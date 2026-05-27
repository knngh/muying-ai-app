import type { NormalizedAuthorityDocument } from '../src/services/authority-sync.service';
import {
  buildAuthorityAiQualityReviewCacheKey,
  isAuthorityAiQualityReviewExportable,
  parseAuthorityAiQualityReviewOutput,
  reviewAuthorityDocumentQualityWithAiIfNeeded,
  shouldRunAuthorityAiQualityReview,
  type AuthorityAiQualityReviewCacheRecord,
} from '../src/services/authority-ai-quality-review.service';

function buildDocument(
  overrides: Partial<NormalizedAuthorityDocument> = {},
): NormalizedAuthorityDocument {
  return {
    sourceId: 'ncwch-maternal-child-health',
    sourceOrg: '国家卫生健康委妇幼健康中心',
    sourceUrl: 'https://www.ncwchnhc.org.cn/content/content.html?id=guidance-1',
    sourceLanguage: 'zh',
    sourceLocale: 'zh-CN',
    title: '孕产妇体重管理指导原则',
    updatedAt: undefined,
    audience: '孕妇',
    topic: 'pregnancy',
    region: 'CN',
    riskLevelDefault: 'green',
    summary: '孕前、孕期及产后女性体重管理指导。',
    contentText: '孕前体重管理应通过合理膳食和适量运动，将体重调整到适宜范围。孕期体重管理需要结合孕周和产检结果。'.repeat(8),
    metadataJson: { sourceClass: 'official' },
    publishStatus: 'published',
    ...overrides,
  };
}

describe('authority AI quality review', () => {
  const raw = { contentHash: 'hash-guidance-1' };
  const now = new Date('2026-05-27T08:00:00.000Z');

  it('is opt-in and only reviews export candidates', () => {
    expect(shouldRunAuthorityAiQualityReview(buildDocument())).toBe(false);
    expect(shouldRunAuthorityAiQualityReview(buildDocument(), { enabled: true })).toBe(true);
    expect(shouldRunAuthorityAiQualityReview(buildDocument({ publishStatus: 'rejected' }), { enabled: true })).toBe(false);
    expect(shouldRunAuthorityAiQualityReview(buildDocument({ contentText: '太短' }), { enabled: true })).toBe(false);
  });

  it('parses strict JSON review responses', () => {
    expect(parseAuthorityAiQualityReviewOutput(JSON.stringify({
      decision: 'publish',
      reasons: ['正文是可复用健康指导'],
      confidence: 0.91,
      contentType: 'guidance',
    }), now.toISOString())).toEqual({
      decision: 'publish',
      reasons: ['正文是可复用健康指导'],
      confidence: 0.91,
      contentType: 'guidance',
      reviewedAt: now.toISOString(),
    });

    expect(parseAuthorityAiQualityReviewOutput('not json')).toBeNull();
    expect(parseAuthorityAiQualityReviewOutput('{"decision":"allow"}')).toBeNull();
  });

  it('keeps high-confidence guidance publishable', async () => {
    const invokeModel = jest.fn().mockResolvedValue({
      answer: JSON.stringify({
        decision: 'publish',
        reasons: ['正文主要是孕产健康指导'],
        confidence: 0.93,
        contentType: 'guidance',
      }),
      route: {
        provider: 'test-provider',
        model: 'test-model',
      },
    });

    const reviewed = await reviewAuthorityDocumentQualityWithAiIfNeeded(buildDocument(), raw, {
      enabled: true,
      cache: {},
      invokeModel,
      now,
    });

    expect(reviewed.publishStatus).toBe('published');
    expect(isAuthorityAiQualityReviewExportable(reviewed.metadataJson)).toBe(true);
    expect(reviewed.metadataJson.aiQualityReview).toMatchObject({
      decision: 'publish',
      exportable: true,
      provider: 'test-provider',
      model: 'test-model',
    });
  });

  it('fails closed when AI is unsure, returns non-guidance, or errors', async () => {
    const lowConfidence = await reviewAuthorityDocumentQualityWithAiIfNeeded(buildDocument(), raw, {
      enabled: true,
      cache: {},
      invokeModel: jest.fn().mockResolvedValue({
        answer: JSON.stringify({
          decision: 'publish',
          reasons: ['看起来像健康内容但正文较弱'],
          confidence: 0.51,
          contentType: 'guidance',
        }),
      }),
      now,
    });

    expect(lowConfidence.publishStatus).toBe('review');
    expect(isAuthorityAiQualityReviewExportable(lowConfidence.metadataJson)).toBe(false);

    const news = await reviewAuthorityDocumentQualityWithAiIfNeeded(buildDocument(), raw, {
      enabled: true,
      cache: {},
      invokeModel: jest.fn().mockResolvedValue({
        answer: JSON.stringify({
          decision: 'publish',
          reasons: ['是机构动态新闻'],
          confidence: 0.9,
          contentType: 'news',
        }),
      }),
      now,
    });

    expect(news.publishStatus).toBe('review');
    expect(isAuthorityAiQualityReviewExportable(news.metadataJson)).toBe(false);

    const failed = await reviewAuthorityDocumentQualityWithAiIfNeeded(buildDocument(), raw, {
      enabled: true,
      cache: {},
      invokeModel: jest.fn().mockRejectedValue(new Error('provider timeout')),
      now,
    });

    expect(failed.publishStatus).toBe('review');
    expect(failed.metadataJson.aiQualityReview).toMatchObject({
      decision: 'review',
      exportable: false,
      contentType: 'other',
    });
    expect(isAuthorityAiQualityReviewExportable(failed.metadataJson)).toBe(false);
  });

  it('rejects AI-classified navigation or admin pages', async () => {
    const reviewed = await reviewAuthorityDocumentQualityWithAiIfNeeded(buildDocument(), raw, {
      enabled: true,
      cache: {},
      invokeModel: jest.fn().mockResolvedValue({
        answer: JSON.stringify({
          decision: 'reject',
          reasons: ['页面主要是栏目导航和联系方式'],
          confidence: 0.96,
          contentType: 'navigation',
        }),
      }),
      now,
    });

    expect(reviewed.publishStatus).toBe('rejected');
    expect(isAuthorityAiQualityReviewExportable(reviewed.metadataJson)).toBe(false);
  });

  it('uses url and content hash cache before invoking AI', async () => {
    const document = buildDocument();
    const key = buildAuthorityAiQualityReviewCacheKey(document, raw.contentHash);
    const cache: Record<string, AuthorityAiQualityReviewCacheRecord> = {
      [key]: {
        sourceId: document.sourceId,
        sourceUrl: document.sourceUrl,
        contentHash: raw.contentHash,
        storedAt: now.toISOString(),
        result: {
          decision: 'reject',
          reasons: ['缓存命中：导航页'],
          confidence: 0.95,
          contentType: 'navigation',
          reviewedAt: now.toISOString(),
          exportable: false,
        },
      },
    };
    const invokeModel = jest.fn();

    const reviewed = await reviewAuthorityDocumentQualityWithAiIfNeeded(document, raw, {
      enabled: true,
      cache,
      invokeModel,
      now,
    });

    expect(invokeModel).not.toHaveBeenCalled();
    expect(reviewed.publishStatus).toBe('rejected');
    expect(reviewed.metadataJson.aiQualityReview).toMatchObject({
      decision: 'reject',
      cacheHit: true,
    });
  });
});
