import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import prisma from '../config/database';
import {
  getAuthoritySourceConfig,
  inferAuthorityLocaleDefaults,
  listEnabledAuthoritySources,
  type AuthoritySourceConfig,
} from '../config/authority-sources';
import { inferAuthorityStages } from '../utils/authority-stage';
import { buildAuthorityDisplayTags } from '../utils/authority-metadata';
import { isIndexLikeAuthorityUrl, shouldFilterAuthoritySourceUrl } from '../utils/authority-source-url';
import { normalizeWithAuthorityAdapter } from './authority-adapters';
import { detectAudience, detectTopic, sanitizeAuthorityTitle, stripHtml } from './authority-adapters/base.adapter';

export interface DiscoveredAuthorityUrl {
  url: string;
  sourceId: string;
  discoveredAt: string;
  priority: number;
}

export interface AuthorityRawDocument {
  sourceId: string;
  url: string;
  httpStatus: number;
  contentType: string;
  etag?: string;
  lastModified?: string;
  contentHash: string;
  fetchedAt: string;
  rawBody: string;
}

export interface NormalizedAuthorityDocument {
  sourceId: string;
  sourceOrg: string;
  sourceUrl: string;
  sourceLanguage?: 'zh' | 'en';
  sourceLocale?: string;
  title: string;
  updatedAt?: string;
  audience: string;
  topic: string;
  region: string;
  riskLevelDefault: 'green' | 'yellow' | 'red';
  summary: string;
  contentText: string;
  metadataJson: Record<string, unknown>;
  publishStatus: 'draft' | 'review' | 'published' | 'rejected';
}

export interface AuthoritySyncSummary {
  sourceId: string;
  mode: 'full' | 'incremental';
  discovered: number;
  fetched: number;
  normalized: number;
  published: number;
  failed: number;
}

export interface AuthorityReviewDocument {
  id: number | bigint;
  sourceId: string;
  sourceOrg: string;
  sourceUrl: string;
  title: string;
  updatedAt: Date | null;
  audience: string;
  topic: string;
  region: string;
  riskLevelDefault: string;
  publishStatus: string;
  createdAt: Date;
}

export interface ListAuthorityDocumentsOptions {
  publishStatus?: 'draft' | 'review' | 'published' | 'rejected' | 'all';
  sourceId?: string;
  limit?: number;
}

let ensureAuthorityTablesPromise: Promise<void> | null = null;
let lastAuthorityFetchAt = 0;

const AUTHORITY_REQUEST_DELAY_MS = Math.max(0, Number(process.env.AUTHORITY_REQUEST_DELAY_MS || 0));
const AUTHORITY_RETRY_429_LIMIT = Math.max(0, Number(process.env.AUTHORITY_RETRY_429_LIMIT || 0));
const AUTHORITY_RETRY_429_DELAY_MS = Math.max(0, Number(process.env.AUTHORITY_RETRY_429_DELAY_MS || 3000));
const AUTHORITY_FETCH_TIMEOUT_MS = Math.max(5000, Number(process.env.AUTHORITY_FETCH_TIMEOUT_MS || 20000));
const AUTHORITY_CACHE_PATH = path.join(process.cwd(), 'data', 'authority-knowledge-cache.json');
const AUTHORITY_VECTOR_PUBLISH_ENABLED = /^true$/i.test(process.env.AUTHORITY_VECTOR_PUBLISH_ENABLED || '');

function toMysqlDateTime(input?: string | Date | null): string | null {
  if (!input) {
    return null;
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function hashText(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return `${hash}`;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function throttleAuthorityFetch(): Promise<void> {
  if (AUTHORITY_REQUEST_DELAY_MS <= 0) {
    return;
  }

  const elapsed = Date.now() - lastAuthorityFetchAt;
  if (elapsed < AUTHORITY_REQUEST_DELAY_MS) {
    await sleep(AUTHORITY_REQUEST_DELAY_MS - elapsed);
  }
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - Date.now());
}

function isAllowedAuthorityUrl(url: string, source: AuthoritySourceConfig): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return source.allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function isBlockedAuthorityUrl(url: string, source: AuthoritySourceConfig): boolean {
  const normalized = url.toLowerCase();

  const genericBlockedPatterns = [
    /\/login\b/,
    /\/signin\b/,
    /\/sign-in\b/,
    /\/logout\b/,
    /\/register\b/,
    /\/account\b/,
    /\/search\b/,
    /\/tag\b/,
    /\/tags\b/,
    /\/category\b/,
    /\/categories\b/,
    /\/author\b/,
    /\/authors\b/,
    /\/feed\b/,
    /\/rss\b/,
    /\/print\b/,
    /\/download\b/,
    /\.js($|[?#])/,
    /\.css($|[?#])/,
    /\.json($|[?#])/,
    /\?.*(replytocom|output=1)/,
  ];

  if (genericBlockedPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (source.id === 'acog') {
    const acogBlockedPatterns = [
      /\/myacog\//,
      /\/membership/,
      /\/membership-applications\//,
      /\/purchase/,
      /\/speaker-agreement/,
      /\/committee-opinion/,
      /\/clinical-guidance\/committee-opinion/,
    ];
    return acogBlockedPatterns.some((pattern) => pattern.test(normalized));
  }

  if (source.id === 'aap') {
    return /\/english\/news\//.test(normalized);
  }

  if (source.id === 'mayo-clinic-zh') {
    return /\/(?:zh-hans\/)?about-mayo-clinic\//.test(normalized)
      || /\/rochester-construction\//.test(normalized);
  }

  if (source.id === 'msd-manuals-cn') {
    return /\/professional\//.test(normalized)
      || /\/(?:audio|author|biodigital|figure|image|infographic|labtest|quiz|table|video)\//.test(normalized);
  }

  if (source.id === 'dxy-maternal') {
    return /\/(login|register|search|diseases|hospitals|surgerys|vaccines|firstaids)(?:\/|$)/.test(normalized);
  }

  if (source.id === 'chunyu-maternal') {
    return /\/(ask|problem|search|doctors|wx_qr_page|cooperation\/wap\/quick_login)(?:\/|$)/.test(normalized);
  }

  if (source.id === 'youlai-pregnancy-guide') {
    return /\/(customer|cse\/search|doctorasklist|doctorphonelist|doctorregisterlist|super|video|voice|ask|yyk\/docindex)(?:\/|$)/.test(normalized);
  }

  if (source.id === 'familydoctor-maternal') {
    return /^https?:\/\/v\.familydoctor\.com\.cn\//.test(normalized)
      || /\/(ask|yyk|jbk|ypk|doctor|hospital|disease|topic|topics|search|register|login|apps)(?:\/|$)/.test(normalized);
  }

  if (source.id === 'yilianmeiti-maternal-child') {
    return /\/(ask|question|video|audio|zys|zyy|zyp|zjb|zxk|site|search|usercenter)(?:\/|$)/.test(normalized)
      || /^https?:\/\/(?:zys|zyy|zyp|zjb|zxk|usercenter|img01)\.yilianmeiti\.com\//.test(normalized);
  }

  if (source.id === 'ncwch-maternal-child-health') {
    return /\/(?:category|content\/redirect|search)(?:[/?#]|$)/.test(normalized);
  }

  if (source.id === 'mchscn-monitoring') {
    return /\/(?:news|picturenews|textnews|specification|workguide|aboutus|questionnaire|sharedresource|continuingeducation|grassrootsexchanges|releaseofmonitoringresults|preventionandcontroldefects)-\d+\.html(?:$|[?#])/i.test(normalized);
  }

  if (source.id === 'cnsoc-dietary-guidelines') {
    return /\/(?:index\.html|[^/]*newslist_|article\/(?:wyly|gywm|lxwm|2021b)\.html)(?:$|[?#])/i.test(normalized);
  }

  if (source.id === 'chinanutri-maternal-child') {
    return /\/(?:gzdt|dqjs|tzgg_6537|kytd|rcpy|djgz|xxgk)\//i.test(normalized);
  }

  if (source.id === 'nhc-fys' || source.id === 'nhc-rkjt') {
    return /\/video\//.test(normalized) || /\.(mp4|mp3|avi|wmv)($|[?#])/i.test(normalized);
  }

  return false;
}

function isHtmlLikeDocumentUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(html?|shtml|pdf)$/.test(pathname);
  } catch {
    return false;
  }
}

function isAuthorityUrlMatched(url: string, source: AuthoritySourceConfig, anchorText = ''): boolean {
  if (!isAllowedAuthorityUrl(url, source) || isBlockedAuthorityUrl(url, source)) {
    return false;
  }

  if (shouldFilterAuthoritySourceUrl({
    source_id: source.id,
    source_org: source.org,
    source_url: url,
    title: anchorText,
    question: anchorText,
  })) {
    return false;
  }

  const normalized = `${url} ${anchorText}`.toLowerCase();
  if (source.id === 'acog') {
    return /\/(clinical|womens-health|topics)\//.test(normalized);
  }

  if (source.id === 'aap') {
    return /\/english\/(ages-stages|health-issues|healthy-living|safety-prevention|family-life)\//.test(normalized)
      && !/\/english\/pages\//.test(normalized);
  }

  if (source.id === 'mayo-clinic-zh') {
    return /mayoclinic\.org\/zh-hans\//i.test(url)
      && /(pregnan|prenatal|postpartum|birth|labor|delivery|newborn|infant|baby|child|children|breast|feeding|vaccine|immun|fertility|contracept|women)/.test(normalized);
  }

  if (source.id === 'msd-manuals-cn') {
    return /msdmanuals\.cn\/home\//i.test(url)
      && /(pregnan|prenatal|postpartum|birth|labor|delivery|newborn|infant|baby|child|children|breast|feeding|vaccine|immun|fertility|contracept|妇产|孕|婴|儿童|新生儿|母乳|喂养|疫苗)/u.test(normalized);
  }

  if (source.id === 'cdc') {
    return /\/(pregnancy|breastfeeding|parents|child-development|vaccines-(children|pregnancy|for-children)|reproductivehealth|womens-health|contraception|growthcharts|ncbddd|act-early|early-care|protect-children|medicines?-and-pregnancy|opioid-use-during-pregnancy|pregnancy-hiv-std-tb-hepatitis)\//.test(normalized);
  }

  if (source.id === 'who') {
    return /(pregnan|maternal|newborn|infant|child|children|breastfeed|breastfeeding|immuni|vaccin|reproductive|family-planning|contracept|postpartum|antenatal|prenatal|labou?r|birth)/.test(normalized);
  }

  if (source.id === 'dxy-maternal') {
    return /dxy\.com\/article\/\d+\/?(?:$|[?#])/i.test(url)
      && /(备孕|怀孕|孕期|产后|分娩|母乳|喂养|辅食|新生儿|婴儿|婴幼儿|宝宝|儿童|儿科|疫苗|接种|黄疸|发热|腹泻|咳嗽)/.test(normalized);
  }

  if (source.id === 'chunyu-maternal') {
    return /chunyuyisheng\.com\/m\/article\/\d+\/?(?:$|[?#])/i.test(url)
      && /(备孕|怀孕|孕期|产后|分娩|母乳|喂养|辅食|新生儿|婴儿|婴幼儿|宝宝|儿童|儿科|疫苗|接种|黄疸|发热|腹泻|咳嗽|过敏)/.test(normalized);
  }

  if (source.id === 'youlai-pregnancy-guide') {
    return /m\.youlai\.cn\/special\/advisor\/[A-Za-z0-9]+\.html(?:$|[?#])/i.test(url);
  }

  if (source.id === 'familydoctor-maternal') {
    return /familydoctor\.com\.cn\/(?:baby\/)?a\/\d{6}\/\d+\.html(?:$|[?#])/i.test(url)
      && /(备孕|怀孕|孕期|产后|分娩|母乳|喂养|辅食|新生儿|婴儿|婴幼儿|宝宝|儿童|儿科|发热|发烧|腹泻|咳嗽|黄疸|湿疹|疫苗|接种|营养|成长|发育)/.test(normalized);
  }

  if (source.id === 'yilianmeiti-maternal-child') {
    return /yilianmeiti\.com\/article\/\d+\.html(?:$|[?#])/i.test(url)
      && /(备孕|怀孕|孕期|孕早期|孕中期|孕晚期|孕妇|产检|产后|分娩|母乳|哺乳|喂养|辅食|新生儿|婴儿|婴幼儿|宝宝|儿童|孩子|儿科|小儿|发热|发烧|腹泻|呕吐|咳嗽|黄疸|湿疹|疫苗|接种|营养|成长|发育)/.test(normalized);
  }

  if (source.id === 'ncwch-maternal-child-health') {
    return /ncwchnhc\.org\.cn\/content\/content\.html\?id=\d+(?:$|[&#])/i.test(url)
      && /(孕产|孕前|孕期|孕妇|产后|分娩|母乳|哺乳|婴幼儿|新生儿|儿童|妇幼|托育|喂养|营养|体重管理|出生缺陷|科普|指南|指导原则)/.test(normalized);
  }

  if (source.id === 'mchscn-monitoring') {
    return !isIndexLikeAuthorityUrl(url)
      && /mchscn\.cn\/[A-Za-z]+-\d+\/\d+\.html(?:$|[?#])/i.test(url)
      && /(孕产|孕妇|产妇|儿童|出生缺陷|妇幼|监测|防治|表卡|项目数|技术规范|工作指南|通讯|培训)/.test(normalized);
  }

  if (source.id === 'cnsoc-dietary-guidelines') {
    return /dg\.cnsoc\.org\/article\/04\/[^/?#]+\.html(?:$|[?#])/i.test(url)
      && /(婴幼儿|儿童|孕妇|乳母|母乳|喂养|辅食|膳食|营养|指南|核心信息)/.test(normalized);
  }

  if (source.id === 'chinanutri-maternal-child') {
    return !isIndexLikeAuthorityUrl(url)
      && /chinanutri\.cn\/(?:xwzx_238\/xyxw|yyjkzxpt\/yyjkkpzx|jkyy|yyjk)\/\d{6}\/t\d{8}_\d+\.(?:html?|shtml)(?:$|[?#])/i.test(url)
      && /(婴幼儿|新生儿|儿童|孕妇|孕产|乳母|母乳|喂养|辅食|膳食|营养|维生素|生长|发育|五健|健康提示|指南)/.test(normalized);
  }

  if (source.id === 'nhc-fys') {
    return /\/(fys|wjw|wsb|jnr)\//.test(normalized)
      && /(妇幼|孕产|孕妇|母婴|婴幼儿|新生儿|儿童|托育|生育|母乳|哺乳|接种|疫苗|出生|产后)/.test(normalized);
  }

  if (source.id === 'nhc-rkjt') {
    return /\/rkjcyjtfzs\//.test(normalized)
      && /(托育|婴幼儿|新生儿|儿童|育儿|生育|孕产|孕妇|母乳|喂养|照护|家庭发展)/.test(normalized);
  }

  if (source.id === 'chinacdc-immunization') {
    return !isIndexLikeAuthorityUrl(url)
      && isHtmlLikeDocumentUrl(url)
      && /(?:\/t\d{8}_\d+\.(?:html?|shtml)|\.pdf(?:$|[?#]))/i.test(url)
      && /chinacdc\.cn/.test(normalized)
      && /(免疫|疫苗|接种|儿童|婴幼儿|新生儿|孕妇|孕产|母乳|喂养)/.test(normalized);
  }

  if (source.id === 'chinacdc-nutrition') {
    return !isIndexLikeAuthorityUrl(url)
      && isHtmlLikeDocumentUrl(url)
      && /(?:\/t\d{8}_\d+\.(?:html?|shtml)|\.pdf(?:$|[?#]))/i.test(url)
      && /chinacdc\.cn/.test(normalized)
      && /(营养|喂养|母乳|辅食|婴幼儿|新生儿|儿童|孕妇|孕产|乳母|配方奶|膳食)/.test(normalized);
  }

  if (source.id === 'govcn-muying' || source.id === 'govcn-jiedu-muying') {
    return /gov\.cn/.test(normalized)
      && /(生育|母婴|托育|儿童|婴幼儿|新生儿|孕产|妇幼|疫苗|接种|产假|育儿)/.test(normalized);
  }

  if (source.id === 'ndcpa-immunization' || source.id === 'ndcpa-public-health') {
    return !isIndexLikeAuthorityUrl(url)
      && /\/common\/content\/content_\d+\.html(?:$|[?#])/i.test(url)
      && /ndcpa\.gov\.cn/.test(normalized)
      && /(免疫|疫苗|接种|儿童|青少年|婴幼儿|新生儿|孕妇|孕产|妇幼|托育|学校卫生|近视|母乳|喂养|狂犬病|麻疹|风疹|流感|手足口)/.test(normalized);
  }

  return true;
}

function filterAuthorityUrls(urls: string[], source: AuthoritySourceConfig): string[] {
  return urls.filter((url) => {
    return isAuthorityUrlMatched(url, source);
  });
}

function extractSitemapLocUrls(xml: string): string[] {
  const discovered = new Set<string>();

  for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/gi)) {
    const candidate = match[1]?.trim();
    if (candidate) {
      discovered.add(candidate);
    }
  }

  return Array.from(discovered);
}

function getAuthorityUrlRelevanceScore(url: string, source: AuthoritySourceConfig): number {
  const normalized = url.toLowerCase();
  let score = 0;

  if (source.language === 'zh') {
    score += 5;
  }

  if (/(pregnan|prenatal|postpartum|birth|labor|delivery|newborn|infant|baby|toddler|child|children|breast|feeding|vaccine|immun|fertility|contracept|妇产|孕|婴|儿童|新生儿|母乳|喂养|疫苗)/u.test(normalized)) {
    score += 20;
  }

  if (source.id === 'mayo-clinic-zh') {
    if (/\/zh-hans\//.test(normalized)) {
      score += 25;
    }

    if (/\/(healthy-lifestyle|diseases-conditions|tests-procedures|drugs-supplements)\//.test(normalized)) {
      score += 60;
    }

    if (/\/(in-depth|art-\d+|symptoms-causes|diagnosis-treatment|expert-answers)\b/.test(normalized)) {
      score += 70;
    }

    if (/(newborn|infant|baby|toddler|child|children|pediatric|paediatric|breast|feeding|vaccine|immun)/.test(normalized)) {
      score += 75;
    }

    if (/(pregnan|prenatal|postpartum|labor|delivery|birth|fertility|contracept|women)/.test(normalized)) {
      score += 65;
    }

    if (/\/departments-centers\//.test(normalized)) {
      score -= 120;
    }

    if (/\/overview(?:\/|$)/.test(normalized)) {
      score -= 40;
    }

    if (/\/specialty-groups\//.test(normalized)) {
      score -= 60;
    }

    if (/(patient-visitor-guide|appointments|medical-professionals|international-patient|research|education|giving-to-mayo-clinic)/.test(normalized)) {
      score -= 120;
    }
  }

  if (source.id === 'msd-manuals-cn') {
    if (/\/sitemaps\/home-topic\.xml(?:\.gz)?$/i.test(normalized)) {
      score += 140;
    }

    if (/\/sitemaps\/home-generic-pages\.xml(?:\.gz)?$/i.test(normalized)) {
      score += 120;
    }

    if (/\/home\//.test(normalized)) {
      score += 40;
    }

    if (/(children-s-health-issues|symptoms-in-infants-and-children|women-s-health-issues|pregnancy-and-childbirth|newborn|infant|child|children|breast|feeding|vaccine|immun)/.test(normalized)) {
      score += 90;
    }

    if (/\/professional\//.test(normalized)) {
      score -= 120;
    }
  }

  if (source.id === 'chinacdc-immunization' || source.id === 'chinacdc-nutrition') {
    if (/\/t\d{8}_\d+\.(?:html?|shtml)(?:$|[?#])/i.test(normalized)) {
      score += 80;
    }

    if (/(免疫|疫苗|接种|儿童|婴幼儿|新生儿|孕妇|孕产|母乳|喂养|营养|辅食)/u.test(normalized)) {
      score += 60;
    }
  }

  if (source.id === 'nhc-fys' || source.id === 'nhc-rkjt' || source.id.startsWith('ndcpa-')) {
    if (/(妇幼|孕产|孕妇|母婴|婴幼儿|新生儿|儿童|托育|生育|母乳|哺乳|接种|疫苗|照护|家庭发展)/u.test(normalized)) {
      score += 60;
    }
  }

  return score;
}

function prioritizeAuthorityUrls(urls: string[], source: AuthoritySourceConfig): string[] {
  return Array.from(new Set(urls))
    .map((url, index) => ({
      url,
      index,
      score: getAuthorityUrlRelevanceScore(url, source),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.url);
}

function extractSitemapUrls(xml: string, source: AuthoritySourceConfig): string[] {
  return prioritizeAuthorityUrls(
    filterAuthorityUrls(extractSitemapLocUrls(xml), source),
    source,
  );
}

function looksLikeSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

function isXmlSitemapUrl(url: string): boolean {
  return /\.xml(\.gz)?($|[?#])/i.test(url) || /sitemap/i.test(url) || /\.gz($|[?#])/i.test(url);
}

function filterNestedSitemapCandidates(urls: string[], source: AuthoritySourceConfig): string[] {
  let filtered = urls.filter((url) => isAllowedAuthorityUrl(url, source));

  if (source.id === 'cdc') {
    filtered = filtered.filter((url) => /\/(pregnancy|breastfeeding|parents|child-development|vaccines-(children|pregnancy|for-children)|reproductivehealth|womens-health|contraception|growthcharts|ncbddd|act-early|early-care|protect-children|medicines?-and-pregnancy|opioid-use-during-pregnancy|pregnancy-hiv-std-tb-hepatitis|rsv|flu|measles|mumps|rubella|chickenpox|rotavirus|pinkbook|acip-recs)\//i.test(url));
  }

  if (source.id === 'msd-manuals-cn') {
    filtered = filtered.filter((url) => /\/home-(?:generic-pages|topic)\.xml(?:\.gz)?$/i.test(url));
  }

  return prioritizeAuthorityUrls(filtered, source);
}

function buildAuthorityUrlCandidate(rawUrl: string, pageUrl: string): string | null {
  const trimmed = rawUrl
    .trim()
    .replace(/&amp;/gi, '&');
  if (!trimmed || /^javascript:/i.test(trimmed) || /^mailto:/i.test(trimmed) || trimmed.startsWith('#')) {
    return null;
  }

  try {
    const resolved = new URL(trimmed, pageUrl);
    resolved.hash = '';
    return resolved.toString();
  } catch {
    return null;
  }
}

function extractEmbeddedIndexLinks(html: string, source: AuthoritySourceConfig, pageUrl: string): Array<{ url: string; text: string }> {
  if (!source.id.startsWith('ndcpa-')) {
    return [];
  }

  const items: Array<{ url: string; text: string }> = [];
  const pattern = /"aT":"([\s\S]*?)"[\s\S]{0,800}?"aU":"\{\\"common\\":\\"([\s\S]*?)\\"\}"/g;

  for (const match of html.matchAll(pattern)) {
    const title = stripHtml((match[1] || '').replace(/\\"/g, '"')).slice(0, 200);
    const rawUrl = (match[2] || '').replace(/\\\//g, '/').replace(/\\"/g, '"');
    const url = buildAuthorityUrlCandidate(rawUrl, pageUrl);
    if (!url) {
      continue;
    }

    items.push({ url, text: title });
  }

  return items;
}

function extractDxyIndexLinks(html: string, source: AuthoritySourceConfig): Array<{ url: string; text: string }> {
  if (source.id !== 'dxy-maternal') {
    return [];
  }

  const match = html.match(/window\.\$\$data\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i);
  if (!match?.[1]) {
    return [];
  }

  try {
    const payload = JSON.parse(match[1]) as {
      list?: {
        items?: Array<{
          id?: number | string;
          title?: string;
          content_brief?: string;
        }>;
      };
    };

    return (payload.list?.items || [])
      .map((item) => {
        const id = typeof item.id === 'number' || typeof item.id === 'string'
          ? `${item.id}`.trim()
          : '';
        if (!/^\d+$/u.test(id)) {
          return null;
        }

        return {
          url: `https://dxy.com/article/${id}`,
          text: `${item.title || ''} ${item.content_brief || ''}`.trim(),
        };
      })
      .filter((item): item is { url: string; text: string } => Boolean(item));
  } catch {
    return [];
  }
}

function extractIndexLinks(html: string, source: AuthoritySourceConfig, pageUrl: string): string[] {
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => ({
      href: match[1]?.trim() || '',
      text: stripHtml(match[2] || '').slice(0, 120),
    }))
    .filter((item) => Boolean(item.href))
    .map((item) => {
      const url = buildAuthorityUrlCandidate(item.href, pageUrl);
      if (!url) {
        return null;
      }

      return {
        url,
        text: item.text,
      };
    })
    .filter((item): item is { url: string; text: string } => Boolean(item));

  const candidates = [
    ...links,
    ...extractEmbeddedIndexLinks(html, source, pageUrl),
    ...extractDxyIndexLinks(html, source),
  ];
  const discovered = new Map<string, string>();

  for (const item of candidates) {
    if (isAuthorityUrlMatched(item.url, source, item.text)) {
      discovered.set(item.url, item.text);
    }
  }

  return Array.from(discovered.keys());
}

function isPaginationAnchorText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return /^(?:上一页|下一页|上页|下页|首页|尾页|next|prev(?:ious)?|more|更多|\d{1,3}|(?:\d{1,2}\s*周))$/i.test(normalized);
}

function isPaginationLikeUrl(url: string, _currentPageUrl?: string): boolean {
  try {
    const candidate = new URL(url);
    const searchKeys = ['page', 'p', 'pn', 'pageNo', 'pageNO', 'pageno', 'currentPage', 'curpage', 'curPage'];

    if (searchKeys.some((key) => candidate.searchParams.has(key))) {
      return true;
    }

    return /(?:^|\/)(?:list|index|new_index)(?:[_-]\d+)?\.(?:html?|shtml)$/i.test(candidate.pathname)
      || /(?:^|\/)(?:page|p)\/\d+(?:\/|$)/i.test(candidate.pathname)
      || /(?:^|[/?=&_-])page(?:[=/_-]|\D*\b)\d+/i.test(candidate.toString());
  } catch {
    return false;
  }
}

function extractPaginationLinks(html: string, source: AuthoritySourceConfig, pageUrl: string): string[] {
  const discovered = new Set<string>();

  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const rawHref = match[1]?.trim() || '';
    const text = stripHtml(match[2] || '').slice(0, 80);
    const url = buildAuthorityUrlCandidate(rawHref, pageUrl);
    if (!url || url === pageUrl) {
      continue;
    }

    if (!isAllowedAuthorityUrl(url, source) || isBlockedAuthorityUrl(url, source)) {
      continue;
    }

    const allowContentPagination = source.id === 'youlai-pregnancy-guide'
      && /\/special\/advisor\/[A-Za-z0-9]+\.html(?:$|[?#])/i.test(url);

    if (!allowContentPagination && !isIndexLikeAuthorityUrl(url)) {
      continue;
    }

    if (!isPaginationAnchorText(text) && !isPaginationLikeUrl(url, pageUrl)) {
      continue;
    }

    discovered.add(url);
  }

  return Array.from(discovered);
}

function extractApiLinks(payload: unknown, source: AuthoritySourceConfig): string[] {
  const discovered = new Map<string, string>();

  function walk(node: unknown) {
    if (!node) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (typeof node !== 'object') {
      return;
    }

    const record = node as Record<string, unknown>;
    const urlValue = [record.URL, record.url, record.link, record.href]
      .find((value) => typeof value === 'string' && value.trim()) as string | undefined;
    const titleValue = [record.TITLE, record.title, record.name]
      .find((value) => typeof value === 'string' && value.trim()) as string | undefined;

    if (urlValue) {
      try {
        const absoluteUrl = new URL(urlValue, source.baseUrl).toString();
        if (isAuthorityUrlMatched(absoluteUrl, source, titleValue || '')) {
          discovered.set(absoluteUrl, titleValue || '');
        }
      } catch {
        // ignore invalid URLs
      }
    }

    Object.values(record).forEach(walk);
  }

  walk(payload);
  return Array.from(discovered.keys());
}

async function fetchText(url: string, headers?: Record<string, string>): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    await throttleAuthorityFetch();
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(AUTHORITY_FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          ...headers,
        },
      });
    } catch (error) {
      const errName = (error as { name?: string }).name;
      const errCode = (error as { code?: string }).code;
      const isTransient = errName === 'TimeoutError' || errName === 'AbortError'
        || errCode === 'ECONNRESET' || errCode === 'ETIMEDOUT' || errCode === 'ECONNREFUSED'
        || errCode === 'UND_ERR_CONNECT_TIMEOUT';
      if (isTransient && attempt < 2) {
        await sleep(AUTHORITY_RETRY_429_DELAY_MS * (attempt + 1));
        continue;
      }
      if (errName === 'TimeoutError' || errName === 'AbortError') {
        throw new Error(`Authority fetch timed out after ${AUTHORITY_FETCH_TIMEOUT_MS}ms: ${url}`);
      }
      throw error;
    }
    lastAuthorityFetchAt = Date.now();

    if (response.status >= 500 && attempt < 2) {
      await sleep(AUTHORITY_RETRY_429_DELAY_MS * (attempt + 1));
      continue;
    }

    if (response.status !== 429 || attempt >= AUTHORITY_RETRY_429_LIMIT) {
      return response;
    }

    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    const delayMs = retryAfterMs ?? (AUTHORITY_RETRY_429_DELAY_MS * (attempt + 1));
    await sleep(delayMs);
  }
}

async function readResponseArrayBuffer(response: Response, url: string): Promise<ArrayBuffer> {
  let timeoutId: NodeJS.Timeout | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      void response.body?.cancel().catch(() => {
        // Ignore body cancellation errors; the sync caller will handle timeout.
      });
      reject(new Error(`Authority response body timed out after ${AUTHORITY_FETCH_TIMEOUT_MS}ms: ${url}`));
    }, AUTHORITY_FETCH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      response.arrayBuffer(),
      timeout,
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function detectResponseCharset(response: Response, buffer: Buffer): string {
  const contentType = response.headers.get('content-type') || '';
  const headerCharset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase();
  if (headerCharset) {
    return headerCharset;
  }

  if (buffer.length >= 2) {
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      return 'utf-16le';
    }
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      return 'utf-16be';
    }
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 128));
  const hasUtf16NullPattern = sample.some((byte, index) => index % 2 === 1 && byte === 0);
  if (hasUtf16NullPattern) {
    return 'utf-16le';
  }

  // Sniff HTML <meta charset> / <meta http-equiv="Content-Type"> for Chinese sites
  // that declare encoding only in the document body (common with GBK/GB2312 pages).
  const headSnippet = buffer.subarray(0, Math.min(buffer.length, 2048)).toString('latin1');
  const metaCharsetMatch = headSnippet.match(/<meta[^>]+charset=["']?([^"';\s>]+)/i);
  if (metaCharsetMatch) {
    const meta = metaCharsetMatch[1].toLowerCase();
    // Normalize gb2312 → gbk since Node TextDecoder supports gbk but treats gb2312 identically
    if (meta === 'gb2312') return 'gbk';
    return meta;
  }

  return 'utf-8';
}

async function readResponseText(response: Response, url: string): Promise<string> {
  const arrayBuffer = await readResponseArrayBuffer(response, url);
  let buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || '';
  const contentEncoding = response.headers.get('content-encoding') || '';

  if (/\.gz($|[?#])/i.test(url) || /gzip/i.test(contentEncoding) || /gzip|x-gzip/i.test(contentType)) {
    try {
      buffer = zlib.gunzipSync(buffer);
    } catch {
      // Some endpoints expose .gz in the URL but return plain XML.
    }
  }

  const charset = detectResponseCharset(response, buffer);
  try {
    const decoder = new TextDecoder(charset);
    return decoder.decode(buffer);
  } catch {
    return buffer.toString('utf-8');
  }
}

export async function ensureAuthoritySyncTables(): Promise<void> {
  if (!ensureAuthorityTablesPromise) {
    ensureAuthorityTablesPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS authority_discovered_urls (
          id BIGINT NOT NULL AUTO_INCREMENT,
          source_id VARCHAR(64) NOT NULL,
          url VARCHAR(1000) NOT NULL,
          discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          priority INT NOT NULL DEFAULT 100,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          PRIMARY KEY (id),
          UNIQUE KEY uniq_authority_discovered_url (source_id, url(255)),
          KEY idx_authority_discovered_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS authority_raw_documents (
          id BIGINT NOT NULL AUTO_INCREMENT,
          source_id VARCHAR(64) NOT NULL,
          url VARCHAR(1000) NOT NULL,
          http_status INT NOT NULL,
          content_type VARCHAR(120) NOT NULL,
          etag VARCHAR(255) NULL,
          last_modified VARCHAR(255) NULL,
          content_hash VARCHAR(128) NOT NULL,
          fetched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          raw_body LONGTEXT NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uniq_authority_raw_url (source_id, url(255), content_hash),
          KEY idx_authority_raw_fetched (fetched_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS authority_normalized_documents (
          id BIGINT NOT NULL AUTO_INCREMENT,
          source_id VARCHAR(64) NOT NULL,
          source_org VARCHAR(120) NOT NULL,
          source_url VARCHAR(1000) NOT NULL,
          title VARCHAR(500) NOT NULL,
          updated_at DATETIME NULL,
          audience VARCHAR(120) NOT NULL,
          topic VARCHAR(120) NOT NULL,
          region VARCHAR(20) NOT NULL,
          risk_level_default VARCHAR(20) NOT NULL,
          summary TEXT NOT NULL,
          content_text LONGTEXT NOT NULL,
          metadata_json LONGTEXT NULL,
          publish_status VARCHAR(20) NOT NULL DEFAULT 'draft',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uniq_authority_normalized_url (source_id, source_url(255))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    })();
  }

  return ensureAuthorityTablesPromise;
}

export async function discoverAuthorityUrls(
  source: AuthoritySourceConfig,
  mode: 'full' | 'incremental',
): Promise<DiscoveredAuthorityUrl[]> {
  const discovered = new Map<string, DiscoveredAuthorityUrl>();

  async function collectSitemapPageUrls(urls: string[], depth = 0): Promise<string[]> {
    if (depth > 2 || urls.length === 0) {
      return [];
    }

    const pageUrls: string[] = [];
    for (const url of urls) {
      if (pageUrls.length >= source.maxPagesPerRun) {
        break;
      }

      const response = await fetchText(url);
      if (!response.ok) {
        continue;
      }

      const text = await readResponseText(response, url);
      const locUrls = extractSitemapLocUrls(text);
      if (locUrls.length === 0) {
        continue;
      }

      if (looksLikeSitemapIndex(text)) {
        const nestedCandidates = filterNestedSitemapCandidates(
          locUrls
            .filter((candidate) => isXmlSitemapUrl(candidate)),
          source,
        );
        const nestedUrls = await collectSitemapPageUrls(
          nestedCandidates.slice(0, source.maxPagesPerRun - pageUrls.length),
          depth + 1,
        );
        pageUrls.push(...nestedUrls);
        continue;
      }

      pageUrls.push(
        ...extractSitemapUrls(text, source)
          .filter((candidate) => !isXmlSitemapUrl(candidate))
          .slice(0, source.maxPagesPerRun - pageUrls.length)
      );
    }

    return pageUrls.slice(0, source.maxPagesPerRun);
  }

  async function collectIndexPageUrls(urls: string[]): Promise<string[]> {
    const pageUrls: string[] = [];
    const visited = new Set<string>();
    const queue = [...urls];
    const maxIndexPages = Math.max(1, source.maxDiscoveryIndexPages || 3);

    while (queue.length > 0 && visited.size < maxIndexPages && pageUrls.length < source.maxPagesPerRun) {
      const currentUrl = queue.shift();
      if (!currentUrl || visited.has(currentUrl)) {
        continue;
      }
      visited.add(currentUrl);

      const response = await fetchText(currentUrl);
      if (!response.ok) {
        continue;
      }

      const text = await readResponseText(response, currentUrl);

      if (isAuthorityUrlMatched(currentUrl, source) && !pageUrls.includes(currentUrl)) {
        pageUrls.push(currentUrl);
        if (pageUrls.length >= source.maxPagesPerRun) {
          break;
        }
      }

      const articleCandidates = extractIndexLinks(text, source, currentUrl);
      for (const articleUrl of articleCandidates) {
        if (!pageUrls.includes(articleUrl)) {
          pageUrls.push(articleUrl);
        }
        if (pageUrls.length >= source.maxPagesPerRun) {
          break;
        }
      }

      if (pageUrls.length >= source.maxPagesPerRun) {
        break;
      }

      const paginationCandidates = extractPaginationLinks(text, source, currentUrl);
      for (const paginationUrl of paginationCandidates) {
        if (!visited.has(paginationUrl) && !queue.includes(paginationUrl)) {
          queue.push(paginationUrl);
        }
      }
    }

    return pageUrls.slice(0, source.maxPagesPerRun);
  }

  for (const entryUrl of source.entryUrls) {
    const normalizedCandidates: string[] = [];

    if (source.discoveryType === 'sitemap') {
      normalizedCandidates.push(...await collectSitemapPageUrls([entryUrl]));
    } else if (source.discoveryType === 'api') {
      const response = await fetchText(entryUrl, { Accept: 'application/json,text/plain,*/*' });
      if (!response.ok) {
        continue;
      }

      const text = await readResponseText(response, entryUrl);
      try {
        const parsed = JSON.parse(text);
        normalizedCandidates.push(...extractApiLinks(parsed, source));
      } catch {
        continue;
      }
    } else {
      normalizedCandidates.push(...await collectIndexPageUrls([entryUrl]));
    }

    for (const url of prioritizeAuthorityUrls(normalizedCandidates, source).slice(0, source.maxPagesPerRun)) {
      if (!discovered.has(url)) {
        discovered.set(url, {
          url,
          sourceId: source.id,
          discoveredAt: new Date().toISOString(),
          priority: mode === 'full' ? 100 : 80,
        });
      }
    }
  }

  return Array.from(discovered.values()).slice(0, source.maxPagesPerRun);
}

export const __authoritySyncTestUtils = {
  buildAuthorityUrlCandidate,
  extractEmbeddedIndexLinks,
  extractIndexLinks,
  extractPaginationLinks,
  extractSitemapLocUrls,
  extractSitemapUrls,
  filterNestedSitemapCandidates,
  getAuthorityUrlRelevanceScore,
  isAuthorityUrlMatched,
  isIndexLikeAuthorityUrl,
  prioritizeAuthorityUrls,
};

export async function persistDiscoveredAuthorityUrls(urls: DiscoveredAuthorityUrl[]): Promise<void> {
  if (urls.length === 0) {
    return;
  }

  await ensureAuthoritySyncTables();

  for (const item of urls) {
    await prisma.$executeRawUnsafe(
      `INSERT IGNORE INTO authority_discovered_urls (source_id, url, discovered_at, priority, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      item.sourceId,
      item.url,
      toMysqlDateTime(item.discoveredAt),
      item.priority,
    );
  }
}

export async function fetchAuthorityDocument(source: AuthoritySourceConfig, url: string): Promise<AuthorityRawDocument | null> {
  const response = await fetchText(url);
  const rawBody = await readResponseText(response, url);
  const contentType = response.headers.get('content-type') || 'text/html';
  const raw: AuthorityRawDocument = {
    sourceId: source.id,
    url,
    httpStatus: response.status,
    contentType,
    etag: response.headers.get('etag') || undefined,
    lastModified: response.headers.get('last-modified') || undefined,
    contentHash: hashText(rawBody),
    fetchedAt: new Date().toISOString(),
    rawBody,
  };

  await prisma.$executeRawUnsafe(
    `INSERT IGNORE INTO authority_raw_documents
     (source_id, url, http_status, content_type, etag, last_modified, content_hash, fetched_at, raw_body)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    raw.sourceId,
    raw.url,
    raw.httpStatus,
    raw.contentType,
    raw.etag || null,
    raw.lastModified || null,
    raw.contentHash,
    toMysqlDateTime(raw.fetchedAt),
    raw.rawBody,
  );

  return raw;
}

export function normalizeAuthorityDocument(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
  return normalizeWithAuthorityAdapter(source, raw);
}

export async function persistNormalizedAuthorityDocument(document: NormalizedAuthorityDocument): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO authority_normalized_documents
     (source_id, source_org, source_url, title, updated_at, audience, topic, region, risk_level_default, summary, content_text, metadata_json, publish_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       source_org = VALUES(source_org),
       title = VALUES(title),
       updated_at = VALUES(updated_at),
       audience = VALUES(audience),
       topic = VALUES(topic),
       region = VALUES(region),
       risk_level_default = VALUES(risk_level_default),
       summary = VALUES(summary),
       content_text = VALUES(content_text),
       metadata_json = VALUES(metadata_json),
       publish_status = CASE
         WHEN publish_status IN ('published', 'rejected') THEN publish_status
         ELSE VALUES(publish_status)
       END`,
    document.sourceId,
    document.sourceOrg,
    document.sourceUrl,
    document.title,
    toMysqlDateTime(document.updatedAt),
    document.audience,
    document.topic,
    document.region,
    document.riskLevelDefault,
    document.summary,
    document.contentText,
    JSON.stringify(document.metadataJson),
    document.publishStatus,
  );
}

export async function listAuthorityDocuments(
  options: ListAuthorityDocumentsOptions = {},
): Promise<AuthorityReviewDocument[]> {
  await ensureAuthoritySyncTables();
  const limit = Math.max(1, Math.min(options.limit || 20, 200));
  const whereClauses: string[] = [];
  const params: Array<string> = [];

  if (options.publishStatus && options.publishStatus !== 'all') {
    whereClauses.push('publish_status = ?');
    params.push(options.publishStatus);
  }

  if (options.sourceId) {
    whereClauses.push('source_id = ?');
    params.push(options.sourceId);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  return prisma.$queryRawUnsafe<AuthorityReviewDocument[]>(
    `SELECT
      id,
      source_id AS sourceId,
      source_org AS sourceOrg,
      source_url AS sourceUrl,
      title,
      updated_at AS updatedAt,
      audience,
      topic,
      region,
      risk_level_default AS riskLevelDefault,
      publish_status AS publishStatus,
      created_at AS createdAt
     FROM authority_normalized_documents
     ${whereSql}
     ORDER BY updated_at DESC, id DESC
     LIMIT ${limit}`,
    ...params,
  );
}

export async function updateAuthorityDocumentPublishStatus(
  ids: number[],
  publishStatus: 'published' | 'rejected',
): Promise<number> {
  await ensureAuthoritySyncTables();
  const normalizedIds = Array.from(new Set(ids))
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (normalizedIds.length === 0) {
    return 0;
  }

  const placeholders = normalizedIds.map(() => '?').join(', ');
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE authority_normalized_documents
     SET publish_status = ?
     WHERE id IN (${placeholders})`,
    publishStatus,
    ...normalizedIds,
  );

  if (updated > 0) {
    await exportPublishedAuthoritySnapshot();
  }

  return Number(updated);
}

export async function syncAuthoritySource(
  sourceId: string,
  mode: 'full' | 'incremental' = 'incremental',
): Promise<AuthoritySyncSummary> {
  await ensureAuthoritySyncTables();
  const source = getAuthoritySourceConfig(sourceId);
  if (!source || !source.enabled) {
    throw new Error(`Authority source not enabled: ${sourceId}`);
  }

  const summary: AuthoritySyncSummary = {
    sourceId,
    mode,
    discovered: 0,
    fetched: 0,
    normalized: 0,
    published: 0,
    failed: 0,
  };

  const discoveredUrls = await discoverAuthorityUrls(source, mode);
  summary.discovered = discoveredUrls.length;
  await persistDiscoveredAuthorityUrls(discoveredUrls);

  for (const discovered of discoveredUrls) {
    try {
      const raw = await fetchAuthorityDocument(source, discovered.url);
      if (!raw || raw.httpStatus >= 400) {
        summary.failed += 1;
        continue;
      }
      summary.fetched += 1;

      const normalized = normalizeAuthorityDocument(source, raw);
      if (!normalized) {
        summary.failed += 1;
        continue;
      }

      await persistNormalizedAuthorityDocument(normalized);
      summary.normalized += 1;
      if (normalized.publishStatus === 'published' || normalized.publishStatus === 'review') {
        summary.published += 1;
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`[Authority Sync] Failed: ${source.id} -> ${discovered.url}`, error);
    }
  }

  await exportPublishedAuthoritySnapshot();

  return summary;
}

export async function syncAllAuthoritySources(
  mode: 'full' | 'incremental' = 'incremental',
): Promise<AuthoritySyncSummary[]> {
  const summaries: AuthoritySyncSummary[] = [];
  for (const source of listEnabledAuthoritySources()) {
    summaries.push(await syncAuthoritySource(source.id, mode));
  }
  return summaries;
}

export function shouldExportAuthoritySnapshotDocument(document: Pick<NormalizedAuthorityDocument, 'publishStatus' | 'riskLevelDefault'>): boolean {
  if (document.publishStatus === 'published') {
    return true;
  }

  // Existing yellow-risk records may already be parked in review from the old
  // publication rule. Export them now, while red emergency content stays gated.
  return document.publishStatus === 'review' && document.riskLevelDefault !== 'red';
}

export async function exportPublishedAuthoritySnapshot(): Promise<void> {
  await ensureAuthoritySyncTables();
  const rows = await prisma.$queryRawUnsafe<Array<{
    sourceId: string;
    sourceOrg: string;
    sourceUrl: string;
    title: string;
    updatedAt: Date | null;
    createdAt: Date;
    audience: string;
    topic: string;
    region: string;
    riskLevelDefault: string;
    summary: string;
    contentText: string;
    metadataJson: string | null;
    publishStatus: string;
  }>>(
    `SELECT
      source_id AS sourceId,
      source_org AS sourceOrg,
      source_url AS sourceUrl,
      title,
      updated_at AS updatedAt,
      created_at AS createdAt,
      audience,
      topic,
      region,
      risk_level_default AS riskLevelDefault,
      summary,
      content_text AS contentText,
      metadata_json AS metadataJson,
      publish_status AS publishStatus
     FROM authority_normalized_documents
     WHERE publish_status IN ('published', 'review')
     ORDER BY COALESCE(updated_at, created_at) DESC, id DESC`
  );

  const exportableRows = rows.filter((row) => shouldExportAuthoritySnapshotDocument({
    publishStatus: row.publishStatus as NormalizedAuthorityDocument['publishStatus'],
    riskLevelDefault: row.riskLevelDefault as NormalizedAuthorityDocument['riskLevelDefault'],
  }));

  const payload = exportableRows.map((row, index) => {
    const cleanedTitle = sanitizeAuthorityTitle(row.title);
    const localeDefaults = inferAuthorityLocaleDefaults(row.sourceId, row.region);
    const metadata = row.metadataJson ? JSON.parse(row.metadataJson) : {};
    const stableDate = row.updatedAt || row.createdAt;
    const inferredAudience = detectAudience({
      sourceUrl: row.sourceUrl,
      title: cleanedTitle,
      summary: row.summary,
      contentText: row.contentText,
    }, getAuthoritySourceConfig(row.sourceId) || {
      id: row.sourceId,
      org: row.sourceOrg,
      baseUrl: row.sourceUrl,
      allowedDomains: [],
      discoveryType: 'index_page',
      entryUrls: [],
      region: row.region as 'US' | 'UK' | 'CN' | 'GLOBAL',
      language: localeDefaults.sourceLanguage,
      locale: localeDefaults.sourceLocale,
      audience: [row.audience || '母婴家庭'],
      topics: [row.topic || 'general'],
      enabled: true,
      fetchIntervalMinutes: 360,
      maxPagesPerRun: 1,
      parserId: row.sourceId,
    });
    const inferredTopic = detectTopic({
      sourceUrl: row.sourceUrl,
      title: cleanedTitle,
      summary: row.summary,
      contentText: row.contentText,
    }, getAuthoritySourceConfig(row.sourceId) || {
      id: row.sourceId,
      org: row.sourceOrg,
      baseUrl: row.sourceUrl,
      allowedDomains: [],
      discoveryType: 'index_page',
      entryUrls: [],
      region: row.region as 'US' | 'UK' | 'CN' | 'GLOBAL',
      language: localeDefaults.sourceLanguage,
      locale: localeDefaults.sourceLocale,
      audience: [row.audience || '母婴家庭'],
      topics: [row.topic || 'general'],
      enabled: true,
      fetchIntervalMinutes: 360,
      maxPagesPerRun: 1,
      parserId: row.sourceId,
    });
    const targetStages = inferAuthorityStages({
      title: cleanedTitle,
      summary: row.summary,
      contentText: row.contentText,
      audience: inferredAudience,
      topic: inferredTopic,
    });

    return {
      id: `authority-${row.sourceId}-${index + 1}`,
      source_id: row.sourceId,
      source_class: typeof (metadata as { sourceClass?: unknown }).sourceClass === 'string'
        ? (metadata as { sourceClass: 'official' | 'medical_platform' | 'dataset' | 'unknown' }).sourceClass
        : 'official',
      content_type: 'authority',
      question: cleanedTitle,
      answer: row.contentText,
      summary: row.summary,
      category: inferredTopic,
      tags: buildAuthorityDisplayTags({
        topic: inferredTopic,
        audience: inferredAudience,
        sourceOrg: row.sourceOrg,
      }),
      target_stage: targetStages,
      difficulty: 'authoritative',
      read_time: Math.max(1, Math.ceil((row.contentText || '').length / 600)),
      author: {
        name: row.sourceOrg,
        title: 'Authority Source',
      },
      is_verified: true,
      status: 'published',
      view_count: 0,
      like_count: 0,
      created_at: row.createdAt.toISOString(),
      updated_at: stableDate.toISOString(),
      published_at: stableDate.toISOString(),
      source: row.sourceOrg,
      source_org: row.sourceOrg,
      source_url: row.sourceUrl,
      source_language: localeDefaults.sourceLanguage,
      source_locale: localeDefaults.sourceLocale,
      source_updated_at: stableDate.toISOString(),
      last_synced_at: typeof (metadata as { fetchedAt?: unknown }).fetchedAt === 'string'
        ? (metadata as { fetchedAt: string }).fetchedAt
        : row.createdAt.toISOString(),
      url: row.sourceUrl,
      audience: inferredAudience,
      topic: inferredTopic,
      risk_level_default: row.riskLevelDefault,
      region: row.region,
      original_id: row.sourceUrl,
      metadata: {
        ...metadata,
        sourceId: row.sourceId,
        sourceClass: typeof (metadata as { sourceClass?: unknown }).sourceClass === 'string'
          ? (metadata as { sourceClass: 'official' | 'medical_platform' | 'dataset' | 'unknown' }).sourceClass
          : 'official',
        sourceLanguage: localeDefaults.sourceLanguage,
        sourceLocale: localeDefaults.sourceLocale,
        targetStages,
      },
    };
  });

  fs.mkdirSync(path.dirname(AUTHORITY_CACHE_PATH), { recursive: true });
  fs.writeFileSync(AUTHORITY_CACHE_PATH, JSON.stringify(payload, null, 2), 'utf-8');

  if (!AUTHORITY_VECTOR_PUBLISH_ENABLED) {
    console.log('[Authority Sync] AUTHORITY_VECTOR_PUBLISH_ENABLED=false，已跳过向量发布');
    return;
  }

  try {
    const { publishAuthorityDocumentsToVectorStore } = await import('./vector.service.js');
    const vectorResult = await publishAuthorityDocumentsToVectorStore(payload.map((item) => ({
      sourceUrl: item.source_url || item.url || item.original_id,
      title: item.question,
      contentText: item.answer,
      topic: item.topic || item.category,
      category: item.category,
      sourceOrg: item.source_org || item.source,
      sourceClass: item.source_class,
      authoritative: item.is_verified,
    })));
    console.log(`[Authority Sync] 向量发布完成: published=${vectorResult.published}, skipped=${vectorResult.skipped}`);
  } catch (error) {
    const moduleError = error as { code?: string; message?: string };
    if (moduleError.code === 'MODULE_NOT_FOUND' && moduleError.message?.includes('@zilliz/milvus2-sdk-node')) {
      console.warn('[Authority Sync] 未安装 Milvus SDK，已跳过向量发布');
      return;
    }

    console.error('[Authority Sync] 权威文档向量发布失败:', error);
  }
}
