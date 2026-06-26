import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { getAuthoritySourceConfig, inferAuthorityLocaleDefaults } from '../config/authority-sources';
import { successResponse, paginatedResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';
import { cache, CacheKeys, CacheTTL } from '../services/cache.service';
import {
  callTaskModelDetailed,
  isAIGatewayModalDirectRateLimitError,
  isAIGatewayProviderError,
  type AITaskModelRole,
} from '../services/ai-gateway.service';
import {
  detectAudience,
  detectTopic,
  isLikelyEnglishNavigationShell,
  sanitizeAuthorityTitle,
} from '../services/authority-adapters/base.adapter';
import { textToRichParagraphHtml } from '../utils/article-format';
import { awardBehaviorPoints } from '../services/checkin.service';
import {
  buildAuthorityDisplayTags,
  isChineseAuthorityArticle,
  normalizeAuthorityAudienceLabel,
  normalizeAuthorityTopicLabel,
} from '../utils/authority-metadata';
import { buildAuthoritySlugCandidates, buildStableAuthoritySlug } from '../utils/authority-identity';
import { inferAuthorityStages } from '../utils/authority-stage';
import { matchesAuthorityStageFilters } from '../utils/authority-stage-filter';
import { logger } from '../utils/logger';
import { shouldFilterAuthoritySourceUrl } from '../utils/authority-source-url';
import { getAuthorityKnowledgeDropReason, isOutOfScopeKnowledgeQuery } from '../utils/knowledge-content-guard';
import { matchesExpandedSearch } from '../utils/search-query-expansion';
import { rewriteSearchQueries } from '../services/knowledge.service';
import { recordServerRetentionBehaviorEvent } from '../services/analytics.service';
import { resolveArticleSourceUrl } from '../utils/article-source-url';
import {
  parseAuthorityTemporalDate,
  resolveReliableAuthorityUpdatedAt,
} from '../utils/authority-temporal';
import {
  extractJsonObject,
  compactTranslationSummary,
  hasTranslationPromptLeak,
  normalizeWhitespace,
  resolveChineseTranslationDisplayFields,
  sanitizeTranslationText,
  stripCodeFence,
} from '../utils/article-translation';
import {
  buildAuthorityTranslationSourceFingerprint,
  isAuthorityTranslationCacheFresh,
  resolveAuthorityTranslationSourceUpdatedAt,
} from '../utils/authority-translation-source';
import {
  resolveAuthorityTranslationTaskRoles,
} from '../utils/authority-translation-routing';

interface AuthorityCacheRecord {
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

type ArticleTagRelation = {
  tag: {
    id: bigint;
    name: string;
    slug: string;
  };
};

type CountRow = {
  total: bigint | number | string | null;
};

const articleDetailInclude = {
  category: {
    include: { parent: true },
  },
  author: true,
  tags: {
    include: { tag: true },
  },
} satisfies Prisma.ArticleInclude;

type ArticleDetailCacheRecord = Prisma.ArticleGetPayload<{
  include: typeof articleDetailInclude;
}>;

const AUTHORITY_CACHE_PATHS = [
  '/tmp/authority-knowledge-cache.json',
  path.join(process.cwd(), 'data', 'authority-knowledge-cache.json'),
  path.join(__dirname, '../../data/authority-knowledge-cache.json'),
];
const AUTHORITY_TRANSLATION_CACHE_PATH = process.env.AUTHORITY_TRANSLATION_CACHE_PATH || '';
const AUTHORITY_TRANSLATION_CACHE_PATHS = [
  AUTHORITY_TRANSLATION_CACHE_PATH,
  path.join(process.cwd(), 'data', 'authority-translation-cache.json'),
  path.join(__dirname, '../../data/authority-translation-cache.json'),
  '/tmp/authority-translation-cache.json',
].filter(Boolean);

let authorityCacheMemo: { path: string; mtimeMs: number; records: AuthorityCacheRecord[] } | null = null;
let authorityTranslationCacheMemo: Record<string, AuthorityTranslationCacheRecord> | null = null;
let authorityTranslationCacheMemoSignature = '';
let translationCacheWriteQueue: Promise<void> = Promise.resolve();
const authorityTranslationInFlight = new Map<string, Promise<AuthorityTranslationCacheRecord>>();
const authorityTranslationInFlightTimestamps = new Map<string, number>();
const AUTHORITY_TRANSLATION_INFLIGHT_TTL_MS = 2 * 60 * 1000; // 2 分钟

function cleanupStaleInFlightTranslations() {
  const now = Date.now();
  for (const [slug, startedAt] of authorityTranslationInFlightTimestamps) {
    if (now - startedAt > AUTHORITY_TRANSLATION_INFLIGHT_TTL_MS) {
      authorityTranslationInFlight.delete(slug);
      authorityTranslationInFlightTimestamps.delete(slug);
    }
  }
}
const AUTHORITY_TRANSLATION_WAIT_TIMEOUT_MS = Math.min(
  18000,
  Math.max(1000, Number.parseInt(process.env.AUTHORITY_TRANSLATION_WAIT_TIMEOUT_MS || '16000', 10) || 16000),
);
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
const AUTHORITY_TRANSLATION_TASK_ROLES: AITaskModelRole[] = resolveAuthorityTranslationTaskRoles();
const AUTHORITY_TRANSLATION_LIST_PREWARM_LIMIT = Math.max(
  0,
  Number.parseInt(process.env.AUTHORITY_TRANSLATION_LIST_PREWARM_LIMIT || '0', 10) || 0,
);
const AUTHORITY_TRANSLATION_SOURCE_CHAR_LIMIT = Math.max(
  1800,
  Number.parseInt(process.env.AUTHORITY_TRANSLATION_SOURCE_CHAR_LIMIT || '3200', 10) || 3200,
);
const AUTHORITY_TRANSLATION_MAX_TOKENS = Math.max(
  1000,
  Number.parseInt(process.env.AUTHORITY_TRANSLATION_MAX_TOKENS || '1600', 10) || 1600,
);
interface AuthorityTranslationExecutionOptions {
  providerTimeoutMs?: number;
}

interface AuthorityTranslationCacheRecord {
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

interface AuthorityArticleTranslationApiResponse {
  status: 'ready' | 'processing';
  retryAfterMs?: number;
  translation?: AuthorityTranslationCacheRecord;
}

type AuthorityArticle = ReturnType<typeof mapAuthorityRecordToArticle>;

function normalizeAuthorityRecordTemporalFields(record: AuthorityCacheRecord): AuthorityCacheRecord {
  const metadataFetchedAt = typeof record.metadata?.fetchedAt === 'string'
    ? record.metadata.fetchedAt
    : undefined;
  const reliableSourceUpdatedAt = resolveReliableAuthorityUpdatedAt(
    {
      sourceId: record.source_id,
      sourceOrg: record.source_org || record.source,
      sourceUrl: record.source_url || record.url,
      updatedAt: parseAuthorityTemporalDate(record.source_updated_at),
      fetchedAt: record.last_synced_at || metadataFetchedAt,
      collectedAt: record.created_at,
      updatedAtSource: typeof record.metadata?.updatedAtSource === 'string' ? record.metadata.updatedAtSource : undefined,
    },
  );

  if (record.source_updated_at && !reliableSourceUpdatedAt) {
    return {
      ...record,
      updated_at: undefined,
      published_at: record.created_at || record.published_at,
      source_updated_at: undefined,
    };
  }

  return record;
}

function hashStringToPositiveInt(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
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

function buildAuthoritySlug(record: AuthorityCacheRecord, index: number): string {
  return buildStableAuthoritySlug(record, index);
}

function getAuthoritySlugCandidates(record: AuthorityCacheRecord, index: number): string[] {
  return buildAuthoritySlugCandidates(record, index);
}

function toRichTextHtml(text: string): string {
  return textToRichParagraphHtml(text);
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

type AuthorityReadableLength = {
  count: number;
  unit: '字' | '词';
};

function countAuthorityReadableLength(input?: string): AuthorityReadableLength {
  const plainText = normalizeAuthorityText(input || '')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) {
    return { count: 0, unit: '字' };
  }

  const cjkChars = countMatches(plainText, /[\u3400-\u4dbf\u4e00-\u9fff]/gu);
  const latinWords = countMatches(plainText, /[A-Za-z]+(?:[-'][A-Za-z]+)*/g);
  const numberGroups = countMatches(plainText, /\b\d+(?:[.,]\d+)*\b/g);

  if (cjkChars > 0) {
    return {
      count: cjkChars + latinWords + numberGroups,
      unit: '字',
    };
  }

  if (latinWords > 0 || numberGroups > 0) {
    return {
      count: latinWords + numberGroups,
      unit: '词',
    };
  }

  return {
    count: plainText.replace(/[^\p{L}\p{N}]/gu, '').length,
    unit: '字',
  };
}

function resolveAuthorityReadingTime(record: AuthorityCacheRecord, readableLength: AuthorityReadableLength): number {
  const storedReadTime = typeof record.read_time === 'number'
    ? record.read_time
    : Number.parseFloat(String(record.read_time || ''));
  if (Number.isFinite(storedReadTime) && storedReadTime > 0) {
    return Math.max(1, Math.ceil(storedReadTime));
  }

  if (readableLength.count <= 0) {
    return 0;
  }

  const speed = readableLength.unit === '词' ? 220 : 600;
  return Math.max(1, Math.ceil(readableLength.count / speed));
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

function resolveAuthoritySummaryText(record: Pick<AuthorityCacheRecord, 'question' | 'summary' | 'answer'>): string {
  const title = normalizeAuthorityText(record.question || '');
  const summary = stripAuthorityPageChrome(record.summary || '');
  const answer = stripAuthorityPageChrome(record.answer || '');
  const summaryChromeCount = countAuthorityChromeMatches(record.summary || '');

  if (summary && summaryChromeCount < 4) {
    return summary;
  }

  if (answer && answer !== title) {
    return answer;
  }

  return title;
}

function isAuthorityRecordLowValue(record: Pick<AuthorityCacheRecord, 'question' | 'summary' | 'answer'>): boolean {
  const title = normalizeAuthorityText(record.question || '');
  const rawSummary = normalizeAuthorityText(record.summary || '');
  const rawAnswer = normalizeAuthorityText(record.answer || '');

  if (isLikelyEnglishNavigationShell(`${rawSummary} ${rawAnswer}`)) {
    return true;
  }

  // Completely empty records have no value
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

  // Too short content + summary → low value
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

function normalizeAuthorityDedupeKey(input: string): string {
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

function normalizeAuthorityTitleDedupeKey(input: string): string {
  return sanitizeAuthorityTitle(input)
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[“”"']/g, '')
    .replace(/[，。；：、]/g, ' ')
    .replace(/[|()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAuthoritySourceDedupeKey(input: string): string {
  return normalizeAuthorityText(input)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericAuthorityTitleKey(titleKey: string): boolean {
  if (!titleKey) {
    return true;
  }

  const genericTitleKeys = new Set([
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

  return titleKey.length < 8 || genericTitleKeys.has(titleKey);
}

function isLowValueAuthorityListTitle(
  article: ReturnType<typeof mapAuthorityRecordToArticle>,
): boolean {
  const titleKey = normalizeAuthorityTitleDedupeKey(article.title || '');
  const sourceKey = normalizeAuthoritySourceDedupeKey(article.sourceOrg || article.source || '');
  if (!titleKey) {
    return true;
  }

  if (sourceKey && titleKey === sourceKey) {
    return true;
  }

  return /^(acknowledgments?, contributors?, and participants|keeping guidance up to date)(?:\s*\|.*)?$/i.test(titleKey);
}

function buildAuthorityArticleDedupeKeys(
  article: ReturnType<typeof mapAuthorityRecordToArticle>,
): string[] {
  const keys = [normalizeAuthorityDedupeKey(article.sourceUrl || article.originalId || article.slug)]
    .filter(Boolean);

  const titleKey = normalizeAuthorityTitleDedupeKey(article.title || '');
  const sourceKey = normalizeAuthoritySourceDedupeKey(article.sourceOrg || article.source || '');
  if (sourceKey && titleKey && !isGenericAuthorityTitleKey(titleKey)) {
    keys.push(`title:${sourceKey}:${titleKey}`);
  }

  return Array.from(new Set(keys));
}

function toAuthoritySummary(text: string): string {
  return compactTranslationSummary(normalizeAuthorityText(text), '', 96);
}

function resolveAuthorityLocale(record: Pick<AuthorityCacheRecord, 'source_id' | 'region' | 'source_language' | 'source_locale'>) {
  const defaults = inferAuthorityLocaleDefaults(record.source_id, record.region);
  return {
    sourceLanguage: record.source_language || defaults.sourceLanguage,
    sourceLocale: record.source_locale || defaults.sourceLocale,
  };
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

  // Auto-generate summary from content when missing or too short
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

function loadAuthorityCacheRecords(): AuthorityCacheRecord[] {
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

function resolveWritableAuthorityCachePath(): string {
  const existingPath = AUTHORITY_CACHE_PATHS.find((candidate) => fs.existsSync(candidate));
  return existingPath || AUTHORITY_CACHE_PATHS[0];
}

function saveAuthorityCacheRecords(records: AuthorityCacheRecord[]): void {
  const cachePath = resolveWritableAuthorityCachePath();
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(records, null, 2), 'utf-8');
  const stat = fs.statSync(cachePath);
  authorityCacheMemo = { path: cachePath, mtimeMs: stat.mtimeMs, records };
}

function incrementAuthorityViewCountBySlug(slug: string): number | null {
  const records = loadAuthorityCacheRecords();
  if (records.length === 0) {
    return null;
  }

  const recordIndex = records.findIndex((item, index) => getAuthoritySlugCandidates(item, index).includes(slug));
  if (recordIndex < 0) {
    return null;
  }

  const currentValue = Number(records[recordIndex]?.view_count || 0);
  const nextValue = Number.isFinite(currentValue) ? currentValue + 1 : 1;
  records[recordIndex] = {
    ...records[recordIndex],
    view_count: nextValue,
  };
  saveAuthorityCacheRecords(records);
  return nextValue;
}

function loadAuthorityTranslationCache(): Record<string, AuthorityTranslationCacheRecord> {
  const signature = AUTHORITY_TRANSLATION_CACHE_PATHS.map((cachePath) => {
    try {
      const stat = fs.statSync(cachePath);
      return `${cachePath}:${stat.mtimeMs}:${stat.size}`;
    } catch {
      return `${cachePath}:missing`;
    }
  }).join('|');

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
      const raw = fs.readFileSync(cachePath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, AuthorityTranslationCacheRecord>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        continue;
      }

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

function saveAuthorityTranslationCache(data: Record<string, AuthorityTranslationCacheRecord>): void {
  authorityTranslationCacheMemo = data;
  authorityTranslationCacheMemoSignature = '';
  translationCacheWriteQueue = translationCacheWriteQueue.then(() => {
    const cachePath = resolveWritableTranslationCachePath();
    let diskCache: Record<string, AuthorityTranslationCacheRecord> = {};
    if (fs.existsSync(cachePath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as Record<string, AuthorityTranslationCacheRecord>;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          diskCache = parsed;
        }
      } catch {
        diskCache = {};
      }
    }
    const merged = {
      ...diskCache,
      ...data,
    };
    authorityTranslationCacheMemo = merged;
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(merged, null, 2), 'utf-8');
    authorityTranslationCacheMemoSignature = AUTHORITY_TRANSLATION_CACHE_PATHS.map((candidate) => {
      try {
        const stat = fs.statSync(candidate);
        return `${candidate}:${stat.mtimeMs}:${stat.size}`;
      } catch {
        return `${candidate}:missing`;
      }
    }).join('|');
  }).catch((err) => {
    console.error('[Authority Translation] Cache write failed:', err);
  });
}

function getCachedAuthorityTranslation(
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

function getCachedAuthorityArticleTranslation(article: AuthorityArticle): AuthorityTranslationCacheRecord | null {
  return getCachedAuthorityTranslation(
    article.slug,
    article.sourceUpdatedAt || article.updatedAt || article.publishedAt || article.createdAt,
    article.sourceFingerprint,
    article.slugCandidates,
  );
}

function withAuthorityDisplayTranslation(
  article: AuthorityArticle,
  options: { includeContent?: boolean; includeTranslation?: boolean } = {},
) {
  const translation = getCachedAuthorityArticleTranslation(article);
  if (!translation) {
    return article;
  }

  const displayFields = resolveChineseTranslationDisplayFields({
    sourceTitle: article.title,
    sourceSummary: article.summary,
    translatedTitle: translation.translatedTitle,
    translatedSummary: translation.translatedSummary,
    translatedContent: translation.translatedContent,
  });
  const displayContentText = options.includeContent
    ? displayFields.displayContentText
    : '';
  const displayContent = displayContentText ? textToRichParagraphHtml(displayContentText) : '';

  return {
    ...article,
    displayTitle: displayFields.displayTitle || article.title,
    displaySummary: displayFields.displaySummary || article.summary,
    ...(options.includeContent ? { displayContent: displayContent || article.content } : {}),
    ...(options.includeTranslation ? { translation } : {}),
    hasChineseTranslation: true,
  };
}

function stripAuthorityInternalFields<T extends { slugCandidates?: string[] }>(article: T): Omit<T, 'slugCandidates'> {
  const { slugCandidates: _slugCandidates, ...publicArticle } = article;
  return publicArticle;
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

async function getAuthorityRecords(): Promise<AuthorityCacheRecord[]> {
  const cacheRecords = loadAuthorityCacheRecords();
  if (cacheRecords.length > 0) {
    return cacheRecords
      .map(normalizeAuthorityRecordTemporalFields)
      .filter((record) => !shouldFilterAuthoritySourceUrl(record))
      .filter((record) => !getAuthorityKnowledgeDropReason(record))
      .filter((record) => !isInvalidAuthoritySourceUrl(record))
      .filter((record) => !isAuthorityRecordLowValue(record));
  }

  const rows = await prisma.$queryRawUnsafe<Array<{
    id: bigint;
    sourceId: string;
    sourceOrg: string;
    sourceUrl: string;
    title: string;
    summary: string;
    contentText: string;
    updatedAt: Date | null;
    createdAt: Date;
    audience: string;
    topic: string;
    region: string;
    metadataJson: string | null;
  }>>(
    `SELECT
      id,
      source_id AS sourceId,
      source_org AS sourceOrg,
      source_url AS sourceUrl,
      title,
      summary,
      content_text AS contentText,
      updated_at AS updatedAt,
      created_at AS createdAt,
      audience,
      topic,
      region,
      metadata_json AS metadataJson
     FROM authority_normalized_documents
     WHERE publish_status = 'published'
     ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
     LIMIT 1000`
  );

  return rows
    .map((row) => mapAuthorityDbRowToRecord(row))
    .filter((record) => !shouldFilterAuthoritySourceUrl(record))
    .filter((record) => !getAuthorityKnowledgeDropReason(record))
    .filter((record) => !isInvalidAuthoritySourceUrl(record))
    .filter((record) => !isAuthorityRecordLowValue(record));
}

async function findAuthorityRecordMatchBySlug(slug: string): Promise<{
  record: AuthorityCacheRecord;
  index: number;
  slug: string;
  slugCandidates: string[];
} | null> {
  const records = await getAuthorityRecords();
  const index = records.findIndex((item, itemIndex) => getAuthoritySlugCandidates(item, itemIndex).includes(slug));
  if (index < 0) {
    return null;
  }

  const record = records[index];
  return {
    record,
    index,
    slug: buildAuthoritySlug(record, index),
    slugCandidates: getAuthoritySlugCandidates(record, index),
  };
}

function extractTaggedContent(input: string, tag: string): string {
  const match = input.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match?.[1]?.trim() || '';
}

function normalizeAuthorityTranslationRecord(
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

  // Strip common AI preamble / prompt residue before using raw content
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

async function translateAuthorityRecord(
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

function getOrCreateAuthorityTranslation(
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

  // 清理超时的 in-flight 条目，防止泄漏
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

function prewarmAuthorityTranslation(slug: string, record: AuthorityCacheRecord, fallbackSlugs: string[] = []): void {
  const sourceUpdatedAt = resolveAuthorityTranslationSourceUpdatedAt(record);
  const sourceFingerprint = buildAuthorityTranslationSourceFingerprint(record);
  if (getCachedAuthorityTranslation(slug, sourceUpdatedAt, sourceFingerprint, fallbackSlugs) || authorityTranslationInFlight.has(slug)) {
    return;
  }

  void getOrCreateAuthorityTranslation(slug, record, {
    providerTimeoutMs: AUTHORITY_TRANSLATION_WARMUP_PROVIDER_TIMEOUT_MS,
  }, fallbackSlugs).catch((error) => {
    console.error(`[Authority Translation] Prewarm failed for ${slug}:`, error);
  });
}

async function waitForAuthorityTranslation(
  slug: string,
  record: AuthorityCacheRecord,
  timeoutMs = AUTHORITY_TRANSLATION_WAIT_TIMEOUT_MS,
  fallbackSlugs: string[] = [],
): Promise<AuthorityTranslationCacheRecord | null> {
  const sourceUpdatedAt = resolveAuthorityTranslationSourceUpdatedAt(record);
  const sourceFingerprint = buildAuthorityTranslationSourceFingerprint(record);
  const cached = getCachedAuthorityTranslation(slug, sourceUpdatedAt, sourceFingerprint, fallbackSlugs);
  if (cached) {
    return cached;
  }

  const translationTask = getOrCreateAuthorityTranslation(slug, record, {}, fallbackSlugs).catch((error) => {
    console.error(`[Authority Translation] Wait failed for ${slug}:`, error);
    return null;
  });
  const timeoutTask = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

  return Promise.race([
    translationTask,
    timeoutTask,
  ]);
}

function buildAuthorityTranslationResponse(
  status: AuthorityArticleTranslationApiResponse['status'],
  options: {
    retryAfterMs?: number;
    translation?: AuthorityTranslationCacheRecord;
  } = {},
): AuthorityArticleTranslationApiResponse {
  return {
    status,
    retryAfterMs: options.retryAfterMs,
    translation: options.translation,
  };
}

function mapAuthorityDbRowToRecord(row: {
  id: bigint;
  sourceId: string;
  sourceOrg: string;
  sourceUrl: string;
  title: string;
  summary: string;
  contentText: string;
  updatedAt: Date | null;
  createdAt: Date;
  audience: string;
  topic: string;
  region: string;
  metadataJson: string | null;
}): AuthorityCacheRecord {
  let metadataTags: string[] = [];
  let metadataSourceLanguage: 'zh' | 'en' | undefined;
  let metadataSourceLocale: string | undefined;
  let metadataSourceClass: 'official' | 'medical_platform' | 'dataset' | 'unknown' | undefined;
  let metadataFetchedAt: string | undefined;
  let metadataUpdatedAtSource: string | undefined;
  try {
    const parsed = row.metadataJson ? JSON.parse(row.metadataJson) as {
      tags?: unknown;
      sourceLanguage?: unknown;
      sourceLocale?: unknown;
      sourceClass?: unknown;
      fetchedAt?: unknown;
      updatedAtSource?: unknown;
    } : {};
    metadataTags = Array.isArray(parsed.tags) ? parsed.tags.map((tag) => String(tag)) : [];
    metadataSourceLanguage = parsed.sourceLanguage === 'zh' || parsed.sourceLanguage === 'en'
      ? parsed.sourceLanguage
      : undefined;
    metadataSourceLocale = typeof parsed.sourceLocale === 'string' ? parsed.sourceLocale : undefined;
    metadataSourceClass = parsed.sourceClass === 'official'
      || parsed.sourceClass === 'medical_platform'
      || parsed.sourceClass === 'dataset'
      || parsed.sourceClass === 'unknown'
      ? parsed.sourceClass
      : undefined;
    metadataFetchedAt = typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : undefined;
    metadataUpdatedAtSource = typeof parsed.updatedAtSource === 'string' ? parsed.updatedAtSource : undefined;
  } catch {
    metadataTags = [];
  }

  const cleanedTitle = sanitizeAuthorityTitle(row.title);
  const localeDefaults = inferAuthorityLocaleDefaults(row.sourceId, row.region);
  const reliableUpdatedAt = resolveReliableAuthorityUpdatedAt({
    sourceId: row.sourceId,
    sourceOrg: row.sourceOrg,
    sourceUrl: row.sourceUrl,
    updatedAt: row.updatedAt,
    fetchedAt: metadataFetchedAt,
    collectedAt: row.createdAt,
    updatedAtSource: metadataUpdatedAtSource,
  });
  const stableDate = reliableUpdatedAt || row.createdAt;
  const sourceConfig = getAuthoritySourceConfig(row.sourceId);
  const inferredAudience = detectAudience({
    sourceUrl: row.sourceUrl,
    title: cleanedTitle,
    summary: row.summary,
    contentText: row.contentText,
  }, sourceConfig || {
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
  }, sourceConfig || {
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

  return {
    id: `authority-db-${row.id.toString()}`,
    content_type: 'authority',
    question: cleanedTitle,
    answer: row.contentText,
    summary: row.summary,
    category: inferredTopic,
    tags: buildAuthorityDisplayTags({
      topic: inferredTopic,
      audience: inferredAudience,
      tags: metadataTags,
      sourceOrg: row.sourceOrg,
    }),
    difficulty: 'authoritative',
    is_verified: true,
    status: 'published',
    view_count: 0,
    like_count: 0,
    created_at: row.createdAt.toISOString(),
    updated_at: reliableUpdatedAt?.toISOString(),
    published_at: stableDate.toISOString(),
    source_id: row.sourceId,
    source: row.sourceOrg,
    source_org: row.sourceOrg,
    source_class: metadataSourceClass || 'official',
    source_url: row.sourceUrl,
    source_language: metadataSourceLanguage || localeDefaults.sourceLanguage,
    source_locale: metadataSourceLocale || localeDefaults.sourceLocale,
    source_updated_at: reliableUpdatedAt?.toISOString(),
    last_synced_at: metadataFetchedAt || row.createdAt.toISOString(),
    url: row.sourceUrl,
    audience: inferredAudience,
    topic: inferredTopic,
    region: row.region,
    original_id: row.sourceUrl,
  };
}

function mapAuthorityRecordToArticle(record: AuthorityCacheRecord, index: number) {
  const sourceOrg = record.source_org || record.source || '权威机构';
  const { sourceLanguage, sourceLocale } = resolveAuthorityLocale(record);
  const slug = buildAuthoritySlug(record, index);
  const slugCandidates = getAuthoritySlugCandidates(record, index);
  const localeDefaults = inferAuthorityLocaleDefaults(
    record.source_id,
    record.region,
  );
  const sourceConfig = getAuthoritySourceConfig(record.source_id || '');
  const inferredAudience = detectAudience({
    sourceUrl: record.source_url || record.url,
    title: record.question,
    summary: record.summary,
    contentText: record.answer,
  }, sourceConfig || {
    id: record.source_id || sourceOrg,
    org: sourceOrg,
    baseUrl: record.source_url || record.url || '',
    allowedDomains: [],
    discoveryType: 'index_page',
    entryUrls: [],
    region: (record.region as 'US' | 'UK' | 'CN' | 'GLOBAL') || 'GLOBAL',
    language: localeDefaults.sourceLanguage,
    locale: localeDefaults.sourceLocale,
    audience: [record.audience || '母婴家庭'],
    topics: [record.topic || record.category || 'general'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 1,
    parserId: record.source_id || sourceOrg,
  });
  const inferredTopic = detectTopic({
    sourceUrl: record.source_url || record.url,
    title: record.question,
    summary: record.summary,
    contentText: record.answer,
  }, sourceConfig || {
    id: record.source_id || sourceOrg,
    org: sourceOrg,
    baseUrl: record.source_url || record.url || '',
    allowedDomains: [],
    discoveryType: 'index_page',
    entryUrls: [],
    region: (record.region as 'US' | 'UK' | 'CN' | 'GLOBAL') || 'GLOBAL',
    language: localeDefaults.sourceLanguage,
    locale: localeDefaults.sourceLocale,
    audience: [record.audience || '母婴家庭'],
    topics: [record.topic || record.category || 'general'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 1,
    parserId: record.source_id || sourceOrg,
  });
  const inferredStages = inferAuthorityStages({
    title: record.question,
    summary: record.summary,
    contentText: record.answer,
    audience: inferredAudience,
    topic: inferredTopic,
  });
  const targetStages = inferredStages.length > 0
    ? inferredStages
    : (record.target_stage?.length ? record.target_stage : []);
  const tags = buildAuthorityDisplayTags({
    topic: inferredTopic,
    audience: inferredAudience,
    tags: record.tags,
    sourceOrg,
  }).map((tag, tagIndex) => ({
      id: tagIndex + 1,
      name: String(tag),
      slug: String(tag).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-'),
      articleCount: 0,
      createdAt: record.created_at || record.published_at || new Date().toISOString(),
    }));
  const readableLength = countAuthorityReadableLength(record.answer || record.summary || '');

  return {
    id: hashStringToPositiveInt(record.id || slug),
    title: record.question,
    slug,
    slugCandidates,
    summary: toAuthoritySummary(resolveAuthoritySummaryText(record)),
    content: toRichTextHtml(record.answer || ''),
    categoryId: 0,
    category: {
      id: 0,
      name: sourceOrg,
      slug: 'authority-source',
      sortOrder: 0,
      articleCount: 0,
      createdAt: record.created_at || record.published_at || new Date().toISOString(),
      updatedAt: record.updated_at || record.published_at || new Date().toISOString(),
    },
    tags,
    author: sourceOrg,
    viewCount: record.view_count || 0,
    likeCount: record.like_count || 0,
    collectCount: 0,
    readingTime: resolveAuthorityReadingTime(record, readableLength),
    readableTextLength: readableLength.count,
    readableTextUnit: readableLength.unit,
    stage: targetStages[0],
    targetStages,
    difficulty: record.difficulty || 'authoritative',
    contentType: 'authority',
    isVerified: record.is_verified !== false,
    disclaimer: '本文内容来自权威机构公开资料，仅供健康信息参考，不能替代医生面诊。',
    status: 1,
    publishedAt: record.published_at || record.updated_at || record.created_at,
    createdAt: record.created_at || record.published_at || new Date().toISOString(),
    updatedAt: record.updated_at || record.published_at || new Date().toISOString(),
    isLiked: false,
    isFavorited: false,
    source: record.source,
    sourceOrg,
    sourceClass: record.source_class || 'official',
    sourceUrl: record.source_url || record.url,
    sourceLanguage,
    sourceLocale,
    sourceUpdatedAt: record.source_updated_at,
    sourceFingerprint: buildAuthorityTranslationSourceFingerprint(record),
    lastSyncedAt: record.last_synced_at || record.updated_at || record.created_at,
    audience: normalizeAuthorityAudienceLabel(inferredAudience),
    topic: normalizeAuthorityTopicLabel(inferredTopic || record.category),
    region: record.region,
    originalId: record.original_id || record.id,
  };
}

function isOfficialAuthorityRecord(record: AuthorityCacheRecord): boolean {
  return (record.source_class || 'official') === 'official';
}

function pickBetterAuthorityArticle(
  left: ReturnType<typeof mapAuthorityRecordToArticle>,
  right: ReturnType<typeof mapAuthorityRecordToArticle>,
) {
  const leftSummary = normalizeAuthorityText(left.summary || '');
  const rightSummary = normalizeAuthorityText(right.summary || '');
  const leftQuality = (leftSummary.length >= 40 ? 1 : 0) - countAuthorityChromeMatches(left.summary || left.content || '');
  const rightQuality = (rightSummary.length >= 40 ? 1 : 0) - countAuthorityChromeMatches(right.summary || right.content || '');
  if (leftQuality !== rightQuality) {
    return leftQuality > rightQuality ? left : right;
  }

  const updatedDiff = getAuthorityArticleTimestamp(left) - getAuthorityArticleTimestamp(right);
  if (updatedDiff !== 0) {
    return updatedDiff > 0 ? left : right;
  }

  const sourcePriorityDiff = getAuthorityArticleSourcePriority(right) - getAuthorityArticleSourcePriority(left);
  if (sourcePriorityDiff !== 0) {
    return sourcePriorityDiff > 0 ? left : right;
  }

  return (left.lastSyncedAt || '') >= (right.lastSyncedAt || '') ? left : right;
}

async function getAuthorityArticles() {
  const records = await getAuthorityRecords();
  const deduped = new Map<string, ReturnType<typeof mapAuthorityRecordToArticle>>();

  records
    .filter(isOfficialAuthorityRecord)
    .map(mapAuthorityRecordToArticle)
    .filter((article) => !isLowValueAuthorityListTitle(article))
    .forEach((article) => {
      const dedupeKeys = buildAuthorityArticleDedupeKeys(article);
      const existing = dedupeKeys
        .map(key => deduped.get(key))
        .find((item): item is ReturnType<typeof mapAuthorityRecordToArticle> => Boolean(item));
      if (!existing) {
        dedupeKeys.forEach(key => deduped.set(key, article));
        return;
      }

      const selected = pickBetterAuthorityArticle(existing, article);
      dedupeKeys.forEach(key => deduped.set(key, selected));
    });

  return Array.from(new Map(
    Array.from(deduped.values()).map(article => [article.slug, article]),
  ).values());
}

async function getAuthorityArticleByNumericId(id: number) {
  const articles = await getAuthorityArticles();
  return articles.find((article) => article.id === id) || null;
}

async function getAuthorityRelatedArticlesByNumericId(id: number, limit: number) {
  const current = await getAuthorityArticleByNumericId(id);
  if (!current) {
    return [];
  }

  const related = (await getAuthorityArticles())
    .filter((item) => item.slug !== current.slug)
    .map((item) => {
      let score = 0;
      if (current.topic && item.topic === current.topic) score += 5;
      if (current.stage && item.stage === current.stage) score += 3;
      if (current.audience && item.audience === current.audience) score += 2;
      if ((current.sourceOrg || current.source) && (item.sourceOrg || item.source) === (current.sourceOrg || current.source)) score += 1;

      return { item, score };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return getAuthorityArticleTimestamp(right.item) - getAuthorityArticleTimestamp(left.item);
    })
    .slice(0, limit)
    .map(({ item }) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      coverImage: null,
      viewCount: item.viewCount || 0,
      publishedAt: item.publishedAt || item.sourceUpdatedAt || item.createdAt,
    }));

  return related;
}

async function prewarmAuthorityTranslationsForArticles(
  articles: Array<ReturnType<typeof mapAuthorityRecordToArticle>>,
  limit = AUTHORITY_TRANSLATION_LIST_PREWARM_LIMIT,
): Promise<void> {
  if (limit <= 0) {
    return;
  }

  const englishArticles = articles
    .filter((article) => !isChineseAuthorityArticle(article))
    .slice(0, limit);

  if (englishArticles.length === 0) {
    return;
  }

  const records = await getAuthorityRecords();
  const recordsBySlug = new Map<string, { record: AuthorityCacheRecord; fallbackSlugs: string[] }>();
  records.forEach((record, index) => {
    recordsBySlug.set(buildAuthoritySlug(record, index), {
      record,
      fallbackSlugs: getAuthoritySlugCandidates(record, index),
    });
  });

  englishArticles.forEach((article) => {
    const match = recordsBySlug.get(article.slug);
    if (match) {
      prewarmAuthorityTranslation(article.slug, match.record, match.fallbackSlugs);
    }
  });
}

function getAuthorityArticleSortDate(article: ReturnType<typeof mapAuthorityRecordToArticle>): string | undefined {
  // Align sorting with the date shown in the UI. sourceUpdatedAt is the most
  // reliable signal, but it is intentionally nulled out for fetch-time noise
  // (see resolveReliableAuthorityUpdatedAt); fall back to the displayed date so
  // recency ordering stays consistent with what the user sees.
  return article.sourceUpdatedAt || article.publishedAt || article.updatedAt || article.createdAt;
}

function getAuthorityArticleTimestamp(article: ReturnType<typeof mapAuthorityRecordToArticle>): number {
  const value = getAuthorityArticleSortDate(article);
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getAuthorityArticleDateBucket(article: ReturnType<typeof mapAuthorityRecordToArticle>): string {
  const value = getAuthorityArticleSortDate(article);
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function getAuthorityArticleSourcePriority(article: ReturnType<typeof mapAuthorityRecordToArticle>): number {
  if (article.sourceClass === 'medical_platform') {
    return 0;
  }

  return isChineseAuthorityArticle(article) ? 1 : 2;
}

function getAuthorityArticlePathname(article: ReturnType<typeof mapAuthorityRecordToArticle>): string {
  const url = article.sourceUrl || '';
  if (!url) {
    return '';
  }

  try {
    return new URL(url).pathname.toLowerCase().replace(/\/+$/u, '') || '/';
  } catch {
    return '';
  }
}

function isAuthorityLandingLikePath(pathname: string): boolean {
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

function getAuthorityArticleQualityScore(article: ReturnType<typeof mapAuthorityRecordToArticle>): number {
  const titleKey = normalizeAuthorityTitleDedupeKey(article.title || '');
  const sourceKey = normalizeAuthoritySourceDedupeKey(article.sourceOrg || article.source || '');
  const pathname = getAuthorityArticlePathname(article);
  const summaryLength = normalizeAuthorityText(article.summary || '').length;
  const titleLength = titleKey.length;

  let score = 0;

  if (summaryLength >= 80) score += 4;
  else if (summaryLength >= 40) score += 2;

  if (article.audience) score += 2;
  if (article.topic && article.topic !== 'general') score += 2;
  if (article.topic && article.topic !== 'policy') score += 1;
  if (titleLength >= 12 && titleLength <= 120) score += 1;
  if (!isAuthorityLandingLikePath(pathname)) score += 2;

  if (article.topic === 'policy') score -= 5;
  if (isGenericAuthorityTitleKey(titleKey)) score -= 4;
  if (isLowValueAuthorityListTitle(article)) score -= 8;
  if (sourceKey && titleKey === sourceKey) score -= 8;
  if (isAuthorityLandingLikePath(pathname)) score -= 3;

  return score;
}

function toAuthorityArticleListItem(article: ReturnType<typeof mapAuthorityRecordToArticle>) {
  const displayArticle = withAuthorityDisplayTranslation(article, {
    includeContent: false,
    includeTranslation: false,
  });
  const publicArticle = stripAuthorityInternalFields(displayArticle);

  return {
    ...publicArticle,
    content: '',
  };
}

async function filterAuthorityArticles(
  articles: Array<ReturnType<typeof mapAuthorityRecordToArticle>>,
  filters: {
    category?: unknown;
    tag?: unknown;
    stage?: unknown;
    difficulty?: unknown;
    keyword?: unknown;
    source?: unknown;
  },
) {
  const keyword = typeof filters.keyword === 'string' ? filters.keyword.trim().toLowerCase() : '';
  const source = typeof filters.source === 'string' ? filters.source.trim().toLowerCase() : '';
  if (keyword && isOutOfScopeKnowledgeQuery(keyword)) {
    return [];
  }

  const searchQueries = keyword
    ? Array.from(new Set([keyword, ...(await rewriteSearchQueries(keyword))].map((item) => item.trim()).filter(Boolean)))
    : [];

  return articles.filter((article) => {
    const articleStages = Array.isArray(article.targetStages) && article.targetStages.length > 0
      ? article.targetStages
      : (article.stage ? [article.stage] : []);
    if (!matchesAuthorityStageFilters(articleStages, filters.stage)) {
      return false;
    }

    if (typeof filters.difficulty === 'string' && filters.difficulty && article.difficulty !== filters.difficulty) {
      return false;
    }

    if (typeof filters.category === 'string' && filters.category) {
      const categoryText = `${article.topic || ''} ${article.category?.name || ''}`.toLowerCase();
      if (!categoryText.includes(filters.category.toLowerCase())) {
        return false;
      }
    }

    if (typeof filters.tag === 'string' && filters.tag) {
      const matched = (article.tags || []).some((tag) => tag.slug === filters.tag || tag.name === filters.tag);
      if (!matched) {
        return false;
      }
    }

    if (source) {
      const sourceText = `${article.sourceOrg || ''} ${article.source || ''}`.toLowerCase();
      if (!sourceText.includes(source)) {
        return false;
      }
    }

    if (!keyword) {
      return true;
    }

    const translated = getCachedAuthorityArticleTranslation(article);
    const searchable = [
      article.title,
      article.summary,
      article.content,
      article.sourceOrg,
      article.topic,
      article.audience,
      article.stage,
      ...(article.targetStages || []),
      ...(article.tags || []).flatMap((tag) => [tag.name, tag.slug]),
      translated?.translatedTitle,
      translated?.translatedSummary,
      translated?.translatedContent,
    ].join(' ').toLowerCase();

    return searchQueries.some((query) => matchesExpandedSearch(query, searchable));
  });
}

/**
 * 获取文章列表（带缓存）
 * - 热门文章缓存5分钟
 * - 推荐文章缓存5分钟
 * - 普通列表不缓存（因为有分页和筛选）
 */
export const getArticles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      category,
      tag,
      stage,
      difficulty,
      contentType,
      keyword,
      source,
      sort = 'latest',
      page = 1,
      pageSize = 20
    } = req.query;

    if (contentType === 'authority') {
      const currentPage = Number(page);
      const currentPageSize = Number(pageSize);
      const skip = (currentPage - 1) * currentPageSize;

      // Cache authority articles — unfiltered first page uses MEDIUM TTL, filtered uses SHORT TTL
      const isAuthorityFirstPage = currentPage === 1 && !category && !tag && !stage && !difficulty && !keyword && !source;
      const filterParamsKey = [category, tag, stage, difficulty, keyword, source, sort, page, pageSize]
        .map((v) => String(v ?? ''))
        .join(':');
      const filteredCacheKey = CacheKeys.ARTICLES_AUTHORITY_FILTERED(filterParamsKey);

      if (isAuthorityFirstPage) {
        const cached = cache.get<unknown>(CacheKeys.ARTICLES_AUTHORITY);
        if (cached) {
          console.log(`[Cache] Hit: ${CacheKeys.ARTICLES_AUTHORITY}`);
          return res.json(cached);
        }
      } else {
        const cached = cache.get<unknown>(filteredCacheKey);
        if (cached) {
          console.log(`[Cache] Hit: ${filteredCacheKey}`);
          return res.json(cached);
        }
      }

      const filtered = await filterAuthorityArticles(await getAuthorityArticles(), {
        category,
        tag,
        stage,
        difficulty,
        keyword,
        source,
      });

      const sorted = [...filtered].sort((left, right) => {
        if (sort === 'popular') {
          return (right.viewCount || 0) - (left.viewCount || 0);
        }

        const dateBucketDiff = getAuthorityArticleDateBucket(right).localeCompare(getAuthorityArticleDateBucket(left));
        if (dateBucketDiff !== 0) {
          return dateBucketDiff;
        }

        // Match product expectation: latest first, and Chinese originals first
        // among authority documents from the same calendar date.
        const sourceDiff = getAuthorityArticleSourcePriority(left) - getAuthorityArticleSourcePriority(right);
        if (sourceDiff !== 0) {
          return sourceDiff;
        }

        const timeDiff = getAuthorityArticleTimestamp(right) - getAuthorityArticleTimestamp(left);
        if (timeDiff !== 0) {
          return timeDiff;
        }

        const qualityDiff = getAuthorityArticleQualityScore(right) - getAuthorityArticleQualityScore(left);
        if (qualityDiff !== 0) {
          return qualityDiff;
        }

        return 0;
      });

      const pageItems = sorted.slice(skip, skip + currentPageSize);
      void prewarmAuthorityTranslationsForArticles(pageItems).catch((error) => {
        console.error('[Authority Translation] List prewarm failed:', error);
      });

      const authorityResponse = paginatedResponse(
        pageItems.map(toAuthorityArticleListItem),
        currentPage,
        currentPageSize,
        sorted.length,
      );

      if (isAuthorityFirstPage) {
        cache.set(CacheKeys.ARTICLES_AUTHORITY, authorityResponse, CacheTTL.MEDIUM);
      } else {
        cache.set(filteredCacheKey, authorityResponse, CacheTTL.SHORT);
      }

      return res.json(authorityResponse);
    }

    // 热门和推荐文章使用缓存（仅第一页）
    const isFirstPage = Number(page) === 1;
    const shouldCache = !category && !tag && !stage && !difficulty && !contentType && isFirstPage;
    
    let cacheKey = '';
    if (shouldCache) {
      cacheKey = sort === 'popular' 
        ? CacheKeys.ARTICLES_POPULAR 
        : sort === 'recommended' 
          ? CacheKeys.ARTICLES_RECOMMENDED 
          : '';
      
      if (cacheKey) {
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          logger.debug(`Cache hit: ${cacheKey}`, { component: 'article', event: 'cache_hit' });
          return res.json(cached);
        }
      }
    }

    const skip = (Number(page) - 1) * Number(pageSize);

    // 构建查询条件
    const where: Prisma.ArticleWhereInput = {
      status: 1,
      deletedAt: null
    };

    if (typeof category === 'string' && category.trim()) {
      where.category = { slug: category };
    }

    if (typeof difficulty === 'string' && difficulty.trim()) {
      where.difficulty = difficulty;
    }

    if (typeof contentType === 'string' && contentType.trim()) {
      where.contentType = contentType;
    }

    if (typeof keyword === 'string' && keyword.trim()) {
      where.OR = [
        { title: { contains: keyword.trim() } },
        { summary: { contains: keyword.trim() } },
      ];
    }

    // 排序
    let orderBy: Prisma.ArticleOrderByWithRelationInput = { publishedAt: 'desc' };
    if (sort === 'popular') {
      orderBy = { viewCount: 'desc' };
    } else if (sort === 'recommended') {
      where.isRecommended = 1;
      orderBy = { publishedAt: 'desc' };
    }

    // 查询文章
    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy,
        skip,
        take: Number(pageSize),
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          coverImage: true,
          difficulty: true,
          targetStage: true,
          readingTime: true,
          source: true,
          references: true,
          viewCount: true,
          likeCount: true,
          isRecommended: true,
          isFeatured: true,
          publishedAt: true,
          category: {
            select: { id: true, name: true, slug: true }
          },
          author: {
            select: { id: true, name: true, avatar: true, title: true }
          },
          tags: {
            include: {
              tag: { select: { id: true, name: true, slug: true } }
            }
          }
        }
      }),
      prisma.article.count({ where })
    ]);

    // 格式化返回数据
    const list = articles.map((article) => {
      const sourceUrl = resolveArticleSourceUrl(article) || undefined;
      const { references: _references, ...articlePayload } = article;
      return {
        ...articlePayload,
        tags: article.tags.map(t => t.tag),
        sourceUrl,
        originalId: sourceUrl,
      };
    });

    const response = paginatedResponse(list, Number(page), Number(pageSize), total);

    // 缓存结果
    if (cacheKey && shouldCache) {
      cache.set(cacheKey, response, CacheTTL.MEDIUM);
      logger.debug(`Cache set: ${cacheKey}`, { component: 'article', event: 'cache_set' });
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 获取文章详情（带缓存）
 * - 文章内容缓存5分钟
 * - 浏览量每次都更新
 * - 用户点赞/收藏状态实时查询
 */
export const getArticleBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const userId = req.userId;

    const authorityMatch = await findAuthorityRecordMatchBySlug(slug);
    if (authorityMatch) {
      const canonicalSlug = authorityMatch.slug;
      const fallbackSlugs = authorityMatch.slugCandidates;
      const authorityArticle = (await getAuthorityArticles())
        .find((item: ReturnType<typeof mapAuthorityRecordToArticle>) => item.slug === canonicalSlug);
      if (!authorityArticle) {
        throw new AppError('文章不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
      }

      prewarmAuthorityTranslation(canonicalSlug, authorityMatch.record, fallbackSlugs);
      const viewCount = incrementAuthorityViewCountBySlug(canonicalSlug) ?? authorityArticle.viewCount ?? 0;
      let isLiked = false;
      let likeCount = authorityArticle.likeCount || 0;

      if (userId) {
        const [like, totalLikes] = await Promise.all([
          prisma.userLike.findFirst({
            where: {
              userId: BigInt(userId),
              likeType: 'authority_article',
              likeId: BigInt(authorityArticle.id),
            }
          }),
          prisma.userLike.count({
            where: {
              likeType: 'authority_article',
              likeId: BigInt(authorityArticle.id),
            }
          })
        ]);
        isLiked = !!like;
        likeCount = totalLikes;
      }

      return res.json(successResponse({
        ...stripAuthorityInternalFields(withAuthorityDisplayTranslation(authorityArticle, {
          includeContent: true,
          includeTranslation: true,
        })),
        viewCount,
        isLiked,
        likeCount,
      }));
    }

    // 尝试从缓存获取文章详情
    const cacheKey = CacheKeys.ARTICLE_DETAIL(slug);
    let article = cache.get<ArticleDetailCacheRecord>(cacheKey);

    if (article) {
      logger.debug(`Cache hit: ${cacheKey}`, { component: 'article', event: 'cache_hit' });
    } else {
      article = await prisma.article.findUnique({
        where: { slug },
        include: articleDetailInclude
      });

      if (!article || article.status !== 1 || article.deletedAt) {
        throw new AppError('文章不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
      }

      // 缓存文章详情
      cache.set(cacheKey, article, CacheTTL.MEDIUM);
      logger.debug(`Cache set: ${cacheKey}`, { component: 'article', event: 'cache_set' });
    }

    // 增加浏览量（异步执行，不阻塞响应）
    prisma.article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } }
    }).catch(err => console.error('[Article] Failed to increment viewCount:', err));

    // 行为积分：阅读奖励（fire-and-forget）
    if (userId) {
      awardBehaviorPoints(userId, 'read', article.id.toString()).catch(() => {});
    }

    // 检查用户是否已点赞/收藏
    let isLiked = false;
    let isFavorited = false;

    if (userId) {
      const [like, favorite] = await Promise.all([
        prisma.userLike.findFirst({
          where: { userId: BigInt(userId), likeType: 'article', likeId: article.id }
        }),
        prisma.userFavorite.findFirst({
          where: { userId: BigInt(userId), favType: 'article', favId: article.id }
        })
      ]);
      isLiked = !!like;
      isFavorited = !!favorite;
    }

    const sourceUrl = resolveArticleSourceUrl(article) || undefined;
    res.json(successResponse({
      ...article,
      tags: article.tags.map((tagRelation: ArticleTagRelation) => tagRelation.tag),
      sourceUrl,
      originalId: sourceUrl,
      isLiked,
      isFavorited
    }));
  } catch (error) {
    next(error);
  }
};

export const getAuthorityArticleTranslation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const shouldWaitForTranslation = /^(1|true)$/i.test(String(req.query.wait || ''));
    const authorityMatch = await findAuthorityRecordMatchBySlug(slug);

    if (!authorityMatch) {
      throw new AppError('文章不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    const authorityRecord = authorityMatch.record;
    const canonicalSlug = authorityMatch.slug;
    const fallbackSlugs = authorityMatch.slugCandidates;
    const sourceUpdatedAt = resolveAuthorityTranslationSourceUpdatedAt(authorityRecord);
    const sourceFingerprint = buildAuthorityTranslationSourceFingerprint(authorityRecord);
    const cached = getCachedAuthorityTranslation(canonicalSlug, sourceUpdatedAt, sourceFingerprint, fallbackSlugs);
    if (cached) {
      return res.json(successResponse(buildAuthorityTranslationResponse('ready', {
        translation: cached,
      })));
    }

    const sourceTextForDetection = [
      authorityRecord.question || '',
      authorityRecord.summary || '',
      authorityRecord.answer || '',
    ].join('\n');

    if (isMostlyChineseText(sourceTextForDetection)) {
      const translation = await getOrCreateAuthorityTranslation(canonicalSlug, authorityRecord, {}, fallbackSlugs);
      return res.json(successResponse(buildAuthorityTranslationResponse('ready', {
        translation,
      })));
    }

    if (shouldWaitForTranslation) {
      const translation = await waitForAuthorityTranslation(canonicalSlug, authorityRecord, AUTHORITY_TRANSLATION_WAIT_TIMEOUT_MS, fallbackSlugs);
      if (translation) {
        return res.json(successResponse(buildAuthorityTranslationResponse('ready', {
          translation,
        })));
      }
    }

    prewarmAuthorityTranslation(canonicalSlug, authorityRecord, fallbackSlugs);
    const retryAfterMs = authorityTranslationInFlight.has(canonicalSlug) ? 3000 : 5000;
    res.json(successResponse(buildAuthorityTranslationResponse('processing', {
      retryAfterMs,
    })));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取相关文章（带缓存）
 */
export const getRelatedArticles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = Number(req.query.limit) || 5;

    // 尝试从缓存获取
    const cacheKey = CacheKeys.ARTICLE_RELATED(id, limit);
    const cached = cache.get<unknown>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit: ${cacheKey}`, { component: 'article', event: 'cache_hit' });
      return res.json(cached);
    }

    const article = await prisma.article.findUnique({
      where: { id: BigInt(id) },
      select: { categoryId: true, tags: true }
    });

    if (!article) {
      const authorityRelated = await getAuthorityRelatedArticlesByNumericId(Number(id), limit);
      const response = successResponse({ list: authorityRelated });
      cache.set(cacheKey, response, CacheTTL.MEDIUM);
      return res.json(response);
    }

    // 查找同分类或同标签的文章
    const relatedArticles = await prisma.article.findMany({
      where: {
        AND: [
          { id: { not: BigInt(id) } },
          { status: 1 },
          { deletedAt: null },
          {
            OR: [
              { categoryId: article.categoryId },
              { tags: { some: { tagId: { in: article.tags.map(t => t.tagId) } } } }
            ]
          }
        ]
      },
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        coverImage: true,
        viewCount: true,
        publishedAt: true
      }
    });

    const response = successResponse({ list: relatedArticles });
    
    // 缓存结果
    cache.set(cacheKey, response, CacheTTL.MEDIUM);
    logger.debug(`Cache set: ${cacheKey}`, { component: 'article', event: 'cache_set' });

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 搜索文章（不缓存，需要记录日志）
 */
export const searchArticles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, page = 1, pageSize = 20, contentType } = req.query;

    if (!q || typeof q !== 'string') {
      throw new AppError('请输入搜索关键词', ErrorCodes.PARAM_ERROR, 400);
    }

    const currentPage = Number(page);
    const currentPageSize = Number(pageSize);
    const skip = (currentPage - 1) * currentPageSize;

    // 记录搜索日志（异步执行）
    prisma.searchLog.create({
      data: {
        keyword: q,
        userId: req.userId ? BigInt(req.userId) : null,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    }).catch(err => console.error('[Search] Failed to log search:', err));

    if (contentType === 'authority') {
      const filtered = await filterAuthorityArticles(await getAuthorityArticles(), {
        keyword: q,
      });
      const paged = filtered.slice(skip, skip + currentPageSize);
      res.json(paginatedResponse(paged.map(toAuthorityArticleListItem), currentPage, currentPageSize, filtered.length));
      return;
    }

    try {
      const [articles, total] = await Promise.all([
        prisma.$queryRaw`
          SELECT id, title, slug, summary, cover_image, view_count, published_at
          FROM articles
          WHERE status = 1
          AND deleted_at IS NULL
          AND MATCH(title, content) AGAINST(${q} IN NATURAL LANGUAGE MODE)
          LIMIT ${currentPageSize} OFFSET ${skip}
        `,
        prisma.$queryRaw`
          SELECT COUNT(*) as total
          FROM articles
          WHERE status = 1
          AND deleted_at IS NULL
          AND MATCH(title, content) AGAINST(${q} IN NATURAL LANGUAGE MODE)
        `
      ]);

      const totalRows = total as CountRow[];
      res.json(paginatedResponse(articles as unknown[], currentPage, currentPageSize, Number(totalRows[0]?.total || 0)));
      return;
    } catch (searchError) {
      console.error('[Search] Fulltext query failed, fallback to LIKE search:', searchError);
    }

    const where = {
      status: 1,
      deletedAt: null,
      OR: [
        { title: { contains: q } },
        { summary: { contains: q } },
        { content: { contains: q } },
      ],
    };

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip,
        take: currentPageSize,
        orderBy: [
          { publishedAt: 'desc' },
          { id: 'desc' },
        ],
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          coverImage: true,
          viewCount: true,
          publishedAt: true,
        }
      }),
      prisma.article.count({ where }),
    ]);

    res.json(paginatedResponse(articles, currentPage, currentPageSize, total));
  } catch (error) {
    next(error);
  }
};

/**
 * 点赞文章（清除相关缓存）
 */
export const likeArticle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const authorityArticle = (await getAuthorityArticles()).find((item) => String(item.id) === String(id));

    if (authorityArticle) {
      const existingLike = await prisma.userLike.findFirst({
        where: { userId: BigInt(userId), likeType: 'authority_article', likeId: BigInt(id) }
      });

      if (existingLike) {
        throw new AppError('已点赞', ErrorCodes.PARAM_ERROR, 400);
      }

      await prisma.userLike.create({
        data: { userId: BigInt(userId), likeType: 'authority_article', likeId: BigInt(id) }
      });

      const likeCount = await prisma.userLike.count({
        where: { likeType: 'authority_article', likeId: BigInt(id) }
      });

      res.json(successResponse({ liked: true, likeCount }, '点赞成功'));
      return;
    }

    // 使用事务确保点赞的原子性
    const updatedArticle = await prisma.$transaction(async (tx) => {
      const existingLike = await tx.userLike.findFirst({
        where: { userId: BigInt(userId), likeType: 'article', likeId: BigInt(id) }
      });

      if (existingLike) {
        throw new AppError('已点赞', ErrorCodes.PARAM_ERROR, 400);
      }

      await tx.userLike.create({
        data: { userId: BigInt(userId), likeType: 'article', likeId: BigInt(id) }
      });

      return tx.article.update({
        where: { id: BigInt(id) },
        data: { likeCount: { increment: 1 } }
      });
    });

    // 清除热门文章缓存
    cache.delete(CacheKeys.ARTICLES_POPULAR);

    res.json(successResponse({ liked: true, likeCount: updatedArticle.likeCount }, '点赞成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 取消点赞
 */
export const unlikeArticle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const authorityArticle = (await getAuthorityArticles()).find((item) => String(item.id) === String(id));

    if (authorityArticle) {
      const like = await prisma.userLike.findFirst({
        where: { userId: BigInt(userId), likeType: 'authority_article', likeId: BigInt(id) }
      });

      if (!like) {
        throw new AppError('未点赞', ErrorCodes.PARAM_ERROR, 400);
      }

      await prisma.userLike.delete({ where: { id: like.id } });
      const likeCount = await prisma.userLike.count({
        where: { likeType: 'authority_article', likeId: BigInt(id) }
      });

      res.json(successResponse({ liked: false, likeCount }, '取消点赞成功'));
      return;
    }

    const like = await prisma.userLike.findFirst({
      where: { userId: BigInt(userId), likeType: 'article', likeId: BigInt(id) }
    });

    if (!like) {
      throw new AppError('未点赞', ErrorCodes.PARAM_ERROR, 400);
    }

    const updatedArticle = await prisma.$transaction(async (tx) => {
      await tx.userLike.delete({ where: { id: like.id } });
      const article = await tx.article.findUnique({
        where: { id: BigInt(id) },
        select: { likeCount: true },
      });
      return tx.article.update({
        where: { id: BigInt(id) },
        data: { likeCount: Math.max(0, (article?.likeCount ?? 1) - 1) },
      });
    });

    // 清除热门文章缓存
    cache.delete(CacheKeys.ARTICLES_POPULAR);

    res.json(successResponse({ liked: false, likeCount: updatedArticle.likeCount }, '取消点赞成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 收藏文章
 */
export const favoriteArticle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const authorityArticle = (await getAuthorityArticles()).find((item) => String(item.id) === String(id));

    if (authorityArticle) {
      throw new AppError('权威文章暂不支持收藏，请先分享或打开原文回看', ErrorCodes.PARAM_ERROR, 400);
    }

    // 检查是否已收藏
    const existingFavorite = await prisma.userFavorite.findFirst({
      where: { userId: BigInt(userId), favType: 'article', favId: BigInt(id) }
    });

    if (existingFavorite) {
      throw new AppError('已收藏', ErrorCodes.PARAM_ERROR, 400);
    }

    // 创建收藏记录并更新计数
    const [, updatedArticle] = await Promise.all([
      prisma.userFavorite.create({
        data: { userId: BigInt(userId), favType: 'article', favId: BigInt(id) }
      }),
      prisma.article.update({
        where: { id: BigInt(id) },
        data: { collectCount: { increment: 1 } }
      })
    ]);

    recordServerRetentionBehaviorEvent('server_article_favorite', {
      userId,
      page: 'articles/favorite',
      properties: {
        articleId: id,
        collectCount: updatedArticle.collectCount,
      },
    }).catch(() => {});

    res.json(successResponse({ favorited: true, collectCount: updatedArticle.collectCount }, '收藏成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 取消收藏
 */
export const unfavoriteArticle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const authorityArticle = (await getAuthorityArticles()).find((item) => String(item.id) === String(id));

    if (authorityArticle) {
      throw new AppError('权威文章暂不支持收藏，请先分享或打开原文回看', ErrorCodes.PARAM_ERROR, 400);
    }

    const favorite = await prisma.userFavorite.findFirst({
      where: { userId: BigInt(userId), favType: 'article', favId: BigInt(id) }
    });

    if (!favorite) {
      throw new AppError('未收藏', ErrorCodes.PARAM_ERROR, 400);
    }

    const updatedArticle = await prisma.$transaction(async (tx) => {
      await tx.userFavorite.delete({ where: { id: favorite.id } });
      const article = await tx.article.findUnique({
        where: { id: BigInt(id) },
        select: { collectCount: true },
      });
      return tx.article.update({
        where: { id: BigInt(id) },
        data: { collectCount: Math.max(0, (article?.collectCount ?? 1) - 1) },
      });
    });

    res.json(successResponse({ favorited: false, collectCount: updatedArticle.collectCount }, '取消收藏成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取缓存统计信息（调试用）
 */
export const getCacheStats = (req: Request, res: Response) => {
  const stats = cache.getStats();
  const hitRate = cache.getHitRate();
  res.json(successResponse({
    ...stats,
    hitRate: `${hitRate.toFixed(2)}%`
  }));
};
