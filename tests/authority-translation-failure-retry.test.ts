import {
  buildAuthorityTranslationFailureRetryPlan,
  isAuthorityTranslationFailureRetrySourceMatch,
  isPrunableAuthorityTranslationFailure,
} from '../src/utils/authority-translation-failure-retry';

describe('authority translation failure retry planner', () => {
  it('selects only retryable failures by default', () => {
    const plan = buildAuthorityTranslationFailureRetryPlan({
      'authority-aap-1': {
        slug: 'authority-aap-1',
        message: 'AI Gateway timeout after 45000ms',
        attempts: 2,
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
