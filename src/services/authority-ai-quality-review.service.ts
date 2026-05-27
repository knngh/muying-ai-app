import fs from 'fs';
import path from 'path';
import type { AuthorityRawDocument, NormalizedAuthorityDocument } from './authority-sync.service';
import { callTaskModelDetailed } from './ai-gateway.service';

export type AuthorityAiQualityDecision = 'publish' | 'review' | 'reject';
export type AuthorityAiQualityContentType = 'guidance' | 'news' | 'navigation' | 'admin' | 'event' | 'other';

export interface AuthorityAiQualityReviewResult {
  decision: AuthorityAiQualityDecision;
  reasons: string[];
  confidence: number;
  contentType: AuthorityAiQualityContentType;
  reviewedAt: string;
  model?: string;
  provider?: string;
  cacheHit?: boolean;
  exportable: boolean;
}

export interface AuthorityAiQualityReviewCacheRecord {
  sourceId: string;
  sourceUrl: string;
  contentHash: string;
  storedAt: string;
  result: AuthorityAiQualityReviewResult;
}

type AuthorityAiQualityReviewCache = Record<string, AuthorityAiQualityReviewCacheRecord>;

type AiReviewMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type AiReviewInvoker = (
  taskRole: 'glm_classify',
  messages: AiReviewMessage[],
  options: {
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    responseFormat: 'json_object';
  },
) => Promise<{
  answer: string;
  route?: {
    provider?: string;
    model?: string;
  };
}>;

export interface AuthorityAiQualityReviewOptions {
  enabled?: boolean;
  cache?: AuthorityAiQualityReviewCache;
  cachePath?: string;
  now?: Date;
  invokeModel?: AiReviewInvoker;
  minConfidence?: number;
  timeoutMs?: number;
  maxContentChars?: number;
}

const DEFAULT_CACHE_PATH = path.join(process.cwd(), 'data', 'authority-ai-quality-review-cache.json');
const DEFAULT_TIMEOUT_MS = Math.max(5000, Number(process.env.AUTHORITY_AI_QUALITY_REVIEW_TIMEOUT_MS || 25000));
const DEFAULT_MAX_CONTENT_CHARS = Math.max(1200, Number(process.env.AUTHORITY_AI_QUALITY_REVIEW_MAX_CONTENT_CHARS || 4200));
const DEFAULT_MIN_CONFIDENCE = clampConfidence(
  Number.parseFloat(process.env.AUTHORITY_AI_QUALITY_REVIEW_MIN_CONFIDENCE || '0.72'),
  0.72,
);

function clampConfidence(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, value));
}

function isReviewEnabled(options: AuthorityAiQualityReviewOptions): boolean {
  if (typeof options.enabled === 'boolean') {
    return options.enabled;
  }

  return /^true$/i.test(process.env.AUTHORITY_AI_QUALITY_REVIEW_ENABLED || '');
}

export function buildAuthorityAiQualityReviewCacheKey(
  document: Pick<NormalizedAuthorityDocument, 'sourceId' | 'sourceUrl'>,
  contentHash: string,
): string {
  return [
    document.sourceId.trim(),
    document.sourceUrl.trim(),
    contentHash.trim(),
  ].join('::');
}

function normalizeText(value: string | null | undefined, maxLength: number): string {
  return (value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function hasAiReviewCandidateStatus(document: NormalizedAuthorityDocument): boolean {
  return document.publishStatus === 'published' || document.publishStatus === 'review';
}

export function shouldRunAuthorityAiQualityReview(
  document: NormalizedAuthorityDocument,
  options: AuthorityAiQualityReviewOptions = {},
): boolean {
  if (!isReviewEnabled(options)) {
    return false;
  }

  if (!hasAiReviewCandidateStatus(document)) {
    return false;
  }

  if (!document.title.trim() || !document.contentText.trim()) {
    return false;
  }

  return document.contentText.trim().length >= 120;
}

function loadAuthorityAiQualityReviewCache(cachePath: string): AuthorityAiQualityReviewCache {
  try {
    if (!fs.existsSync(cachePath)) {
      return {};
    }

    const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return parsed as AuthorityAiQualityReviewCache;
  } catch {
    return {};
  }
}

function saveAuthorityAiQualityReviewCache(cachePath: string, cache: AuthorityAiQualityReviewCache): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

function buildReviewMessages(document: NormalizedAuthorityDocument, maxContentChars: number): AiReviewMessage[] {
  const metadata = document.metadataJson || {};
  const sourceClass = typeof metadata.sourceClass === 'string' ? metadata.sourceClass : 'unknown';
  return [
    {
      role: 'system',
      content: [
        '你是母婴权威知识库的网页质量审核员，只判断网页是否适合自动进入知识库。',
        '规则：明显导航页、站点栏目页、联系方式页、后台/表卡/系统说明页、培训/会议/活动/新闻动态、医院宣传、招聘公告、泛政策新闻、与孕产/婴幼儿健康无关内容，都必须 reject。',
        '只有正文主要是孕产、产后、婴幼儿健康、营养、喂养、发育、疫苗、安全护理等可复用指导内容时，才能 publish。',
        '如果正文不足、网页类型不确定、标题像政策/新闻但仍可能有指导价值，返回 review。',
        '不要因为来源权威就放行导航、会议、培训或宣传内容。',
        '只输出 JSON，不要 Markdown。字段必须是 decision、reasons、confidence、contentType。',
        'decision 只能是 publish、review、reject；contentType 只能是 guidance、news、navigation、admin、event、other；confidence 是 0 到 1 的数字。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `来源ID：${document.sourceId}`,
        `来源机构：${document.sourceOrg}`,
        `来源类别：${sourceClass}`,
        `地区：${document.region}`,
        `语言：${document.sourceLanguage || document.sourceLocale || 'unknown'}`,
        `URL：${document.sourceUrl}`,
        `标题：${document.title}`,
        `摘要：${document.summary}`,
        '正文节选：',
        normalizeText(document.contentText, maxContentChars),
      ].join('\n\n'),
    },
  ];
}

function normalizeDecision(value: unknown): AuthorityAiQualityDecision | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'publish' || normalized === 'review' || normalized === 'reject') {
    return normalized;
  }

  return null;
}

function normalizeContentType(value: unknown): AuthorityAiQualityContentType {
  if (typeof value !== 'string') {
    return 'other';
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'guidance'
    || normalized === 'news'
    || normalized === 'navigation'
    || normalized === 'admin'
    || normalized === 'event'
    || normalized === 'other'
  ) {
    return normalized;
  }

  return 'other';
}

function normalizeReasons(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeConfidence(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseFloat(value)
      : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed > 1 ? clampConfidence(parsed / 100, 0) : clampConfidence(parsed, 0);
}

export function parseAuthorityAiQualityReviewOutput(
  output: string,
  reviewedAt = new Date().toISOString(),
): Omit<AuthorityAiQualityReviewResult, 'reviewedAt' | 'exportable'> & {
  reviewedAt: string;
  exportable?: boolean;
} | null {
  const match = output.trim().match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }

  const decision = normalizeDecision(parsed.decision);
  if (!decision) {
    return null;
  }

  return {
    decision,
    reasons: normalizeReasons(parsed.reasons),
    confidence: normalizeConfidence(parsed.confidence),
    contentType: normalizeContentType(parsed.contentType ?? parsed.content_type),
    reviewedAt,
  };
}

function finalizeAiReviewResult(
  review: Omit<AuthorityAiQualityReviewResult, 'exportable'>,
  minConfidence: number,
): AuthorityAiQualityReviewResult {
  const publishable = review.decision === 'publish'
    && review.contentType === 'guidance'
    && review.confidence >= minConfidence;

  return {
    ...review,
    decision: publishable ? 'publish' : review.decision === 'reject' ? 'reject' : 'review',
    reasons: review.reasons.length > 0
      ? review.reasons
      : publishable
        ? ['ai_quality_review_passed']
        : ['ai_quality_review_needs_human_review'],
    exportable: publishable,
  };
}

function buildFailureReview(error: unknown, reviewedAt: string): AuthorityAiQualityReviewResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    decision: 'review',
    reasons: ['ai_quality_review_failed', message.replace(/\s+/g, ' ').slice(0, 180)],
    confidence: 0,
    contentType: 'other',
    reviewedAt,
    exportable: false,
  };
}

function withAiReviewMetadata(
  document: NormalizedAuthorityDocument,
  review: AuthorityAiQualityReviewResult,
): NormalizedAuthorityDocument {
  const nextStatus = review.decision === 'reject'
    ? 'rejected'
    : review.exportable
      ? document.publishStatus
      : 'review';

  return {
    ...document,
    publishStatus: nextStatus,
    metadataJson: {
      ...document.metadataJson,
      aiQualityReview: review,
    },
  };
}

async function invokeAuthorityAiQualityReview(
  document: NormalizedAuthorityDocument,
  options: AuthorityAiQualityReviewOptions,
): Promise<AuthorityAiQualityReviewResult> {
  const reviewedAt = (options.now || new Date()).toISOString();
  const invokeModel = options.invokeModel || callTaskModelDetailed;
  const result = await invokeModel('glm_classify', buildReviewMessages(
    document,
    options.maxContentChars ?? DEFAULT_MAX_CONTENT_CHARS,
  ), {
    temperature: 0,
    maxTokens: 500,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    responseFormat: 'json_object',
  });

  const parsed = parseAuthorityAiQualityReviewOutput(result.answer, reviewedAt);
  if (!parsed) {
    throw new Error('AI quality review returned invalid JSON');
  }

  return finalizeAiReviewResult({
    ...parsed,
    model: result.route?.model,
    provider: result.route?.provider,
  }, options.minConfidence ?? DEFAULT_MIN_CONFIDENCE);
}

export async function reviewAuthorityDocumentQualityWithAiIfNeeded(
  document: NormalizedAuthorityDocument,
  raw: Pick<AuthorityRawDocument, 'contentHash'>,
  options: AuthorityAiQualityReviewOptions = {},
): Promise<NormalizedAuthorityDocument> {
  if (!shouldRunAuthorityAiQualityReview(document, options)) {
    return document;
  }

  const cachePath = options.cachePath || DEFAULT_CACHE_PATH;
  const cache = options.cache || loadAuthorityAiQualityReviewCache(cachePath);
  const cacheKey = buildAuthorityAiQualityReviewCacheKey(document, raw.contentHash);
  const cached = cache[cacheKey];

  if (cached?.result) {
    return withAiReviewMetadata(document, {
      ...cached.result,
      cacheHit: true,
    });
  }

  const reviewedAt = (options.now || new Date()).toISOString();
  try {
    const review = await invokeAuthorityAiQualityReview(document, options);
    cache[cacheKey] = {
      sourceId: document.sourceId,
      sourceUrl: document.sourceUrl,
      contentHash: raw.contentHash,
      storedAt: reviewedAt,
      result: review,
    };
    if (!options.cache) {
      saveAuthorityAiQualityReviewCache(cachePath, cache);
    }

    return withAiReviewMetadata(document, review);
  } catch (error) {
    const review = buildFailureReview(error, reviewedAt);
    return withAiReviewMetadata(document, review);
  }
}

export function isAuthorityAiQualityReviewExportable(metadataJson: unknown): boolean {
  if (!metadataJson) {
    return true;
  }

  let metadata: Record<string, unknown>;
  if (typeof metadataJson === 'string') {
    try {
      metadata = JSON.parse(metadataJson) as Record<string, unknown>;
    } catch {
      return false;
    }
  } else if (typeof metadataJson === 'object' && !Array.isArray(metadataJson)) {
    metadata = metadataJson as Record<string, unknown>;
  } else {
    return true;
  }

  const review = metadata.aiQualityReview;
  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    return true;
  }

  const manualOverride = (review as { manualOverride?: unknown }).manualOverride;
  if (manualOverride === true) {
    return true;
  }

  return (review as { decision?: unknown }).decision === 'publish'
    && (review as { exportable?: unknown }).exportable !== false;
}
