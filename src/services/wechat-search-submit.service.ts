export const DEFAULT_WECHAT_SEARCH_PAGE_PATH = 'pages/knowledge-detail/index';
export const DEFAULT_WECHAT_SEARCH_CATEGORY_ID = 17;
export const DEFAULT_WECHAT_SEARCH_STRUCTURED_TYPE = 'wxsearch_testcpdata';
export const WECHAT_SEARCH_SUBMIT_MAX_PAGES = 1000;

export type WechatSearchStructuredType = 'wxsearch_cpdata' | 'wxsearch_testcpdata';
export type WechatSearchUpdateAction = 1 | 3;

export interface WechatSearchArticleInput {
  id?: bigint | number | string | null;
  slug?: string | null;
  title?: string | null;
  seoTitle?: string | null;
  summary?: string | null;
  seoDescription?: string | null;
  content?: string | null;
  coverImage?: string | null;
  h5Url?: string | null;
  source?: string | null;
  tags?: Array<string | null | undefined> | null;
  viewCount?: number | null;
  likeCount?: number | null;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface WechatSearchPageData {
  '@type': WechatSearchStructuredType;
  update: WechatSearchUpdateAction;
  content_id: string;
  page_type: 2;
  category_id: number;
  weapp_url: string;
  h5_url?: string;
  title: string;
  abstract?: string[];
  mainbody: string;
  cover_img?: Array<{
    cover_img_url: string;
    cover_img_size: 1 | 2 | 3;
  }>;
  time_publish: number;
  time_modify: number;
  tag?: string[];
  pv?: number;
  like?: number;
  author_name?: string;
}

export interface WechatSearchPage {
  path: string;
  query: string;
  data_list: WechatSearchPageData[];
}

export interface WechatSearchSubmitPayload {
  pages: WechatSearchPage[];
}

export interface BuildWechatSearchPageOptions {
  path?: string;
  categoryId?: number;
  structuredType?: WechatSearchStructuredType;
  update?: WechatSearchUpdateAction;
  now?: Date;
  maxTitleChars?: number;
  maxAbstractChars?: number;
  maxMainbodyChars?: number;
}

export type WechatSearchPageSkipReason = 'missing_slug' | 'missing_title' | 'missing_mainbody';

export type WechatSearchPageBuildResult =
  | { ok: true; page: WechatSearchPage }
  | {
      ok: false;
      reason: WechatSearchPageSkipReason;
      slug?: string;
      title?: string;
    };

export interface BuildWechatSearchPayloadResult {
  payload: WechatSearchSubmitPayload;
  skipped: Array<Extract<WechatSearchPageBuildResult, { ok: false }>>;
}

export interface WechatSearchSubmitResponse {
  errcode: number;
  errmsg: string;
  [key: string]: unknown;
}

type FetchLike = typeof fetch;

type WechatAccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

function normalizePlainText(input: string): string {
  return decodeHtmlEntities(stripHtml(input))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtml(input: string): string {
  return input
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|section|article|div|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const value = Number.parseInt(code, 10);
      return toSafeCodePoint(value);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => {
      const value = Number.parseInt(code, 16);
      return toSafeCodePoint(value);
    });
}

function toSafeCodePoint(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 0x10FFFF) {
    return '';
  }

  return String.fromCodePoint(value);
}

function truncateText(input: string, maxChars: number): string {
  const chars = Array.from(input);
  if (chars.length <= maxChars) {
    return input;
  }

  if (maxChars <= 0) {
    return '';
  }

  if (maxChars <= 3) {
    return chars.slice(0, maxChars).join('');
  }

  return `${chars.slice(0, maxChars - 3).join('').trim()}...`;
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, '').trim() || DEFAULT_WECHAT_SEARCH_PAGE_PATH;
}

function buildQuery(slug: string): string {
  return new URLSearchParams({ slug }).toString();
}

function normalizeContentId(input: WechatSearchArticleInput, slug: string): string {
  const rawId = input.id === undefined || input.id === null ? slug : String(input.id);
  return `article_${rawId}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);
}

function isHttpUrl(input: string | null | undefined): input is string {
  return typeof input === 'string' && /^https?:\/\//i.test(input.trim());
}

function toUnixSeconds(input: Date | string | null | undefined, fallback: Date): number {
  if (!input) {
    return Math.floor(fallback.getTime() / 1000);
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return Math.floor(fallback.getTime() / 1000);
  }

  return Math.floor(date.getTime() / 1000);
}

function normalizeTags(tags: WechatSearchArticleInput['tags']): string[] | undefined {
  const normalized = Array.from(new Set((tags || [])
    .map((tag) => normalizePlainText(String(tag || '')))
    .filter(Boolean)
    .map((tag) => truncateText(tag, 20))))
    .slice(0, 10);

  return normalized.length > 0 ? normalized : undefined;
}

function positiveInteger(input: number | null | undefined): number | undefined {
  if (!Number.isFinite(input) || !input || input <= 0) {
    return undefined;
  }

  return Math.floor(input);
}

export function buildWechatSearchPage(
  input: WechatSearchArticleInput,
  options: BuildWechatSearchPageOptions = {},
): WechatSearchPageBuildResult {
  const slug = String(input.slug || '').trim();
  if (!slug) {
    return { ok: false, reason: 'missing_slug', title: input.title || undefined };
  }

  const title = truncateText(normalizePlainText(input.seoTitle || input.title || ''), options.maxTitleChars ?? 60);
  if (!title) {
    return { ok: false, reason: 'missing_title', slug };
  }

  const mainbody = truncateText(normalizePlainText(input.content || input.summary || ''), options.maxMainbodyChars ?? 6000);
  if (!mainbody) {
    return { ok: false, reason: 'missing_mainbody', slug, title };
  }

  const path = normalizePath(options.path || DEFAULT_WECHAT_SEARCH_PAGE_PATH);
  const query = buildQuery(slug);
  const now = options.now || new Date();
  const timePublish = toUnixSeconds(input.publishedAt || input.createdAt || input.updatedAt, now);
  const timeModify = toUnixSeconds(input.updatedAt || input.publishedAt || input.createdAt, now);
  const abstract = normalizePlainText(input.seoDescription || input.summary || '');
  const coverImage = isHttpUrl(input.coverImage) ? input.coverImage.trim() : undefined;
  const source = normalizePlainText(input.source || '');
  const tags = normalizeTags(input.tags);
  const pv = positiveInteger(input.viewCount);
  const like = positiveInteger(input.likeCount);

  const data: WechatSearchPageData = {
    '@type': options.structuredType || DEFAULT_WECHAT_SEARCH_STRUCTURED_TYPE,
    update: options.update || 1,
    content_id: normalizeContentId(input, slug),
    page_type: 2,
    category_id: options.categoryId || DEFAULT_WECHAT_SEARCH_CATEGORY_ID,
    weapp_url: `${path}?${query}`,
    ...(isHttpUrl(input.h5Url) ? { h5_url: input.h5Url.trim() } : {}),
    title,
    ...(abstract ? { abstract: [truncateText(abstract, options.maxAbstractChars ?? 200)] } : {}),
    mainbody,
    ...(coverImage ? { cover_img: [{ cover_img_url: coverImage, cover_img_size: 1 as const }] } : {}),
    time_publish: timePublish,
    time_modify: timeModify,
    ...(tags ? { tag: tags } : {}),
    ...(pv ? { pv } : {}),
    ...(like ? { like } : {}),
    ...(source ? { author_name: source } : {}),
  };

  return {
    ok: true,
    page: {
      path,
      query,
      data_list: [data],
    },
  };
}

export function buildWechatSearchSubmitPayload(
  articles: WechatSearchArticleInput[],
  options: BuildWechatSearchPageOptions = {},
): BuildWechatSearchPayloadResult {
  const pages: WechatSearchPage[] = [];
  const skipped: BuildWechatSearchPayloadResult['skipped'] = [];

  for (const article of articles) {
    const result = buildWechatSearchPage(article, options);
    if (result.ok) {
      pages.push(result.page);
    } else {
      skipped.push(result);
    }
  }

  return {
    payload: { pages },
    skipped,
  };
}

export function chunkWechatSearchPages(
  pages: WechatSearchPage[],
  chunkSize = WECHAT_SEARCH_SUBMIT_MAX_PAGES,
): WechatSearchPage[][] {
  const normalizedChunkSize = Math.max(1, Math.min(chunkSize, WECHAT_SEARCH_SUBMIT_MAX_PAGES));
  const chunks: WechatSearchPage[][] = [];

  for (let index = 0; index < pages.length; index += normalizedChunkSize) {
    chunks.push(pages.slice(index, index + normalizedChunkSize));
  }

  return chunks;
}

export async function submitWechatSearchPages(
  accessToken: string,
  pages: WechatSearchPage[],
  fetchImpl: FetchLike = fetch,
): Promise<WechatSearchSubmitResponse> {
  const token = accessToken.trim();
  if (!token) {
    throw new Error('Missing WeChat access token');
  }

  if (pages.length === 0) {
    throw new Error('No WeChat search pages to submit');
  }

  if (pages.length > WECHAT_SEARCH_SUBMIT_MAX_PAGES) {
    throw new Error(`WeChat search submit supports at most ${WECHAT_SEARCH_SUBMIT_MAX_PAGES} pages per request`);
  }

  const url = new URL('https://api.weixin.qq.com/wxa/search/wxaapi_submitpages');
  url.searchParams.set('access_token', token);

  const response = await fetchImpl(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pages }),
  });
  const body = await response.text();
  let parsed: unknown;

  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    throw new Error(`Invalid WeChat search submit response: ${body.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`WeChat search submit HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const result = parsed as WechatSearchSubmitResponse;
  if (typeof result.errcode === 'number' && result.errcode !== 0) {
    throw new Error(`WeChat search submit failed: ${result.errcode} ${result.errmsg || ''}`.trim());
  }

  return result;
}

export async function fetchWechatAccessToken(
  appId: string,
  appSecret: string,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const normalizedAppId = appId.trim();
  const normalizedAppSecret = appSecret.trim();
  if (!normalizedAppId || !normalizedAppSecret) {
    throw new Error('Missing WECHAT_APPID or WECHAT_APP_SECRET');
  }

  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', normalizedAppId);
  url.searchParams.set('secret', normalizedAppSecret);

  const response = await fetchImpl(url.toString());
  const body = await response.text();
  let parsed: WechatAccessTokenResponse;

  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    throw new Error(`Invalid WeChat access token response: ${body.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`WeChat access token HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  if (typeof parsed.errcode === 'number' && parsed.errcode !== 0) {
    throw new Error(`WeChat access token failed: ${parsed.errcode} ${parsed.errmsg || ''}`.trim());
  }

  if (!parsed.access_token) {
    throw new Error('WeChat access token response missing access_token');
  }

  return parsed.access_token;
}
