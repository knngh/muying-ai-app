import { resolveAuthorityWorkerTranslationWarmupOptions } from '../src/utils/authority-worker-warmup';

describe('authority worker translation warmup options', () => {
  it('keeps startup warmup read-only by default', () => {
    expect(resolveAuthorityWorkerTranslationWarmupOptions('startup', {})).toEqual({
      limit: 0,
    });
  });

  it('allows startup translation warmup to be explicitly enabled', () => {
    expect(resolveAuthorityWorkerTranslationWarmupOptions('startup', {
      AUTHORITY_TRANSLATION_STARTUP_LIMIT: '2',
      AUTHORITY_TRANSLATION_STARTUP_DELAY_MS: '0',
    })).toEqual({
      limit: 2,
      delayMs: 0,
    });
  });

  it('keeps scheduled warmup phases on the service defaults', () => {
    expect(resolveAuthorityWorkerTranslationWarmupOptions('interval', {
      AUTHORITY_TRANSLATION_STARTUP_LIMIT: '2',
    })).toEqual({});
    expect(resolveAuthorityWorkerTranslationWarmupOptions('after_sync', {
      AUTHORITY_TRANSLATION_STARTUP_LIMIT: '2',
    })).toEqual({});
  });
});
