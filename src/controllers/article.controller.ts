import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { getAuthoritySourceConfig, inferAuthorityLocaleDefaults } from '../config/authority-sources';
import { successResponse, paginatedResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';
import { cache, CacheKeys, CacheTTL } from '../services/cache.service';
import { callTaskModelDetailed } from '../services/ai-gateway.service';
import { detectAudience, detectTopic, sanitizeAuthorityTitle } from '../services/authority-adapters/base.adapter';
import { textToRichParagraphHtml } from '../utils/article-format';
import { awardBehaviorPoints } from '../services/checkin.service';
import {
  buildAuthorityDisplayTags,
  normalizeAuthorityAudienceLabel,
  normalizeAuthorityTopicLabel,
} from '../utils/authority-metadata';
import { inferAuthorityStages } from '../utils/authority-stage';
import { matchesAuthorityStageFilters } from '../utils/authority-stage-filter';
import { shouldFilterAuthoritySourceUrl } from '../utils/authority-source-url';
import { matchesExpandedSearch } from '../utils/search-query-expansion';
import { rewriteSearchQueries } from '../services/knowledge.service';

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
}

const AUTHORITY_CACHE_PATHS = [
  '/tmp/authority-knowledge-cache.json',
  path.join(process.cwd(), 'data', 'authority-knowledge-cache.json'),
  path.join(__dirname, '../../data/authority-knowledge-cache.json'),
];
const AUTHORITY_TRANSLATION_CACHE_PATHS = [
  '/tmp/authority-translation-cache.json',
  path.join(process.cwd(), 'data', 'authority-translation-cache.json'),
  path.join(__dirname, '../../data/authority-translation-cache.json'),
];

let authorityCacheMemo: { path: string; mtimeMs: number; records: AuthorityCacheRecord[] } | null = null;
let authorityTranslationCacheMemo: Record<string, AuthorityTranslationCacheRecord> | null = null;
const authorityTranslationInFlight = new Map<string, Promise<AuthorityTranslationCacheRecord>>();

interface AuthorityTranslationCacheRecord {
  slug: string;
  sourceUpdatedAt?: string;
  translatedTitle: string;
  translatedSummary: string;
  translatedContent: string;
  translationNotice: string;
  updatedAt: string;
  model?: string;
  provider?: string;
  isSourceChinese?: boolean;
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

  const chineseChars = countMatches(text, /[\u4e00-\u9fff]/gu);
  const latinChars = countMatches(text, /[A-Za-z]/g);

  if (chineseChars >= 80 && chineseChars >= latinChars) {
    return true;
  }

  return chineseChars / Math.max(text.length, 1) >= 0.2 && chineseChars >= latinChars * 0.6;
}

function buildAuthoritySlug(record: AuthorityCacheRecord, index: number): string {
  const base = (record.id || record.original_id || record.question || `authority-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base.startsWith('authority-') ? base : `authority-${base || index + 1}`;
}

function toRichTextHtml(text: string): string {
  return textToRichParagraphHtml(text);
}

const AUTHORITY_CHROME_PATTERNS = [
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
  if (!rawAnswer) {
    return false;
  }

  const answerChromeCount = countAuthorityChromeMatches(rawAnswer);
  const summaryChromeCount = countAuthorityChromeMatches(rawSummary);
  const cleanedAnswer = stripAuthorityPageChrome(rawAnswer);
  const cleanedWithoutTitle = title
    ? cleanedAnswer.replace(title, '').trim()
    : cleanedAnswer;
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

function toAuthoritySummary(text: string): string {
  const normalized = normalizeAuthorityText(text);
  return normalized.slice(0, 180);
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

  return {
    ...record,
    question: normalizedQuestion || record.question,
    answer: normalizedAnswer,
    summary: normalizedSummary,
  };
}

function resolveWritableTranslationCachePath(): string {
  return AUTHORITY_TRANSLATION_CACHE_PATHS[0];
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

  const recordIndex = records.findIndex((item, index) => buildAuthoritySlug(item, index) === slug);
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
  if (authorityTranslationCacheMemo) {
    return authorityTranslationCacheMemo;
  }

  const cachePath = AUTHORITY_TRANSLATION_CACHE_PATHS.find((candidate) => fs.existsSync(candidate));
  if (!cachePath) {
    authorityTranslationCacheMemo = {};
    return authorityTranslationCacheMemo;
  }

  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, AuthorityTranslationCacheRecord>;
    authorityTranslationCacheMemo = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    authorityTranslationCacheMemo = {};
  }

  return authorityTranslationCacheMemo;
}

function saveAuthorityTranslationCache(cache: Record<string, AuthorityTranslationCacheRecord>): void {
  const cachePath = resolveWritableTranslationCachePath();
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  authorityTranslationCacheMemo = cache;
}

function getCachedAuthorityTranslation(
  slug: string,
  sourceUpdatedAt?: string,
): AuthorityTranslationCacheRecord | null {
  const translationCache = loadAuthorityTranslationCache();
  const cached = translationCache[slug];
  if (cached && cached.sourceUpdatedAt === sourceUpdatedAt) {
    return cached;
  }
  return null;
}

async function getAuthorityRecords(): Promise<AuthorityCacheRecord[]> {
  const cacheRecords = loadAuthorityCacheRecords();
  if (cacheRecords.length > 0) {
    return cacheRecords
      .filter((record) => !shouldFilterAuthoritySourceUrl(record))
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
    .filter((record) => !isAuthorityRecordLowValue(record));
}

async function findAuthorityRecordBySlug(slug: string): Promise<AuthorityCacheRecord | null> {
  const records = await getAuthorityRecords();
  return records.find((item, index) => buildAuthoritySlug(item, index) === slug) || null;
}

function extractTaggedContent(input: string, tag: string): string {
  const match = input.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match?.[1]?.trim() || '';
}

async function translateAuthorityRecord(slug: string, record: AuthorityCacheRecord): Promise<AuthorityTranslationCacheRecord> {
  const sourceUpdatedAt = record.updated_at || record.published_at || record.created_at;
  const cached = getCachedAuthorityTranslation(slug, sourceUpdatedAt);
  if (cached) {
    return cached;
  }

  const sourceTitle = record.question || '';
  const sourceSummary = record.summary || '';
  const sourceContent = (record.answer || '').slice(0, 12000);
  const translationNotice = '以下内容由系统基于权威机构原文辅助翻译，仅用于阅读理解，不替代医疗建议。请以原始来源和线下医生意见为准。';
  const sourceTextForDetection = [sourceTitle, sourceSummary, sourceContent].join('\n');

  if (isMostlyChineseText(sourceTextForDetection)) {
    const payload: AuthorityTranslationCacheRecord = {
      slug,
      sourceUpdatedAt,
      translatedTitle: sourceTitle,
      translatedSummary: sourceSummary,
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

  const result = await callTaskModelDetailed('minimax_render', [
    {
      role: 'system',
      content: [
        '你是母婴权威知识库的专业翻译助手。',
        '请把英文医学健康文章准确翻译成简体中文，保持谨慎、克制、忠实原文。',
        '不要补充原文没有的建议，不要改写成诊断结论，不要省略重要风险提示。',
        '输出必须严格使用以下标签，不要输出任何额外说明：',
        '<translated_title>...</translated_title>',
        '<translated_summary>...</translated_summary>',
        '<translated_content>...</translated_content>',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `来源机构：${record.source_org || record.source || '权威机构'}`,
        `原文标题：${sourceTitle}`,
        `原文摘要：${sourceSummary}`,
        '原文正文：',
        sourceContent,
      ].join('\n\n'),
    },
  ], {
    temperature: 0.2,
    maxTokens: 4000,
  });

  const translatedTitle = extractTaggedContent(result.answer, 'translated_title') || sourceTitle;
  const translatedSummary = extractTaggedContent(result.answer, 'translated_summary') || sourceSummary;
  const translatedContent = extractTaggedContent(result.answer, 'translated_content');

  if (!translatedContent) {
    throw new Error('翻译结果解析失败');
  }

  const payload: AuthorityTranslationCacheRecord = {
    slug,
    sourceUpdatedAt,
    translatedTitle,
    translatedSummary,
    translatedContent,
    translationNotice,
    updatedAt: new Date().toISOString(),
    model: result.route.model,
    provider: result.route.provider,
    isSourceChinese: false,
  };

  const translationCache = loadAuthorityTranslationCache();
  translationCache[slug] = payload;
  saveAuthorityTranslationCache(translationCache);
  return payload;
}

function getOrCreateAuthorityTranslation(slug: string, record: AuthorityCacheRecord): Promise<AuthorityTranslationCacheRecord> {
  const sourceUpdatedAt = record.updated_at || record.published_at || record.created_at;
  const cached = getCachedAuthorityTranslation(slug, sourceUpdatedAt);
  if (cached) {
    return Promise.resolve(cached);
  }

  const inFlight = authorityTranslationInFlight.get(slug);
  if (inFlight) {
    return inFlight;
  }

  const task = translateAuthorityRecord(slug, record)
    .finally(() => {
      authorityTranslationInFlight.delete(slug);
    });
  authorityTranslationInFlight.set(slug, task);
  return task;
}

function prewarmAuthorityTranslation(slug: string, record: AuthorityCacheRecord): void {
  const sourceUpdatedAt = record.updated_at || record.published_at || record.created_at;
  if (getCachedAuthorityTranslation(slug, sourceUpdatedAt) || authorityTranslationInFlight.has(slug)) {
    return;
  }

  void getOrCreateAuthorityTranslation(slug, record).catch((error) => {
    console.error(`[Authority Translation] Prewarm failed for ${slug}:`, error);
  });
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
  try {
    const parsed = row.metadataJson ? JSON.parse(row.metadataJson) as {
      tags?: unknown;
      sourceLanguage?: unknown;
      sourceLocale?: unknown;
      sourceClass?: unknown;
      fetchedAt?: unknown;
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
  } catch {
    metadataTags = [];
  }

  const cleanedTitle = sanitizeAuthorityTitle(row.title);
  const localeDefaults = inferAuthorityLocaleDefaults(row.sourceId, row.region);
  const stableDate = row.updatedAt || row.createdAt;
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
    updated_at: stableDate.toISOString(),
    published_at: stableDate.toISOString(),
    source_id: row.sourceId,
    source: row.sourceOrg,
    source_org: row.sourceOrg,
    source_class: metadataSourceClass || 'official',
    source_url: row.sourceUrl,
    source_language: metadataSourceLanguage || localeDefaults.sourceLanguage,
    source_locale: metadataSourceLocale || localeDefaults.sourceLocale,
    source_updated_at: stableDate.toISOString(),
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

  return {
    id: hashStringToPositiveInt(record.id || slug),
    title: record.question,
    slug,
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
    sourceUrl: record.source_url || record.url,
    sourceLanguage,
    sourceLocale,
    sourceUpdatedAt: record.source_updated_at || record.published_at || record.updated_at || record.created_at,
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
    .forEach((article) => {
      const dedupeKey = normalizeAuthorityDedupeKey(article.sourceUrl || article.originalId || article.slug);
      const existing = deduped.get(dedupeKey);
      if (!existing) {
        deduped.set(dedupeKey, article);
        return;
      }

      deduped.set(dedupeKey, pickBetterAuthorityArticle(existing, article));
    });

  return Array.from(deduped.values());
}

function getAuthorityArticleTimestamp(article: ReturnType<typeof mapAuthorityRecordToArticle>): number {
  const value = article.publishedAt || article.updatedAt || article.createdAt;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getAuthorityArticleDateBucket(article: ReturnType<typeof mapAuthorityRecordToArticle>): string {
  const value = article.publishedAt || article.updatedAt || article.createdAt;
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
  return article.sourceLanguage === 'zh' || article.sourceLocale === 'zh-CN' ? 0 : 1;
}

function toAuthorityArticleListItem(article: ReturnType<typeof mapAuthorityRecordToArticle>) {
  return {
    ...article,
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
  const translationCache = keyword ? loadAuthorityTranslationCache() : null;
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

    const translated = translationCache?.[article.slug];
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

        const timeDiff = getAuthorityArticleTimestamp(right) - getAuthorityArticleTimestamp(left);
        if (timeDiff !== 0) {
          return timeDiff;
        }

        const sourceDiff = getAuthorityArticleSourcePriority(left) - getAuthorityArticleSourcePriority(right);
        if (sourceDiff !== 0) {
          return sourceDiff;
        }

        return 0;
      });

      return res.json(paginatedResponse(
        sorted.slice(skip, skip + currentPageSize).map(toAuthorityArticleListItem),
        currentPage,
        currentPageSize,
        sorted.length,
      ));
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
        const cached = cache.get<any>(cacheKey);
        if (cached) {
          console.log(`[Cache] Hit: ${cacheKey}`);
          return res.json(cached);
        }
      }
    }

    const skip = (Number(page) - 1) * Number(pageSize);

    // 构建查询条件
    const where: any = {
      status: 1,
      deletedAt: null
    };

    if (category) {
      where.category = { slug: category };
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (contentType) {
      where.contentType = contentType;
    }

    if (typeof keyword === 'string' && keyword.trim()) {
      where.OR = [
        { title: { contains: keyword.trim() } },
        { summary: { contains: keyword.trim() } },
      ];
    }

    // 排序
    let orderBy: any = { publishedAt: 'desc' };
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
    const list = articles.map(article => ({
      ...article,
      tags: article.tags.map(t => t.tag)
    }));

    const response = paginatedResponse(list, Number(page), Number(pageSize), total);

    // 缓存结果
    if (cacheKey && shouldCache) {
      cache.set(cacheKey, response, CacheTTL.MEDIUM);
      console.log(`[Cache] Set: ${cacheKey}`);
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

    const authorityArticle = (await getAuthorityArticles()).find((item: ReturnType<typeof mapAuthorityRecordToArticle>) => item.slug === slug);
    if (authorityArticle) {
      const authorityRecord = await findAuthorityRecordBySlug(slug);
      if (authorityRecord) {
        prewarmAuthorityTranslation(slug, authorityRecord);
      }
      const viewCount = incrementAuthorityViewCountBySlug(slug) ?? authorityArticle.viewCount ?? 0;
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
        ...authorityArticle,
        viewCount,
        isLiked,
        likeCount,
      }));
    }

    // 尝试从缓存获取文章详情
    const cacheKey = CacheKeys.ARTICLE_DETAIL(slug);
    let article = cache.get<any>(cacheKey);

    if (article) {
      console.log(`[Cache] Hit: ${cacheKey}`);
    } else {
      article = await prisma.article.findUnique({
        where: { slug },
        include: {
          category: {
            include: { parent: true }
          },
          author: true,
          tags: {
            include: { tag: true }
          }
        }
      });

      if (!article || article.status !== 1 || article.deletedAt) {
        throw new AppError('文章不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
      }

      // 缓存文章详情
      cache.set(cacheKey, article, CacheTTL.MEDIUM);
      console.log(`[Cache] Set: ${cacheKey}`);
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

    res.json(successResponse({
      ...article,
      tags: article.tags.map((t: any) => t.tag),
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
    const authorityRecord = await findAuthorityRecordBySlug(slug);

    if (!authorityRecord) {
      throw new AppError('文章不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    const translation = await getOrCreateAuthorityTranslation(slug, authorityRecord);
    res.json(successResponse(translation));
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
    const cacheKey = CacheKeys.ARTICLE_RELATED(id);
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      console.log(`[Cache] Hit: ${cacheKey}`);
      return res.json(cached);
    }

    const article = await prisma.article.findUnique({
      where: { id: BigInt(id) },
      select: { categoryId: true, tags: true }
    });

    if (!article) {
      throw new AppError('文章不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
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
    console.log(`[Cache] Set: ${cacheKey}`);

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
      res.json(paginatedResponse(paged, currentPage, currentPageSize, filtered.length));
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

      res.json(paginatedResponse(articles as unknown[], currentPage, currentPageSize, Number((total as any)[0]?.total || 0)));
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

    // 检查是否已点赞
    const existingLike = await prisma.userLike.findFirst({
      where: { userId: BigInt(userId), likeType: 'article', likeId: BigInt(id) }
    });

    if (existingLike) {
      throw new AppError('已点赞', ErrorCodes.PARAM_ERROR, 400);
    }

    // 创建点赞记录并更新计数
    const [, updatedArticle] = await Promise.all([
      prisma.userLike.create({
        data: { userId: BigInt(userId), likeType: 'article', likeId: BigInt(id) }
      }),
      prisma.article.update({
        where: { id: BigInt(id) },
        data: { likeCount: { increment: 1 } }
      })
    ]);

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

    const [, updatedArticle] = await Promise.all([
      prisma.userLike.delete({ where: { id: like.id } }),
      prisma.article.update({
        where: { id: BigInt(id) },
        data: { likeCount: { decrement: 1 } }
      })
    ]);

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

    const [, updatedArticle] = await Promise.all([
      prisma.userFavorite.delete({ where: { id: favorite.id } }),
      prisma.article.update({
        where: { id: BigInt(id) },
        data: { collectCount: { decrement: 1 } }
      })
    ]);

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
