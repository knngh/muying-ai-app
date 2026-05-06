import {
  buildKnowledgeOpsAuthoritySlug,
  buildKnowledgeOpsReport,
  hasAuthorityCoverage,
  type KnowledgeOpsQaRecord,
} from '../src/utils/knowledge-ops-report';

function qaFixture(overrides: Partial<KnowledgeOpsQaRecord> = {}): KnowledgeOpsQaRecord {
  return {
    id: overrides.id || 'qa-1',
    question: overrides.question || '宝宝发烧怎么办',
    answer: overrides.answer || '观察体温、精神状态和进食情况，必要时就医。',
    category: overrides.category || 'common-symptoms',
    source: overrides.source || 'cMedQA2数据集',
    is_verified: false,
    ...overrides,
  };
}

function authorityFixture(overrides: Partial<KnowledgeOpsQaRecord> = {}): KnowledgeOpsQaRecord {
  return {
    id: overrides.id || 'authority-aap-fever',
    question: overrides.question || 'Fever in children',
    answer: overrides.answer || 'Fever guidance for children from an official pediatric source.',
    summary: overrides.summary || 'Fever guidance.',
    category: overrides.category || 'common-symptoms',
    source: overrides.source || 'AAP',
    source_id: overrides.source_id || 'aap',
    source_org: overrides.source_org || 'AAP',
    source_class: overrides.source_class || 'official',
    source_url: overrides.source_url || 'https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/default.aspx',
    source_language: overrides.source_language || 'en',
    source_updated_at: overrides.source_updated_at || '2026-05-01T00:00:00.000Z',
    risk_level_default: overrides.risk_level_default || 'yellow',
    is_verified: true,
    ...overrides,
  };
}

describe('knowledge ops report', () => {
  it('detects authority coverage from references and source fields', () => {
    expect(hasAuthorityCoverage(qaFixture())).toBe(false);
    expect(hasAuthorityCoverage(qaFixture({
      references: [{
        title: 'AAP fever article',
        sourceOrg: 'AAP',
        sourceClass: 'official',
        authoritative: true,
      }],
    }))).toBe(true);
    expect(hasAuthorityCoverage(qaFixture({
      source_org: '中国疾病预防控制中心',
      source_url: 'https://www.chinacdc.cn/example.html',
    }))).toBe(true);
  });

  it('summarizes coverage, translation freshness, risk layers and source gaps', () => {
    const authority = [
      authorityFixture(),
      authorityFixture({
        id: 'authority-cdc-fever',
        source_id: 'cdc',
        source_org: 'CDC',
        source_url: 'https://www.cdc.gov/children/fever.html',
        source_updated_at: '2026-05-02T00:00:00.000Z',
        risk_level_default: 'red',
      }),
      authorityFixture({
        id: 'authority-nhc-feeding',
        source_id: 'nhc-fys',
        source_org: '国家卫生健康委员会妇幼健康司',
        source_url: 'https://www.nhc.gov.cn/example.html',
        source_language: 'zh',
        risk_level_default: 'green',
      }),
    ];
    const freshSlug = buildKnowledgeOpsAuthoritySlug(authority[0], 0);
    const staleSlug = buildKnowledgeOpsAuthoritySlug(authority[1], 1);

    const report = buildKnowledgeOpsReport({
      qaRecords: [
        qaFixture({ id: 'qa-covered', references: [{ authoritative: true, sourceOrg: 'AAP' }] }),
        qaFixture({ id: 'qa-missing', category: 'parenting-0-1' }),
      ],
      enrichedQaRecords: [],
      authorityRecords: authority,
      translationCache: {
        [freshSlug]: {
          sourceUpdatedAt: '2026-05-01T00:00:00.000Z',
          translatedTitle: '儿童发热',
          translatedSummary: '摘要',
          translatedContent: '正文',
          updatedAt: '2026-05-03T00:00:00.000Z',
        },
        [staleSlug]: {
          sourceUpdatedAt: '2026-04-01T00:00:00.000Z',
          translatedTitle: '旧标题',
          translatedSummary: '旧摘要',
          translatedContent: '旧正文',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      },
      translationFailures: {
        [staleSlug]: {
          slug: staleSlug,
          sourceUpdatedAt: '2026-05-02T00:00:00.000Z',
          message: 'timeout',
          attempts: 2,
          failedAt: '2026-05-04T00:00:00.000Z',
          retryAfterAt: '2026-05-04T01:00:00.000Z',
        },
      },
    }, {
      now: '2026-05-06T00:00:00.000Z',
      watchedSourceIds: ['mayo-clinic-zh', 'chinacdc-nutrition'],
    });

    expect(report.coverage).toMatchObject({
      source: 'computed',
      total: 2,
      authorityCovered: 1,
      missingAuthorityCoverage: 1,
      coverageRate: 50,
    });
    expect(report.translations).toMatchObject({
      recordsForTranslation: 2,
      cacheEntries: 2,
      freshCacheEntries: 1,
      staleCacheEntries: 1,
      failureEntries: 1,
      retryableFailures: 1,
      blockedFailures: 0,
      cacheHitRate: 50,
    });
    expect(report.review.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskLevel: 'red', action: 'manual_review', count: 1 }),
      expect.objectContaining({ riskLevel: 'yellow', action: 'sample_review', count: 1 }),
      expect.objectContaining({ riskLevel: 'green', action: 'default_publish', count: 1 }),
    ]));
    expect(report.sourceCoverage.watchedSources).toEqual([
      { sourceId: 'mayo-clinic-zh', count: 0, status: 'missing' },
      { sourceId: 'chinacdc-nutrition', count: 0, status: 'missing' },
    ]);
    expect(report.actionItems.map((item) => item.area)).toEqual(expect.arrayContaining([
      'authority_coverage',
      'translation_cache',
      'source_coverage',
    ]));
  });
});
