import { cleanAuthorityTranslationCache } from './authority-translation-cache-cleaner';
import { getDatasetKnowledgeDropReason } from './knowledge-content-guard';

export type KnowledgeOpsRiskLevel = 'red' | 'yellow' | 'green' | 'unknown';

export interface KnowledgeOpsReference {
  authoritative?: boolean;
  sourceClass?: string;
  sourceOrg?: string;
  org?: string;
  title?: string;
  url?: string;
}

export interface KnowledgeOpsQaRecord {
  id?: string;
  original_id?: string;
  question?: string;
  answer?: string;
  summary?: string;
  category?: string;
  tags?: string[];
  references?: KnowledgeOpsReference[];
  is_verified?: boolean;
  source?: string;
  source_id?: string;
  source_org?: string;
  source_class?: string;
  source_url?: string;
  source_language?: string;
  source_updated_at?: string;
  url?: string;
  audience?: string;
  topic?: string;
  target_stage?: string[];
  risk_level_default?: string;
  region?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
}

export interface KnowledgeOpsTranslationCacheRecord {
  slug?: string;
  sourceUpdatedAt?: string;
  updatedAt?: string;
  translatedTitle?: string;
  translatedSummary?: string;
  translatedContent?: string;
}

export interface KnowledgeOpsTranslationFailureRecord {
  slug?: string;
  sourceUpdatedAt?: string;
  message?: string;
  attempts?: number;
  failedAt?: string;
  retryAfterAt?: string;
}

export interface KnowledgeOpsCoverageAudit {
  total?: number;
  rawTotal?: number;
  excludedByGuard?: Array<{ reason?: string; count?: number }>;
  authorityCovered?: number;
  missingAuthorityCoverage?: number;
  coverageRate?: number;
  missingByCategory?: Array<{ category?: string; count?: number }>;
  remediationQueue?: Array<{
    id?: string;
    category?: string;
    question?: string;
    suggestedSourceIds?: string[];
  }>;
}

export interface KnowledgeOpsFileStat {
  path: string;
  exists: boolean;
  total?: number;
  bytes?: number;
  mtime?: string;
}

export interface KnowledgeOpsReportInput {
  qaRecords: KnowledgeOpsQaRecord[];
  enrichedQaRecords?: KnowledgeOpsQaRecord[];
  authorityRecords: KnowledgeOpsQaRecord[];
  translationCache?: Record<string, KnowledgeOpsTranslationCacheRecord>;
  translationFailures?: Record<string, KnowledgeOpsTranslationFailureRecord>;
  coverageAudit?: KnowledgeOpsCoverageAudit | null;
  reviewQueueSummary?: unknown;
}

export interface KnowledgeOpsReportOptions {
  now?: string;
  sampleLimit?: number;
  watchedSourceIds?: string[];
  watchedSourceMinimumRecords?: number;
  fileStats?: Record<string, KnowledgeOpsFileStat>;
}

export interface KnowledgeOpsPromotionQuestionCandidate {
  id?: string;
  question: string;
  category?: string;
  topic?: string;
  targetStage: string[];
  riskLevel: 'green' | 'yellow';
  suggestedUse: 'general_education' | 'care_boundary';
  boundaryNote?: string;
  authorityReference: {
    title?: string;
    url?: string;
    sourceOrg?: string;
    sourceClass?: string;
    authoritative: boolean;
  };
}

const DEFAULT_WATCHED_SOURCE_IDS = ['mayo-clinic-zh', 'chinacdc-nutrition'];
const DEFAULT_WATCHED_SOURCE_MINIMUM_RECORDS = 10;
const AUTHORITY_SOURCE_PATTERN = /who\.int|cdc\.gov|healthychildren\.org|acog\.org|mayoclinic\.org|msdmanuals\.cn|nhs\.uk|nih\.gov|fda\.gov|nhc\.gov\.cn|chinacdc\.cn|ndcpa\.gov\.cn|gov\.cn|who|cdc|aap|acog|mayo|nhs|卫健委|疾控|中国政府网|国家疾病预防控制局/iu;
const PROMOTION_CASE_FORM_PATTERN = /全部症状|发病时间|治疗情况|患者性别|患者年龄|病情描述|想得到怎样的帮助/u;
const PROMOTION_URGENT_RISK_PATTERN = /高烧|高热|发烧|发热|咳嗽|腹泻|呕吐|便秘|红疹|皮疹|湿疹|黄疸|出血|见红|疼|痛|呼吸困难|喘不过气|抽搐|惊厥|意识异常|昏迷|大出血|脱水|胎动消失|胎动明显减少|拒奶.*精神差|精神差.*拒奶|吃什么药|用什么药/u;
const PROMOTION_PERSONAL_CASE_PATTERN = /(?:^|[，。？！\s])(我|我的|本人|老婆|老公|亲戚|男朋友|女朋友)|上个月|这个月|今天|昨天|这几天|最近|前几天|医生|医院|检查|B超|彩超|输液|打针|退烧药|治疗情况|我应该怎么办|该怎么办|怎么办|怎么回事|不胖|硬疙瘩|不吃奶|不吃奶粉|没怎么吃奶/u;
const PROMOTION_CARE_BOUNDARY_PATTERN = /何时就医|什么时候需要就医|就医信号|红旗信号/u;
const PROMOTION_GENERIC_INTENT_PATTERNS = [
  /(?:宝宝|婴儿|孩子).{0,12}辅食.{0,12}(?:怎么|如何|注意|添加|顺序)/u,
  /(?:辅食).{0,12}(?:怎么|如何|注意|添加|顺序)/u,
  /(?:宝宝|婴儿|孩子).{0,12}(?:母乳|奶量|喂养|吃奶).{0,12}(?:怎么|如何|注意|多少)/u,
  /(?:宝宝|婴儿|孩子).{0,12}(?:睡眠|夜醒|作息|安抚|哄睡).{0,12}(?:怎么|如何|注意|怎么办)/u,
  /(?:发育|里程碑).{0,12}(?:怎么|如何|注意|观察)/u,
  /胎动.{0,8}(?:怎么数|如何数|注意)/u,
  /(?:产检|待产|入院准备).{0,12}(?:怎么|如何|注意|准备|项目|时间)/u,
  /(?:孕期营养|叶酸|体重增长).{0,12}(?:怎么|如何|注意|多少)/u,
  /(?:疫苗|接种).{0,12}(?:时间|程序|注意|反应观察)/u,
  PROMOTION_CARE_BOUNDARY_PATTERN,
];
const PROMOTION_MAX_QUESTION_LENGTH = 72;

function roundPercent(value: number): number {
  return Number(value.toFixed(2));
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeKey(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : 'unknown';
}

function normalizeRiskLevel(value: unknown): KnowledgeOpsRiskLevel {
  if (value === 'red' || value === 'yellow' || value === 'green') {
    return value;
  }
  return 'unknown';
}

function makeRiskCounts(): Record<KnowledgeOpsRiskLevel, number> {
  return {
    red: 0,
    yellow: 0,
    green: 0,
    unknown: 0,
  };
}

function topBy<T>(items: T[], keyFn: (item: T) => unknown, limit = 10): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = normalizeKey(keyFn(item));
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function countRisks(items: KnowledgeOpsQaRecord[]): Record<KnowledgeOpsRiskLevel, number> {
  const counts = makeRiskCounts();
  for (const item of items) {
    counts[normalizeRiskLevel(item.risk_level_default)] += 1;
  }
  return counts;
}

function hasAuthorityReference(reference?: KnowledgeOpsReference | null): boolean {
  if (!reference) {
    return false;
  }

  if (reference.authoritative === true || reference.sourceClass === 'official') {
    return true;
  }

  const sourceText = `${reference.org || ''} ${reference.sourceOrg || ''} ${reference.title || ''} ${reference.url || ''}`;
  return AUTHORITY_SOURCE_PATTERN.test(sourceText);
}

function resolveAuthorityReference(record: KnowledgeOpsQaRecord): KnowledgeOpsReference | undefined {
  if (Array.isArray(record.references)) {
    const reference = record.references.find(hasAuthorityReference);
    if (reference) {
      return reference;
    }
  }

  if (hasAuthorityCoverage(record)) {
    return {
      sourceOrg: record.source_org || record.source,
      sourceClass: record.source_class,
      title: record.source || record.source_org,
      url: record.source_url || record.url,
      authoritative: record.source_class === 'official',
    };
  }

  return undefined;
}

export function hasAuthorityCoverage(record: KnowledgeOpsQaRecord): boolean {
  if (Array.isArray(record.references) && record.references.some(hasAuthorityReference)) {
    return true;
  }

  const sourceText = `${record.source_org || ''} ${record.source || ''} ${record.source_url || ''} ${record.url || ''}`;
  return AUTHORITY_SOURCE_PATTERN.test(sourceText);
}

function buildCoverageSummary(
  records: KnowledgeOpsQaRecord[],
  audit: KnowledgeOpsCoverageAudit | null | undefined,
  sampleLimit: number,
) {
  if (
    audit
    && Number.isFinite(audit.total)
    && Number.isFinite(audit.authorityCovered)
    && Number.isFinite(audit.missingAuthorityCoverage)
  ) {
    return {
      source: 'authority-coverage-audit',
      total: Number(audit.total),
      rawTotal: Number(audit.rawTotal || audit.total),
      excludedByGuard: (audit.excludedByGuard || [])
        .map((item) => ({
          reason: normalizeKey(item.reason),
          count: Number(item.count || 0),
        }))
        .filter((item) => item.count > 0),
      authorityCovered: Number(audit.authorityCovered),
      missingAuthorityCoverage: Number(audit.missingAuthorityCoverage),
      coverageRate: Number(audit.coverageRate || 0),
      missingByCategory: (audit.missingByCategory || [])
        .map((item) => ({
          category: normalizeKey(item.category),
          count: Number(item.count || 0),
        }))
        .filter((item) => item.count > 0),
      remediationQueue: (audit.remediationQueue || []).slice(0, sampleLimit),
    };
  }

  const missing = records.filter((record) => !hasAuthorityCoverage(record));
  return {
    source: 'computed',
    total: records.length,
    authorityCovered: records.length - missing.length,
    missingAuthorityCoverage: missing.length,
    coverageRate: roundPercent(((records.length - missing.length) / Math.max(records.length, 1)) * 100),
    missingByCategory: topBy(missing, (item) => item.category, 20).map((item) => ({
      category: item.key,
      count: item.count,
    })),
    remediationQueue: missing.slice(0, sampleLimit).map((item) => ({
      id: item.id,
      category: item.category,
      question: item.question,
    })),
  };
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

function isValidHttpUrl(value?: string): boolean {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

function resolveSourceUpdatedAt(record: KnowledgeOpsQaRecord): string | undefined {
  return record.updated_at || record.source_updated_at || record.published_at || record.created_at;
}

export function buildKnowledgeOpsAuthoritySlug(record: KnowledgeOpsQaRecord, index: number): string {
  const base = (record.id || record.original_id || record.question || `authority-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base.startsWith('authority-') ? base : `authority-${base || index + 1}`;
}

function isTranslationCandidate(record: KnowledgeOpsQaRecord): boolean {
  if (!isValidHttpUrl(record.source_url || record.url)) {
    return false;
  }

  if (record.source_language === 'zh') {
    return false;
  }

  const sourceText = [record.question || '', record.summary || '', record.answer || ''].join('\n');
  return !isMostlyChineseText(sourceText);
}

function normalizeFailureMessage(value: unknown): string {
  const message = typeof value === 'string' && value.trim() ? value.trim() : 'unknown';
  return message.replace(/\s+/g, ' ').slice(0, 160);
}

function buildTranslationSummary(
  authorityRecords: KnowledgeOpsQaRecord[],
  translationCache: Record<string, KnowledgeOpsTranslationCacheRecord>,
  translationFailures: Record<string, KnowledgeOpsTranslationFailureRecord>,
  now: string,
  sampleLimit: number,
) {
  const nowMs = Date.parse(now);
  const recordsBySlug = new Map<string, { record: KnowledgeOpsQaRecord; sourceUpdatedAt?: string; translatable: boolean }>();

  authorityRecords.forEach((record, index) => {
    recordsBySlug.set(buildKnowledgeOpsAuthoritySlug(record, index), {
      record,
      sourceUpdatedAt: resolveSourceUpdatedAt(record),
      translatable: isTranslationCandidate(record),
    });
  });

  const translatableSlugs = Array.from(recordsBySlug.entries())
    .filter(([, value]) => value.translatable)
    .map(([slug]) => slug);
  const freshSlugs = new Set<string>();
  const staleSamples: Array<{ slug: string; cachedSourceUpdatedAt?: string; currentSourceUpdatedAt?: string; title?: string }> = [];
  let staleEntries = 0;
  let orphanEntries = 0;

  for (const [slug, cached] of Object.entries(translationCache || {})) {
    const current = recordsBySlug.get(slug);
    if (!current) {
      orphanEntries += 1;
      continue;
    }

    if (cached.sourceUpdatedAt === current.sourceUpdatedAt) {
      freshSlugs.add(slug);
      continue;
    }

    staleEntries += 1;
    if (staleSamples.length < sampleLimit) {
      staleSamples.push({
        slug,
        cachedSourceUpdatedAt: cached.sourceUpdatedAt,
        currentSourceUpdatedAt: current.sourceUpdatedAt,
        title: current.record.question,
      });
    }
  }

  const missingFreshTranslationSample = translatableSlugs
    .filter((slug) => !freshSlugs.has(slug))
    .slice(0, sampleLimit)
    .map((slug) => ({
      slug,
      title: recordsBySlug.get(slug)?.record.question,
      sourceOrg: recordsBySlug.get(slug)?.record.source_org || recordsBySlug.get(slug)?.record.source,
    }));

  const failures = Object.entries(translationFailures || {});
  const retryableFailures = failures.filter(([, failure]) => {
    const retryAt = Date.parse(failure.retryAfterAt || '');
    return !Number.isFinite(retryAt) || retryAt <= nowMs;
  });
  const blockedFailures = failures.length - retryableFailures.length;
  const failureMessageSummary = topBy(failures, ([, failure]) => normalizeFailureMessage(failure.message), 10);
  const cacheCleanResult = cleanAuthorityTranslationCache(translationCache || {});

  return {
    authorityRecords: authorityRecords.length,
    recordsForTranslation: translatableSlugs.length,
    cacheEntries: Object.keys(translationCache || {}).length,
    invalidCacheEntries: cacheCleanResult.removed,
    freshCacheEntries: freshSlugs.size,
    staleCacheEntries: staleEntries,
    orphanCacheEntries: orphanEntries,
    missingFreshTranslations: Math.max(0, translatableSlugs.length - translatableSlugs.filter((slug) => freshSlugs.has(slug)).length),
    cacheHitRate: roundPercent((translatableSlugs.filter((slug) => freshSlugs.has(slug)).length / Math.max(translatableSlugs.length, 1)) * 100),
    failureEntries: failures.length,
    retryableFailures: retryableFailures.length,
    blockedFailures,
    topFailureMessages: failureMessageSummary.map((item) => ({
      message: item.key,
      count: item.count,
    })),
    invalidCacheSamples: cacheCleanResult.removedEntries.slice(0, sampleLimit),
    staleSamples,
    failureSamples: failures.slice(0, sampleLimit).map(([slug, failure]) => ({
      slug,
      message: normalizeFailureMessage(failure.message),
      attempts: failure.attempts || 0,
      failedAt: failure.failedAt,
      retryAfterAt: failure.retryAfterAt,
    })),
    missingFreshTranslationSample,
  };
}

function buildReviewRiskSummary(authorityRecords: KnowledgeOpsQaRecord[], reviewQueueSummary: unknown, sampleLimit: number) {
  const byRisk = countRisks(authorityRecords);
  const sampleByRisk = (['red', 'yellow', 'green'] as const).reduce<Record<'red' | 'yellow' | 'green', Array<{ id?: string; title?: string; sourceId?: string; sourceOrg?: string; topic?: string }>>>((acc, risk) => {
    acc[risk] = authorityRecords
      .filter((record) => normalizeRiskLevel(record.risk_level_default) === risk)
      .slice(0, sampleLimit)
      .map((record) => ({
        id: record.id,
        title: record.question,
        sourceId: record.source_id,
        sourceOrg: record.source_org || record.source,
        topic: record.topic || record.category,
      }));
    return acc;
  }, { red: [], yellow: [], green: [] });

  return {
    cacheRiskDistribution: byRisk,
    cacheRiskBySource: topBy(authorityRecords, (item) => `${normalizeRiskLevel(item.risk_level_default)}:${normalizeKey(item.source_id || item.source_org || item.source)}`, 20),
    layers: [
      {
        riskLevel: 'red',
        action: 'manual_review',
        count: byRisk.red,
        samples: sampleByRisk.red,
      },
      {
        riskLevel: 'yellow',
        action: 'sample_review',
        count: byRisk.yellow,
        samples: sampleByRisk.yellow,
      },
      {
        riskLevel: 'green',
        action: 'default_publish',
        count: byRisk.green,
        samples: sampleByRisk.green,
      },
    ],
    reviewQueueSummary: reviewQueueSummary || null,
  };
}

function resolveWatchedSourceStatus(count: number, minimumPublishedRecords: number): 'missing' | 'low' | 'healthy' {
  if (count <= 0) {
    return 'missing';
  }

  return count >= minimumPublishedRecords ? 'healthy' : 'low';
}

function buildSourceCoverageSummary(
  authorityRecords: KnowledgeOpsQaRecord[],
  watchedSourceIds: string[],
  minimumPublishedRecords: number,
) {
  const countBySourceId = new Map<string, number>();
  for (const record of authorityRecords) {
    const sourceId = normalizeKey(record.source_id || record.source_org || record.source);
    countBySourceId.set(sourceId, (countBySourceId.get(sourceId) || 0) + 1);
  }

  return {
    watchedSources: watchedSourceIds.map((sourceId) => ({
      sourceId,
      count: countBySourceId.get(sourceId) || 0,
      minimumPublishedRecords,
      status: resolveWatchedSourceStatus(countBySourceId.get(sourceId) || 0, minimumPublishedRecords),
    })),
    topSources: topBy(authorityRecords, (item) => item.source_id || item.source_org || item.source, 15),
  };
}

function isOfficialPromotionReference(reference: KnowledgeOpsReference): boolean {
  if (reference.sourceClass === 'official') {
    return true;
  }

  const sourceText = `${reference.org || ''} ${reference.sourceOrg || ''} ${reference.title || ''} ${reference.url || ''}`;
  return AUTHORITY_SOURCE_PATTERN.test(sourceText);
}

function buildPromotionSafeQuestionCandidates(records: KnowledgeOpsQaRecord[], sampleLimit: number) {
  const excluded = {
    missingQuestion: 0,
    unsafeQuestionShape: 0,
    unsupportedPromotionIntent: 0,
    contentGuard: 0,
    missingAuthorityReference: 0,
    redRisk: 0,
    unsupportedRisk: 0,
  };
  const candidates: KnowledgeOpsPromotionQuestionCandidate[] = [];

  for (const record of records) {
    const question = (record.question || '').trim();
    if (!question) {
      excluded.missingQuestion += 1;
      continue;
    }

    const allowsCareBoundary = PROMOTION_CARE_BOUNDARY_PATTERN.test(question);
    if (
      question.length > PROMOTION_MAX_QUESTION_LENGTH
      || PROMOTION_CASE_FORM_PATTERN.test(question)
      || (PROMOTION_URGENT_RISK_PATTERN.test(question) && !allowsCareBoundary)
      || PROMOTION_PERSONAL_CASE_PATTERN.test(question)
    ) {
      excluded.unsafeQuestionShape += 1;
      continue;
    }

    if (!PROMOTION_GENERIC_INTENT_PATTERNS.some((pattern) => pattern.test(question))) {
      excluded.unsupportedPromotionIntent += 1;
      continue;
    }

    if (getDatasetKnowledgeDropReason(record)) {
      excluded.contentGuard += 1;
      continue;
    }

    const authorityReference = resolveAuthorityReference(record);
    if (!authorityReference || !isOfficialPromotionReference(authorityReference)) {
      excluded.missingAuthorityReference += 1;
      continue;
    }

    const riskLevel = normalizeRiskLevel(record.risk_level_default);
    if (riskLevel === 'red') {
      excluded.redRisk += 1;
      continue;
    }
    if (riskLevel !== 'green' && riskLevel !== 'yellow') {
      excluded.unsupportedRisk += 1;
      continue;
    }

    candidates.push({
      id: record.id || record.original_id,
      question,
      category: record.category,
      topic: record.topic,
      targetStage: Array.isArray(record.target_stage) ? record.target_stage.filter(Boolean) : [],
      riskLevel,
      suggestedUse: riskLevel === 'green' ? 'general_education' : 'care_boundary',
      boundaryNote: riskLevel === 'yellow'
        ? '仅用于科普与就医准备，不作为诊断或治疗建议。'
        : undefined,
      authorityReference: {
        title: authorityReference.title,
        url: authorityReference.url,
        sourceOrg: authorityReference.sourceOrg || authorityReference.org,
        sourceClass: authorityReference.sourceClass,
        authoritative: authorityReference.authoritative === true || authorityReference.sourceClass === 'official',
      },
    });
  }

  const sortedCandidates = candidates.sort((left, right) => {
    const riskOrder = left.riskLevel.localeCompare(right.riskLevel);
    if (riskOrder !== 0) {
      return riskOrder;
    }
    return (left.category || '').localeCompare(right.category || '') || left.question.localeCompare(right.question);
  });

  return {
    source: 'enriched_qa',
    eligibleInput: records.length,
    total: sortedCandidates.length,
    byCategory: topBy(sortedCandidates, (item) => item.category, 12),
    byTopic: topBy(sortedCandidates, (item) => item.topic, 12),
    excluded,
    candidates: sortedCandidates.slice(0, sampleLimit),
  };
}

export function buildKnowledgeOpsReport(input: KnowledgeOpsReportInput, options: KnowledgeOpsReportOptions = {}) {
  const now = options.now || new Date().toISOString();
  const sampleLimit = Math.max(1, Math.min(options.sampleLimit || 20, 100));
  const qaRecords = input.qaRecords || [];
  const enrichedQaRecords = input.enrichedQaRecords || [];
  const authorityRecords = input.authorityRecords || [];
  const coverageRecords = enrichedQaRecords.length > 0 ? enrichedQaRecords : qaRecords;
  const watchedSourceIds = options.watchedSourceIds || DEFAULT_WATCHED_SOURCE_IDS;
  const watchedSourceMinimumRecords = normalizePositiveInteger(
    options.watchedSourceMinimumRecords,
    DEFAULT_WATCHED_SOURCE_MINIMUM_RECORDS,
  );
  const coverage = buildCoverageSummary(coverageRecords, input.coverageAudit, sampleLimit);
  const sourceCoverage = buildSourceCoverageSummary(authorityRecords, watchedSourceIds, watchedSourceMinimumRecords);
  const translations = buildTranslationSummary(
    authorityRecords,
    input.translationCache || {},
    input.translationFailures || {},
    now,
    sampleLimit,
  );

  const actionItems = [
    coverage.coverageRate < 60
      ? {
        priority: 'P2',
        area: 'authority_coverage',
        message: `authority coverage below 60%: ${coverage.coverageRate}%`,
      }
      : null,
    translations.failureEntries > 0
      ? {
        priority: 'P2',
        area: 'translation_cache',
        message: `${translations.failureEntries} translation failures need retry or diagnosis`,
      }
      : null,
    translations.invalidCacheEntries > 0
      ? {
        priority: 'P2',
        area: 'translation_cache',
        message: `${translations.invalidCacheEntries} invalid translation cache entries need cleanup`,
      }
      : null,
    ...sourceCoverage.watchedSources
      .filter((source) => source.status !== 'healthy')
      .map((source) => ({
        priority: 'P2',
        area: 'source_coverage',
        message: `${source.sourceId} has ${source.count}/${source.minimumPublishedRecords} published authority records`,
      })),
  ].filter((item): item is { priority: string; area: string; message: string } => Boolean(item));

  return {
    generatedAt: now,
    files: options.fileStats || {},
    qa: {
      total: qaRecords.length,
      enrichedTotal: enrichedQaRecords.length,
      enrichedAvailable: enrichedQaRecords.length > 0,
      verified: qaRecords.filter((item) => item.is_verified === true).length,
      topCategories: topBy(qaRecords, (item) => item.category, 12),
      topSources: topBy(qaRecords, (item) => item.source || item.source_org, 12),
    },
    authority: {
      total: authorityRecords.length,
      official: authorityRecords.filter((item) => item.source_class === 'official').length,
      medicalPlatform: authorityRecords.filter((item) => item.source_class === 'medical_platform').length,
      verified: authorityRecords.filter((item) => item.is_verified === true).length,
      topTopics: topBy(authorityRecords, (item) => item.topic || item.category, 12),
      topSources: topBy(authorityRecords, (item) => item.source_id || item.source_org || item.source, 12),
      riskDistribution: countRisks(authorityRecords),
    },
    coverage,
    translations,
    review: buildReviewRiskSummary(authorityRecords, input.reviewQueueSummary, sampleLimit),
    sourceCoverage,
    promotion: {
      safeQuestionCandidates: buildPromotionSafeQuestionCandidates(enrichedQaRecords, sampleLimit),
    },
    actionItems,
  };
}
