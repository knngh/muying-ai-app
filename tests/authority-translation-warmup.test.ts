import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildStableAuthoritySlug } from '../src/utils/authority-identity';
import { buildAuthorityTranslationSourceFingerprint } from '../src/utils/authority-translation-source';

describe('authority translation warmup', () => {
  const originalEnv = {
    AUTHORITY_KNOWLEDGE_CACHE_PATH: process.env.AUTHORITY_KNOWLEDGE_CACHE_PATH,
    AUTHORITY_TRANSLATION_CACHE_PATH: process.env.AUTHORITY_TRANSLATION_CACHE_PATH,
    AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH: process.env.AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH,
    AUTHORITY_TRANSLATION_SYNC_LIMIT: process.env.AUTHORITY_TRANSLATION_SYNC_LIMIT,
    AUTHORITY_TRANSLATION_SYNC_DELAY_MS: process.env.AUTHORITY_TRANSLATION_SYNC_DELAY_MS,
    AUTHORITY_TRANSLATION_WARMUP_PROVIDER_TIMEOUT_MS: process.env.AUTHORITY_TRANSLATION_WARMUP_PROVIDER_TIMEOUT_MS,
    AUTHORITY_TRANSLATION_TASK_ROLES: process.env.AUTHORITY_TRANSLATION_TASK_ROLES,
    AUTHORITY_TRANSLATION_ALLOW_PAID_FALLBACK: process.env.AUTHORITY_TRANSLATION_ALLOW_PAID_FALLBACK,
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

  it('defaults translation warmup to DeepSeek official API with free GLM fallback', () => {
    delete process.env.AUTHORITY_TRANSLATION_TASK_ROLES;

    let resolveAuthorityTranslationTaskRoles: typeof import('../src/services/authority-translation.service').__authorityTranslationTestUtils.resolveAuthorityTranslationTaskRoles | null = null;
    jest.isolateModules(() => {
      const translationService = require('../src/services/authority-translation.service') as typeof import('../src/services/authority-translation.service');
      resolveAuthorityTranslationTaskRoles = translationService.__authorityTranslationTestUtils.resolveAuthorityTranslationTaskRoles;
    });

    expect(resolveAuthorityTranslationTaskRoles).not.toBeNull();
    expect(resolveAuthorityTranslationTaskRoles!()).toEqual(['deepseek_translate', 'glm_classify']);

    process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'unknown_role';
    expect(resolveAuthorityTranslationTaskRoles!()).toEqual(['deepseek_translate', 'glm_classify']);
  });

  it('honors explicitly configured paid translation fallback roles', () => {
    process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'glm_classify,minimax_render,kimi_reason';

    let resolveAuthorityTranslationTaskRoles: typeof import('../src/services/authority-translation.service').__authorityTranslationTestUtils.resolveAuthorityTranslationTaskRoles | null = null;
    jest.isolateModules(() => {
      const translationService = require('../src/services/authority-translation.service') as typeof import('../src/services/authority-translation.service');
      resolveAuthorityTranslationTaskRoles = translationService.__authorityTranslationTestUtils.resolveAuthorityTranslationTaskRoles;
    });

    expect(resolveAuthorityTranslationTaskRoles).not.toBeNull();
    expect(resolveAuthorityTranslationTaskRoles!()).toEqual(['glm_classify', 'minimax_render', 'kimi_reason']);

    process.env.AUTHORITY_TRANSLATION_ALLOW_PAID_FALLBACK = 'true';
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

  it('preloads authority, translation, and failure cache files at startup', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-translation-preload-'));
    const authorityCachePath = path.join(tmpDir, 'authority-knowledge-cache.json');
    const translationCachePath = path.join(tmpDir, 'authority-translation-cache.json');
    const failureCachePath = path.join(tmpDir, 'authority-translation-failures.json');

    fs.writeFileSync(authorityCachePath, JSON.stringify([
      {
        id: 'aap-1',
        question: 'Your baby first solid foods',
        summary: 'How to introduce solid foods.',
        answer: 'Start around six months when the baby shows readiness.',
        source_language: 'en',
        source_url: 'https://www.healthychildren.org/example',
      },
    ]), 'utf-8');
    fs.writeFileSync(translationCachePath, JSON.stringify({
      'authority-aap-1': {
        slug: 'authority-aap-1',
        translatedTitle: '宝宝第一口辅食',
        translatedSummary: '如何添加辅食。',
        translatedContent: '大约六个月时开始添加辅食。',
        translationNotice: '缓存译文',
        updatedAt: '2026-05-09T01:00:00.000Z',
      },
    }), 'utf-8');
    fs.writeFileSync(failureCachePath, JSON.stringify({
      'authority-aap-2': {
        slug: 'authority-aap-2',
        message: 'AI Gateway timeout after 12000ms',
        attempts: 1,
        failedAt: '2026-05-09T01:00:00.000Z',
        retryAfterAt: '2026-05-09T01:30:00.000Z',
      },
    }), 'utf-8');

    process.env.AUTHORITY_KNOWLEDGE_CACHE_PATH = authorityCachePath;
    process.env.AUTHORITY_TRANSLATION_CACHE_PATH = translationCachePath;
    process.env.AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH = failureCachePath;

    jest.isolateModules(() => {
      const translationService = require('../src/services/authority-translation.service') as typeof import('../src/services/authority-translation.service');
      const preloadResult = translationService.__authorityTranslationInternalTestUtils.preloadAuthorityTranslationRuntimeCache();
      expect(preloadResult).toMatchObject({
        authorityRecords: 1,
        failureEntries: 1,
      });
      expect(preloadResult.translationEntries).toBeGreaterThanOrEqual(1);
    });
  });

  it('reuses cached translations when the source fingerprint still matches after timestamp churn', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-translation-warmup-'));
    const authorityCachePath = path.join(tmpDir, 'authority-knowledge-cache.json');
    const translationCachePath = path.join(tmpDir, 'authority-translation-cache.json');
    const failureCachePath = path.join(tmpDir, 'authority-translation-failures.json');
    const authorityRecord = {
      id: 'aap-1',
      question: 'Your baby first solid foods',
      summary: 'How to introduce solid foods.',
      answer: 'Start around six months when the baby shows readiness. Offer iron-rich foods and avoid choking hazards.',
      source_language: 'en',
      source_url: 'https://www.healthychildren.org/example',
      updated_at: '2026-05-10T00:00:00.000Z',
      source_updated_at: '2026-05-10T00:00:00.000Z',
    };

    fs.writeFileSync(authorityCachePath, JSON.stringify([authorityRecord]), 'utf-8');
    fs.writeFileSync(translationCachePath, JSON.stringify({
      'authority-aap-1': {
        slug: 'authority-aap-1',
        sourceUpdatedAt: '2026-05-09T00:00:00.000Z',
        sourceFingerprint: buildAuthorityTranslationSourceFingerprint(authorityRecord),
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

  it('reuses and repairs legacy slug translations after stable authority slugs change', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-translation-warmup-'));
    const authorityCachePath = path.join(tmpDir, 'authority-knowledge-cache.json');
    const translationCachePath = path.join(tmpDir, 'authority-translation-cache.json');
    const failureCachePath = path.join(tmpDir, 'authority-translation-failures.json');
    const authorityRecord = {
      id: 'aap-1',
      source_id: 'aap',
      source_org: 'American Academy of Pediatrics',
      question: 'Your baby first solid foods',
      summary: 'How to introduce solid foods.',
      answer: 'Start around six months when the baby shows readiness. Offer iron-rich foods and avoid choking hazards.',
      source_language: 'en',
      source_url: 'https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Switching-To-Solid-Foods.aspx',
      updated_at: '2026-05-10T00:00:00.000Z',
      source_updated_at: '2026-05-10T00:00:00.000Z',
    };
    const canonicalSlug = buildStableAuthoritySlug(authorityRecord, 0);
    expect(canonicalSlug).not.toBe('authority-aap-1');

    fs.writeFileSync(authorityCachePath, JSON.stringify([authorityRecord]), 'utf-8');
    fs.writeFileSync(translationCachePath, JSON.stringify({
      'authority-aap-1': {
        slug: 'authority-aap-1',
        sourceUpdatedAt: '2026-05-09T00:00:00.000Z',
        sourceFingerprint: buildAuthorityTranslationSourceFingerprint(authorityRecord),
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

    const repairedCache = JSON.parse(fs.readFileSync(translationCachePath, 'utf-8')) as Record<string, { slug: string; translatedTitle: string }>;
    expect(repairedCache['authority-aap-1']).toMatchObject({
      slug: 'authority-aap-1',
      translatedTitle: '宝宝第一口辅食',
    });
    expect(repairedCache[canonicalSlug]).toMatchObject({
      slug: canonicalSlug,
      translatedTitle: '宝宝第一口辅食',
    });
  });

  it('does not reuse timestamp-stale cache entries when the source fingerprint changed', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-translation-warmup-'));
    const authorityCachePath = path.join(tmpDir, 'authority-knowledge-cache.json');
    const translationCachePath = path.join(tmpDir, 'authority-translation-cache.json');
    const failureCachePath = path.join(tmpDir, 'authority-translation-failures.json');

    fs.writeFileSync(authorityCachePath, JSON.stringify([
      {
        id: 'aap-1',
        question: 'Your baby first solid foods',
        summary: 'How to introduce solid foods.',
        answer: 'This source text has materially changed and needs a new Chinese translation.',
        source_language: 'en',
        source_url: 'https://www.healthychildren.org/example',
        updated_at: '2026-05-10T00:00:00.000Z',
        source_updated_at: '2026-05-10T00:00:00.000Z',
      },
    ]), 'utf-8');
    fs.writeFileSync(translationCachePath, JSON.stringify({
      'authority-aap-1': {
        slug: 'authority-aap-1',
        sourceUpdatedAt: '2026-05-09T00:00:00.000Z',
        sourceFingerprint: 'sha256:old-source',
        translatedTitle: '宝宝第一口辅食',
        translatedSummary: '如何添加辅食。',
        translatedContent: '旧译文。',
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
      limit: 0,
    });

    expect(result).toEqual(expect.objectContaining({
      scanned: 1,
      candidates: 1,
      selected: 0,
      cached: 0,
      skipped: 0,
      warmed: 0,
      failed: 0,
    }));
    expect(moduleApi.callTaskModelSpy).not.toHaveBeenCalled();
  });

  it('parses Hunyuan MT inline Chinese labels into clean translation fields', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-translation-warmup-'));
    const authorityCachePath = path.join(tmpDir, 'authority-knowledge-cache.json');
    const translationCachePath = path.join(tmpDir, 'authority-translation-cache.json');
    const failureCachePath = path.join(tmpDir, 'authority-translation-failures.json');

    fs.writeFileSync(authorityCachePath, JSON.stringify([
      {
        id: 'aap-1',
        question: 'Emotional Development: 1 Year Olds',
        summary: 'Your child will swing between independence and clinging.',
        answer: 'Throughout her second year, your child will swing back and forth between independence and clinging to you.',
        source_language: 'en',
        source_url: 'https://www.healthychildren.org/example',
        updated_at: '2026-05-10T00:00:00.000Z',
      },
    ]), 'utf-8');
    fs.writeFileSync(translationCachePath, '{}', 'utf-8');
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
      const callTaskModelSpy = jest.spyOn(aiGateway, 'callTaskModelDetailed').mockResolvedValue({
        answer: [
          '来源机构：AAP',
          '',
          '译后标题：情感发展：1岁儿童',
          '',
          '译后摘要：在第二年，孩子会在强烈的独立性和对您的依恋之间来回摇摆。',
        ].join('\n'),
        route: {
          provider: 'siliconflow',
          model: 'tencent/Hunyuan-MT-7B',
          route: 'task',
          label: 'task-glm',
        },
      });
      const translationService = require('../src/services/authority-translation.service') as typeof import('../src/services/authority-translation.service');

      moduleApi = {
        callTaskModelSpy,
        warmPublishedAuthorityTranslations: translationService.warmPublishedAuthorityTranslations,
      };
    });

    expect(moduleApi).not.toBeNull();
    const result = await moduleApi.warmPublishedAuthorityTranslations({
      delayMs: 0,
      limit: 1,
    });

    expect(result).toEqual(expect.objectContaining({
      scanned: 1,
      candidates: 1,
      selected: 1,
      warmed: 1,
      failed: 0,
    }));

    const cache = JSON.parse(fs.readFileSync(translationCachePath, 'utf-8')) as Record<string, {
      translatedTitle: string;
      translatedSummary: string;
      translatedContent: string;
      model: string;
      provider: string;
    }>;
    expect(cache['authority-aap-1']).toMatchObject({
      translatedTitle: '情感发展：1岁儿童',
      translatedSummary: '在第二年，孩子会在强烈的独立性和对您的依恋之间来回摇摆。',
      translatedContent: '在第二年，孩子会在强烈的独立性和对您的依恋之间来回摇摆。',
      model: 'tencent/Hunyuan-MT-7B',
      provider: 'siliconflow',
    });
    expect(cache['authority-aap-1'].translatedContent).not.toContain('译后标题');
    expect(cache['authority-aap-1'].translatedContent).not.toContain('来源机构');
  });

  it('accepts Hunyuan MT outputs that put translated title and summary under original labels', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-translation-warmup-'));
    const authorityCachePath = path.join(tmpDir, 'authority-knowledge-cache.json');
    const translationCachePath = path.join(tmpDir, 'authority-translation-cache.json');
    const failureCachePath = path.join(tmpDir, 'authority-translation-failures.json');

    fs.writeFileSync(authorityCachePath, JSON.stringify([
      {
        id: 'who-8',
        question: 'Allaitement',
        summary: 'WHO breastfeeding overview.',
        answer: 'L’allaitement maternel est l’un des moyens les plus efficaces de préserver la santé de l’enfant.',
        source_language: 'en',
        source_url: 'https://www.who.int/example',
        updated_at: '2026-05-17T08:57:57.000Z',
      },
    ]), 'utf-8');
    fs.writeFileSync(translationCachePath, '{}', 'utf-8');
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
      const callTaskModelSpy = jest.spyOn(aiGateway, 'callTaskModelDetailed').mockResolvedValue({
        answer: [
          '来源机构：世界卫生组织（WHO）',
          '',
          '原文标题：母乳喂养',
          '',
          '原文摘要：母乳喂养是维护儿童健康和确保其生存的最有效方法之一。',
          '',
          '原文正文：',
          '',
          '母乳喂养是维护儿童健康和确保其生存的最有效方法之一。',
        ].join('\n'),
        route: {
          provider: 'siliconflow',
          model: 'tencent/Hunyuan-MT-7B',
          route: 'task',
          label: 'task-glm',
        },
      });
      const translationService = require('../src/services/authority-translation.service') as typeof import('../src/services/authority-translation.service');

      moduleApi = {
        callTaskModelSpy,
        warmPublishedAuthorityTranslations: translationService.warmPublishedAuthorityTranslations,
      };
    });

    expect(moduleApi).not.toBeNull();
    const result = await moduleApi.warmPublishedAuthorityTranslations({
      delayMs: 0,
      limit: 1,
    });

    expect(result).toEqual(expect.objectContaining({
      scanned: 1,
      candidates: 1,
      selected: 1,
      warmed: 1,
      failed: 0,
    }));

    const cache = JSON.parse(fs.readFileSync(translationCachePath, 'utf-8')) as Record<string, {
      translatedTitle: string;
      translatedSummary: string;
      translatedContent: string;
    }>;
    expect(cache['authority-who-8']).toMatchObject({
      translatedTitle: '母乳喂养',
      translatedSummary: '母乳喂养是维护儿童健康和确保其生存的最有效方法之一。',
      translatedContent: '母乳喂养是维护儿童健康和确保其生存的最有效方法之一。',
    });
    expect(cache['authority-who-8'].translatedContent).not.toContain('原文标题');
    expect(cache['authority-who-8'].translatedContent).not.toContain('原文正文');
    expect(cache['authority-who-8'].translatedContent).not.toContain('来源机构');
  });

  it('accepts Hunyuan MT outputs that keep original title and summary labels with translated body text', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-translation-warmup-'));
    const authorityCachePath = path.join(tmpDir, 'authority-knowledge-cache.json');
    const translationCachePath = path.join(tmpDir, 'authority-translation-cache.json');
    const failureCachePath = path.join(tmpDir, 'authority-translation-failures.json');

    fs.writeFileSync(authorityCachePath, JSON.stringify([
      {
        id: 'who-9',
        question: 'Allaitement',
        summary: 'L’allaitement maternel est l’un des moyens les plus efficaces de préserver la santé et d’assurer la survie de l’enfant.',
        answer: 'OMS/Yoshi Shimizu © Photo Allaitement maternel Vue d’ensemble L’allaitement maternel est l’un des moyens les plus efficaces de préserver la santé et d’assurer la survie de l’enfant.',
        source_language: 'en',
        source_url: 'https://www.who.int/example',
        updated_at: '2026-05-17T08:57:57.000Z',
      },
    ]), 'utf-8');
    fs.writeFileSync(translationCachePath, '{}', 'utf-8');
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
      const callTaskModelSpy = jest.spyOn(aiGateway, 'callTaskModelDetailed').mockResolvedValue({
        answer: [
          '来源机构：世界卫生组织（WHO）',
          '',
          '原文标题：母乳喂养',
          '',
          '原文摘要：母乳喂养是保障儿童健康和生存最有效的方法之一。然而，目前仅有约三分之二的婴儿在出生后的前6个月内能够按照建议完全依靠母乳喂养。',
          '',
          '原文正文（节选）：',
          '',
          '世界卫生组织/吉田良（Yoshi Shimizu）© 摄影',
          '母乳喂养是保障儿童健康和生存最有效的方法之一。然而，根据世界卫生组织的建议，实际上不到一半的婴儿在出生后的前6个月内能够完全依靠母乳喂养。',
        ].join('\n'),
        route: {
          provider: 'siliconflow',
          model: 'tencent/Hunyuan-MT-7B',
          route: 'task',
          label: 'task-glm',
        },
      });
      const translationService = require('../src/services/authority-translation.service') as typeof import('../src/services/authority-translation.service');

      moduleApi = {
        callTaskModelSpy,
        warmPublishedAuthorityTranslations: translationService.warmPublishedAuthorityTranslations,
      };
    });

    expect(moduleApi).not.toBeNull();
    const result = await moduleApi.warmPublishedAuthorityTranslations({
      delayMs: 0,
      limit: 1,
    });

    expect(result).toEqual(expect.objectContaining({
      scanned: 1,
      candidates: 1,
      selected: 1,
      warmed: 1,
      failed: 0,
    }));

    const cache = JSON.parse(fs.readFileSync(translationCachePath, 'utf-8')) as Record<string, {
      translatedTitle: string;
      translatedSummary: string;
      translatedContent: string;
    }>;
    expect(cache['authority-who-9']).toMatchObject({
      translatedTitle: '母乳喂养',
      translatedSummary: '母乳喂养是保障儿童健康和生存最有效的方法之一。然而，目前仅有约三分之二的婴儿在出生后的前6个月内能够按照建议完全依靠母乳喂养。',
    });
    expect(cache['authority-who-9'].translatedContent).toContain('世界卫生组织/吉田良');
    expect(cache['authority-who-9'].translatedContent).toContain('根据世界卫生组织的建议');
    expect(cache['authority-who-9'].translatedContent).not.toContain('原文正文');
    expect(moduleApi.callTaskModelSpy).toHaveBeenCalledWith(
      'deepseek_translate',
      expect.any(Array),
      expect.objectContaining({
        responseFormat: 'json_object',
        thinking: 'disabled',
        timeoutMs: 90000,
      }),
    );
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

  it('keeps SiliconFlow Hunyuan warmup unblocked when a Modal Direct key remains configured', async () => {
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
      'authority-aap-timeout': {
        slug: 'authority-aap-timeout',
        message: 'AI Gateway timeout after 45000ms',
        attempts: 1,
        failedAt: '2026-05-17T06:56:28.646Z',
        retryAfterAt: '2026-05-17T10:56:28.646Z',
      },
    }), 'utf-8');

    process.env.AUTHORITY_KNOWLEDGE_CACHE_PATH = authorityCachePath;
    process.env.AUTHORITY_TRANSLATION_CACHE_PATH = translationCachePath;
    process.env.AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH = failureCachePath;
    process.env.AUTHORITY_TRANSLATION_SYNC_LIMIT = '10';
    process.env.AUTHORITY_TRANSLATION_SYNC_DELAY_MS = '0';
    process.env.AUTHORITY_TRANSLATION_WARMUP_PROVIDER_TIMEOUT_MS = '90000';
    process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'glm_classify';
    process.env.AI_GLM_PROVIDER = 'siliconflow';
    process.env.AI_GLM_MODEL = 'tencent/Hunyuan-MT-7B';
    process.env.AI_MODAL_DIRECT_KEY = 'test-modal-key';

    jest.useFakeTimers().setSystemTime(new Date('2026-05-17T09:15:00.000Z'));

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
    expect(moduleApi.isModalDirectGlmFirstForTranslation()).toBe(false);
    expect(moduleApi.shouldStopAfterTranslationTaskFailure('glm_classify', new Error('AI Gateway timeout after 45000ms'))).toBe(false);

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

  it('stops the current batch after a Modal Direct concurrency failure', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-translation-warmup-'));
    const authorityCachePath = path.join(tmpDir, 'authority-knowledge-cache.json');
    const translationCachePath = path.join(tmpDir, 'authority-translation-cache.json');
    const failureCachePath = path.join(tmpDir, 'authority-translation-failures.json');

    fs.writeFileSync(authorityCachePath, JSON.stringify([
      {
        id: 'aap-100',
        question: 'Your baby first solid foods',
        summary: 'How to introduce solid foods.',
        answer: 'Start around six months when the baby shows readiness. Offer iron-rich foods and avoid choking hazards.',
        source_language: 'en',
        source_url: 'https://www.healthychildren.org/example-100',
        updated_at: '2026-05-09T00:00:00.000Z',
      },
      {
        id: 'aap-101',
        question: 'Baby sleep routines',
        summary: 'How to plan safe sleep routines.',
        answer: 'Use a firm flat sleep surface and keep soft objects out of the sleep area.',
        source_language: 'en',
        source_url: 'https://www.healthychildren.org/example-101',
        updated_at: '2026-05-09T00:00:00.000Z',
      },
    ]), 'utf-8');
    fs.writeFileSync(translationCachePath, '{}', 'utf-8');
    fs.writeFileSync(failureCachePath, '{}', 'utf-8');

    process.env.AUTHORITY_KNOWLEDGE_CACHE_PATH = authorityCachePath;
    process.env.AUTHORITY_TRANSLATION_CACHE_PATH = translationCachePath;
    process.env.AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH = failureCachePath;
    process.env.AUTHORITY_TRANSLATION_SYNC_LIMIT = '10';
    process.env.AUTHORITY_TRANSLATION_SYNC_DELAY_MS = '0';
    process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'glm_classify,minimax_render';
    process.env.AI_GLM_PROVIDER = 'modal-direct';
    process.env.AI_GLM_MODEL = 'zai-org/GLM-5.1-FP8';
    process.env.AI_MODAL_DIRECT_KEY = 'test-modal-key';

    const modalConcurrencyError = Object.assign(new Error('AI Gateway error: 429'), {
      gatewayStatus: 429,
      gatewayProvider: 'modal-direct',
      gatewayErrorText: '{"error": "Too many concurrent requests for this model"}',
    });

    let moduleApi: {
      callTaskModelSpy: jest.SpyInstance;
      warmPublishedAuthorityTranslations: typeof import('../src/services/authority-translation.service').warmPublishedAuthorityTranslations;
    } | null = null;

    jest.isolateModules(() => {
      const aiGateway = require('../src/services/ai-gateway.service') as typeof import('../src/services/ai-gateway.service');
      const callTaskModelSpy = jest.spyOn(aiGateway, 'callTaskModelDetailed')
        .mockRejectedValue(modalConcurrencyError);
      const translationService = require('../src/services/authority-translation.service') as typeof import('../src/services/authority-translation.service');

      moduleApi = {
        callTaskModelSpy,
        warmPublishedAuthorityTranslations: translationService.warmPublishedAuthorityTranslations,
      };
    });

    expect(moduleApi).not.toBeNull();
    const result = await moduleApi.warmPublishedAuthorityTranslations({
      delayMs: 0,
      limit: 2,
    });

    expect(moduleApi.callTaskModelSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({
      scanned: 2,
      candidates: 2,
      selected: 1,
      cached: 0,
      skipped: 1,
      warmed: 0,
      failed: 1,
    }));
    expect(result.failures).toEqual([
      {
        slug: 'authority-aap-100',
        message: 'AI Gateway error: 429',
      },
    ]);

    const storedFailures = JSON.parse(fs.readFileSync(failureCachePath, 'utf-8')) as Record<string, { message?: string }>;
    expect(Object.keys(storedFailures)).toEqual(['authority-aap-100']);
    expect(storedFailures['authority-aap-100'].message).toContain('Too many concurrent requests');
  });
});
