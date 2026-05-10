import {
  buildAuthorityTranslationFailureRetryPlan,
  resolveAuthorityTranslationFailureRetryAfterAt,
  isAuthorityTranslationFailureRetrySourceMatch,
  isPrunableAuthorityTranslationFailure,
  resolveActiveAuthorityTranslationQuotaResetAt,
  resolveActiveAuthorityTranslationTransientBlockUntil,
} from '../src/utils/authority-translation-failure-retry';

describe('authority translation failure retry planner', () => {
  it('selects only retryable failures by default', () => {
    const plan = buildAuthorityTranslationFailureRetryPlan({
      'authority-aap-1': {
        slug: 'authority-aap-1',
        message: 'AI Gateway error: 500',
        attempts: 1,
        failedAt: '2026-05-08T08:00:00.000Z',
        retryAfterAt: '2026-05-08T08:30:00.000Z',
      },
      'authority-aap-2': {
        slug: 'authority-aap-2',
        message: 'AI Gateway error: 422',
        attempts: 1,
        failedAt: '2026-05-08T08:00:00.000Z',
        retryAfterAt: '2026-05-08T12:00:00.000Z',
      },
    }, {
      now: '2026-05-08T09:00:00.000Z',
      limit: 10,
    });

    expect(plan).toMatchObject({
      totalFailures: 2,
      retryableFailures: 1,
      blockedFailures: 1,
      includeBlocked: false,
      limit: 10,
    });
    expect(plan.selectedFailures.map((candidate) => candidate.slug)).toEqual(['authority-aap-1']);
    expect(plan.skippedFailures.map((candidate) => candidate.slug)).toEqual(['authority-aap-2']);
  });

  it('backs off Modal Direct concurrency failures before retrying translation', () => {
    const plan = buildAuthorityTranslationFailureRetryPlan({
      'authority-aap-modal': {
        slug: 'authority-aap-modal',
        message: 'AI Gateway error: 429: {"error": "Too many concurrent requests for this model"}',
        attempts: 1,
        failedAt: '2026-05-09T07:00:00.000Z',
        retryAfterAt: '2026-05-09T07:30:00.000Z',
      },
    }, {
      now: '2026-05-09T07:10:00.000Z',
      limit: 10,
    });

    expect(plan.retryableFailures).toBe(0);
    expect(plan.blockedFailures).toBe(1);
    expect(plan.skippedFailures).toEqual([
      expect.objectContaining({
        slug: 'authority-aap-modal',
        blockedReason: 'retry_after_pending',
      }),
    ]);
  });

  it('reports active transient translation failures for batch warmup pause', () => {
    const blockedUntil = resolveActiveAuthorityTranslationTransientBlockUntil({
      'authority-aap-modal': {
        message: 'AI Gateway error: 429: {"error": "Too many concurrent requests for this model"}',
        failedAt: '2026-05-09T07:00:00.000Z',
        retryAfterAt: '2026-05-09T07:30:00.000Z',
      },
      'authority-aap-weekly': {
        message: 'AI Gateway error: 429: usage limit exceeded, weekly usage limit reached, resets at 2026-05-11T00:00:00+08:00',
        retryAfterAt: '2026-05-10T16:00:00.000Z',
      },
    }, {
      now: '2026-05-09T07:10:00.000Z',
    });

    expect(blockedUntil).toBe('2026-05-09T07:30:00.000Z');
  });

  it('keeps Modal Direct transient failures on a conservative retry schedule', () => {
    expect(resolveAuthorityTranslationFailureRetryAfterAt(
      'AI Gateway error: 429: {"error": "Too many concurrent requests for this model"}',
      new Date('2026-05-10T01:01:42.626Z'),
      2,
    )).toBe('2026-05-10T05:01:42.626Z');

    expect(resolveAuthorityTranslationFailureRetryAfterAt(
      'AI Gateway timeout after 45000ms',
      new Date('2026-05-10T01:01:12.046Z'),
      2,
    )).toBe('2026-05-10T09:01:12.046Z');
  });

  it('uses conservative retry timing when old failure records had a shorter retryAfterAt', () => {
    const plan = buildAuthorityTranslationFailureRetryPlan({
      'authority-aap-timeout': {
        slug: 'authority-aap-timeout',
        message: 'AI Gateway timeout after 45000ms',
        attempts: 2,
        failedAt: '2026-05-10T01:01:12.046Z',
        retryAfterAt: '2026-05-10T02:01:12.046Z',
      },
    }, {
      now: '2026-05-10T02:08:12.212Z',
      limit: 10,
    });

    expect(plan.retryableFailures).toBe(0);
    expect(plan.blockedFailures).toBe(1);
    expect(plan.skippedFailures).toEqual([
      expect.objectContaining({
        slug: 'authority-aap-timeout',
        retryable: false,
        retryAfterAt: '2026-05-10T09:01:12.046Z',
        blockedReason: 'retry_after_pending',
      }),
    ]);
  });

  it('can include blocked failures and apply slug/limit filters', () => {
    const plan = buildAuthorityTranslationFailureRetryPlan({
      'authority-aap-1': {
        message: 'timeout',
        retryAfterAt: '2026-05-08T08:30:00.000Z',
      },
      'authority-aap-2': {
        message: 'timeout',
        retryAfterAt: '2026-05-08T12:00:00.000Z',
      },
    }, {
      now: '2026-05-08T09:00:00.000Z',
      includeBlocked: true,
      limit: 1,
      slug: 'authority-aap-2',
    });

    expect(plan.totalFailures).toBe(1);
    expect(plan.selectedFailures).toEqual([
      expect.objectContaining({
        slug: 'authority-aap-2',
        retryable: false,
        blockedReason: 'retry_after_pending',
      }),
    ]);
  });

  it('keeps AI Gateway weekly quota failures blocked until the reset time', () => {
    const plan = buildAuthorityTranslationFailureRetryPlan({
      'authority-aap-429': {
        slug: 'authority-aap-429',
        message: 'AI Gateway error: 429: usage limit exceeded, weekly usage limit reached for Token Plan Starter (6000/6000 used), resets at 2026-05-11T00:00:00+08:00 (2056)',
        attempts: 1,
        failedAt: '2026-05-09T05:00:00.000Z',
        retryAfterAt: '2026-05-09T06:00:00.000Z',
      },
    }, {
      now: '2026-05-09T07:00:00.000Z',
      limit: 10,
    });

    expect(plan.retryableFailures).toBe(0);
    expect(plan.blockedFailures).toBe(1);
    expect(plan.selectedFailures).toEqual([]);
    expect(plan.skippedFailures).toEqual([
      expect.objectContaining({
        slug: 'authority-aap-429',
        retryable: false,
        blockedReason: 'ai_gateway_usage_limit',
        retryAfterAt: '2026-05-10T16:00:00.000Z',
      }),
    ]);
  });

  it('reports the active AI Gateway quota reset time across cached failures', () => {
    const resetAt = resolveActiveAuthorityTranslationQuotaResetAt({
      'authority-aap-1': {
        message: 'AI Gateway timeout after 45000ms',
        retryAfterAt: '2026-05-09T08:00:00.000Z',
      },
      'authority-aap-2': {
        message: 'AI Gateway error: 429: usage limit exceeded, weekly usage limit reached, resets at 2026-05-11T00:00:00+08:00',
        retryAfterAt: '2026-05-09T06:00:00.000Z',
      },
    }, {
      now: '2026-05-09T07:00:00.000Z',
    });

    expect(resetAt).toBe('2026-05-10T16:00:00.000Z');

    expect(resolveActiveAuthorityTranslationQuotaResetAt({
      'authority-aap-2': {
        message: 'AI Gateway error: 429: usage limit exceeded, weekly usage limit reached, resets at 2026-05-11T00:00:00+08:00',
      },
    }, {
      now: '2026-05-10T16:00:00.000Z',
    })).toBeUndefined();
  });

  it('requires sourceUpdatedAt to match the current authority record before retrying', () => {
    expect(isAuthorityTranslationFailureRetrySourceMatch(
      '2026-05-02T11:55:51.000Z',
      '2026-05-02T11:55:51.000Z',
    )).toBe(true);
    expect(isAuthorityTranslationFailureRetrySourceMatch(
      '2026-05-02T11:55:51.000Z',
      '2026-05-08T06:00:09.000Z',
    )).toBe(false);
    expect(isAuthorityTranslationFailureRetrySourceMatch(undefined, '2026-05-08T06:00:09.000Z')).toBe(false);
  });

  it('only prunes stale failures that cannot be retried against current records', () => {
    expect(isPrunableAuthorityTranslationFailure({ skipReason: 'authority_record_not_found' })).toBe(true);
    expect(isPrunableAuthorityTranslationFailure({ skipReason: 'source_updated_at_mismatch' })).toBe(true);
    expect(isPrunableAuthorityTranslationFailure({ skipReason: undefined })).toBe(false);
  });
});
