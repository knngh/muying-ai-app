import { buildKnowledgeDailyOpsReport } from '../src/utils/knowledge-daily-ops';

describe('knowledge daily ops report', () => {
  it('marks report as attention when coverage and source dry-run need follow-up', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-07T00:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'coverage', command: 'npm run audit:authority-coverage', ok: true, exitCode: 0, durationMs: 100 },
      ],
      knowledgeReport: {
        coverage: {
          coverageRate: 52.83,
          authorityCovered: 1659,
          missingAuthorityCoverage: 1481,
        },
        sourceCoverage: {
          watchedSources: [
            { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
          ],
        },
        actionItems: [
          { priority: 'P2', area: 'source_coverage', message: 'mayo-clinic-zh has 0/10 published authority records' },
        ],
      },
      sourceRefreshResult: {
        dryRun: true,
        selectedSources: [
          { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
        ],
        summaries: [
          {
            sourceId: 'mayo-clinic-zh',
            skipped: true,
            reason: 'dry_run',
            discoveryProbe: {
              ok: true,
              discovered: 3,
              sampleUrls: [
                'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/expert-answers/newborn/faq-20057752',
              ],
              entryDiagnostics: [
                {
                  entryUrl: 'https://www.mayoclinic.org/chinese_patient_consumer_faq.xml',
                  ok: true,
                  status: 200,
                  contentType: 'application/xml',
                  locCount: 500,
                  nestedSitemapCount: 0,
                  matchedCandidateCount: 3,
                  sampleMatchedUrls: [
                    'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/expert-answers/newborn/faq-20057752',
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    expect(report.status).toBe('attention');
    expect(report.remediation.sourceRefresh.summaries).toEqual([
      {
        sourceId: 'mayo-clinic-zh',
        skipped: true,
        reason: 'dry_run',
        discoveryProbe: {
          ok: true,
          discovered: 3,
          sampleUrls: [
            'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/expert-answers/newborn/faq-20057752',
          ],
          entryDiagnostics: [
            {
              entryUrl: 'https://www.mayoclinic.org/chinese_patient_consumer_faq.xml',
              ok: true,
              status: 200,
              contentType: 'application/xml',
              locCount: 500,
              nestedSitemapCount: 0,
              matchedCandidateCount: 3,
              sampleMatchedUrls: [
                'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/expert-answers/newborn/faq-20057752',
              ],
            },
          ],
        },
      },
    ]);
    expect(report.nextActions).toEqual(expect.arrayContaining([
      'Authority coverage is below P4 target: 52.83% < 80%',
      'Review low-coverage source dry-run output, then run KNOWLEDGE_DAILY_APPLY_FIXES=true npm run ops:knowledge:daily when ready.',
      'mayo-clinic-zh discovery probe found 3 candidate URL(s); safe to run a controlled source refresh for that source.',
    ]));
  });

  it('does not request authority coverage action once the P4 threshold is met', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-14T00:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'knowledge_ops_report', command: 'npm run ops:knowledge:report', ok: true, exitCode: 0, durationMs: 100 },
      ],
      knowledgeReport: {
        coverage: {
          coverageRate: 80.63,
          authorityCovered: 1428,
          missingAuthorityCoverage: 343,
        },
        actionItems: [],
      },
    });

    expect(report.status).toBe('ok');
    expect(report.nextActions).toEqual([]);
  });

  it('downgrades upstream entry access failures when no source refresh can be applied', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-08T00:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'low_coverage_source_refresh', command: 'npm run ops:authority:refresh-low-coverage', ok: true, exitCode: 0, durationMs: 100 },
      ],
      knowledgeReport: {
        actionItems: [
          { priority: 'P2', area: 'source_coverage', message: 'mayo-clinic-zh has 0/10 published authority records' },
        ],
      },
      sourceRefreshResult: {
        dryRun: true,
        selectedSources: [
          { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
        ],
        summaries: [
          {
            sourceId: 'mayo-clinic-zh',
            skipped: true,
            reason: 'dry_run',
            discoveryProbe: {
              ok: true,
              discovered: 0,
              sampleUrls: [],
              entryDiagnostics: [
                {
                  entryUrl: 'https://www.mayoclinic.org/chinese_condition_consolidated_concepts.xml',
                  ok: false,
                  status: 403,
                  contentType: 'text/html',
                },
              ],
            },
          },
        ],
      },
    });

    expect(report.status).toBe('ok');
    expect(report.blockedExternalSources).toEqual([
      {
        sourceId: 'mayo-clinic-zh',
        blockedEntryUrl: 'https://www.mayoclinic.org/chinese_condition_consolidated_concepts.xml',
        blockedStatus: 403,
      },
    ]);
    expect(report.knowledge.actionItems).toEqual([]);
    expect(report.nextActions).toEqual([]);
    expect(report.nextActions).not.toEqual(expect.arrayContaining([
      'Review low-coverage source dry-run output, then run KNOWLEDGE_DAILY_APPLY_FIXES=true npm run ops:knowledge:daily when ready.',
      'mayo-clinic-zh discovery entry is blocked upstream (403): https://www.mayoclinic.org/chinese_condition_consolidated_concepts.xml',
      'mayo-clinic-zh discovery probe found 0 candidate URL(s); safe to run a controlled source refresh for that source.',
    ]));
  });

  it('keeps sources with candidates refreshable even when one entry diagnostic is blocked', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-12T00:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'low_coverage_source_refresh', command: 'npm run ops:authority:refresh-low-coverage', ok: true, exitCode: 0, durationMs: 100 },
      ],
      sourceRefreshResult: {
        dryRun: true,
        selectedSources: [
          { sourceId: 'mchscn-monitoring', count: 0, minimumPublishedRecords: 10, status: 'missing' },
        ],
        summaries: [
          {
            sourceId: 'mchscn-monitoring',
            skipped: true,
            reason: 'dry_run',
            discoveryProbe: {
              ok: true,
              discovered: 36,
              sampleUrls: [
                'https://www.mchscn.cn/details/monitoring-1.html',
              ],
              entryDiagnostics: [
                {
                  entryUrl: 'https://www.mchscn.cn/missing.html',
                  ok: false,
                  status: 404,
                  contentType: 'text/html',
                },
                {
                  entryUrl: 'https://www.mchscn.cn/monitoring/',
                  ok: true,
                  status: 200,
                  matchedCandidateCount: 36,
                },
              ],
            },
            discoveryPreflight: {
              ok: true,
              reason: 'discovery_passed',
              discovered: 36,
              minimumDiscovered: 3,
              sampleUrls: [
                'https://www.mchscn.cn/details/monitoring-1.html',
              ],
            },
          },
        ],
      },
    });

    expect(report.blockedExternalSources).toEqual([]);
    expect(report.nextActions).toEqual(expect.arrayContaining([
      'Review low-coverage source dry-run output, then run KNOWLEDGE_DAILY_APPLY_FIXES=true npm run ops:knowledge:daily when ready.',
      'mchscn-monitoring discovery probe found 36 candidate URL(s); safe to run a controlled source refresh for that source.',
    ]));
    expect(report.nextActions).not.toEqual(expect.arrayContaining([
      'mchscn-monitoring discovery entry is blocked upstream (404): https://www.mchscn.cn/missing.html',
    ]));
  });

  it('does not recommend applying a source refresh when discovery is below the quality floor', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-12T01:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'low_coverage_source_refresh', command: 'npm run ops:authority:refresh-low-coverage', ok: true, exitCode: 0, durationMs: 100 },
      ],
      sourceRefreshResult: {
        dryRun: true,
        selectedSources: [
          { sourceId: 'chinacdc-nutrition', count: 1, minimumPublishedRecords: 10, status: 'low' },
        ],
        summaries: [
          {
            sourceId: 'chinacdc-nutrition',
            skipped: true,
            reason: 'dry_run',
            discoveryProbe: {
              ok: true,
              discovered: 1,
              sampleUrls: [
                'https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_295584.html',
              ],
            },
            discoveryPreflight: {
              ok: false,
              reason: 'discovery_below_quality_floor',
              discovered: 1,
              minimumDiscovered: 3,
              sampleUrls: [
                'https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_295584.html',
              ],
            },
          },
        ],
      },
    });

    expect(report.status).toBe('attention');
    expect(report.nextActions).toEqual([
      'chinacdc-nutrition discovery probe found 1 candidate URL(s), below quality floor 3; improve source discovery before applying refresh.',
    ]);
    expect(report.nextActions).not.toEqual(expect.arrayContaining([
      'Review low-coverage source dry-run output, then run KNOWLEDGE_DAILY_APPLY_FIXES=true npm run ops:knowledge:daily when ready.',
      'chinacdc-nutrition discovery probe found 1 candidate URL(s); safe to run a controlled source refresh for that source.',
    ]));
  });

  it('keeps Mayo preflight failures downgraded during apply fixes runs', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-10T05:30:00.000Z',
      applyFixes: true,
      commands: [
        { name: 'low_coverage_source_refresh', command: 'npm run ops:authority:refresh-low-coverage', ok: true, exitCode: 0, durationMs: 100 },
      ],
      knowledgeReport: {
        actionItems: [
          { priority: 'P2', area: 'source_coverage', message: 'mayo-clinic-zh has 0/10 published authority records' },
        ],
      },
      sourceRefreshResult: {
        dryRun: false,
        selectedSources: [
          { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
        ],
        summaries: [
          {
            sourceId: 'mayo-clinic-zh',
            skipped: true,
            reason: 'preflight_failed',
          },
        ],
      },
    });

    expect(report.status).toBe('ok');
    expect(report.blockedExternalSources).toEqual([{ sourceId: 'mayo-clinic-zh' }]);
    expect(report.knowledge.actionItems).toEqual([]);
    expect(report.nextActions).toEqual([]);
  });

  it('surfaces retryable translation failures as an operator action', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-08T00:00:00.000Z',
      applyFixes: false,
      commands: [
        {
          name: 'authority_translation_failure_retry',
          command: 'npm run retry:authority-translation-failures',
          ok: true,
          exitCode: 0,
          durationMs: 100,
        },
      ],
      translationFailureRetryReport: {
        dryRun: true,
        totalFailures: 3,
        retryableFailures: 2,
        blockedFailures: 1,
        limit: 5,
        selectedFailures: [
          { slug: 'authority-aap-1', message: 'AI Gateway timeout after 45000ms', retryable: true },
          { slug: 'authority-aap-2', message: 'AI Gateway error: 529', retryable: true },
        ],
      },
    });

    expect(report.remediation.translationFailureRetry).toEqual(expect.objectContaining({
      dryRun: true,
      totalFailures: 3,
      retryableFailures: 2,
      blockedFailures: 1,
    }));
    expect(report.nextActions).toEqual(expect.arrayContaining([
      'Run DRY_RUN=false npm run retry:authority-translation-failures to retry 2 translation failure(s).',
    ]));
  });

  it('keeps retry-after blocked translation failures as healthy when no operator action is available', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-09T12:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'knowledge_ops_report', command: 'npm run ops:knowledge:report', ok: true, exitCode: 0, durationMs: 100 },
        { name: 'authority_translation_failure_retry', command: 'npm run retry:authority-translation-failures', ok: true, exitCode: 0, durationMs: 100 },
      ],
      knowledgeReport: {
        translations: {
          recordsForTranslation: 628,
          cacheEntries: 628,
          invalidCacheEntries: 0,
          failureEntries: 28,
          retryableFailures: 0,
          blockedFailures: 28,
        },
        actionItems: [
          { priority: 'P2', area: 'translation_cache', message: '28 translation failures need retry or diagnosis' },
        ],
      },
      translationFailureRetryReport: {
        dryRun: true,
        totalFailures: 28,
        retryableFailures: 0,
        blockedFailures: 28,
        limit: 10,
        selectedFailures: [],
      },
    });

    expect(report.status).toBe('ok');
    expect(report.knowledge.translations).toMatchObject({
      failureEntries: 28,
      retryableFailures: 0,
      blockedFailures: 28,
    });
    expect(report.knowledge.actionItems).toEqual([]);
    expect(report.nextActions).toEqual([]);
  });

  it('filters stale retryable translation failures when no retry action can be selected', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-10T05:14:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'knowledge_ops_report', command: 'npm run ops:knowledge:report', ok: true, exitCode: 0, durationMs: 100 },
        { name: 'authority_translation_failure_retry', command: 'npm run retry:authority-translation-failures', ok: true, exitCode: 0, durationMs: 100 },
      ],
      knowledgeReport: {
        translations: {
          recordsForTranslation: 677,
          cacheEntries: 633,
          invalidCacheEntries: 0,
          failureEntries: 88,
          retryableFailures: 4,
          blockedFailures: 84,
        },
        actionItems: [
          { priority: 'P2', area: 'translation_cache', message: '4 retryable translation failures need retry or diagnosis' },
        ],
      },
      translationFailureRetryReport: {
        dryRun: true,
        totalFailures: 88,
        retryableFailures: 4,
        actionableRetryableFailures: 0,
        staleRetryableFailures: 4,
        blockedFailures: 84,
        limit: 5,
        selectedFailures: [],
        skippedFailures: [
          {
            slug: 'authority-aap-5',
            message: 'AI Gateway error: 429',
            retryAfterAt: '2026-05-10T05:03:58.878Z',
            retryable: true,
            skipReason: 'source_updated_at_mismatch',
          },
          {
            slug: 'authority-aap-6',
            message: 'AI Gateway error: 429',
            retryAfterAt: '2026-05-10T05:04:29.419Z',
            retryable: true,
            skipReason: 'source_updated_at_mismatch',
          },
          {
            slug: 'authority-aap-8',
            message: 'AI Gateway error: 429',
            retryAfterAt: '2026-05-10T05:06:15.068Z',
            retryable: true,
            skipReason: 'source_updated_at_mismatch',
          },
          {
            slug: 'authority-aap-9',
            message: 'AI Gateway error: 429',
            retryAfterAt: '2026-05-10T05:06:45.644Z',
            retryable: true,
            skipReason: 'source_updated_at_mismatch',
          },
        ],
      },
    });

    expect(report.status).toBe('ok');
    expect(report.knowledge.actionItems).toEqual([]);
    expect(report.nextActions).toEqual([]);
  });

  it('keeps legacy translation failure action items when retryability is unknown', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-09T12:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'knowledge_ops_report', command: 'npm run ops:knowledge:report', ok: true, exitCode: 0, durationMs: 100 },
      ],
      knowledgeReport: {
        translations: {
          recordsForTranslation: 628,
          cacheEntries: 628,
          invalidCacheEntries: 0,
          failureEntries: 2,
        },
        actionItems: [
          { priority: 'P2', area: 'translation_cache', message: '2 translation failures need retry or diagnosis' },
        ],
      },
    });

    expect(report.status).toBe('attention');
    expect(report.knowledge.actionItems).toEqual([
      { priority: 'P2', area: 'translation_cache', message: '2 translation failures need retry or diagnosis' },
    ]);
  });

  it('includes promotion-safe question candidates without changing healthy status', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-09T00:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'knowledge_ops_report', command: 'npm run ops:knowledge:report', ok: true, exitCode: 0, durationMs: 100 },
      ],
      knowledgeReport: {
        coverage: {
          coverageRate: 81.99,
          authorityCovered: 1452,
          missingAuthorityCoverage: 319,
        },
        translations: {
          recordsForTranslation: 628,
          cacheEntries: 628,
          invalidCacheEntries: 0,
          failureEntries: 0,
        },
        promotion: {
          safeQuestionCandidates: {
            eligibleInput: 3140,
            total: 2388,
            byCategory: [{ key: 'nutrition-baby', count: 128 }],
            byTopic: [{ key: 'feeding', count: 210 }],
            excluded: { missingAuthorityReference: 752, redRisk: 12 },
            candidates: [
              {
                id: 'qa-green',
                question: '6 个月宝宝添加辅食要注意什么？',
                category: 'nutrition-baby',
                topic: 'feeding',
                riskLevel: 'green',
                suggestedUse: 'general_education',
              },
              {
                id: 'qa-yellow',
                question: '宝宝发烧什么时候需要就医？',
                category: 'common-symptoms',
                topic: 'common-symptoms',
                riskLevel: 'yellow',
                suggestedUse: 'care_boundary',
              },
            ],
          },
        },
        actionItems: [],
      },
    });

    expect(report.status).toBe('ok');
    expect(report.knowledge.promotion?.safeQuestionCandidates).toMatchObject({
      eligibleInput: 3140,
      total: 2388,
      candidates: [
        { id: 'qa-green', suggestedUse: 'general_education' },
        { id: 'qa-yellow', suggestedUse: 'care_boundary' },
      ],
    });
  });

  it('includes AI provider health in remediation without changing healthy status when ok', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-10T00:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'knowledge_ops_report', command: 'npm run ops:knowledge:report', ok: true, exitCode: 0, durationMs: 100 },
        { name: 'ai_provider_health', command: 'npm run ops:ai:health', ok: true, exitCode: 0, durationMs: 4200 },
      ],
      knowledgeReport: {
        coverage: {
          coverageRate: 81.99,
          authorityCovered: 1452,
          missingAuthorityCoverage: 319,
        },
        translations: {
          recordsForTranslation: 633,
          cacheEntries: 633,
          invalidCacheEntries: 0,
          failureEntries: 0,
        },
        actionItems: [],
      },
      aiProviderHealthReport: {
        generatedAt: '2026-05-10T00:00:00.000Z',
        status: 'ok',
        taskRole: 'glm_classify',
        timeoutMs: 45000,
        maxTokens: 80,
        binding: {
          role: 'glm_classify',
          provider: 'modal-direct',
          model: 'zai-org/GLM-5.1-FP8',
          configured: true,
        },
        call: {
          attempted: true,
          ok: true,
          elapsedMs: 4261,
          answerPreview: '3',
          expectedMatched: true,
          route: {
            provider: 'modal-direct',
            model: 'zai-org/GLM-5.1-FP8',
            route: 'task',
            label: 'task-glm',
          },
        },
      },
    });

    expect(report.status).toBe('ok');
    expect(report.remediation.aiProviderHealth).toMatchObject({
      status: 'ok',
      taskRole: 'glm_classify',
      binding: {
        provider: 'modal-direct',
        model: 'zai-org/GLM-5.1-FP8',
      },
      call: {
        ok: true,
        answerPreview: '3',
        route: {
          provider: 'modal-direct',
          model: 'zai-org/GLM-5.1-FP8',
        },
      },
    });
    expect(report.nextActions).toEqual([]);
  });

  it('marks the daily report attention when AI provider health fails', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-10T00:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'knowledge_ops_report', command: 'npm run ops:knowledge:report', ok: true, exitCode: 0, durationMs: 100 },
        { name: 'ai_provider_health', command: 'npm run ops:ai:health', ok: true, exitCode: 0, durationMs: 1000 },
      ],
      knowledgeReport: {
        coverage: {
          coverageRate: 81.99,
          authorityCovered: 1452,
          missingAuthorityCoverage: 319,
        },
        translations: {
          recordsForTranslation: 633,
          cacheEntries: 633,
          invalidCacheEntries: 0,
          failureEntries: 0,
        },
        actionItems: [],
      },
      aiProviderHealthReport: {
        generatedAt: '2026-05-10T00:00:00.000Z',
        status: 'failed',
        taskRole: 'glm_classify',
        timeoutMs: 45000,
        maxTokens: 80,
        binding: {
          role: 'glm_classify',
          provider: 'modal-direct',
          model: 'zai-org/GLM-5.1-FP8',
          configured: true,
        },
        call: {
          attempted: true,
          ok: false,
          elapsedMs: 45000,
          error: {
            message: 'timeout',
            gatewayProvider: 'modal-direct',
            gatewayModel: 'zai-org/GLM-5.1-FP8',
          },
        },
      },
    });

    expect(report.status).toBe('attention');
    expect(report.nextActions).toEqual([
      'AI provider health check failed for glm_classify (modal-direct / zai-org/GLM-5.1-FP8).',
    ]);
  });

  it('keeps the daily report ok when AI provider health is transiently degraded', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-11T00:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'knowledge_ops_report', command: 'npm run ops:knowledge:report', ok: true, exitCode: 0, durationMs: 100 },
        { name: 'ai_provider_health', command: 'npm run ops:ai:health', ok: true, exitCode: 0, durationMs: 1000 },
      ],
      knowledgeReport: {
        coverage: {
          coverageRate: 81.99,
          authorityCovered: 1452,
          missingAuthorityCoverage: 319,
        },
        translations: {
          recordsForTranslation: 633,
          cacheEntries: 633,
          invalidCacheEntries: 0,
          failureEntries: 0,
        },
        actionItems: [],
      },
      aiProviderHealthReport: {
        generatedAt: '2026-05-11T00:00:00.000Z',
        status: 'degraded',
        taskRole: 'glm_classify',
        timeoutMs: 45000,
        maxTokens: 80,
        binding: {
          role: 'glm_classify',
          provider: 'modal-direct',
          model: 'zai-org/GLM-5.1-FP8',
          configured: true,
        },
        call: {
          attempted: true,
          ok: false,
          elapsedMs: 723,
          error: {
            message: 'AI Gateway error: 503',
            gatewayStatus: 503,
            gatewayProvider: 'modal-direct',
            gatewayModel: 'zai-org/GLM-5.1-FP8',
          },
        },
      },
    });

    expect(report.status).toBe('ok');
    expect(report.remediation.aiProviderHealth?.status).toBe('degraded');
    expect(report.nextActions).toEqual([]);
  });

  it('surfaces AI ops report action items in daily status', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-14T00:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'knowledge_ops_report', command: 'npm run ops:knowledge:report', ok: true, exitCode: 0, durationMs: 100 },
        { name: 'ai_ops_report', command: 'npm run ops:ai:report', ok: true, exitCode: 0, durationMs: 100 },
      ],
      knowledgeReport: {
        coverage: {
          coverageRate: 81.99,
          authorityCovered: 1452,
          missingAuthorityCoverage: 319,
        },
        actionItems: [],
      },
      aiOpsReport: {
        generatedAt: '2026-05-14T00:00:00.000Z',
        status: 'attention',
        rangeDays: 7,
        serverAi: {
          requestsStarted: 10,
          responsesCompleted: 7,
          requestErrors: 3,
          errorRate: 0.3,
          averageLatencyMs: 15000,
          topErrorCode: 'AI_TIMEOUT',
          topRoute: 'task:glm_classify',
        },
        acquisition: {
          recommendedQuestionsServed: 4,
          recommendedQuestionsReturned: 12,
        },
        productEntrypointCoverage: [
          {
            entrySource: 'home_suggested_question',
            label: 'Home suggested question',
            clickCount: 1,
            prefillCount: 1,
            messageCount: 1,
            serverStartCount: 1,
            serverResponseCount: 1,
            serverErrorCount: 0,
            feedbackCount: 0,
            hasClick: true,
            hasPrefill: true,
            hasMessage: true,
            hasServerStart: true,
            hasServerResponse: true,
            hasFeedback: false,
            totalTrackedEvents: 5,
          },
        ],
        opsProductEntrypointCoverage: [
          {
            entrySource: 'weekly_report',
            label: 'Weekly report AI',
            clickCount: 1,
            prefillCount: 1,
            messageCount: 1,
            serverStartCount: 1,
            serverResponseCount: 1,
            serverErrorCount: 0,
            feedbackCount: 0,
            hasClick: true,
            hasPrefill: true,
            hasMessage: true,
            hasServerStart: true,
            hasServerResponse: true,
            hasFeedback: false,
            totalTrackedEvents: 5,
          },
        ],
        actionItems: [
          { area: 'ai_error_rate', severity: 'medium', message: 'Server AI error rate is 30.0%.' },
        ],
        nextActions: [
          'Inspect top AI error code: AI_TIMEOUT',
        ],
      },
    });

    expect(report.status).toBe('attention');
    expect(report.remediation.aiOps).toMatchObject({
      status: 'attention',
      serverAi: {
        requestsStarted: 10,
        requestErrors: 3,
        topErrorCode: 'AI_TIMEOUT',
      },
      productEntrypointCoverage: [
        {
          entrySource: 'home_suggested_question',
          label: 'Home suggested question',
          serverResponseCount: 1,
          hasServerResponse: true,
        },
      ],
      opsProductEntrypointCoverage: [
        {
          entrySource: 'weekly_report',
          label: 'Weekly report AI',
          serverResponseCount: 1,
          hasServerResponse: true,
        },
      ],
    });
    expect(report.nextActions).toEqual(['Inspect top AI error code: AI_TIMEOUT']);
  });

  it('marks report as failed when a command fails', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-07T00:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'coverage', command: 'npm run audit:authority-coverage', ok: false, exitCode: 1, durationMs: 100, stderrTail: 'boom' },
      ],
    });

    expect(report.status).toBe('failed');
    expect(report.nextActions[0]).toBe('Inspect failed daily ops command(s): coverage');
  });
});
