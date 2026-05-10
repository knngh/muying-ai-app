import {
  isAiGatewayUsageLimitBlocked,
  resolveAiGatewayUsageLimitRetryAfterAt,
} from './ai-gateway-quota';

export interface AuthorityTranslationFailureRecord {
  slug?: string;
  sourceUpdatedAt?: string;
  message?: string;
  attempts?: number;
  failedAt?: string;
  retryAfterAt?: string;
}

export interface AuthorityTranslationFailureRetryPlanOptions {
  now?: string;
  limit?: number;
  includeBlocked?: boolean;
  slug?: string;
}

export interface AuthorityTranslationFailureRetryCandidate {
  slug: string;
  sourceUpdatedAt?: string;
  currentSourceUpdatedAt?: string;
  message: string;
  attempts: number;
  failedAt?: string;
  retryAfterAt?: string;
  retryable: boolean;
  blockedReason?: 'retry_after_pending' | 'ai_gateway_usage_limit';
  skipReason?: 'authority_record_not_found' | 'source_updated_at_mismatch';
}

export interface AuthorityTranslationFailureRetryPlan {
  generatedAt: string;
  totalFailures: number;
  retryableFailures: number;
  blockedFailures: number;
  includeBlocked: boolean;
  limit: number;
  selectedFailures: AuthorityTranslationFailureRetryCandidate[];
  skippedFailures: AuthorityTranslationFailureRetryCandidate[];
}

export interface AuthorityTranslationQuotaBlockOptions {
  now?: string;
}

export function getAuthorityTranslationFailureRetryDelayMs(message: string, attempts: number): number {
  const normalized = message.toLowerCase();
  const safeAttempts = Math.max(1, attempts);

  if (/too many concurrent|concurrent requests/i.test(normalized)) {
    return Math.min(12 * 60 * 60 * 1000, 2 * 60 * 60 * 1000 * safeAttempts);
  }

  if (/timeout|timed out|empty response/i.test(normalized)) {
    return Math.min(12 * 60 * 60 * 1000, 4 * 60 * 60 * 1000 * safeAttempts);
  }

  if (/529|overload|temporar|rate limit|短暂繁忙|超时/u.test(normalized)) {
    return Math.min(2 * 60 * 60 * 1000, 30 * 60 * 1000 * safeAttempts);
  }

  if (/422|解析|empty translation|prompt leak|提示词/u.test(normalized)) {
    return Math.min(24 * 60 * 60 * 1000, 6 * 60 * 60 * 1000 * safeAttempts);
  }

  return Math.min(6 * 60 * 60 * 1000, 60 * 60 * 1000 * safeAttempts);
}

export function resolveAuthorityTranslationFailureRetryAfterAt(
  message: string,
  failedAt: Date,
  attempts: number,
): string {
  return resolveAiGatewayUsageLimitRetryAfterAt(message)
    || new Date(failedAt.getTime() + getAuthorityTranslationFailureRetryDelayMs(message, attempts)).toISOString();
}

export function isPrunableAuthorityTranslationFailure(
  candidate: Pick<AuthorityTranslationFailureRetryCandidate, 'skipReason'>,
): boolean {
  return candidate.skipReason === 'authority_record_not_found'
    || candidate.skipReason === 'source_updated_at_mismatch';
}

function normalizeMessage(value: unknown): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().replace(/\s+/g, ' ').slice(0, 240)
    : 'unknown';
}

function normalizeAttempts(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function isRetryableAt(retryAfterAt: string | undefined, nowMs: number): boolean {
  if (!retryAfterAt) {
    return true;
  }

  const retryAt = Date.parse(retryAfterAt);
  return !Number.isFinite(retryAt) || retryAt <= nowMs;
}

function resolveFailureRetryState(
  failure: AuthorityTranslationFailureRecord,
  nowMs: number,
): Pick<AuthorityTranslationFailureRetryCandidate, 'retryAfterAt' | 'retryable' | 'blockedReason'> {
  const usageLimitRetryAfterAt = resolveAiGatewayUsageLimitRetryAfterAt(failure?.message);
  if (usageLimitRetryAfterAt && isAiGatewayUsageLimitBlocked(failure?.message, nowMs)) {
    return {
      retryAfterAt: usageLimitRetryAfterAt,
      retryable: false,
      blockedReason: 'ai_gateway_usage_limit',
    };
  }

  const failedAt = Date.parse(failure?.failedAt || '');
  const conservativeRetryAfterAt = Number.isFinite(failedAt)
    ? resolveAuthorityTranslationFailureRetryAfterAt(
      normalizeMessage(failure?.message),
      new Date(failedAt),
      normalizeAttempts(failure?.attempts),
    )
    : undefined;
  const retryAfterAt = conservativeRetryAfterAt && failure?.retryAfterAt
    ? (Date.parse(conservativeRetryAfterAt) > Date.parse(failure.retryAfterAt) ? conservativeRetryAfterAt : failure.retryAfterAt)
    : (conservativeRetryAfterAt || failure?.retryAfterAt);
  const retryable = isRetryableAt(retryAfterAt, nowMs);
  return {
    retryAfterAt: usageLimitRetryAfterAt || retryAfterAt,
    retryable,
    blockedReason: retryable ? undefined : 'retry_after_pending',
  };
}

export function resolveActiveAuthorityTranslationQuotaResetAt(
  failures: Record<string, AuthorityTranslationFailureRecord>,
  options: AuthorityTranslationQuotaBlockOptions = {},
): string | undefined {
  const generatedAt = options.now || new Date().toISOString();
  const nowMs = Date.parse(generatedAt);
  const effectiveNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const activeResetTimes = Object.values(failures || {})
    .map((failure) => {
      if (!isAiGatewayUsageLimitBlocked(failure?.message, effectiveNowMs)) {
        return undefined;
      }

      return resolveAiGatewayUsageLimitRetryAfterAt(failure?.message);
    })
    .filter((value): value is string => Boolean(value));

  return activeResetTimes.sort()[0];
}

export function resolveActiveAuthorityTranslationTransientBlockUntil(
  failures: Record<string, AuthorityTranslationFailureRecord>,
  options: AuthorityTranslationQuotaBlockOptions = {},
): string | undefined {
  const generatedAt = options.now || new Date().toISOString();
  const nowMs = Date.parse(generatedAt);
  const effectiveNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const blockedUntilTimes = Object.values(failures || {})
    .map((failure) => {
      const message = String(failure?.message || '');
      if (!/too many concurrent|concurrent requests|timeout|empty response/i.test(message)) {
        return undefined;
      }

      const retryAfterMs = Date.parse(failure?.retryAfterAt || '');
      if (!Number.isFinite(retryAfterMs) || retryAfterMs <= effectiveNowMs) {
        return undefined;
      }

      return new Date(retryAfterMs).toISOString();
    })
    .filter((value): value is string => Boolean(value));

  return blockedUntilTimes.sort()[0];
}

function candidateSortKey(candidate: AuthorityTranslationFailureRetryCandidate): string {
  return [
    candidate.retryable ? '0' : '1',
    candidate.retryAfterAt || '',
    candidate.failedAt || '',
    candidate.slug,
  ].join('|');
}

export function isAuthorityTranslationFailureRetrySourceMatch(
  failureSourceUpdatedAt: string | undefined,
  currentSourceUpdatedAt: string | undefined,
): boolean {
  return Boolean(failureSourceUpdatedAt && currentSourceUpdatedAt && failureSourceUpdatedAt === currentSourceUpdatedAt);
}

export function buildAuthorityTranslationFailureRetryPlan(
  failures: Record<string, AuthorityTranslationFailureRecord>,
  options: AuthorityTranslationFailureRetryPlanOptions = {},
): AuthorityTranslationFailureRetryPlan {
  const generatedAt = options.now || new Date().toISOString();
  const nowMs = Date.parse(generatedAt);
  const effectiveNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const includeBlocked = options.includeBlocked === true;
  const limit = Math.max(0, options.limit ?? 10);
  const slugFilter = options.slug?.trim();

  const candidates = Object.entries(failures || {})
    .map(([cacheKey, failure]): AuthorityTranslationFailureRetryCandidate => {
      const slug = (failure?.slug || cacheKey).trim();
      const retryState = resolveFailureRetryState(failure, effectiveNowMs);
      return {
        slug,
        sourceUpdatedAt: failure?.sourceUpdatedAt,
        message: normalizeMessage(failure?.message),
        attempts: normalizeAttempts(failure?.attempts),
        failedAt: failure?.failedAt,
        ...retryState,
      };
    })
    .filter((candidate) => candidate.slug)
    .filter((candidate) => !slugFilter || candidate.slug === slugFilter)
    .sort((left, right) => candidateSortKey(left).localeCompare(candidateSortKey(right)));

  const eligible = candidates.filter((candidate) => candidate.retryable || includeBlocked);
  const selectedFailures = limit > 0 ? eligible.slice(0, limit) : [];
  const selectedSlugs = new Set(selectedFailures.map((candidate) => candidate.slug));

  return {
    generatedAt,
    totalFailures: candidates.length,
    retryableFailures: candidates.filter((candidate) => candidate.retryable).length,
    blockedFailures: candidates.filter((candidate) => !candidate.retryable).length,
    includeBlocked,
    limit,
    selectedFailures,
    skippedFailures: candidates.filter((candidate) => !selectedSlugs.has(candidate.slug)),
  };
}
