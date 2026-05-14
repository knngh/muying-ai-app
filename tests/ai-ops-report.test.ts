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
});
