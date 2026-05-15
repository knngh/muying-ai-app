import { buildAIOpsReport } from '../src/utils/ai-ops-report';

describe('AI ops report', () => {
  it('marks report attention when server AI error rate, latency, or source coverage need follow-up', () => {
    const report = buildAIOpsReport({
      generatedAt: '2026-05-14T06:40:00.000Z',
      overview: {
        rangeDays: 7,
        startAt: '2026-05-07T06:40:00.000Z',
        endAt: '2026-05-14T06:40:00.000Z',
        counts: {
          messagesSent: 8,
          responsesReceived: 7,
          serverRequestsStarted: 10,
          serverResponsesCompleted: 7,
          serverRequestErrors: 3,
          serverRecommendedQuestionsServed: 4,
        },
        responseQuality: {
          degradedRate: 0.1,
          withSourcesRate: 0.85,
        },
        serverAi: {
          requestsStarted: 10,
          responsesCompleted: 7,
          requestErrors: 3,
          errorRate: 0.3,
          averageLatencyMs: 15000,
          degradedRate: 0.2,
          withSourcesRate: 0.4,
          recommendedQuestionsServed: 4,
          recommendedQuestionsReturned: 12,
          endpointBreakdown: [{ key: 'ask', count: 6 }, { key: 'chat', count: 4 }],
          providerBreakdown: [{ key: 'modal-direct', count: 7 }],
          routeBreakdown: [{ key: 'task:glm_classify', count: 7 }],
          errorCodeBreakdown: [{ key: 'AI_TIMEOUT', count: 3 }],
          recommendedStageBreakdown: [{ key: 'newborn', count: 4 }],
        },
      },
    });

    expect(report).toMatchObject({
      status: 'attention',
      generatedAt: '2026-05-14T06:40:00.000Z',
      rangeDays: 7,
      serverAi: {
        requestsStarted: 10,
        responsesCompleted: 7,
        requestErrors: 3,
        errorRate: 0.3,
        averageLatencyMs: 15000,
        withSourcesRate: 0.4,
        topEndpoint: 'ask',
        topProvider: 'modal-direct',
        topRoute: 'task:glm_classify',
        topErrorCode: 'AI_TIMEOUT',
      },
    });
    expect(report.actionItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ area: 'ai_error_rate' }),
      expect.objectContaining({ area: 'ai_latency' }),
      expect.objectContaining({ area: 'ai_source_coverage' }),
    ]));
    expect(report.nextActions).toEqual(expect.arrayContaining([
      'Inspect top AI error code: AI_TIMEOUT',
      'Review slowest/high-volume AI route: task:glm_classify',
      'Audit AI answers without sources before increasing traffic',
    ]));
  });

  it('keeps report ok when AI traffic has healthy completion and source metrics', () => {
    const report = buildAIOpsReport({
      generatedAt: '2026-05-14T06:40:00.000Z',
      overview: {
        rangeDays: 7,
        counts: {
          messagesSent: 20,
          responsesReceived: 19,
          serverRequestsStarted: 20,
          serverResponsesCompleted: 19,
          serverRequestErrors: 1,
          serverRecommendedQuestionsServed: 8,
        },
        responseQuality: {
          degradedRate: 0.02,
          withSourcesRate: 0.9,
        },
        serverAi: {
          requestsStarted: 20,
          responsesCompleted: 19,
          requestErrors: 1,
          errorRate: 0.05,
          averageLatencyMs: 4200,
          degradedRate: 0.02,
          withSourcesRate: 0.9,
          recommendedQuestionsServed: 8,
          recommendedQuestionsReturned: 24,
          endpointBreakdown: [{ key: 'chat', count: 12 }],
          providerBreakdown: [{ key: 'modal-direct', count: 19 }],
          routeBreakdown: [{ key: 'task:kimi_reason', count: 19 }],
          errorCodeBreakdown: [{ key: 'AI_TIMEOUT', count: 1 }],
        },
      },
    });

    expect(report.status).toBe('ok');
    expect(report.actionItems).toEqual([]);
    expect(report.nextActions).toEqual([]);
    expect(report.serverAi).toMatchObject({
      completionRate: 0.95,
      topEndpoint: 'chat',
      topProvider: 'modal-direct',
      topRoute: 'task:kimi_reason',
    });
  });

  it('asks for baseline traffic when no AI request or recommendation exposure has been captured', () => {
    const report = buildAIOpsReport({
      generatedAt: '2026-05-14T06:40:00.000Z',
      overview: {
        rangeDays: 7,
        counts: {
          messagesSent: 0,
          responsesReceived: 0,
          serverRequestsStarted: 0,
          serverResponsesCompleted: 0,
          serverRequestErrors: 0,
          serverRecommendedQuestionsServed: 0,
        },
        responseQuality: {},
        serverAi: {
          requestsStarted: 0,
          responsesCompleted: 0,
          requestErrors: 0,
          errorRate: null,
          averageLatencyMs: null,
          recommendedQuestionsServed: 0,
        },
      },
    });

    expect(report.status).toBe('attention');
    expect(report.actionItems).toEqual([
      expect.objectContaining({ area: 'ai_traffic' }),
    ]);
    expect(report.nextActions).toEqual([
      'Drive a small AI/chat and recommendation smoke cohort to establish baseline metrics',
    ]);
  });

  it('still asks for an AI answer baseline when recommendation exposure exists but no AI answer request was captured', () => {
    const report = buildAIOpsReport({
      generatedAt: '2026-05-14T06:40:00.000Z',
      overview: {
        rangeDays: 7,
        counts: {
          messagesSent: 0,
          responsesReceived: 0,
          serverRequestsStarted: 0,
          serverResponsesCompleted: 0,
          serverRequestErrors: 0,
          serverRecommendedQuestionsServed: 2,
        },
        responseQuality: {},
        serverAi: {
          requestsStarted: 0,
          responsesCompleted: 0,
          requestErrors: 0,
          errorRate: null,
          averageLatencyMs: null,
          recommendedQuestionsServed: 2,
          recommendedQuestionsReturned: 6,
          recommendedStageBreakdown: [{ key: 'newborn', count: 2 }],
        },
      },
    });

    expect(report.status).toBe('attention');
    expect(report.actionItems).toEqual([
      expect.objectContaining({ area: 'ai_answer_traffic' }),
    ]);
    expect(report.nextActions).toEqual([
      'Run a small authenticated AI/chat smoke cohort to establish answer quality and latency metrics',
    ]);
    expect(report.acquisition).toMatchObject({
      recommendedQuestionsServed: 2,
      recommendedQuestionsReturned: 6,
      topRecommendedStage: 'newborn',
    });
  });

  it('flags smoke-only answer traffic as insufficient for product learning', () => {
    const report = buildAIOpsReport({
      generatedAt: '2026-05-14T06:40:00.000Z',
      overview: {
        rangeDays: 7,
        counts: {
          messagesSent: 0,
          responsesReceived: 0,
          serverRequestsStarted: 1,
          serverResponsesCompleted: 1,
          serverRequestErrors: 0,
          serverRecommendedQuestionsServed: 3,
        },
        responseQuality: {},
        serverAi: {
          requestsStarted: 1,
          responsesCompleted: 1,
          requestErrors: 0,
          errorRate: 0,
          averageLatencyMs: 3272,
          degradedRate: 0,
          withSourcesRate: 1,
          recommendedQuestionsServed: 3,
          recommendedQuestionsReturned: 9,
          endpointBreakdown: [{ key: 'ask', count: 2 }],
          providerBreakdown: [{ key: 'system', count: 1 }],
          routeBreakdown: [{ key: 'fallback:kimi_reason>minimax_render', count: 1 }],
          entrySourceBreakdown: [{ key: 'ops_ai_smoke', count: 2 }],
          productEntrypointCoverage: [
            {
              entrySource: 'home_suggested_question',
              label: 'Home suggested question',
              clickCount: 0,
              prefillCount: 0,
              messageCount: 0,
              serverStartCount: 0,
              serverResponseCount: 0,
              serverErrorCount: 0,
              feedbackCount: 0,
              hasClick: false,
              hasPrefill: false,
              hasMessage: false,
              hasServerStart: false,
              hasServerResponse: false,
              hasFeedback: false,
              totalTrackedEvents: 0,
            },
            {
              entrySource: 'knowledge_detail',
              label: 'Knowledge detail AI',
              clickCount: 0,
              prefillCount: 0,
              messageCount: 0,
              serverStartCount: 0,
              serverResponseCount: 0,
              serverErrorCount: 0,
              feedbackCount: 0,
              hasClick: false,
              hasPrefill: false,
              hasMessage: false,
              hasServerStart: false,
              hasServerResponse: false,
              hasFeedback: false,
              totalTrackedEvents: 0,
            },
            {
              entrySource: 'weekly_report',
              label: 'Weekly report AI',
              clickCount: 0,
              prefillCount: 0,
              messageCount: 0,
              serverStartCount: 0,
              serverResponseCount: 0,
              serverErrorCount: 0,
              feedbackCount: 0,
              hasClick: false,
              hasPrefill: false,
              hasMessage: false,
              hasServerStart: false,
              hasServerResponse: false,
              hasFeedback: false,
              totalTrackedEvents: 0,
            },
          ],
          recommendedStageBreakdown: [{ key: 'newborn', count: 3 }],
          recommendedSourceBreakdown: [{ key: 'knowledge_ops_report', count: 3 }],
        },
      },
    });

    expect(report.status).toBe('attention');
    expect(report.serverAi).toMatchObject({
      topEntrySource: 'ops_ai_smoke',
      opsSmokeEventCount: 2,
      nonOpsEntrySourceEventCount: 0,
    });
    expect(report.actionItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        area: 'ai_real_usage_traffic',
        message: 'Only ops AI smoke answer traffic was captured in the last 7 day(s); missing product entrypoints: Home suggested question, Knowledge detail AI, Weekly report AI.',
      }),
    ]));
    expect(report.nextActions).toEqual(expect.arrayContaining([
      'Run an in-app AI journey cohort for missing entrypoints: Home suggested question, Knowledge detail AI, Weekly report AI',
    ]));
  });

  it('counts native app AI entrypoint traffic as real usage when it is not from ops smoke', () => {
    const report = buildAIOpsReport({
      generatedAt: '2026-05-14T06:40:00.000Z',
      overview: {
        rangeDays: 7,
        counts: {
          messagesSent: 2,
          responsesReceived: 2,
          serverRequestsStarted: 8,
          serverResponsesCompleted: 8,
          serverRequestErrors: 0,
          serverRecommendedQuestionsServed: 3,
        },
        responseQuality: {
          degradedRate: 0,
          withSourcesRate: 1,
        },
        serverAi: {
          requestsStarted: 8,
          responsesCompleted: 8,
          requestErrors: 0,
          errorRate: 0,
          averageLatencyMs: 2800,
          degradedRate: 0,
          withSourcesRate: 1,
          recommendedQuestionsServed: 3,
          recommendedQuestionsReturned: 9,
          endpointBreakdown: [{ key: 'chat_stream', count: 8 }],
          providerBreakdown: [{ key: 'modal-direct', count: 8 }],
          routeBreakdown: [{ key: 'task:kimi_reason', count: 8 }],
          entrySourceBreakdown: [
            { key: 'ops_ai_smoke', count: 4 },
            { key: 'native', count: 4 },
          ],
          opsEntrypointSmokeEventCount: 0,
          productEntrypointCoverage: [
            {
              entrySource: 'native',
              label: 'Native chat',
              clickCount: 0,
              prefillCount: 0,
              messageCount: 2,
              serverStartCount: 2,
              serverResponseCount: 2,
              serverErrorCount: 0,
              feedbackCount: 0,
              hasClick: false,
              hasPrefill: false,
              hasMessage: true,
              hasServerStart: true,
              hasServerResponse: true,
              hasFeedback: false,
              totalTrackedEvents: 6,
            },
          ],
        },
      },
    });

    expect(report.serverAi).toMatchObject({
      opsSmokeEventCount: 4,
      nonOpsEntrySourceEventCount: 4,
      opsEntrypointSmokeEventCount: 0,
      realEntrySourceEventCount: 4,
      topEntrySource: 'ops_ai_smoke',
    });
    expect(report.productEntrypointCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entrySource: 'native',
        hasMessage: true,
        hasServerResponse: true,
      }),
    ]));
    expect(report.actionItems).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ area: 'ai_real_usage_traffic' }),
    ]));
  });

  it('flags product entrypoints that still lack server response coverage', () => {
    const report = buildAIOpsReport({
      generatedAt: '2026-05-14T06:40:00.000Z',
      overview: {
        rangeDays: 7,
        counts: {
          messagesSent: 3,
          responsesReceived: 2,
          serverRequestsStarted: 3,
          serverResponsesCompleted: 2,
          serverRequestErrors: 0,
          serverRecommendedQuestionsServed: 4,
        },
        responseQuality: {
          degradedRate: 0,
          withSourcesRate: 1,
        },
        serverAi: {
          requestsStarted: 3,
          responsesCompleted: 2,
          requestErrors: 0,
          errorRate: 0,
          averageLatencyMs: 2500,
          degradedRate: 0,
          withSourcesRate: 1,
          recommendedQuestionsServed: 4,
          recommendedQuestionsReturned: 12,
          endpointBreakdown: [{ key: 'chat_stream', count: 2 }],
          providerBreakdown: [{ key: 'modal-direct', count: 2 }],
          routeBreakdown: [{ key: 'task:kimi_reason', count: 2 }],
          entrySourceBreakdown: [
            { key: 'home_suggested_question', count: 2 },
            { key: 'knowledge_detail', count: 1 },
          ],
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
            {
              entrySource: 'knowledge_detail',
              label: 'Knowledge detail AI',
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
            {
              entrySource: 'weekly_report',
              label: 'Weekly report AI',
              clickCount: 1,
              prefillCount: 1,
              messageCount: 1,
              serverStartCount: 1,
              serverResponseCount: 0,
              serverErrorCount: 0,
              feedbackCount: 0,
              hasClick: true,
              hasPrefill: true,
              hasMessage: true,
              hasServerStart: true,
              hasServerResponse: false,
              hasFeedback: false,
              totalTrackedEvents: 4,
            },
          ],
        },
      },
    });

    expect(report.status).toBe('attention');
    expect(report.productEntrypointCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entrySource: 'weekly_report',
        hasServerResponse: false,
      }),
    ]));
    expect(report.actionItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        area: 'ai_entrypoint_response_coverage',
        message: 'Product AI entrypoints still missing server response coverage: Weekly report AI.',
      }),
    ]));
    expect(report.nextActions).toEqual(expect.arrayContaining([
      'Replay missing AI entrypoint journeys and verify server response_complete events: Weekly report AI',
    ]));
  });

  it('keeps ops product entrypoint smoke traffic separate from real usage coverage', () => {
    const report = buildAIOpsReport({
      generatedAt: '2026-05-14T06:40:00.000Z',
      overview: {
        rangeDays: 7,
        counts: {
          messagesSent: 0,
          responsesReceived: 0,
          serverRequestsStarted: 7,
          serverResponsesCompleted: 7,
          serverRequestErrors: 0,
          serverRecommendedQuestionsServed: 3,
        },
        responseQuality: {},
        productEntrypointCoverage: [
          {
            entrySource: 'home_suggested_question',
            label: 'Home suggested question',
            clickCount: 0,
            prefillCount: 0,
            messageCount: 0,
            serverStartCount: 0,
            serverResponseCount: 0,
            serverErrorCount: 0,
            feedbackCount: 0,
            hasClick: false,
            hasPrefill: false,
            hasMessage: false,
            hasServerStart: false,
            hasServerResponse: false,
            hasFeedback: false,
            totalTrackedEvents: 0,
          },
        ],
        opsProductEntrypointCoverage: [
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
        serverAi: {
          requestsStarted: 7,
          responsesCompleted: 7,
          requestErrors: 0,
          errorRate: 0,
          averageLatencyMs: 1800,
          degradedRate: 0,
          withSourcesRate: 1,
          recommendedQuestionsServed: 3,
          recommendedQuestionsReturned: 9,
          endpointBreakdown: [{ key: 'ask', count: 10 }],
          providerBreakdown: [{ key: 'system', count: 5 }],
          routeBreakdown: [{ key: 'fallback:minimax_render', count: 5 }],
          entrySourceBreakdown: [
            { key: 'ops_ai_smoke', count: 4 },
            { key: 'home_suggested_question', count: 2 },
            { key: 'weekly_report', count: 2 },
            { key: 'knowledge_detail', count: 2 },
            { key: 'knowledge_recent_ai', count: 2 },
            { key: 'native', count: 2 },
          ],
          opsEntrypointSmokeEventCount: 10,
        },
      },
    });

    expect(report.status).toBe('attention');
    expect(report.serverAi).toMatchObject({
      opsSmokeEventCount: 4,
      nonOpsEntrySourceEventCount: 10,
      opsEntrypointSmokeEventCount: 10,
      realEntrySourceEventCount: 0,
    });
    expect(report.opsProductEntrypointCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entrySource: 'home_suggested_question',
        totalTrackedEvents: 5,
      }),
    ]));
    expect(report.actionItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        area: 'ai_real_usage_traffic',
        message: 'Only ops AI smoke answer traffic was captured in the last 7 day(s); missing product entrypoints: Home suggested question.',
      }),
    ]));
  });
});
