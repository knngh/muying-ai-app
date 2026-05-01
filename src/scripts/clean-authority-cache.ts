import '../config/env';
import fs from 'fs';
import path from 'path';
import { getAuthoritySourceConfig, inferAuthorityLocaleDefaults, type AuthoritySourceConfig } from '../config/authority-sources';
import {
  containsDeathRelatedTerms,
  detectAudience,
  detectTopic,
  isHighRiskOrClickbaitTitle,
  isLikelyEnglishNavigationShell,
  sanitizeAuthorityTitle,
} from '../services/authority-adapters/base.adapter';
import { buildAuthorityDisplayTags } from '../utils/authority-metadata';
import { inferAuthorityStages } from '../utils/authority-stage';
import { shouldFilterAuthoritySourceUrl } from '../utils/authority-source-url';

interface AuthorityCacheRecord {
  id?: string;
  original_id?: string;
  question?: string;
  title?: string;
  source?: string;
  source_org?: string;
  source_id?: string;
  source_url?: string;
  url?: string;
  answer?: string;
  summary?: string;
  category?: string;
  tags?: string[];
  target_stage?: string[];
  topic?: string;
  audience?: string;
  region?: string;
  source_language?: 'zh' | 'en';
  source_locale?: string;
  source_updated_at?: string;
  published_at?: string;
  updated_at?: string;
  created_at?: string;
}

type WorkingRecord = AuthorityCacheRecord & { __index: number };

const INPUT_FILE = process.env.INPUT_FILE || path.join(process.cwd(), 'data', 'authority-knowledge-cache.json');
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.cwd(), 'tmp', 'authority-knowledge-cache.cleaned.json');
const REPORT_FILE = process.env.REPORT_FILE || path.join(process.cwd(), 'tmp', 'authority-cache-clean-report.json');
const WRITE_BACK = /^true$/i.test(process.env.WRITE_BACK || '');

const GENERIC_TITLE_KEYS = new Set([
  'nutrition',
  'pregnancy',
  'breastfeeding',
  'immunization',
  'vaccines',
  'contraception',
  'child development',
  'parents',
  'participants',
]);

const AUTHORITY_CHROME_PATTERNS = [
  /turn on more accessible mode/giu,
  /turn off more accessible mode/giu,
  /skip ribbon commands/giu,
  /skip to main content/giu,
  /turn off animations/giu,
  /turn on animations/giu,
  /our sponsors/giu,
  /log in\s*\|\s*register/giu,
  /donate menu/giu,
  /find a pediatrician/giu,
  /healthy children\s*>/giu,
  /page content/giu,
  /长者版/gu,
  /无障碍/gu,
  /\b(?:邮箱|EN)\b/gu,
  /登录\s*\|\s*注册\s*\|\s*退出/gu,
  /语言版本\s*简体中文\s*English/gu,
  /当前位置：\s*首页/gu,
  /扫一扫在手机打开当前页/gu,
  /网站地图/gu,
  /网站声明/gu,
  /微信公众号/gu,
  /相关链接/gu,
  /技术支持/gu,
  /版权所有/gu,
  /网站标识码/gu,
  /电子标识编号/gu,
  /京ICP备[^\s]*/gu,
  /京公网安备[^\s]*/gu,
  /地址：/gu,
  /邮编：/gu,
  /电话：/gu,
  /字号：\s*【?\s*大\s*中\s*小\s*】?/gu,
  /分享到：/gu,
];

function getSourceName(record: AuthorityCacheRecord): string {
  return record.source_org || record.source || record.source_id || 'unknown';
}

function getUrl(record: AuthorityCacheRecord): string {
  return record.source_url || record.url || '';
}

function normalizeAuthorityText(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&gt;/gi, '>')
    .replace(/&lt;/gi, '<')
    .replace(/&#39;/gi, '\'')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^-->\s*/, '');
}

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

function countAuthorityChromeMatches(text: string): number {
  const normalized = normalizeAuthorityText(text);
  if (!normalized) {
    return 0;
  }

  return AUTHORITY_CHROME_PATTERNS.reduce((total, pattern) => total + countMatches(normalized, pattern), 0);
}

function stripAuthorityPageChrome(text: string): string {
  let normalized = normalizeAuthorityText(text);
  if (!normalized) {
    return '';
  }

  normalized = normalized
    .replace(/^[\s\S]*?当前位置：\s*首页\s*/u, '')
    .replace(/(?:扫一扫在手机打开当前页|手机版|微信公众号|网站地图|网站声明|相关链接|地址：)[\s\S]*$/u, '')
    .replace(/(?:长者版|无障碍|\b邮箱\b|\bEN\b)(?:\s*\|\s*(?:长者版|无障碍|\b邮箱\b|\bEN\b))*/gu, ' ')
    .replace(/登录\s*\|\s*注册\s*\|\s*退出/gu, ' ')
    .replace(/语言版本\s*简体中文\s*English/gu, ' ')
    .replace(/字号：\s*【?\s*大\s*中\s*小\s*】?/gu, ' ')
    .replace(/分享到：/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

function normalizeTitleKey(input: string): string {
  return sanitizeAuthorityTitle(input)
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[“”"']/g, '')
    .replace(/[，。；：、]/g, ' ')
    .replace(/[|()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSourceKey(input: string): string {
  return normalizeAuthorityText(input)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrlKey(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
    return url.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}

function getPathname(record: AuthorityCacheRecord): string {
  const url = getUrl(record);
  if (!url) {
    return '';
  }

  try {
    return new URL(url).pathname.toLowerCase().replace(/\/+$/u, '') || '/';
  } catch {
    return '';
  }
}

function isLandingLikePath(pathname: string): boolean {
  if (!pathname) {
    return false;
  }

  return [
    /^\/$/,
    /^\/topics(?:\/[^/]+)?$/,
    /^\/parents$/,
    /^\/pregnancy$/,
    /^\/breastfeeding$/,
    /^\/contraception$/,
    /^\/child-development$/,
    /^\/conditions(?:\/[^/]+)?$/,
    /^\/english\/(?:ages-stages|health-issues|healthy-living|safety-prevention|family-life)$/,
  ].some(pattern => pattern.test(pathname));
}

function isGenericTitleKey(titleKey: string): boolean {
  return !titleKey || titleKey.length < 8 || GENERIC_TITLE_KEYS.has(titleKey);
}

function isLowValueTitle(record: AuthorityCacheRecord): boolean {
  const titleKey = normalizeTitleKey(record.question || record.title || '');
  const sourceKey = normalizeSourceKey(getSourceName(record));
  if (!titleKey) {
    return true;
  }

  if (sourceKey && titleKey === sourceKey) {
    return true;
  }

  return /^(acknowledgments?, contributors?, and participants|keeping guidance up to date)(?:\s*\|.*)?$/i.test(titleKey);
}

function isAapSource(record: AuthorityCacheRecord): boolean {
  return /\baap\b|healthychildren\.org/i.test(`${getSourceName(record)} ${getUrl(record)}`);
}

function buildAuthorityFallbackSourceConfig(record: AuthorityCacheRecord): AuthoritySourceConfig {
  const sourceOrg = getSourceName(record);
  const localeDefaults = inferAuthorityLocaleDefaults(record.source_id, record.region);
  return {
    id: record.source_id || sourceOrg,
    org: sourceOrg,
    baseUrl: getUrl(record),
    allowedDomains: [],
    discoveryType: 'index_page',
    entryUrls: [],
    region: (record.region as AuthoritySourceConfig['region']) || 'GLOBAL',
    language: localeDefaults.sourceLanguage,
    locale: localeDefaults.sourceLocale,
    audience: [record.audience || '母婴家庭'],
    topics: [record.topic || record.category || 'general'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 1,
    parserId: record.source_id || sourceOrg,
  };
}

function normalizeAuthorityMetadata(record: AuthorityCacheRecord): AuthorityCacheRecord {
  const sourceConfig = getAuthoritySourceConfig(record.source_id || '') || buildAuthorityFallbackSourceConfig(record);
  const sourceUrl = getUrl(record);
  const title = sanitizeAuthorityTitle(record.question || record.title || '') || record.question || record.title || '';
  const inferredAudience = detectAudience({
    sourceUrl,
    title,
    summary: record.summary,
    contentText: record.answer,
  }, sourceConfig);
  const inferredTopic = detectTopic({
    sourceUrl,
    title,
    summary: record.summary,
    contentText: record.answer,
  }, sourceConfig);
  const inferredStages = inferAuthorityStages({
    title,
    summary: record.summary,
    contentText: record.answer,
    audience: inferredAudience,
    topic: inferredTopic,
  });

  return {
    ...record,
    question: title,
    category: inferredTopic || record.category,
    audience: inferredAudience,
    topic: inferredTopic || record.topic,
    target_stage: inferredStages.length > 0 ? inferredStages : (record.target_stage || []),
    tags: buildAuthorityDisplayTags({
      topic: inferredTopic || record.topic,
      audience: inferredAudience,
      tags: [],
      sourceOrg: record.source_org || record.source,
    }),
  };
}

function extractAapArticleBody(content: string): string {
  if (!content) {
    return '';
  }

  let normalized = content.replace(/\s+/g, ' ').trim().replace(/^-->\s*/, '');
  const pageContentMatch = normalized.match(/\bPage Content\b\s*([\s\S]*?)(?:\bArticle Body\b|\bLast Updated\b|\bFollow Us\b|$)/i);
  if (pageContentMatch?.[1]) {
    normalized = pageContentMatch[1].trim();
  }

  return normalized
    .replace(/\b(?:Article Body|Last Updated|Follow Us)\b[\s\S]*$/i, '')
    .replace(/^[a-z][a-z0-9-]{2,}[~;]\s*/i, '')
    .trim();
}

function normalizeRecord(record: AuthorityCacheRecord, index: number): WorkingRecord {
  const question = sanitizeAuthorityTitle(record.question || record.title || '') || record.question || record.title || '';
  let answer = typeof record.answer === 'string' ? record.answer.trim() : '';
  let summary = typeof record.summary === 'string' ? record.summary.trim() : '';

  if (isAapSource(record)) {
    const cleanedAnswer = extractAapArticleBody(answer);
    if (cleanedAnswer.length >= 150) {
      answer = cleanedAnswer;
    }

    const cleanedSummary = extractAapArticleBody(summary);
    summary = cleanedSummary || answer.slice(0, 300) || summary;
  }

  const cleanedAnswer = stripAuthorityPageChrome(answer);
  if (cleanedAnswer.length >= 150 && cleanedAnswer.length < answer.length) {
    answer = cleanedAnswer;
  }

  const cleanedSummary = stripAuthorityPageChrome(summary);
  if (cleanedSummary) {
    summary = cleanedSummary;
  }

  if (answer && summary && (countAuthorityChromeMatches(summary) >= 4 || isLikelyEnglishNavigationShell(summary))) {
    summary = answer.slice(0, 300);
  }

  const normalized = normalizeAuthorityMetadata({
    ...record,
    question,
    answer,
    summary,
  });
  return {
    ...normalized,
    __index: index,
  };
}

function getTimestamp(record: AuthorityCacheRecord): number {
  const value = record.source_updated_at || record.published_at || record.updated_at || record.created_at;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getRecordQualityScore(record: AuthorityCacheRecord): number {
  const titleKey = normalizeTitleKey(record.question || record.title || '');
  const sourceKey = normalizeSourceKey(getSourceName(record));
  const pathname = getPathname(record);
  const summaryLength = normalizeAuthorityText(record.summary || '').length;
  const answerLength = normalizeAuthorityText(record.answer || '').length;
  const topic = String(record.topic || record.category || '').toLowerCase();

  let score = 0;

  if (summaryLength >= 80) score += 4;
  else if (summaryLength >= 40) score += 2;
  if (answerLength >= 500) score += 3;
  else if (answerLength >= 180) score += 1;

  if (record.audience) score += 2;
  if (topic && topic !== 'general') score += 2;
  if (topic && topic !== 'policy') score += 1;
  if (titleKey.length >= 12 && titleKey.length <= 120) score += 1;
  if (!isLandingLikePath(pathname)) score += 2;

  if (topic === 'policy') score -= 5;
  if (isGenericTitleKey(titleKey)) score -= 4;
  if (isLowValueTitle(record)) score -= 8;
  if (sourceKey && titleKey === sourceKey) score -= 8;
  if (isLandingLikePath(pathname)) score -= 3;
  score -= countAuthorityChromeMatches(`${record.summary || ''} ${record.answer || ''}`);

  return score;
}

function getDropReason(record: AuthorityCacheRecord): string | null {
  if (shouldFilterAuthoritySourceUrl(record)) {
    return 'filtered_source_url';
  }

  const sensitivityReason = isHighRiskOrClickbaitTitle(record.question || record.title || '');
  if (sensitivityReason) {
    return sensitivityReason;
  }

  if (containsDeathRelatedTerms(`${record.summary || ''} ${record.answer || ''}`)) {
    return 'death_related_term';
  }

  if (isLowValueTitle(record)) {
    return 'low_value_title';
  }

  const titleKey = normalizeTitleKey(record.question || record.title || '');
  if (isGenericTitleKey(titleKey) && isLandingLikePath(getPathname(record))) {
    return 'generic_landing_page';
  }

  return null;
}

function buildDedupeKeys(record: AuthorityCacheRecord): string[] {
  const keys = [
    normalizeUrlKey(getUrl(record) || record.original_id || record.id || ''),
  ].filter(Boolean);

  const titleKey = normalizeTitleKey(record.question || record.title || '');
  const sourceKey = normalizeSourceKey(getSourceName(record));
  if (sourceKey && titleKey && !isGenericTitleKey(titleKey)) {
    keys.push(`title:${sourceKey}:${titleKey}`);
  }

  return Array.from(new Set(keys));
}

function pickBetterRecord(left: WorkingRecord, right: WorkingRecord): WorkingRecord {
  const leftQuality = getRecordQualityScore(left);
  const rightQuality = getRecordQualityScore(right);
  if (leftQuality !== rightQuality) {
    return rightQuality > leftQuality ? right : left;
  }

  const timestampDiff = getTimestamp(right) - getTimestamp(left);
  if (timestampDiff !== 0) {
    return timestampDiff > 0 ? right : left;
  }

  return left.__index <= right.__index ? left : right;
}

function omitWorkingFields(record: WorkingRecord): AuthorityCacheRecord {
  const { __index: _ignored, ...rest } = record;
  return rest;
}

function sampleRecord(record: AuthorityCacheRecord) {
  return {
    source: getSourceName(record),
    title: record.question || record.title || '',
    url: getUrl(record),
    updatedAt: record.source_updated_at || record.published_at || record.updated_at || record.created_at || '',
  };
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Authority cache not found: ${INPUT_FILE}`);
  }

  const raw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8')) as AuthorityCacheRecord[];
  const records = Array.isArray(raw) ? raw : [];
  const normalized = records.map(normalizeRecord);
  const removedByReason: Record<string, WorkingRecord[]> = {};
  const candidates: WorkingRecord[] = [];

  normalized.forEach((record) => {
    const reason = getDropReason(record);
    if (reason) {
      removedByReason[reason] = removedByReason[reason] || [];
      removedByReason[reason].push(record);
      return;
    }
    candidates.push(record);
  });

  const deduped = new Map<string, WorkingRecord>();
  const duplicateRemoved: WorkingRecord[] = [];

  candidates.forEach((record) => {
    const keys = buildDedupeKeys(record);
    const existing = keys
      .map(key => deduped.get(key))
      .find((item): item is WorkingRecord => Boolean(item));

    if (!existing) {
      keys.forEach(key => deduped.set(key, record));
      return;
    }

    const selected = pickBetterRecord(existing, record);
    const removed = selected.__index === existing.__index ? record : existing;
    duplicateRemoved.push(removed);
    keys.forEach(key => deduped.set(key, selected));
  });

  const uniqueWorkingRecords = Array.from(new Map(
    Array.from(deduped.values()).map(record => [record.__index, record]),
  ).values()).sort((left, right) => left.__index - right.__index);
  const cleaned = uniqueWorkingRecords.map(omitWorkingFields);

  const report = {
    generatedAt: new Date().toISOString(),
    inputFile: INPUT_FILE,
    outputFile: OUTPUT_FILE,
    writeBack: WRITE_BACK,
    total: records.length,
    normalized: normalized.length,
    kept: cleaned.length,
    removed: records.length - cleaned.length,
    removedByReason: Object.entries(removedByReason)
      .map(([reason, list]) => ({ reason, count: list.length, samples: list.slice(0, 20).map(sampleRecord) })),
    duplicateRemoved: duplicateRemoved.length,
    duplicateSamples: duplicateRemoved.slice(0, 40).map(sampleRecord),
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cleaned, null, 2), 'utf-8');
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');

  if (WRITE_BACK) {
    const backupFile = `${INPUT_FILE}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(INPUT_FILE, backupFile);
    fs.writeFileSync(INPUT_FILE, JSON.stringify(cleaned, null, 2), 'utf-8');
    console.log(`backup_file=${backupFile}`);
  }

  console.log(JSON.stringify(report, null, 2));
}

main();
