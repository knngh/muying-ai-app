import fs from 'fs';
import os from 'os';
import path from 'path';

describe('authority translation warmup', () => {
  const originalEnv = {
    AUTHORITY_KNOWLEDGE_CACHE_PATH: process.env.AUTHORITY_KNOWLEDGE_CACHE_PATH,
    AUTHORITY_TRANSLATION_CACHE_PATH: process.env.AUTHORITY_TRANSLATION_CACHE_PATH,
    AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH: process.env.AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH,
    AUTHORITY_TRANSLATION_SYNC_LIMIT: process.env.AUTHORITY_TRANSLATION_SYNC_LIMIT,
    AUTHORITY_TRANSLATION_SYNC_DELAY_MS: process.env.AUTHORITY_TRANSLATION_SYNC_DELAY_MS,
  };

  function restoreEnv() {
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    jest.useRealTimers();
    restoreEnv();
  });

  it('pauses batch warmup while AI Gateway weekly quota is blocked', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-translation-warmup-'));
    const authorityCachePath = path.join(tmpDir, 'authority-knowledge-cache.json');
    const translationCachePath = path.join(tmpDir, 'authority-translation-cache.json');
    const failureCachePath = path.join(tmpDir, 'authority-translation-failures.json');

    fs.writeFileSync(authorityCachePath, JSON.stringify([
      {
        id: 'aap-1',
        question: 'Your baby first solid foods',
        summary: 'How to introduce solid foods.',
        answer: 'Start around six months when the baby shows readiness. Offer iron-rich foods and avoid choking hazards.',
        source_language: 'en',
        source_url: 'https://www.healthychildren.org/example',
        updated_at: '2026-05-09T00:00:00.000Z',
      },
    ]), 'utf-8');
    fs.writeFileSync(translationCachePath, '{}', 'utf-8');
    fs.writeFileSync(failureCachePath, JSON.stringify({
      'authority-aap-429': {
        slug: 'authority-aap-429',
        message: 'AI Gateway error: 429: usage limit exceeded, weekly usage limit reached, resets at 2026-05-11T00:00:00+08:00',
        attempts: 1,
        failedAt: '2026-05-09T05:00:00.000Z',
        retryAfterAt: '2026-05-09T06:00:00.000Z',
      },
    }), 'utf-8');

    process.env.AUTHORITY_KNOWLEDGE_CACHE_PATH = authorityCachePath;
    process.env.AUTHORITY_TRANSLATION_CACHE_PATH = translationCachePath;
    process.env.AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH = failureCachePath;
    process.env.AUTHORITY_TRANSLATION_SYNC_LIMIT = '10';
    process.env.AUTHORITY_TRANSLATION_SYNC_DELAY_MS = '0';

    jest.useFakeTimers().setSystemTime(new Date('2026-05-09T07:00:00.000Z'));

    let moduleApi: {
      callTaskModelSpy: jest.SpyInstance;
      warmPublishedAuthorityTranslations: typeof import('../src/services/authority-translation.service').warmPublishedAuthorityTranslations;
    } | null = null;

    jest.isolateModules(() => {
      const aiGateway = require('../src/services/ai-gateway.service') as typeof import('../src/services/ai-gateway.service');
      const callTaskModelSpy = jest.spyOn(aiGateway, 'callTaskModelDetailed');
      const translationService = require('../src/services/authority-translation.service') as typeof import('../src/services/authority-translation.service');

      moduleApi = {
        callTaskModelSpy,
        warmPublishedAuthorityTranslations: translationService.warmPublishedAuthorityTranslations,
      };
    });

    expect(moduleApi).not.toBeNull();
    const result = await moduleApi.warmPublishedAuthorityTranslations({
      delayMs: 0,
      limit: 10,
    });

    expect(result).toEqual(expect.objectContaining({
      scanned: 1,
      candidates: 1,
      selected: 0,
      skipped: 1,
      warmed: 0,
      failed: 0,
      quotaBlocked: true,
      quotaResetAt: '2026-05-10T16:00:00.000Z',
    }));
    expect(moduleApi.callTaskModelSpy).not.toHaveBeenCalled();
  });
});
