import fs from 'fs';
import path from 'path';
import {
  callTaskModelDetailed,
  getAIGatewayErrorOpsMessage,
  isAIGatewayProviderError,
  isAIGatewayModalDirectRateLimitError,
  type AITaskModelRole,
} from './ai-gateway.service';
import { isLikelyEnglishNavigationShell, sanitizeAuthorityTitle } from './authority-adapters/base.adapter';
import { shouldFilterAuthoritySourceUrl } from '../utils/authority-source-url';
import {
  extractJsonObject,
  compactTranslationSummary,
  hasTranslationPromptLeak,
  normalizeWhitespace,
  sanitizeTranslationText,
  stripCodeFence,
} from '../utils/article-translation';
import {
  resolveActiveAuthorityTranslationQuotaResetAt,
  resolveActiveAuthorityTranslationTransientBlockUntil,
  resolveAuthorityTranslationFailureRetryAfterAt,
} from '../utils/authority-translation-failure-retry';
import {
  buildAuthorityTranslationSourceFingerprint,
  isAuthorityTranslationCacheFresh,
  resolveAuthorityTranslationSourceUpdatedAt,
} from '../utils/authority-translation-source';
import {
  resolveAuthorityTranslationTaskRoles,
} from '../utils/authority-translation-routing';
import { buildAuthoritySlugCandidates, buildStableAuthoritySlug } from '../utils/authority-identity';

export { resolveAuthorityTranslationSourceUpdatedAt } from '../utils/authority-translation-source';

export interface AuthorityCacheRecord {
  id: string;
  content_type?: string;
  question: string;
  answer: string;
  summary?: string;
  category?: string;
  tags?: string[];
  target_stage?: string[];
  difficulty?: string;
  read_time?: number;
  is_verified?: boolean;
  status?: string;
  view_count?: number;
  like_count?: number;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  source?: string;
  source_id?: string;
  source_org?: string;
  source_class?: 'official' | 'medical_platform' | 'dataset' | 'unknown';
  source_url?: string;
  source_language?: 'zh' | 'en';
  source_locale?: string;
  source_updated_at?: string;
  last_synced_at?: string;
  url?: string;
  audience?: string;
  topic?: string;
  region?: string;
  original_id?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityTranslationCacheRecord {
  slug: string;
  sourceUpdatedAt?: string;
  sourceFingerprint?: string;
  translatedTitle: string;
  translatedSummary: string;
  translatedContent: string;
  translationNotice: string;
  updatedAt: string;
  model?: string;
  provider?: string;
  isSourceChinese?: boolean;
}

interface AuthorityTranslationExecutionOptions {
  providerTimeoutMs?: number;
}

interface AuthorityTranslationFailureCacheRecord {
  slug: string;
  sourceUpdatedAt?: string;
  message: string;
  attempts: number;
  failedAt: string;
  retryAfterAt: string;
}

export interface WarmAuthorityTranslationsOptions {
  limit?: number;
  delayMs?: number;
  sourceLanguage?: 'en' | 'zh' | 'all';
  slug?: string;
  providerTimeoutMs?: number;
}

export interface WarmAuthorityTranslationsResult {
  scanned: number;
  candidates: number;
  selected: number;
  cached: number;
  skipped: number;
  warmed: number;
  failed: number;
  failures: Array<{ slug: string; message: string }>;
  quotaBlocked?: boolean;
  quotaResetAt?: string;
}

const AUTHORITY_CACHE_PATHS = [
  process.env.AUTHORITY_KNOWLEDGE_CACHE_PATH || '',
  '/tmp/authority-knowledge-cache.json',
  path.join(process.cwd(), 'data', 'authority-knowledge-cache.json'),
  path.join(__dirname, '../../data/authority-knowledge-cache.json'),
].filter(Boolean);
const AUTHORITY_TRANSLATION_CACHE_PATH = process.env.AUTHORITY_TRANSLATION_CACHE_PATH || '';
const AUTHORITY_TRANSLATION_CACHE_PATHS = [
  AUTHORITY_TRANSLATION_CACHE_PATH,
  path.join(process.cwd(), 'data', 'authority-translation-cache.json'),
  path.join(__dirname, '../../data/authority-translation-cache.json'),
  '/tmp/authority-translation-cache.json',
].filter(Boolean);
const AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH = process.env.AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH || '';
const AUTHORITY_TRANSLATION_FAILURE_CACHE_PATHS = [
  AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH,
  path.join(process.cwd(), 'data', 'authority-translation-failures.json'),
  path.join(__dirname, '../../data/authority-translation-failures.json'),
  '/tmp/authority-translation-failures.json',
].filter(Boolean);

let authorityCacheMemo: { path: string; mtimeMs: number; records: AuthorityCacheRecord[] } | null = null;
let authorityTranslationCacheMemo: Record<string, AuthorityTranslationCacheRecord> | null = null;
let authorityTranslationCacheMemoSignature = '';
let authorityTranslationFailureCacheMemo: {
  path: string;
  mtimeMs: number;
  data: Record<string, AuthorityTranslationFailureCacheRecord>;
} | null = null;
let translationCacheWriteQueue: Promise<void> = Promise.resolve();
const authorityTranslationInFlight = new Map<string, Promise<AuthorityTranslationCacheRecord>>();
const authorityTranslationInFlightTimestamps = new Map<string, number>();
const AUTHORITY_TRANSLATION_INFLIGHT_TTL_MS = 2 * 60 * 1000;

const AUTHORITY_TRANSLATION_PROVIDER_TIMEOUT_MS = Math.min(
  45000,
  Math.max(3000, Number.parseInt(process.env.AUTHORITY_TRANSLATION_PROVIDER_TIMEOUT_MS || '45000', 10) || 45000),
);
const AUTHORITY_TRANSLATION_WARMUP_PROVIDER_TIMEOUT_MS = Math.min(
  120000,
  Math.max(
    AUTHORITY_TRANSLATION_PROVIDER_TIMEOUT_MS,
    Number.parseInt(process.env.AUTHORITY_TRANSLATION_WARMUP_PROVIDER_TIMEOUT_MS || '90000', 10) || 90000,
  ),
);
const AUTHORITY_TRANSLATION_SOURCE_CHAR_LIMIT = Math.max(
  1800,
  Number.parseInt(process.env.AUTHORITY_TRANSLATION_SOURCE_CHAR_LIMIT || '3200', 10) || 3200,
);
const AUTHORITY_TRANSLATION_MAX_TOKENS = Math.max(
  1000,
  Number.parseInt(process.env.AUTHORITY_TRANSLATION_MAX_TOKENS || '1600', 10) || 1600,
);
function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

const AUTHORITY_TRANSLATION_SYNC_LIMIT = parseNonNegativeInt(process.env.AUTHORITY_TRANSLATION_SYNC_LIMIT, 10);
const AUTHORITY_TRANSLATION_SYNC_DELAY_MS = parseNonNegativeInt(process.env.AUTHORITY_TRANSLATION_SYNC_DELAY_MS, 30000);

const AUTHORITY_TRANSLATION_TASK_ROLES: AITaskModelRole[] = resolveAuthorityTranslationTaskRoles();

export const __authorityTranslationTestUtils = {
  resolveAuthorityTranslationTaskRoles,
};

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function countMatches(input: string, pattern: RegExp): number {
  const matched = input.match(pattern);
  return matched ? matched.length : 0;
}

function isMostlyChineseText(input: string): boolean {
  const text = input.replace(/\s+/g, '');
  if (!text) {
    return false;
  }

  const chineseChars = countMatches(text, /[\u3400-\u4dbf\u4e00-\u9fff]/gu);
  const latinChars = countMatches(text, /[A-Za-z]/g);

  if (chineseChars >= 30 && chineseChars >= latinChars) {
    return true;
  }

  return chineseChars / Math.max(text.length, 1) >= 0.2 && chineseChars >= latinChars * 0.6;
}

export function buildAuthoritySlug(record: AuthorityCacheRecord, index: number): string {
  return buildStableAuthoritySlug(record, index);
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

function isAuthorityRecordLowValue(record: Pick<AuthorityCacheRecord, 'question' | 'summary' | 'answer'>): boolean {
  const title = normalizeAuthorityText(record.question || '');
  const rawSummary = normalizeAuthorityText(record.summary || '');
  const rawAnswer = normalizeAuthorityText(record.answer || '');

  if (isLikelyEnglishNavigationShell(`${rawSummary} ${rawAnswer}`)) {
    return true;
  }

  if (!rawAnswer && !rawSummary) {
    return true;
  }

  if (!rawAnswer) {
    return false;
  }

  const answerChromeCount = countAuthorityChromeMatches(rawAnswer);
  const summaryChromeCount = countAuthorityChromeMatches(rawSummary);
  const cleanedAnswer = stripAuthorityPageChrome(rawAnswer);
  const cleanedWithoutTitle = title
    ? cleanedAnswer.replace(title, '').trim()
    : cleanedAnswer;
  const cleanedSummary = stripAuthorityPageChrome(rawSummary);

  if (cleanedWithoutTitle.length < 80 && cleanedSummary.length < 20) {
    return true;
  }

  const looksLikeAttachmentNotice = /附件[:：]|\.(?:zip|pdf|docx?|xlsx?)(?:\s|$)|海报\d+/iu.test(cleanedAnswer);
  const sentenceCount = countMatches(cleanedWithoutTitle, /[。！？.!?]/g);

  return (
    answerChromeCount >= 6
    && summaryChromeCount >= 3
    && cleanedWithoutTitle.length > 0
    && cleanedWithoutTitle.length < 120
  ) || (
    looksLikeAttachmentNotice
    && sentenceCount === 0
    && cleanedWithoutTitle.length > 0
    && cleanedWithoutTitle.length < 180
  );
}

function isAapCacheRecord(record: AuthorityCacheRecord): boolean {
  const sourceText = `${record.source_id || ''} ${record.source || ''} ${record.source_org || ''} ${record.source_url || ''} ${record.url || ''}`.toLowerCase();
  return /\baap\b|healthychildren\.org/.test(sourceText);
}

function normalizeAapCachedContent(content: string): string {
  if (!content) {
    return '';
  }

  let normalized = content.replace(/\s+/g, ' ').trim();
  normalized = normalized.replace(/^-->\s*/, '');

  const pageContentMatch = normalized.match(/\bPage Content\b\s*([\s\S]*?)(?:\bArticle Body\b|\bLast Updated\b|\bFollow Us\b|$)/i);
  if (pageContentMatch?.[1]) {
    normalized = pageContentMatch[1].trim();
  }

  normalized = normalized
    .replace(/\b(?:Article Body|Last Updated|Follow Us)\b[\s\S]*$/i, '')
    .replace(/^[a-z][a-z0-9-]{2,}[~;]\s*/i, '')
    .trim();

  return normalized;
}

function normalizeAuthorityCacheRecord(record: AuthorityCacheRecord): AuthorityCacheRecord {
  const normalizedQuestion = sanitizeAuthorityTitle(record.question || '');
  let normalizedAnswer = typeof record.answer === 'string' ? record.answer.trim() : '';
  let normalizedSummary = typeof record.summary === 'string' ? record.summary.trim() : undefined;

  if (isAapCacheRecord(record)) {
    const cleanedAnswer = normalizeAapCachedContent(normalizedAnswer);
    if (cleanedAnswer.length >= 150) {
      normalizedAnswer = cleanedAnswer;
    }

    const cleanedSummary = normalizeAapCachedContent(normalizedSummary || '');
    normalizedSummary = cleanedSummary || normalizedAnswer.slice(0, 300) || normalizedSummary;
  }

  const cleanedAnswer = stripAuthorityPageChrome(normalizedAnswer);
  if (cleanedAnswer.length >= 150 && cleanedAnswer.length < normalizedAnswer.length) {
    normalizedAnswer = cleanedAnswer;
  }

  const cleanedSummary = stripAuthorityPageChrome(normalizedSummary || '');
  if (cleanedSummary) {
    normalizedSummary = cleanedSummary;
  }

  if (
    normalizedAnswer
    && normalizedSummary
    && (countAuthorityChromeMatches(normalizedSummary) >= 4 || isLikelyEnglishNavigationShell(normalizedSummary))
  ) {
    normalizedSummary = normalizedAnswer.slice(0, 300);
  }

  if ((!normalizedSummary || normalizedSummary.length < 20) && normalizedAnswer) {
    const sentenceMatch = normalizedAnswer.match(/^(.{20,180}?[。！？.!?])/u);
    if (sentenceMatch) {
      normalizedSummary = sentenceMatch[1];
    }
  }

  return {
    ...record,
    question: normalizedQuestion || record.question,
    answer: normalizedAnswer,
    summary: normalizedSummary,
  };
}

function isInvalidAuthoritySourceUrl(record: Pick<AuthorityCacheRecord, 'source_url'>): boolean {
  const url = (record.source_url || '').trim();
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return true;
    }
    if (!parsed.hostname.includes('.')) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function loadAuthorityCacheRecords(): AuthorityCacheRecord[] {
  const cachePath = AUTHORITY_CACHE_PATHS.find((candidate) => fs.existsSync(candidate));
  if (!cachePath) {
    return [];
  }

  const stat = fs.statSync(cachePath);
  if (authorityCacheMemo && authorityCacheMemo.path === cachePath && authorityCacheMemo.mtimeMs === stat.mtimeMs) {
    return authorityCacheMemo.records;
  }

  const raw = fs.readFileSync(cachePath, 'utf-8');
  const parsed = JSON.parse(raw);
  const records = Array.isArray(parsed)
    ? (parsed as AuthorityCacheRecord[]).map(normalizeAuthorityCacheRecord)
    : [];
  authorityCacheMemo = { path: cachePath, mtimeMs: stat.mtimeMs, records };
  return records;
}

export async function getAuthorityRecordsForTranslation(): Promise<AuthorityCacheRecord[]> {
  return loadAuthorityCacheRecords()
    .filter((record) => !shouldFilterAuthoritySourceUrl(record))
    .filter((record) => !isInvalidAuthoritySourceUrl(record))
    .filter((record) => !isAuthorityRecordLowValue(record));
}

export async function findAuthorityRecordForTranslationBySlug(
  slug: string,
): Promise<{ record: AuthorityCacheRecord; slug: string } | null> {
  const records = await getAuthorityRecordsForTranslation();
  const index = records.findIndex((item, itemIndex) => buildAuthoritySlugCandidates(item, itemIndex).includes(slug));
  if (index < 0) {
    return null;
  }

  return {
    record: records[index],
    slug: buildAuthoritySlug(records[index], index),
  };
}

function resolveWritableTranslationCachePath(): string {
  if (AUTHORITY_TRANSLATION_CACHE_PATH) {
    return AUTHORITY_TRANSLATION_CACHE_PATH;
  }

  const durablePath = path.join(process.cwd(), 'data', 'authority-translation-cache.json');
  if (fs.existsSync(durablePath)) {
    return durablePath;
  }

  const existingDurablePath = AUTHORITY_TRANSLATION_CACHE_PATHS.find((candidate) => (
    candidate !== '/tmp/authority-translation-cache.json'
    && fs.existsSync(candidate)
  ));
  return existingDurablePath || durablePath;
}

export function normalizeAuthorityTranslationRecord(
  translation: AuthorityTranslationCacheRecord,
): AuthorityTranslationCacheRecord | null {
  const normalized: AuthorityTranslationCacheRecord = {
    ...translation,
    translatedTitle: sanitizeTranslationText(translation.translatedTitle || '', 'title'),
    translatedSummary: compactTranslationSummary(translation.translatedSummary || ''),
    translatedContent: sanitizeTranslationText(translation.translatedContent || '', 'content'),
  };

  if (!normalized.translatedContent) {
    return null;
  }

  return normalized;
}

function readTranslationCacheFile(cachePath: string): Record<string, AuthorityTranslationCacheRecord> {
  if (!fs.existsSync(cachePath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, AuthorityTranslationCacheRecord>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([slug, translation]) => [slug, normalizeAuthorityTranslationRecord(translation)] as const)
        .filter((entry): entry is [string, AuthorityTranslationCacheRecord] => Boolean(entry[1])),
    );
  } catch {
    return {};
  }
}

function getTranslationCacheSignature(): string {
  return AUTHORITY_TRANSLATION_CACHE_PATHS.map((cachePath) => {
    try {
      const stat = fs.statSync(cachePath);
      return `${cachePath}:${stat.mtimeMs}:${stat.size}`;
    } catch {
      return `${cachePath}:missing`;
    }
  }).join('|');
}

export function loadAuthorityTranslationCache(): Record<string, AuthorityTranslationCacheRecord> {
  const signature = getTranslationCacheSignature();
  if (authorityTranslationCacheMemo && authorityTranslationCacheMemoSignature === signature) {
    return authorityTranslationCacheMemo;
  }

  const cachePaths = AUTHORITY_TRANSLATION_CACHE_PATHS.filter((candidate) => fs.existsSync(candidate));
  if (cachePaths.length === 0) {
    authorityTranslationCacheMemo = {};
    authorityTranslationCacheMemoSignature = signature;
    return authorityTranslationCacheMemo;
  }

  const merged: Record<string, AuthorityTranslationCacheRecord> = {};
  try {
    for (const cachePath of cachePaths) {
      const parsed = readTranslationCacheFile(cachePath);
      for (const [slug, translation] of Object.entries(parsed)) {
        if (!merged[slug]) {
          merged[slug] = translation;
        }
      }
    }
    authorityTranslationCacheMemo = merged;
    authorityTranslationCacheMemoSignature = signature;
  } catch {
    authorityTranslationCacheMemo = {};
    authorityTranslationCacheMemoSignature = signature;
  }

  return authorityTranslationCacheMemo;
}

export function preloadAuthorityTranslationRuntimeCache(): {
  authorityRecords: number;
  translationEntries: number;
  failureEntries: number;
} {
  const authorityRecords = loadAuthorityCacheRecords().length;
  const translationEntries = Object.keys(loadAuthorityTranslationCache()).length;
  const failureEntries = Object.keys(loadAuthorityTranslationFailureCache()).length;

  return {
    authorityRecords,
    translationEntries,
    failureEntries,
  };
}

function saveAuthorityTranslationCache(data: Record<string, AuthorityTranslationCacheRecord>): void {
  authorityTranslationCacheMemo = data;
  authorityTranslationCacheMemoSignature = getTranslationCacheSignature();
  translationCacheWriteQueue = translationCacheWriteQueue.then(() => {
    const cachePath = resolveWritableTranslationCachePath();
    const diskCache = readTranslationCacheFile(cachePath);
    const merged = {
      ...diskCache,
      ...data,
    };
    authorityTranslationCacheMemo = merged;
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(merged, null, 2), 'utf-8');
    authorityTranslationCacheMemoSignature = getTranslationCacheSignature();
  }).catch((err) => {
    console.error('[Authority Translation] Cache write failed:', err);
  });
}

function resolveWritableTranslationFailureCachePath(): string {
  if (AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH) {
    return AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH;
  }

  const durablePath = path.join(process.cwd(), 'data', 'authority-translation-failures.json');
  if (fs.existsSync(durablePath)) {
    return durablePath;
  }

  const existingDurablePath = AUTHORITY_TRANSLATION_FAILURE_CACHE_PATHS.find((candidate) => (
    candidate !== '/tmp/authority-translation-failures.json'
    && fs.existsSync(candidate)
  ));
  return existingDurablePath || durablePath;
}

function loadAuthorityTranslationFailureCache(): Record<string, AuthorityTranslationFailureCacheRecord> {
  const failurePath = AUTHORITY_TRANSLATION_FAILURE_CACHE_PATHS.find((candidate) => fs.existsSync(candidate))
    || resolveWritableTranslationFailureCachePath();

  if (!fs.existsSync(failurePath)) {
    authorityTranslationFailureCacheMemo = {
      path: failurePath,
      mtimeMs: 0,
      data: {},
    };
    return authorityTranslationFailureCacheMemo.data;
  }

  const stat = fs.statSync(failurePath);
  if (
    authorityTranslationFailureCacheMemo
    && authorityTranslationFailureCacheMemo.path === failurePath
    && authorityTranslationFailureCacheMemo.mtimeMs === stat.mtimeMs
  ) {
    return authorityTranslationFailureCacheMemo.data;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(failurePath, 'utf-8')) as Record<string, AuthorityTranslationFailureCacheRecord>;
    authorityTranslationFailureCacheMemo = {
      path: failurePath,
      mtimeMs: stat.mtimeMs,
      data: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {},
    };
  } catch {
    authorityTranslationFailureCacheMemo = {
      path: failurePath,
      mtimeMs: stat.mtimeMs,
      data: {},
    };
  }

  return authorityTranslationFailureCacheMemo.data;
}

function saveAuthorityTranslationFailureCache(data: Record<string, AuthorityTranslationFailureCacheRecord>): void {
  const failurePath = resolveWritableTranslationFailureCachePath();
  fs.mkdirSync(path.dirname(failurePath), { recursive: true });
  fs.writeFileSync(failurePath, JSON.stringify(data, null, 2), 'utf-8');
  const stat = fs.statSync(failurePath);
  authorityTranslationFailureCacheMemo = {
    path: failurePath,
    mtimeMs: stat.mtimeMs,
    data,
  };
}

function shouldSkipRecentlyFailedAuthorityTranslation(slug: string, sourceUpdatedAt?: string): boolean {
  const cachedFailure = loadAuthorityTranslationFailureCache()[slug];
  if (!cachedFailure || cachedFailure.sourceUpdatedAt !== sourceUpdatedAt) {
    return false;
  }

  const retryAt = Date.parse(cachedFailure.retryAfterAt);
  return Number.isFinite(retryAt) && retryAt > Date.now();
}

function resolveActiveAuthorityTranslationQuotaBlock(nowMs = Date.now()): string | undefined {
  return resolveActiveAuthorityTranslationQuotaResetAt(loadAuthorityTranslationFailureCache(), {
    now: new Date(nowMs).toISOString(),
  });
}

function resolveActiveAuthorityTranslationTransientBlock(nowMs = Date.now()): string | undefined {
  return resolveActiveAuthorityTranslationTransientBlockUntil(loadAuthorityTranslationFailureCache(), {
    now: new Date(nowMs).toISOString(),
  });
}

function isModalDirectGlmFirstForTranslation(): boolean {
  const firstRole = AUTHORITY_TRANSLATION_TASK_ROLES[0];
  if (firstRole !== 'glm_classify') {
    return false;
  }

  const hasModalDirectKey = Boolean(process.env.AI_MODAL_DIRECT_KEY || process.env.MODAL_DIRECT_API_KEY);
  const provider = (
    process.env.AI_GLM_PROVIDER
    || (hasModalDirectKey ? (process.env.AI_MODAL_DIRECT_PROVIDER || 'modal-direct') : '')
  ).toLowerCase();
  const model = process.env.AI_GLM_MODEL
    || (hasModalDirectKey ? (process.env.AI_MODAL_DIRECT_MODEL || 'zai-org/GLM-5.1-FP8') : '');
  return provider.includes('modal')
    || /glm-5\.1-fp8/i.test(model);
}

function shouldStopAfterTranslationTaskFailure(taskRole: AITaskModelRole, error: unknown): boolean {
  return taskRole === 'glm_classify'
    && isModalDirectGlmFirstForTranslation()
    && (isAIGatewayProviderError(error, 'modal-direct') || error instanceof Error);
}

function shouldStopAuthorityTranslationWarmupBatch(error: unknown): boolean {
  if (isAIGatewayModalDirectRateLimitError(error) || isAIGatewayProviderError(error, 'modal-direct')) {
    return true;
  }

  if (!isModalDirectGlmFirstForTranslation() || !(error instanceof Error)) {
    return false;
  }

  return /too many concurrent|concurrent requests|timeout|timed out|empty response/i.test(getAIGatewayErrorOpsMessage(error));
}

function recordAuthorityTranslationFailure(slug: string, sourceUpdatedAt: string | undefined, error: unknown): void {
  const failureCache = loadAuthorityTranslationFailureCache();
  const message = getAIGatewayErrorOpsMessage(error);
  const previous = failureCache[slug]?.sourceUpdatedAt === sourceUpdatedAt ? failureCache[slug] : null;
  const attempts = (previous?.attempts || 0) + 1;
  const failedAt = new Date();

  failureCache[slug] = {
    slug,
    sourceUpdatedAt,
    message,
    attempts,
    failedAt: failedAt.toISOString(),
    retryAfterAt: resolveAuthorityTranslationFailureRetryAfterAt(message, failedAt, attempts),
  };
  saveAuthorityTranslationFailureCache(failureCache);
}

function clearAuthorityTranslationFailure(slug: string, sourceUpdatedAt?: string): void {
  const failureCache = loadAuthorityTranslationFailureCache();
  const cachedFailure = failureCache[slug];
  if (!cachedFailure) {
    return;
  }

  if (sourceUpdatedAt && cachedFailure.sourceUpdatedAt && cachedFailure.sourceUpdatedAt !== sourceUpdatedAt) {
    return;
  }

  delete failureCache[slug];
  saveAuthorityTranslationFailureCache(failureCache);
}

export function getCachedAuthorityTranslation(
  slug: string,
  sourceUpdatedAt?: string,
  sourceFingerprint?: string,
  fallbackSlugs: string[] = [],
): AuthorityTranslationCacheRecord | null {
  const translationCache = loadAuthorityTranslationCache();
  const candidateSlugs = Array.from(new Set([
    slug,
    ...fallbackSlugs,
    ...Object.entries(translationCache)
      .filter(([, cached]) => Boolean(
        sourceFingerprint
        && cached?.sourceFingerprint
        && cached.sourceFingerprint === sourceFingerprint,
      ))
      .map(([candidateSlug]) => candidateSlug),
  ]));

  for (const candidateSlug of candidateSlugs) {
    const cached = translationCache[candidateSlug];
    if (!isAuthorityTranslationCacheFresh(cached, { sourceUpdatedAt, sourceFingerprint })) {
      continue;
    }

    const normalized = normalizeAuthorityTranslationRecord(cached);
    if (!normalized) {
      continue;
    }

    const repaired: AuthorityTranslationCacheRecord = {
      ...normalized,
      slug,
      sourceUpdatedAt: sourceUpdatedAt || normalized.sourceUpdatedAt,
      sourceFingerprint: sourceFingerprint || normalized.sourceFingerprint,
    };
    if (
      candidateSlug !== slug
      || repaired.slug !== cached.slug
      || repaired.sourceUpdatedAt !== cached.sourceUpdatedAt
      || repaired.sourceFingerprint !== cached.sourceFingerprint
      || repaired.translatedTitle !== cached.translatedTitle
      || repaired.translatedSummary !== cached.translatedSummary
      || repaired.translatedContent !== cached.translatedContent
    ) {
      translationCache[slug] = repaired;
      saveAuthorityTranslationCache(translationCache);
    }

    return repaired;
  }
  return null;
}

function extractTaggedContent(input: string, tag: string): string {
  const match = input.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match?.[1]?.trim() || '';
}

function buildAuthorityTranslationSourceContent(input: string): { content: string; truncated: boolean } {
  const plainText = normalizeWhitespace(input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|section|article|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' '));

  if (plainText.length <= AUTHORITY_TRANSLATION_SOURCE_CHAR_LIMIT) {
    return { content: plainText, truncated: false };
  }

  const clipped = plainText.slice(0, AUTHORITY_TRANSLATION_SOURCE_CHAR_LIMIT);
  const paragraphBreak = clipped.lastIndexOf('\n\n');
  const sentenceBreak = Math.max(
    clipped.lastIndexOf('. '),
    clipped.lastIndexOf('! '),
    clipped.lastIndexOf('? '),
  );
  const safeBreak = paragraphBreak >= AUTHORITY_TRANSLATION_SOURCE_CHAR_LIMIT * 0.65
    ? paragraphBreak
    : sentenceBreak;
  const content = clipped.slice(0, safeBreak >= AUTHORITY_TRANSLATION_SOURCE_CHAR_LIMIT * 0.65 ? safeBreak + 1 : clipped.length).trim();

  return { content, truncated: true };
}

function pickFirstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function extractSectionBody(input: string, labels: string[]): string {
  const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const optionalLabelNote = '(?:\\s*[（(][^\\n）)]{0,40}[）)])?';
  const boundaryLabels = [
    'translated_title',
    'translated_summary',
    'translated_content',
    '译后标题',
    '译后摘要',
    '译后正文',
    '译后的标题',
    '译后的摘要',
    '译后的正文',
    '译文标题',
    '译文摘要',
    '译文正文',
    '原文标题',
    '原文摘要',
    '原文正文',
    '标题',
    '摘要',
    '正文',
    '内容',
    'Title',
    'Summary',
    'Content',
  ].map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:${escapedLabels.join('|')})${optionalLabelNote}\\s*[:：]\\s*([\\s\\S]*?)(?=(?:\\n\\s*(?:${boundaryLabels.join('|')})${optionalLabelNote}\\s*[:：])|$)`,
    'i',
  );
  const matched = input.match(pattern);
  return matched?.[1]?.trim() || '';
}

function matchInlineSectionLabel(line: string, labels: string[]): string | null {
  const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const optionalLabelNote = '(?:\\s*[（(][^\\n）)]{0,40}[）)])?';
  const matched = line.match(new RegExp(`^\\s*(?:${escapedLabels.join('|')})${optionalLabelNote}\\s*[:：]\\s*(.*)$`, 'i'));
  return matched ? matched[1].trim() : null;
}

function isHunyuanPreambleLine(line: string): boolean {
  return /^(?:来源机构|来源|原文标题|原文摘要|原文正文|译后标题|译后摘要|译后正文|译文标题|译文摘要|译文正文|标题|摘要|正文|内容|Source|Title|Summary|Content)(?:\s*[（(][^\n）)]{0,40}[）)])?\s*[:：]?\s*$/i.test(line.trim());
}

function normalizeHunyuanContentTail(lines: string[], labels: string[]): string | null {
  const workingLines = [...lines];
  while (workingLines.length > 0 && workingLines[0].trim() === '') {
    workingLines.shift();
  }

  if (workingLines.length > 0) {
    const firstLine = workingLines[0].trim();
    const inlineTailContent = matchInlineSectionLabel(firstLine, labels);
    if (inlineTailContent !== null) {
      const contentLines = [inlineTailContent, ...workingLines.slice(1)].join('\n').trim();
      if (contentLines) {
        return contentLines;
      }
    }
  }

  while (workingLines.length > 0 && isHunyuanPreambleLine(workingLines[0])) {
    workingLines.shift();
    while (workingLines.length > 0 && workingLines[0].trim() === '') {
      workingLines.shift();
    }
  }

  const contentLines = workingLines.join('\n').trim();
  return contentLines || null;
}

function extractHunyuanStyleTranslationPayload(input: string): {
  translatedTitle: string;
  translatedSummary: string;
  translatedContent: string;
} | null {
  const lines = input.split('\n');
  const titleLabels = ['translated_title', '译后标题', '译后的标题', '译文标题', '原文标题', '标题', 'Title'];
  const summaryLabels = ['translated_summary', '译后摘要', '译后的摘要', '译文摘要', '原文摘要', '摘要', 'Summary'];
  const contentLabels = ['translated_content', '译后正文', '译后的正文', '译文正文', '原文正文', '正文', '内容', 'Content'];
  const findLabel = (labels: string[]) => {
    for (let index = 0; index < lines.length; index += 1) {
      const value = matchInlineSectionLabel(lines[index], labels);
      if (value !== null) {
        return { index, value };
      }
    }
    return null;
  };

  const title = findLabel(titleLabels);
  const summary = findLabel(summaryLabels);
  const content = findLabel(contentLabels);
  if (!title && !summary) {
    return null;
  }

  if (content) {
    const contentLines = normalizeHunyuanContentTail([content.value, ...lines.slice(content.index + 1)], contentLabels);
    return contentLines ? {
      translatedTitle: title?.value || '',
      translatedSummary: summary?.value || '',
      translatedContent: contentLines,
    } : null;
  }

  if (!summary) {
    return null;
  }

  const contentLines = normalizeHunyuanContentTail(lines.slice(summary.index + 1), contentLabels);
  if (contentLines) {
    return {
      translatedTitle: title?.value || '',
      translatedSummary: summary.value,
      translatedContent: contentLines,
    };
  }

  return summary.value && title ? {
    translatedTitle: title?.value || '',
    translatedSummary: summary.value,
    translatedContent: summary.value,
  } : null;
}

function extractTranslationPayload(
  answer: string,
  sourceTitle: string,
  sourceSummary: string,
): {
  translatedTitle: string;
  translatedSummary: string;
  translatedContent: string;
  parseMode: 'xml' | 'json' | 'section' | 'raw';
} {
  const normalizedAnswer = normalizeWhitespace(stripCodeFence(answer));

  const xmlTitle = extractTaggedContent(normalizedAnswer, 'translated_title');
  const xmlSummary = extractTaggedContent(normalizedAnswer, 'translated_summary');
  const xmlContent = extractTaggedContent(normalizedAnswer, 'translated_content');
  if (xmlContent) {
    return {
      translatedTitle: xmlTitle || sourceTitle,
      translatedSummary: xmlSummary || sourceSummary,
      translatedContent: xmlContent,
      parseMode: 'xml',
    };
  }

  const parsedJson = extractJsonObject(normalizedAnswer);
  if (parsedJson) {
    const jsonContent = pickFirstNonEmptyString(
      parsedJson.translated_content,
      parsedJson.translatedContent,
      parsedJson.content,
      parsedJson.body,
    );
    if (jsonContent) {
      return {
        translatedTitle: pickFirstNonEmptyString(
          parsedJson.translated_title,
          parsedJson.translatedTitle,
          parsedJson.title,
          sourceTitle,
        ),
        translatedSummary: pickFirstNonEmptyString(
          parsedJson.translated_summary,
          parsedJson.translatedSummary,
          parsedJson.summary,
          sourceSummary,
        ),
        translatedContent: jsonContent,
        parseMode: 'json',
      };
    }
  }

  const hunyuanStylePayload = extractHunyuanStyleTranslationPayload(normalizedAnswer);
  if (hunyuanStylePayload) {
    return {
      translatedTitle: hunyuanStylePayload.translatedTitle || sourceTitle,
      translatedSummary: hunyuanStylePayload.translatedSummary || sourceSummary,
      translatedContent: hunyuanStylePayload.translatedContent,
      parseMode: 'section',
    };
  }

  const sectionTitle = extractSectionBody(normalizedAnswer, ['translated_title', '译后标题', '译后的标题', '译文标题', '原文标题', '标题', 'Title']);
  const sectionSummary = extractSectionBody(normalizedAnswer, ['translated_summary', '译后摘要', '译后的摘要', '译文摘要', '原文摘要', '摘要', 'Summary']);
  const sectionContent = extractSectionBody(normalizedAnswer, ['translated_content', '译后正文', '译后的正文', '译文正文', '原文正文', '正文', '内容', 'Content']);
  if (sectionContent) {
    return {
      translatedTitle: sectionTitle || sourceTitle,
      translatedSummary: sectionSummary || sourceSummary,
      translatedContent: sectionContent,
      parseMode: 'section',
    };
  }

  const strippedRaw = normalizedAnswer
    .replace(/^(?:好的[，,]?|以下是|这是|下面是)[^\n]{0,40}(?:翻译|译文|中文版)[：:。.]?\s*/u, '')
    .replace(/^translated_title:.*\n?/im, '')
    .replace(/^translated_summary:.*\n?/im, '')
    .replace(/^translated_content:?\s*/im, '')
    .trim();

  return {
    translatedTitle: sourceTitle,
    translatedSummary: sourceSummary,
    translatedContent: strippedRaw || normalizedAnswer,
    parseMode: 'raw',
  };
}

function cleanupStaleInFlightTranslations() {
  const now = Date.now();
  for (const [slug, startedAt] of authorityTranslationInFlightTimestamps) {
    if (now - startedAt > AUTHORITY_TRANSLATION_INFLIGHT_TTL_MS) {
      authorityTranslationInFlight.delete(slug);
      authorityTranslationInFlightTimestamps.delete(slug);
    }
  }
}

function shouldWarmAuthorityRecord(
  record: AuthorityCacheRecord,
  sourceLanguage: WarmAuthorityTranslationsOptions['sourceLanguage'],
): boolean {
  if (sourceLanguage === 'all') {
    return true;
  }

  const sourceTextForDetection = [
    record.question || '',
    record.summary || '',
    record.answer || '',
  ].join('\n');

  if (sourceLanguage === 'zh') {
    return record.source_language === 'zh' || isMostlyChineseText(sourceTextForDetection);
  }

  if (record.source_language && record.source_language !== 'en') {
    return false;
  }

  return !isMostlyChineseText(sourceTextForDetection);
}

export async function translateAuthorityRecord(
  slug: string,
  record: AuthorityCacheRecord,
  options: AuthorityTranslationExecutionOptions = {},
): Promise<AuthorityTranslationCacheRecord> {
  const sourceUpdatedAt = resolveAuthorityTranslationSourceUpdatedAt(record);
  const sourceFingerprint = buildAuthorityTranslationSourceFingerprint(record);
  const cached = getCachedAuthorityTranslation(slug, sourceUpdatedAt, sourceFingerprint);
  if (cached) {
    return cached;
  }

  const sourceTitle = record.question || '';
  const sourceSummary = record.summary || '';
  const { content: sourceContent, truncated: sourceContentTruncated } = buildAuthorityTranslationSourceContent(record.answer || '');
  const translationNotice = '以下内容由系统基于权威机构原文辅助翻译，仅用于阅读理解，不替代医疗建议。请以原始来源和线下医生意见为准。';
  const sourceTextForDetection = [sourceTitle, sourceSummary, sourceContent].join('\n');

  if (isMostlyChineseText(sourceTextForDetection)) {
    const payload: AuthorityTranslationCacheRecord = {
      slug,
      sourceUpdatedAt,
      sourceFingerprint,
      translatedTitle: sourceTitle,
      translatedSummary: compactTranslationSummary(sourceSummary, sourceContent),
      translatedContent: sourceContent,
      translationNotice: '当前文章原文已是中文，无需额外生成中文辅助阅读内容。',
      updatedAt: new Date().toISOString(),
      model: 'identity',
      provider: 'local',
      isSourceChinese: true,
    };
    const translationCache = loadAuthorityTranslationCache();
    translationCache[slug] = payload;
    saveAuthorityTranslationCache(translationCache);
    return payload;
  }

  let lastError: unknown;
  let result: Awaited<ReturnType<typeof callTaskModelDetailed>> | null = null;
  let parsedTranslation: ReturnType<typeof extractTranslationPayload> | null = null;

  for (const taskRole of AUTHORITY_TRANSLATION_TASK_ROLES) {
    const translationMessages = [
      {
        role: 'system' as const,
        content: taskRole === 'deepseek_translate'
          ? [
            '你是母婴权威知识库的专业翻译助手。',
            '请把英文医学健康文章准确翻译成简体中文，保持谨慎、克制、忠实原文。',
            '不要补充原文没有的建议，不要改写成诊断结论，不要省略重要风险提示。',
            '如果正文是节选，只翻译已提供内容，不要自行补全未提供段落。',
            'JSON 必须严格包含 translated_title, translated_summary, translated_content 三个字符串字段。',
            'translated_summary 只能写 1 到 2 句中文导读，控制在 80 到 100 个汉字内，必须明显短于正文。',
            '字段内必须填写真实完整译文，禁止使用省略号、占位符或“待翻译”等空内容。',
            '不要输出 Markdown、代码块或任何 JSON 外的说明。',
          ].join('\n')
          : [
            '你是母婴权威知识库的专业翻译助手。',
            '请把英文医学健康文章准确翻译成简体中文，保持谨慎、克制、忠实原文。',
            '不要补充原文没有的建议，不要改写成诊断结论，不要省略重要风险提示。',
            '如果正文是节选，只翻译已提供内容，不要自行补全未提供段落。',
            'translated_summary 只能写 1 到 2 句中文导读，控制在 80 到 100 个汉字内，必须明显短于正文。',
            '标签内必须填写真实完整译文，禁止使用省略号、占位符或“待翻译”等空内容。',
            '输出必须严格使用以下标签，不要输出任何额外说明：',
            '<translated_title>译后的标题</translated_title>',
            '<translated_summary>译后的摘要</translated_summary>',
            '<translated_content>译后的正文</translated_content>',
          ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          `来源机构：${record.source_org || record.source || '权威机构'}`,
          `原文标题：${sourceTitle}`,
          `原文摘要：${sourceSummary}`,
          sourceContentTruncated ? '原文正文（较长，以下为前段节选）：' : '原文正文：',
          sourceContent,
        ].join('\n\n'),
      },
    ];

    try {
      result = await callTaskModelDetailed(taskRole, translationMessages, {
        temperature: 0.2,
        maxTokens: AUTHORITY_TRANSLATION_MAX_TOKENS,
        timeoutMs: options.providerTimeoutMs ?? AUTHORITY_TRANSLATION_PROVIDER_TIMEOUT_MS,
        primaryOnly: true,
        responseFormat: taskRole === 'deepseek_translate' ? 'json_object' : undefined,
        thinking: taskRole === 'deepseek_translate' ? 'disabled' : undefined,
        stopOnProviderFailure: taskRole === 'glm_classify' && isModalDirectGlmFirstForTranslation()
          ? ['modal-direct']
          : undefined,
      });
    } catch (error) {
      lastError = error;
      console.error(`[Authority Translation] Task failed for ${slug} via ${taskRole}:`, error);
      if (isAIGatewayModalDirectRateLimitError(error) || shouldStopAfterTranslationTaskFailure(taskRole, error)) {
        break;
      }
      continue;
    }

    const parsed = extractTranslationPayload(result.answer, sourceTitle, sourceSummary);
    const title = sanitizeTranslationText(parsed.translatedTitle || sourceTitle, 'title');
    const summary = compactTranslationSummary(parsed.translatedSummary, sourceSummary);
    const content = sanitizeTranslationText(parsed.translatedContent, 'content');

    if (!content) {
      lastError = new Error('翻译结果解析失败');
      console.error(`[Authority Translation] Empty translation for ${slug} via ${taskRole}`);
      continue;
    }

    if (
      hasTranslationPromptLeak(title)
      || hasTranslationPromptLeak(summary)
      || hasTranslationPromptLeak(content)
    ) {
      lastError = new Error('翻译结果包含提示词模板，已丢弃');
      console.error(`[Authority Translation] Prompt leak detected for ${slug} via ${taskRole}, trying next model`);
      continue;
    }

    parsedTranslation = parsed;
    break;
  }

  if (!result || !parsedTranslation) {
    throw lastError instanceof Error ? lastError : new Error('翻译服务暂时不可用');
  }

  const translatedTitle = sanitizeTranslationText(parsedTranslation.translatedTitle || sourceTitle, 'title') || sourceTitle;
  const translatedSummary = compactTranslationSummary(parsedTranslation.translatedSummary, sourceSummary) || compactTranslationSummary(sourceSummary, sourceContent);
  const translatedContent = sanitizeTranslationText(parsedTranslation.translatedContent, 'content');

  const payload: AuthorityTranslationCacheRecord = {
    slug,
    sourceUpdatedAt,
    sourceFingerprint,
    translatedTitle,
    translatedSummary,
    translatedContent,
    translationNotice,
    updatedAt: new Date().toISOString(),
    model: parsedTranslation.parseMode === 'raw'
      ? `${result.route.model}:raw-fallback`
      : result.route.model,
    provider: result.route.provider,
    isSourceChinese: false,
  };

  const translationCache = loadAuthorityTranslationCache();
  translationCache[slug] = payload;
  saveAuthorityTranslationCache(translationCache);
  return payload;
}

export function getOrCreateAuthorityTranslation(
  slug: string,
  record: AuthorityCacheRecord,
  options: AuthorityTranslationExecutionOptions = {},
  fallbackSlugs: string[] = [],
): Promise<AuthorityTranslationCacheRecord> {
  const sourceUpdatedAt = resolveAuthorityTranslationSourceUpdatedAt(record);
  const sourceFingerprint = buildAuthorityTranslationSourceFingerprint(record);
  const cached = getCachedAuthorityTranslation(slug, sourceUpdatedAt, sourceFingerprint, fallbackSlugs);
  if (cached) {
    return Promise.resolve(cached);
  }

  cleanupStaleInFlightTranslations();

  const inFlight = authorityTranslationInFlight.get(slug);
  if (inFlight) {
    return inFlight;
  }

  const task = translateAuthorityRecord(slug, record, options)
    .finally(() => {
      authorityTranslationInFlight.delete(slug);
      authorityTranslationInFlightTimestamps.delete(slug);
    });
  authorityTranslationInFlight.set(slug, task);
  authorityTranslationInFlightTimestamps.set(slug, Date.now());
  return task;
}

export async function warmPublishedAuthorityTranslations(
  options: WarmAuthorityTranslationsOptions = {},
): Promise<WarmAuthorityTranslationsResult> {
  const sourceLanguage = options.sourceLanguage || 'en';
  const limit = Math.max(0, options.limit ?? AUTHORITY_TRANSLATION_SYNC_LIMIT);
  const delayMs = Math.max(0, options.delayMs ?? AUTHORITY_TRANSLATION_SYNC_DELAY_MS);
  const providerTimeoutMs = Math.min(
    120000,
    Math.max(
      AUTHORITY_TRANSLATION_PROVIDER_TIMEOUT_MS,
      options.providerTimeoutMs ?? AUTHORITY_TRANSLATION_WARMUP_PROVIDER_TIMEOUT_MS,
    ),
  );
  const records = await getAuthorityRecordsForTranslation();
  const failures: WarmAuthorityTranslationsResult['failures'] = [];
  const candidates: Array<{ slug: string; record: AuthorityCacheRecord; fallbackSlugs: string[] }> = [];
  let cached = 0;
  let skipped = 0;
  const quotaResetAt = options.slug
    ? undefined
    : (isModalDirectGlmFirstForTranslation()
      ? resolveActiveAuthorityTranslationTransientBlock()
      : resolveActiveAuthorityTranslationQuotaBlock());
  const quotaBlocked = Boolean(quotaResetAt);

  records.forEach((record, index) => {
    const slug = buildAuthoritySlug(record, index);
    const fallbackSlugs = buildAuthoritySlugCandidates(record, index);
    if (options.slug && slug !== options.slug) {
      if (!fallbackSlugs.includes(options.slug)) {
        skipped += 1;
        return;
      }
    }

    const sourceUpdatedAt = resolveAuthorityTranslationSourceUpdatedAt(record);
    const sourceFingerprint = buildAuthorityTranslationSourceFingerprint(record);
    if (getCachedAuthorityTranslation(slug, sourceUpdatedAt, sourceFingerprint, fallbackSlugs)) {
      fallbackSlugs.forEach((candidateSlug) => clearAuthorityTranslationFailure(candidateSlug));
      cached += 1;
      return;
    }

    if (!options.slug && fallbackSlugs.some((candidateSlug) => shouldSkipRecentlyFailedAuthorityTranslation(candidateSlug, sourceUpdatedAt))) {
      skipped += 1;
      return;
    }

    if (!shouldWarmAuthorityRecord(record, sourceLanguage)) {
      skipped += 1;
      return;
    }

    candidates.push({ slug, record, fallbackSlugs });
  });

  const selected = limit > 0 ? candidates.slice(0, limit) : [];
  let warmed = 0;
  let attempted = 0;

  if (!quotaBlocked) {
    for (let index = 0; index < selected.length; index += 1) {
      const item = selected[index];
      attempted += 1;
      try {
        await getOrCreateAuthorityTranslation(item.slug, item.record, { providerTimeoutMs }, item.fallbackSlugs);
        item.fallbackSlugs.forEach((candidateSlug) => clearAuthorityTranslationFailure(candidateSlug));
        warmed += 1;
      } catch (error) {
        recordAuthorityTranslationFailure(item.slug, resolveAuthorityTranslationSourceUpdatedAt(item.record), error);
        failures.push({
          slug: item.slug,
          message: error instanceof Error ? error.message : String(error),
        });
        if (shouldStopAuthorityTranslationWarmupBatch(error)) {
          break;
        }
      }

      if (index < selected.length - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  const effectiveSelected = quotaBlocked ? 0 : attempted;
  const effectiveSkipped = quotaBlocked ? skipped + selected.length : skipped + selected.length - attempted;

  return {
    scanned: records.length,
    candidates: candidates.length,
    selected: effectiveSelected,
    cached,
    skipped: effectiveSkipped,
    warmed,
    failed: failures.length,
    failures,
    ...(quotaBlocked ? {
      quotaBlocked: true,
      quotaResetAt,
    } : {}),
  };
}

export const __authorityTranslationInternalTestUtils = {
  isModalDirectGlmFirstForTranslation,
  shouldStopAfterTranslationTaskFailure,
  shouldStopAuthorityTranslationWarmupBatch,
  resolveActiveAuthorityTranslationQuotaBlock,
  resolveActiveAuthorityTranslationTransientBlock,
  preloadAuthorityTranslationRuntimeCache,
};
