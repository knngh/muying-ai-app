import { cleanAuthorityTranslationCache } from '../src/utils/authority-translation-cache-cleaner';

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
    });

    expect(result).toMatchObject({
      total: 3,
      kept: 1,
      removed: 2,
      cleanedCache: {
        valid: expect.objectContaining({ translatedTitle: '儿童发热' }),
      },
    });
    expect(result.removedEntries).toEqual([
      { slug: 'promptLeak', reason: 'prompt_leak' },
      { slug: 'placeholder', reason: 'empty_or_invalid_content' },
    ]);
  });
});
