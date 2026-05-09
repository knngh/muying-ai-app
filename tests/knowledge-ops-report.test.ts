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

  it('keeps retry-after blocked translation failures out of operator action items', () => {
    const authority = [
      authorityFixture({
        id: 'authority-aap-fever',
        source_updated_at: '2026-05-01T00:00:00.000Z',
      }),
    ];
    const slug = buildKnowledgeOpsAuthoritySlug(authority[0], 0);

    const report = buildKnowledgeOpsReport({
      qaRecords: [
        qaFixture({ id: 'qa-covered', references: [{ authoritative: true, sourceOrg: 'AAP' }] }),
      ],
      authorityRecords: authority,
      translationFailures: {
        [slug]: {
          slug,
          sourceUpdatedAt: '2026-05-01T00:00:00.000Z',
          message: 'AI Gateway 429 weekly usage limit exceeded',
          attempts: 3,
          failedAt: '2026-05-09T01:00:00.000Z',
          retryAfterAt: '2026-05-11T00:00:00.000Z',
        },
      },
    }, {
      now: '2026-05-09T12:00:00.000Z',
      watchedSourceIds: [],
    });

    expect(report.translations).toMatchObject({
      failureEntries: 1,
      retryableFailures: 0,
      blockedFailures: 1,
    });
    expect(report.actionItems).toEqual([]);
  });

  it('keeps AI Gateway weekly quota failures blocked until the reset time', () => {
    const authority = [
      authorityFixture({
        id: 'authority-aap-fever',
        source_updated_at: '2026-05-01T00:00:00.000Z',
      }),
    ];
    const slug = buildKnowledgeOpsAuthoritySlug(authority[0], 0);

    const report = buildKnowledgeOpsReport({
      qaRecords: [
        qaFixture({ id: 'qa-covered', references: [{ authoritative: true, sourceOrg: 'AAP' }] }),
      ],
      authorityRecords: authority,
      translationFailures: {
        [slug]: {
          slug,
          sourceUpdatedAt: '2026-05-01T00:00:00.000Z',
          message: 'AI Gateway error: 429: usage limit exceeded, weekly usage limit reached for Token Plan Starter (6000/6000 used), resets at 2026-05-11T00:00:00+08:00 (2056)',
          attempts: 1,
          failedAt: '2026-05-09T05:00:00.000Z',
          retryAfterAt: '2026-05-09T06:00:00.000Z',
        },
      },
    }, {
      now: '2026-05-09T12:00:00.000Z',
      watchedSourceIds: [],
    });

    expect(report.translations).toMatchObject({
      failureEntries: 1,
      retryableFailures: 0,
      blockedFailures: 1,
    });
    expect(report.actionItems).toEqual([]);
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

  it('builds a promotion-safe question candidate pool from enriched official QA coverage', () => {
    const officialReference = {
      authoritative: true,
      sourceClass: 'official',
      sourceOrg: '中国疾病预防控制中心营养与健康所',
      title: '婴幼儿喂养建议',
      url: 'https://www.chinacdc.cn/example.html',
    };

    const report = buildKnowledgeOpsReport({
      qaRecords: [
        qaFixture({ id: 'qa-raw', question: '宝宝辅食怎么添加？' }),
      ],
      enrichedQaRecords: [
        qaFixture({
          id: 'qa-green',
          question: '6 个月宝宝添加辅食要注意什么？',
          category: 'nutrition-baby',
          topic: 'feeding',
          risk_level_default: 'green',
          target_stage: ['6-12-months'],
          references: [officialReference],
        }),
        qaFixture({
          id: 'qa-yellow',
          question: '宝宝发烧什么时候需要就医？',
          category: 'common-symptoms',
          topic: 'common-symptoms',
          risk_level_default: 'yellow',
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'AAP',
            title: 'Fever in children',
            url: 'https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/default.aspx',
          }],
        }),
        qaFixture({
          id: 'qa-red',
          question: '宝宝睡眠安全要注意什么？',
          risk_level_default: 'red',
          references: [officialReference],
        }),
        qaFixture({
          id: 'qa-missing-reference',
          question: '宝宝辅食添加顺序要注意什么？',
          risk_level_default: 'green',
        }),
        qaFixture({
          id: 'qa-case-form',
          question: '全部症状：宝宝高烧不退四五天，吃退烧药也不管用，发病时间及原因：最近几天，治疗情况：暂无',
          risk_level_default: 'green',
          references: [officialReference],
        }),
      ],
      authorityRecords: [],
    }, {
      sampleLimit: 10,
      watchedSourceIds: [],
    });

    expect(report.promotion.safeQuestionCandidates).toMatchObject({
      total: 2,
      excluded: {
        missingAuthorityReference: 1,
        redRisk: 1,
        unsafeQuestionShape: 1,
      },
    });
    expect(report.promotion.safeQuestionCandidates.candidates.map((item) => item.id)).toEqual([
      'qa-green',
      'qa-yellow',
    ]);
    expect(report.promotion.safeQuestionCandidates.candidates[0]).toMatchObject({
      id: 'qa-green',
      question: '6 个月宝宝添加辅食要注意什么？',
      riskLevel: 'green',
      suggestedUse: 'general_education',
      authorityReference: {
        sourceOrg: '中国疾病预防控制中心营养与健康所',
        sourceClass: 'official',
      },
    });
    expect(report.promotion.safeQuestionCandidates.candidates[1]).toMatchObject({
      id: 'qa-yellow',
      riskLevel: 'yellow',
      suggestedUse: 'care_boundary',
      boundaryNote: '仅用于科普与就医准备，不作为诊断或治疗建议。',
    });
  });

  it('generates standardized promotion-safe titles from official covered case-style QA records', () => {
    const officialReference = {
      authoritative: true,
      sourceClass: 'official',
      sourceOrg: '中国疾病预防控制中心营养与健康所',
      title: '婴幼儿喂养建议',
      url: 'https://www.chinacdc.cn/example.html',
    };

    const report = buildKnowledgeOpsReport({
      qaRecords: [],
      enrichedQaRecords: [
        qaFixture({
          id: 'qa-case-feeding',
          question: '我家的宝宝现在已经6个月大了，不知道能不能添加辅食，最近大便也不是很好，请问怎么办？',
          category: 'nutrition-baby',
          topic: 'feeding',
          risk_level_default: 'green',
          target_stage: ['6-12-months'],
          references: [officialReference],
        }),
        qaFixture({
          id: 'qa-case-fetal-movement',
          question: '我怀孕24周了，想知道胎动应该怎么数，最近去医院检查医生也让我注意胎动。',
          category: 'pregnancy-mid',
          topic: 'pregnancy',
          risk_level_default: 'green',
          target_stage: ['second-trimester'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'ACOG',
            title: 'Fetal movement guidance',
            url: 'https://www.acog.org/example',
          }],
        }),
        qaFixture({
          id: 'qa-case-fever',
          question: '宝宝昨天晚上开始高烧，今天精神也不太好，家里人都很着急，请问该怎么办？',
          category: 'common-symptoms',
          topic: 'common-symptoms',
          risk_level_default: 'yellow',
          target_stage: ['0-6-months'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'AAP',
            title: 'Fever in children',
            url: 'https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/default.aspx',
          }],
        }),
        qaFixture({
          id: 'qa-case-red',
          question: '宝宝发热什么时候需要就医？',
          category: 'common-symptoms',
          topic: 'common-symptoms',
          risk_level_default: 'red',
          target_stage: ['0-6-months'],
          references: [officialReference],
        }),
        qaFixture({
          id: 'qa-case-missing-reference',
          question: '6 个月宝宝添加辅食要注意什么？',
          category: 'nutrition-baby',
          topic: 'feeding',
          risk_level_default: 'green',
          target_stage: ['6-12-months'],
        }),
        qaFixture({
          id: 'qa-case-unsupported',
          question: '宝宝用品怎么买更划算？',
          category: 'shopping',
          topic: 'shopping',
          risk_level_default: 'green',
          references: [officialReference],
        }),
      ],
      authorityRecords: [],
    }, {
      sampleLimit: 10,
      watchedSourceIds: [],
    });

    expect(report.promotion.safeQuestionCandidates).toMatchObject({
      total: 3,
      excluded: {
        missingAuthorityReference: 1,
        redRisk: 1,
        unsupportedPromotionIntent: 1,
      },
    });
    expect(report.promotion.safeQuestionCandidates.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'qa-case-feeding',
        question: '6 个月宝宝添加辅食要注意什么？',
        riskLevel: 'green',
        suggestedUse: 'general_education',
      }),
      expect.objectContaining({
        id: 'qa-case-fetal-movement',
        question: '孕中期胎动怎么数？',
        riskLevel: 'green',
        suggestedUse: 'general_education',
      }),
      expect.objectContaining({
        id: 'qa-case-fever',
        question: '宝宝发热什么时候需要就医？',
        riskLevel: 'yellow',
        suggestedUse: 'care_boundary',
        boundaryNote: '仅用于科普与就医准备，不作为诊断或治疗建议。',
      }),
    ]));
  });

  it('does not invent promotion topics from generic answers or broad stage arrays', () => {
    const report = buildKnowledgeOpsReport({
      qaRecords: [],
      enrichedQaRecords: [
        qaFixture({
          id: 'qa-generic-answer',
          question: '哺乳感觉浑身发冷四肢无力恶心，是感冒吗？',
          answer: '观察症状，注意饮食，保证休息，必要时就医。',
          category: 'common-symptoms',
          topic: 'common-symptoms',
          risk_level_default: 'yellow',
          target_stage: ['0-6-months', '6-12-months', 'first-trimester'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'ACOG',
            title: 'Nausea and Vomiting of Pregnancy',
            url: 'https://www.acog.org/example',
          }],
        }),
        qaFixture({
          id: 'qa-reference-mismatch',
          question: '宝宝脸上起红疹什么时候需要就医？',
          category: 'common-symptoms',
          topic: 'common-symptoms',
          risk_level_default: 'yellow',
          target_stage: ['0-6-months'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'NHS',
            title: 'Ibuprofen for children: medicine for pain and high temperature',
            url: 'https://www.nhs.uk/medicines/ibuprofen-for-children/',
          }],
        }),
        qaFixture({
          id: 'qa-reference-match',
          question: '宝宝发热什么时候需要就医？',
          category: 'common-symptoms',
          topic: 'common-symptoms',
          risk_level_default: 'yellow',
          target_stage: ['0-6-months'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'NHS',
            title: 'Ibuprofen for children: medicine for pain and high temperature',
            url: 'https://www.nhs.uk/medicines/ibuprofen-for-children/',
          }],
        }),
      ],
      authorityRecords: [],
    }, {
      sampleLimit: 10,
      watchedSourceIds: [],
    });

    expect(report.promotion.safeQuestionCandidates).toMatchObject({
      total: 1,
      excluded: {
        unsupportedPromotionIntent: 1,
        authorityReferenceMismatch: 1,
      },
    });
    expect(report.promotion.safeQuestionCandidates.candidates).toEqual([
      expect.objectContaining({
        id: 'qa-reference-match',
        question: '宝宝发热什么时候需要就医？',
      }),
    ]);
  });

  it('requires specific authority reference alignment for standardized promotion titles', () => {
    const report = buildKnowledgeOpsReport({
      qaRecords: [],
      enrichedQaRecords: [
        qaFixture({
          id: 'qa-feeding-mismatch',
          question: '宝宝 6 个月开始添加辅食要注意什么？',
          category: 'parenting-0-1',
          topic: 'feeding',
          risk_level_default: 'green',
          target_stage: ['6-12-months'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'NHS',
            title: 'Breastfeeding in public',
            url: 'https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/breastfeeding/breastfeeding-in-public/',
          }],
        }),
        qaFixture({
          id: 'qa-diarrhea-mismatch',
          question: '宝宝呕吐和腹泻什么时候需要就医？',
          category: 'common-symptoms',
          topic: 'common-symptoms',
          risk_level_default: 'yellow',
          target_stage: ['0-6-months'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'ACOG',
            title: 'Nausea and Vomiting of Pregnancy',
            url: 'https://www.acog.org/example',
          }],
        }),
        qaFixture({
          id: 'qa-newborn-mismatch',
          question: '新生儿护理要注意什么？',
          category: 'parenting-0-1',
          topic: 'newborn',
          risk_level_default: 'green',
          target_stage: ['newborn'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'MSD Manuals',
            title: '风湿热 - 儿童的健康问题',
            url: 'https://www.msdmanuals.cn/home/children-s-health-issues/bacterial-infections-in-infants-and-children/rheumatic-fever',
          }],
        }),
        qaFixture({
          id: 'qa-nutrition-mismatch',
          question: '孕期营养要注意什么？',
          category: 'pregnancy-early',
          topic: 'pregnancy',
          risk_level_default: 'green',
          target_stage: ['first-trimester'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'NHS',
            title: 'Antenatal checks and tests',
            url: 'https://www.nhs.uk/pregnancy/your-pregnancy-care/antenatal-checks-and-tests/',
          }],
        }),
        qaFixture({
          id: 'qa-specific-match',
          question: '宝宝皮疹或湿疹什么时候需要就医？',
          category: 'common-symptoms',
          topic: 'common-symptoms',
          risk_level_default: 'yellow',
          target_stage: ['0-6-months'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'MSD Manuals',
            title: '儿童皮疹 - 儿童的健康问题',
            url: 'https://www.msdmanuals.cn/home/children-s-health-issues/symptoms-in-infants-and-children/rashes-in-children',
          }],
        }),
      ],
      authorityRecords: [],
    }, {
      sampleLimit: 10,
      watchedSourceIds: [],
    });

    expect(report.promotion.safeQuestionCandidates).toMatchObject({
      total: 1,
      excluded: {
        authorityReferenceMismatch: 4,
      },
    });
    expect(report.promotion.safeQuestionCandidates.candidates).toEqual([
      expect.objectContaining({
        id: 'qa-specific-match',
        question: '宝宝皮疹或湿疹什么时候需要就医？',
      }),
    ]);
  });

  it('normalizes promotion candidate stages before writing the ops report', () => {
    const report = buildKnowledgeOpsReport({
      qaRecords: [],
      enrichedQaRecords: [
        qaFixture({
          id: 'qa-broad-feeding',
          question: '6 个月宝宝添加辅食要注意什么？',
          category: 'parenting-0-1',
          topic: 'feeding',
          risk_level_default: 'green',
          target_stage: ['first-trimester', '0-6-months', '6-12-months'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'NHS',
            title: 'Your baby first solid foods',
            url: 'https://www.nhs.uk/baby/weaning-and-feeding/babys-first-solid-foods/',
          }],
        }),
        qaFixture({
          id: 'qa-broad-fever',
          question: '宝宝发热什么时候需要就医？',
          category: 'common-symptoms',
          topic: 'common-symptoms',
          risk_level_default: 'yellow',
          target_stage: ['0-6-months', '6-12-months', '1-3-years', 'first-trimester', 'second-trimester', 'third-trimester'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'AAP',
            title: 'Fever in children',
            url: 'https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/default.aspx',
          }],
        }),
        qaFixture({
          id: 'qa-breastfeeding',
          question: '哺乳期喂养要注意什么？',
          category: 'pregnancy-mid',
          topic: 'feeding',
          risk_level_default: 'green',
          target_stage: ['second-trimester'],
          references: [{
            authoritative: true,
            sourceClass: 'official',
            sourceOrg: 'MSD Manuals',
            title: 'Medication and substance use during breastfeeding',
            url: 'https://www.msdmanuals.cn/home/women-s-health-issues/medication-and-substance-use-during-pregnancy/medication-and-substance-use-during-breastfeeding',
          }],
        }),
      ],
      authorityRecords: [],
    }, {
      sampleLimit: 10,
      watchedSourceIds: [],
    });

    const candidatesById = new Map(
      report.promotion.safeQuestionCandidates.candidates.map((candidate) => [candidate.id, candidate]),
    );

    expect(candidatesById.get('qa-broad-feeding')?.targetStage).toEqual(['6-12-months']);
    expect(candidatesById.get('qa-broad-fever')?.targetStage).toEqual([
      'newborn',
      '0-6-months',
      '6-12-months',
      '1-3-years',
    ]);
    expect(candidatesById.get('qa-breastfeeding')?.targetStage).toEqual(['postpartum']);
  });
});
