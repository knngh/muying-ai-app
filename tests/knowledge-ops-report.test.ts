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
        'authority-prompt-leak': {
          sourceUpdatedAt: '2026-05-01T00:00:00.000Z',
          translatedTitle: '<think>Let me translate</think>',
          translatedSummary: '摘要',
          translatedContent: '正文',
          updatedAt: '2026-05-03T00:00:00.000Z',
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
      cacheEntries: 3,
      invalidCacheEntries: 1,
      freshCacheEntries: 1,
      staleCacheEntries: 1,
      failureEntries: 1,
      retryableFailures: 1,
      blockedFailures: 0,
      cacheHitRate: 50,
    });
    expect(report.translations.invalidCacheSamples).toEqual([
      { slug: 'authority-prompt-leak', reason: 'prompt_leak' },
    ]);
    expect(report.review.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskLevel: 'red', action: 'manual_review', count: 1 }),
      expect.objectContaining({ riskLevel: 'yellow', action: 'sample_review', count: 1 }),
      expect.objectContaining({ riskLevel: 'green', action: 'default_publish', count: 1 }),
    ]));
    expect(report.sourceCoverage.watchedSources).toEqual([
      { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
      { sourceId: 'chinacdc-nutrition', count: 0, minimumPublishedRecords: 10, status: 'missing' },
    ]);
    expect(report.actionItems.map((item) => item.area)).toEqual(expect.arrayContaining([
      'authority_coverage',
      'translation_cache',
      'source_coverage',
    ]));
  });

  it('preserves guard exclusion totals from authority coverage audits', () => {
    const report = buildKnowledgeOpsReport({
      qaRecords: [
        qaFixture({ id: 'qa-covered', references: [{ authoritative: true, sourceOrg: 'AAP' }] }),
        qaFixture({ id: 'qa-filtered', question: '孩子青春期发育太快怎么办' }),
      ],
      authorityRecords: [],
      coverageAudit: {
        total: 3140,
        rawTotal: 3306,
        excludedByGuard: [
          { reason: 'category_scope_conflict', count: 81 },
          { reason: 'beyond_app_child_age', count: 54 },
        ],
        authorityCovered: 1659,
        missingAuthorityCoverage: 1481,
        coverageRate: 52.83,
      },
    }, {
      now: '2026-05-06T00:00:00.000Z',
      watchedSourceIds: [],
    });

    expect(report.coverage).toMatchObject({
      source: 'authority-coverage-audit',
      total: 3140,
      rawTotal: 3306,
      excludedByGuard: [
        { reason: 'category_scope_conflict', count: 81 },
        { reason: 'beyond_app_child_age', count: 54 },
      ],
      authorityCovered: 1659,
      missingAuthorityCoverage: 1481,
      coverageRate: 52.83,
    });
  });

  it('keeps watched authority sources in low status until they reach the configured minimum', () => {
    const chinacdcRecords = Array.from({ length: 10 }, (_, index) => authorityFixture({
      id: `authority-chinacdc-nutrition-${index + 1}`,
      source_id: 'chinacdc-nutrition',
      source_org: '中国疾病预防控制中心营养与健康所',
      source_url: `https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_29558${index}.html`,
      source_language: 'zh',
      risk_level_default: 'green',
    }));
    const report = buildKnowledgeOpsReport({
      qaRecords: [],
      authorityRecords: [
        authorityFixture({
          id: 'authority-mayo-clinic-zh-1',
          source_id: 'mayo-clinic-zh',
          source_org: 'Mayo Clinic',
          source_url: 'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/in-depth/baby-poop/art-20043980',
          source_language: 'zh',
        }),
        ...chinacdcRecords,
      ],
    }, {
      watchedSourceIds: ['mayo-clinic-zh', 'chinacdc-nutrition'],
      watchedSourceMinimumRecords: 10,
    });

    expect(report.sourceCoverage.watchedSources).toEqual([
      { sourceId: 'mayo-clinic-zh', count: 1, minimumPublishedRecords: 10, status: 'low' },
      { sourceId: 'chinacdc-nutrition', count: 10, minimumPublishedRecords: 10, status: 'healthy' },
    ]);
    expect(report.actionItems).toContainEqual({
      priority: 'P2',
      area: 'source_coverage',
      message: 'mayo-clinic-zh has 1/10 published authority records',
    });
    expect(report.actionItems.some((item) => item.message.includes('chinacdc-nutrition'))).toBe(false);
  });
});
