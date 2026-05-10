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
      'Authority coverage is below P2 target: 52.83% < 60%',
      'Review low-coverage source dry-run output, then run KNOWLEDGE_DAILY_APPLY_FIXES=true npm run ops:knowledge:daily when ready.',
      'mayo-clinic-zh discovery probe found 3 candidate URL(s); safe to run a controlled source refresh for that source.',
    ]));
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
          coverageRate: 76.05,
          authorityCovered: 2388,
          missingAuthorityCoverage: 752,
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
          coverageRate: 76.05,
          authorityCovered: 2388,
          missingAuthorityCoverage: 752,
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
          coverageRate: 76.05,
          authorityCovered: 2388,
          missingAuthorityCoverage: 752,
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
