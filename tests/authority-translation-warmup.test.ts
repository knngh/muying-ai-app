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
    AUTHORITY_TRANSLATION_TASK_ROLES: process.env.AUTHORITY_TRANSLATION_TASK_ROLES,
    AI_GLM_PROVIDER: process.env.AI_GLM_PROVIDER,
    AI_GLM_MODEL: process.env.AI_GLM_MODEL,
    AI_MODAL_DIRECT_KEY: process.env.AI_MODAL_DIRECT_KEY,
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

  it('defaults translation warmup to free GLM before paid fallback roles', () => {
    delete process.env.AUTHORITY_TRANSLATION_TASK_ROLES;

    let resolveAuthorityTranslationTaskRoles: typeof import('../src/services/authority-translation.service').__authorityTranslationTestUtils.resolveAuthorityTranslationTaskRoles | null = null;
    jest.isolateModules(() => {
      const translationService = require('../src/services/authority-translation.service') as typeof import('../src/services/authority-translation.service');
      resolveAuthorityTranslationTaskRoles = translationService.__authorityTranslationTestUtils.resolveAuthorityTranslationTaskRoles;
    });

    expect(resolveAuthorityTranslationTaskRoles).not.toBeNull();
    expect(resolveAuthorityTranslationTaskRoles!()).toEqual(['glm_classify', 'minimax_render', 'kimi_reason']);

    process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'unknown_role';
    expect(resolveAuthorityTranslationTaskRoles!()).toEqual(['glm_classify', 'minimax_render', 'kimi_reason']);
  });

  it('loads existing translation cache before warming missing articles', async () => {
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
    fs.writeFileSync(translationCachePath, JSON.stringify({
      'authority-aap-1': {
        slug: 'authority-aap-1',
        sourceUpdatedAt: '2026-05-09T00:00:00.000Z',
        translatedTitle: '宝宝第一口辅食',
        translatedSummary: '如何添加辅食。',
        translatedContent: '大约六个月时，在宝宝表现出准备信号后开始添加辅食。',
        translationNotice: '缓存译文',
        updatedAt: '2026-05-09T01:00:00.000Z',
        model: 'zai-org/GLM-5.1-FP8',
        provider: 'modal-direct',
      },
    }), 'utf-8');
    fs.writeFileSync(failureCachePath, '{}', 'utf-8');

    process.env.AUTHORITY_KNOWLEDGE_CACHE_PATH = authorityCachePath;
    process.env.AUTHORITY_TRANSLATION_CACHE_PATH = translationCachePath;
    process.env.AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH = failureCachePath;
    process.env.AUTHORITY_TRANSLATION_SYNC_LIMIT = '10';
    process.env.AUTHORITY_TRANSLATION_SYNC_DELAY_MS = '0';

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
      candidates: 0,
      selected: 0,
      cached: 1,
      skipped: 0,
      warmed: 0,
      failed: 0,
    }));
    expect(moduleApi.callTaskModelSpy).not.toHaveBeenCalled();
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

  it('does not let a legacy quota block pause warmup when Modal Direct GLM is first', async () => {
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
      'authority-minimax-429': {
        slug: 'authority-minimax-429',
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
    process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'glm_classify,minimax_render';
    process.env.AI_GLM_PROVIDER = 'modal-direct';
    process.env.AI_GLM_MODEL = 'zai-org/GLM-5.1-FP8';
    process.env.AI_MODAL_DIRECT_KEY = 'test-modal-key';

    jest.useFakeTimers().setSystemTime(new Date('2026-05-09T07:00:00.000Z'));

    let moduleApi: {
      isModalDirectGlmFirstForTranslation: typeof import('../src/services/authority-translation.service').__authorityTranslationInternalTestUtils.isModalDirectGlmFirstForTranslation;
      shouldStopAfterTranslationTaskFailure: typeof import('../src/services/authority-translation.service').__authorityTranslationInternalTestUtils.shouldStopAfterTranslationTaskFailure;
      warmPublishedAuthorityTranslations: typeof import('../src/services/authority-translation.service').warmPublishedAuthorityTranslations;
    } | null = null;

    jest.isolateModules(() => {
      const translationService = require('../src/services/authority-translation.service') as typeof import('../src/services/authority-translation.service');
      moduleApi = {
        isModalDirectGlmFirstForTranslation: translationService.__authorityTranslationInternalTestUtils.isModalDirectGlmFirstForTranslation,
        shouldStopAfterTranslationTaskFailure: translationService.__authorityTranslationInternalTestUtils.shouldStopAfterTranslationTaskFailure,
        warmPublishedAuthorityTranslations: translationService.warmPublishedAuthorityTranslations,
      };
    });

    expect(moduleApi).not.toBeNull();
    expect(moduleApi.isModalDirectGlmFirstForTranslation()).toBe(true);
    expect(moduleApi.shouldStopAfterTranslationTaskFailure('glm_classify', new Error('AI provider returned empty response'))).toBe(true);

    const result = await moduleApi.warmPublishedAuthorityTranslations({
      delayMs: 0,
      limit: 0,
    });

    expect(result).toEqual(expect.objectContaining({
      scanned: 1,
      candidates: 1,
      selected: 0,
      skipped: 0,
      warmed: 0,
      failed: 0,
    }));
    expect(result.quotaBlocked).toBeUndefined();
  });

  it('pauses Modal Direct batch warmup while a transient provider failure is pending', async () => {
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
      'authority-aap-modal': {
        slug: 'authority-aap-modal',
        message: 'AI Gateway error: 429: {"error": "Too many concurrent requests for this model"}',
        attempts: 1,
        failedAt: '2026-05-09T07:00:00.000Z',
        retryAfterAt: '2026-05-09T07:30:00.000Z',
      },
    }), 'utf-8');

    process.env.AUTHORITY_KNOWLEDGE_CACHE_PATH = authorityCachePath;
    process.env.AUTHORITY_TRANSLATION_CACHE_PATH = translationCachePath;
    process.env.AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH = failureCachePath;
    process.env.AUTHORITY_TRANSLATION_SYNC_LIMIT = '10';
    process.env.AUTHORITY_TRANSLATION_SYNC_DELAY_MS = '0';
    process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'glm_classify,minimax_render';
    process.env.AI_GLM_PROVIDER = 'modal-direct';
    process.env.AI_GLM_MODEL = 'zai-org/GLM-5.1-FP8';
    process.env.AI_MODAL_DIRECT_KEY = 'test-modal-key';

    jest.useFakeTimers().setSystemTime(new Date('2026-05-09T07:10:00.000Z'));

    let moduleApi: {
      resolveActiveAuthorityTranslationTransientBlock: typeof import('../src/services/authority-translation.service').__authorityTranslationInternalTestUtils.resolveActiveAuthorityTranslationTransientBlock;
      warmPublishedAuthorityTranslations: typeof import('../src/services/authority-translation.service').warmPublishedAuthorityTranslations;
    } | null = null;

    jest.isolateModules(() => {
      const translationService = require('../src/services/authority-translation.service') as typeof import('../src/services/authority-translation.service');
      moduleApi = {
        resolveActiveAuthorityTranslationTransientBlock: translationService.__authorityTranslationInternalTestUtils.resolveActiveAuthorityTranslationTransientBlock,
        warmPublishedAuthorityTranslations: translationService.warmPublishedAuthorityTranslations,
      };
    });

    expect(moduleApi).not.toBeNull();
    expect(moduleApi.resolveActiveAuthorityTranslationTransientBlock()).toBe('2026-05-09T07:30:00.000Z');

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
      quotaResetAt: '2026-05-09T07:30:00.000Z',
    }));
  });
});
