import { cleanAuthorityTranslationCache } from '../src/utils/authority-translation-cache-cleaner';
import {
  __authorityTranslationTestUtils,
  normalizeAuthorityTranslationRecord,
} from '../src/services/authority-translation.service';

describe('authority translation cache cleaner', () => {
  it('removes prompt leaks and placeholder translations while keeping valid cache entries', () => {
    const result = cleanAuthorityTranslationCache({
      valid: {
        slug: 'valid',
        translatedTitle: '儿童发热',
        translatedSummary: '摘要',
        translatedContent: '正文内容较完整。',
        translationNotice: '辅助翻译',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
      promptLeak: {
        slug: 'promptLeak',
        translatedTitle: '<think>Let me translate carefully</think>',
        translatedSummary: '摘要',
        translatedContent: '正文',
        translationNotice: '辅助翻译',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
      placeholder: {
        slug: 'placeholder',
        translatedTitle: '标题',
        translatedSummary: '摘要',
        translatedContent: '待翻译',
        translationNotice: '辅助翻译',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
      analysisLeak: {
        slug: 'analysisLeak',
        translatedTitle: '情感发展',
        translatedSummary: '摘要',
        translatedContent: '让我仔细分析这篇AAP的文章并准确翻译。\n原文标题：Emotional Development: 1 Year Olds\n孩子在第二年会在独立和依恋之间摇摆。',
        translationNotice: '辅助翻译',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
      templateTitle: {
        slug: 'templateTitle',
        translatedTitle: '译后的标题',
        translatedSummary: '摘要',
        translatedContent: '译后的正文',
        translationNotice: '辅助翻译',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
      leakedFieldLabel: {
        slug: 'leakedFieldLabel',
        translatedTitle: '怀孕、哺乳期间使用速效胰岛素与生育能力',
        translatedSummary: '摘要',
        translatedContent: '怀孕期间使用胰岛素时，应按医生建议监测血糖。\n\n译后的标题>怀孕、哺乳期间使用速效胰岛素与生育能力',
        translationNotice: '辅助翻译',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
      structuredTagLeak: {
        slug: 'structuredTagLeak',
        translatedTitle: '母乳冷冻与冷藏小贴士',
        translatedSummary: '摘要',
        translatedContent: '母乳冷冻与冷藏小贴士\n美国儿科学会提供了关于如何安全储存和准备母乳的指南。</summary>\n译后的正文：\n请彻底清洗双手和所有储存容器。',
        translationNotice: '辅助翻译',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
    });

    expect(result).toMatchObject({
      total: 7,
      kept: 1,
      removed: 6,
      normalizedEntries: [],
      cleanedCache: {
        valid: expect.objectContaining({ translatedTitle: '儿童发热' }),
      },
    });
    expect(result.removedEntries).toEqual([
      { slug: 'promptLeak', reason: 'prompt_leak' },
      { slug: 'placeholder', reason: 'empty_or_invalid_content' },
      { slug: 'analysisLeak', reason: 'prompt_leak' },
      { slug: 'templateTitle', reason: 'empty_or_invalid_content' },
      { slug: 'leakedFieldLabel', reason: 'prompt_leak' },
      { slug: 'structuredTagLeak', reason: 'prompt_leak' },
    ]);
  });

  it('compacts long cached translated summaries without dropping the entry', () => {
    const result = cleanAuthorityTranslationCache({
      longSummary: {
        slug: 'longSummary',
        translatedTitle: '母乳喂养',
        translatedSummary: '母乳喂养是保障儿童健康和生存最有效的方法之一。世界卫生组织建议出生后尽早开始母乳喂养，并在生命最初六个月进行纯母乳喂养，同时根据家庭情况获得持续支持。后续还可以在添加辅食的同时继续母乳喂养。',
        translatedContent: '母乳喂养是保障儿童健康和生存最有效的方法之一。世界卫生组织建议出生后尽早开始母乳喂养，并在生命最初六个月进行纯母乳喂养，同时根据家庭情况获得持续支持。后续还可以在添加辅食的同时继续母乳喂养。',
        translationNotice: '辅助翻译',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
    });

    expect(result.kept).toBe(1);
    expect(result.removed).toBe(0);
    expect(result.normalizedEntries).toEqual([{ slug: 'longSummary', field: 'translatedSummary' }]);
    expect(result.cleanedCache.longSummary.translatedSummary).toBe('母乳喂养是保障儿童健康和生存最有效的方法之一。世界卫生组织建议出生后尽早开始母乳喂养，并在生命最初六个月进行纯母乳喂养，同时根据家庭情况获得持续支持。');
  });

  it('normalizes cached records with the same guards used before writes', () => {
    expect(normalizeAuthorityTranslationRecord({
      slug: 'valid',
      translatedTitle: '儿童发热',
      translatedSummary: '摘要',
      translatedContent: '正文内容较完整。',
      translationNotice: '辅助翻译',
      updatedAt: '2026-05-07T00:00:00.000Z',
    })).toEqual(expect.objectContaining({
      translatedTitle: '儿童发热',
      translatedContent: '正文内容较完整。',
    }));

    expect(normalizeAuthorityTranslationRecord({
      slug: 'placeholder',
      translatedTitle: '...',
      translatedSummary: '...',
      translatedContent: '...',
      translationNotice: '辅助翻译',
      updatedAt: '2026-05-07T00:00:00.000Z',
    })).toBeNull();

    expect(normalizeAuthorityTranslationRecord({
      slug: 'prompt-leak',
      translatedTitle: '服用甲苯咪唑期间的怀孕、母乳喂养和生育能力',
      translatedSummary: '摘要',
      translatedContent: 'Let me translate:\n</think>\n<translated_content>正文</translated_content>',
      translationNotice: '辅助翻译',
      updatedAt: '2026-05-07T00:00:00.000Z',
    })).toBeNull();

    expect(normalizeAuthorityTranslationRecord({
      slug: 'analysis-leak',
      translatedTitle: '情感发展',
      translatedSummary: '摘要',
      translatedContent: '让我仔细分析这篇AAP的文章并准确翻译。\n原文正文：Your child...\n孩子在第二年会在独立和依恋之间摇摆。',
      translationNotice: '辅助翻译',
      updatedAt: '2026-05-07T00:00:00.000Z',
    })).toBeNull();
  });

  it('defaults to DeepSeek official API and GLM fallback without explicit paid fallback roles', () => {
    const originalRoles = process.env.AUTHORITY_TRANSLATION_TASK_ROLES;
    const originalAllowPaidFallback = process.env.AUTHORITY_TRANSLATION_ALLOW_PAID_FALLBACK;
    try {
      delete process.env.AUTHORITY_TRANSLATION_TASK_ROLES;
      delete process.env.AUTHORITY_TRANSLATION_ALLOW_PAID_FALLBACK;

      expect(__authorityTranslationTestUtils.resolveAuthorityTranslationTaskRoles()).toEqual([
        'deepseek_translate',
        'glm_classify',
      ]);
    } finally {
      if (originalRoles === undefined) {
        delete process.env.AUTHORITY_TRANSLATION_TASK_ROLES;
      } else {
        process.env.AUTHORITY_TRANSLATION_TASK_ROLES = originalRoles;
      }

      if (originalAllowPaidFallback === undefined) {
        delete process.env.AUTHORITY_TRANSLATION_ALLOW_PAID_FALLBACK;
      } else {
        process.env.AUTHORITY_TRANSLATION_ALLOW_PAID_FALLBACK = originalAllowPaidFallback;
      }
    }
  });

  it('keeps explicitly configured task roles in order', () => {
    const originalRoles = process.env.AUTHORITY_TRANSLATION_TASK_ROLES;
    const originalAllowPaidFallback = process.env.AUTHORITY_TRANSLATION_ALLOW_PAID_FALLBACK;
    try {
      process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'minimax_render,kimi_reason';
      delete process.env.AUTHORITY_TRANSLATION_ALLOW_PAID_FALLBACK;

      expect(__authorityTranslationTestUtils.resolveAuthorityTranslationTaskRoles()).toEqual([
        'minimax_render',
        'kimi_reason',
      ]);
    } finally {
      if (originalRoles === undefined) {
        delete process.env.AUTHORITY_TRANSLATION_TASK_ROLES;
      } else {
        process.env.AUTHORITY_TRANSLATION_TASK_ROLES = originalRoles;
      }

      if (originalAllowPaidFallback === undefined) {
        delete process.env.AUTHORITY_TRANSLATION_ALLOW_PAID_FALLBACK;
      } else {
        process.env.AUTHORITY_TRANSLATION_ALLOW_PAID_FALLBACK = originalAllowPaidFallback;
      }
    }
  });
});
