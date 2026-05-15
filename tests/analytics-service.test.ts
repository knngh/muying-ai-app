const mockAnalyticsCreate = jest.fn();
const mockAnalyticsGroupBy = jest.fn();
const mockAnalyticsFindMany = jest.fn();

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    analyticsEvent: {
      create: mockAnalyticsCreate,
      groupBy: mockAnalyticsGroupBy,
      findMany: mockAnalyticsFindMany,
    },
  },
}));

import { getAIOverview, getAnalyticsFunnel, recordAnalyticsEvent } from '../src/services/analytics.service';

describe('analytics.service 单元测试', () => {
  beforeEach(() => {
    mockAnalyticsCreate.mockReset();
    mockAnalyticsGroupBy.mockReset();
    mockAnalyticsFindMany.mockReset();
  });

  it('recordAnalyticsEvent 会把 userId 转成 BigInt 并写入 analyticsEvent', async () => {
    await recordAnalyticsEvent({
      eventName: 'app_membership_exposure',
      source: 'app',
      userId: '123',
      page: 'MembershipScreen',
      clientId: 'client-12345678',
      sessionId: 'session-12345678',
      properties: { from: 'unit-test' },
    });

    expect(mockAnalyticsCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 123n,
        eventName: 'app_membership_exposure',
        source: 'app',
        page: 'MembershipScreen',
        clientId: 'client-12345678',
        sessionId: 'session-12345678',
        properties: { from: 'unit-test' },
      }),
    });
  });

  it('getAnalyticsFunnel 会按第一步计算转化率，并补齐缺失步骤', async () => {
    mockAnalyticsGroupBy.mockResolvedValue([
      { eventName: 'mini_program_app_download_click', _count: { _all: 20 } },
      { eventName: 'app_membership_exposure', _count: { _all: 10 } },
      { eventName: 'app_order_created', _count: { _all: 5 } },
    ]);
    mockAnalyticsFindMany.mockResolvedValue([]);

    const result = await getAnalyticsFunnel(7);

    expect(result.rangeDays).toBe(7);
    expect(result.steps).toHaveLength(6);
    expect(result.steps[0]).toMatchObject({
      eventName: 'mini_program_app_download_click',
      count: 20,
      conversionRate: 100,
    });
    expect(result.steps[1]).toMatchObject({
      eventName: 'app_membership_exposure',
      count: 10,
      conversionRate: 50,
    });
    expect(result.steps[2]).toMatchObject({
      eventName: 'app_order_created',
      count: 5,
      conversionRate: 25,
    });
    expect(result.steps[3]).toMatchObject({
      eventName: 'app_payment_success',
      count: 0,
      conversionRate: 0,
    });
  });

  it('当第一步为 0 时，后续步骤转化率应为 null', async () => {
    mockAnalyticsGroupBy.mockResolvedValue([
      { eventName: 'app_payment_success', _count: { _all: 3 } },
    ]);
    mockAnalyticsFindMany.mockResolvedValue([]);

    const result = await getAnalyticsFunnel(7);

    expect(result.steps[0]).toMatchObject({
      eventName: 'mini_program_app_download_click',
      count: 0,
      conversionRate: null,
    });
    expect(result.steps[3]).toMatchObject({
      eventName: 'app_payment_success',
      count: 3,
      conversionRate: null,
    });
  });

  it('getAnalyticsFunnel 会按 userId/clientId/sessionId 生成去重漏斗并统计身份缺失事件', async () => {
    mockAnalyticsGroupBy.mockResolvedValue([
      { eventName: 'mini_program_app_download_click', _count: { _all: 4 } },
      { eventName: 'app_membership_exposure', _count: { _all: 3 } },
      { eventName: 'app_payment_success', _count: { _all: 2 } },
    ]);
    mockAnalyticsFindMany.mockResolvedValue([
      {
        eventName: 'mini_program_app_download_click',
        userId: null,
        clientId: 'client-a',
        sessionId: 'session-a',
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
      },
      {
        eventName: 'mini_program_app_download_click',
        userId: null,
        clientId: 'client-a',
        sessionId: 'session-a-2',
        createdAt: new Date('2026-05-01T00:01:00.000Z'),
      },
      {
        eventName: 'mini_program_app_download_click',
        userId: 42n,
        clientId: 'client-user-42',
        sessionId: 'session-user-42',
        createdAt: new Date('2026-05-01T00:02:00.000Z'),
      },
      {
        eventName: 'mini_program_app_download_click',
        userId: null,
        clientId: null,
        sessionId: null,
        createdAt: new Date('2026-05-01T00:03:00.000Z'),
      },
      {
        eventName: 'app_membership_exposure',
        userId: null,
        clientId: 'client-a',
        sessionId: 'session-a',
        createdAt: new Date('2026-05-01T00:04:00.000Z'),
      },
      {
        eventName: 'app_membership_exposure',
        userId: 42n,
        clientId: 'client-user-42',
        sessionId: 'session-user-42',
        createdAt: new Date('2026-05-01T00:05:00.000Z'),
      },
      {
        eventName: 'app_payment_success',
        userId: 42n,
        clientId: 'client-user-42',
        sessionId: 'session-user-42',
        createdAt: new Date('2026-05-01T00:06:00.000Z'),
      },
      {
        eventName: 'app_payment_success',
        userId: null,
        clientId: null,
        sessionId: 'session-pay',
        createdAt: new Date('2026-05-01T00:07:00.000Z'),
      },
    ]);

    const result = await getAnalyticsFunnel(7);

    expect(mockAnalyticsFindMany).toHaveBeenCalledWith(expect.objectContaining({
      select: {
        eventName: true,
        userId: true,
        clientId: true,
        sessionId: true,
        createdAt: true,
      },
    }));
    expect(result.uniqueIdentityPriority).toEqual(['userId', 'clientId', 'sessionId']);
    expect(result.uniqueSteps[0]).toMatchObject({
      eventName: 'mini_program_app_download_click',
      uniqueCount: 2,
      unidentifiedCount: 1,
      conversionRate: 100,
    });
    expect(result.uniqueSteps[1]).toMatchObject({
      eventName: 'app_membership_exposure',
      uniqueCount: 2,
      unidentifiedCount: 0,
      conversionRate: 100,
    });
    expect(result.uniqueSteps[3]).toMatchObject({
      eventName: 'app_payment_success',
      uniqueCount: 2,
      unidentifiedCount: 0,
      conversionRate: 100,
    });
    expect(result.uniqueSummary).toMatchObject({
      firstStepUniqueCount: 2,
      totalIdentifiedEvents: 7,
      totalUnidentifiedEvents: 1,
      identityCoverageRate: 0.875,
    });
  });

  it('getAIOverview 会汇总回答质量、动作点击和反馈分布', async () => {
    mockAnalyticsFindMany.mockResolvedValue([
      {
        eventName: 'app_chat_message_send',
        page: 'ChatScreen',
        properties: {
          stage: 'pregnant_early',
          entrySource: 'knowledge_detail',
          articleSlug: 'who-feeding-guide',
        },
      },
      {
        eventName: 'app_chat_response_receive',
        page: 'ChatScreen',
        properties: {
          degraded: true,
          sourcesCount: 2,
          sourceReliability: 'mixed',
          route: 'fallback:task-kimi>task-minimax',
          riskLevel: 'yellow',
          entrySource: 'knowledge_detail',
          articleSlug: 'who-feeding-guide',
        },
      },
      { eventName: 'app_chat_add_calendar_click', page: 'ChatScreen', properties: { entrySource: 'knowledge_detail', articleSlug: 'who-feeding-guide' } },
      { eventName: 'app_chat_open_knowledge_click', page: 'ChatScreen', properties: { entrySource: 'knowledge_detail', articleSlug: 'who-feeding-guide' } },
      { eventName: 'app_chat_open_hit_article_click', page: 'ChatScreen', properties: { entrySource: 'knowledge_detail', articleSlug: 'who-feeding-guide' } },
      { eventName: 'app_chat_open_archive_click', page: 'ChatScreen', properties: { entrySource: 'knowledge_detail', articleSlug: 'who-feeding-guide' } },
      {
        eventName: 'app_knowledge_recent_ai_hit_click',
        page: 'KnowledgePage',
        properties: {
          entrySource: 'knowledge_detail',
          articleSlug: 'who-feeding-guide',
          reportId: 'report-knowledge',
          matchReason: 'entry_meta',
        },
      },
      {
        eventName: 'app_knowledge_recent_ai_topic_click',
        page: 'HomePage',
        properties: {
          entrySource: 'knowledge_detail',
          articleSlug: 'who-feeding-guide',
          reportId: 'report-knowledge',
          topic: 'feeding',
          displayName: '喂养与辅食',
        },
      },
      {
        eventName: 'app_knowledge_recent_ai_source_click',
        page: 'KnowledgePage',
        properties: {
          entrySource: 'knowledge_detail',
          articleSlug: 'who-feeding-guide',
          reportId: 'report-knowledge',
          sourceOrg: 'WHO',
          displayName: '世界卫生组织',
        },
      },
      {
        eventName: 'app_knowledge_recent_ai_ask_click',
        page: 'HomePage',
        properties: {
          entrySource: 'knowledge_detail',
          articleSlug: 'who-feeding-guide',
          reportId: 'report-knowledge',
          targetType: 'source',
        },
      },
      {
        eventName: 'app_knowledge_detail_ai_hit_open',
        page: 'KnowledgeDetailPage',
        properties: {
          entrySource: 'knowledge_detail',
          articleSlug: 'who-feeding-guide',
          reportId: 'report-knowledge',
          matchReason: 'source_title',
        },
      },
      { eventName: 'app_weekly_report_ask_ai_click', page: 'WeeklyReportScreen', properties: { entrySource: 'weekly_report', reportId: 'report-1' } },
      { eventName: 'app_knowledge_detail_ask_ai_click', page: 'KnowledgeDetailPage', properties: { entrySource: 'knowledge_detail', articleSlug: 'who-feeding-guide' } },
      { eventName: 'ai_qa_feedback', page: 'ChatScreen', properties: { feedback: 'helpful', entrySource: 'knowledge_detail', articleSlug: 'who-feeding-guide' } },
      { eventName: 'ai_qa_feedback', page: 'WeeklyReportScreen', properties: { feedback: 'not_helpful', reason: 'missing_sources', entrySource: 'weekly_report', reportId: 'report-1' } },
    ]);

    const result = await getAIOverview(7);

    expect(result.counts).toMatchObject({
      messagesSent: 1,
      responsesReceived: 1,
      addCalendarClicks: 1,
      openKnowledgeClicks: 1,
      openHitArticleClicks: 1,
      openArchiveClicks: 1,
      knowledgeRecentAiHitClicks: 1,
      knowledgeRecentAiTopicClicks: 1,
      knowledgeRecentAiSourceClicks: 1,
      knowledgeRecentAiAskClicks: 1,
      knowledgeDetailAiHitOpens: 1,
      weeklyReportAskAiClicks: 1,
      knowledgeDetailAskAiClicks: 1,
      feedbackTotal: 2,
    });
    expect(result.productEntrypointCoverage).toEqual([
      {
        entrySource: 'knowledge_detail',
        label: 'Knowledge detail AI',
        clickCount: 1,
        prefillCount: 0,
        messageCount: 1,
        serverStartCount: 0,
        serverResponseCount: 0,
        serverErrorCount: 0,
        feedbackCount: 1,
        hasClick: true,
        hasPrefill: false,
        hasMessage: true,
        hasServerStart: false,
        hasServerResponse: false,
        hasFeedback: true,
        totalTrackedEvents: 3,
      },
      {
        entrySource: 'weekly_report',
        label: 'Weekly report AI',
        clickCount: 1,
        prefillCount: 0,
        messageCount: 0,
        serverStartCount: 0,
        serverResponseCount: 0,
        serverErrorCount: 0,
        feedbackCount: 1,
        hasClick: true,
        hasPrefill: false,
        hasMessage: false,
        hasServerStart: false,
        hasServerResponse: false,
        hasFeedback: true,
        totalTrackedEvents: 2,
      },
      {
        entrySource: 'knowledge_recent_ai',
        label: 'Knowledge recent AI',
        clickCount: 1,
        prefillCount: 0,
        messageCount: 0,
        serverStartCount: 0,
        serverResponseCount: 0,
        serverErrorCount: 0,
        feedbackCount: 0,
        hasClick: true,
        hasPrefill: false,
        hasMessage: false,
        hasServerStart: false,
        hasServerResponse: false,
        hasFeedback: false,
        totalTrackedEvents: 1,
      },
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
        entrySource: 'native',
        label: 'Native chat',
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
    ]);
    expect(result.responseQuality).toMatchObject({
      degradedCount: 1,
      degradedRate: 1,
      withSourcesCount: 1,
      withSourcesRate: 1,
      averageSourcesCount: 2,
    });
    expect(result.sourceReliability).toEqual([{ key: 'mixed', count: 1 }]);
    expect(result.entrySourceBreakdown).toEqual([
      { key: 'knowledge_detail', count: 7 },
      { key: 'weekly_report', count: 1 },
    ]);
    expect(result.articleSlugBreakdown).toEqual([{ key: 'who-feeding-guide', count: 7 }]);
    expect(result.reportIdBreakdown).toEqual([{ key: 'report-1', count: 1 }]);
    expect(result.feedbackBreakdown).toEqual([
      { key: 'helpful', count: 1 },
      { key: 'not_helpful', count: 1 },
    ]);
    expect(result.feedbackReasonBreakdown).toEqual([{ key: 'missing_sources', count: 1 }]);
    expect(result.recentAiJourney).toEqual({
      askTargetBreakdown: [{ key: 'source', count: 1 }],
      hitMatchReasonBreakdown: [{ key: 'entry_meta', count: 1 }],
      detailOpenMatchReasonBreakdown: [{ key: 'source_title', count: 1 }],
      topicBreakdown: [{ key: '喂养与辅食', count: 1 }],
      sourceBreakdown: [{ key: '世界卫生组织', count: 1 }],
      pageBreakdown: [
        { key: 'HomePage', count: 2 },
        { key: 'KnowledgePage', count: 2 },
        { key: 'KnowledgeDetailPage', count: 1 },
      ],
      entrySourceBreakdown: [{ key: 'knowledge_detail', count: 5 }],
      articleSlugBreakdown: [{ key: 'who-feeding-guide', count: 5 }],
      reportIdBreakdown: [{ key: 'report-knowledge', count: 5 }],
    });
  });

  it('getAIOverview 会汇总服务端 AI 请求埋点', async () => {
    mockAnalyticsFindMany.mockResolvedValue([
      {
        eventName: 'server_ai_request_start',
        page: 'api/ai/ask',
        properties: {
          endpoint: 'ask',
          questionLength: 12,
          hasConversationId: false,
          entrySource: 'home_suggested_question',
        },
      },
      {
        eventName: 'server_ai_response_complete',
        page: 'api/ai/ask',
        properties: {
          endpoint: 'ask',
          durationMs: 1500,
          provider: 'modal-direct',
          model: 'zai-org/GLM-5.1-FP8',
          route: 'task:glm_classify',
          riskLevel: 'yellow',
          sourceReliability: 'authoritative',
          degraded: false,
          isEmergency: false,
          sourcesCount: 3,
          entrySource: 'home_suggested_question',
        },
      },
      {
        eventName: 'server_ai_request_error',
        page: 'api/ai/chat',
        properties: {
          endpoint: 'chat',
          durationMs: 300,
          errorCode: 'AI_TIMEOUT',
          statusCode: 504,
          entrySource: 'knowledge_detail',
        },
      },
      {
        eventName: 'server_ai_knowledge_recommendations_served',
        page: 'api/ai/knowledge/recommended-questions',
        properties: {
          stage: 'newborn',
          source: 'knowledge_ops_report',
          requestedLimit: 3,
          returnedCount: 3,
        },
      },
    ]);

    const result = await getAIOverview(7);

    expect(mockAnalyticsFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        eventName: {
          in: expect.arrayContaining([
            'server_ai_request_start',
            'server_ai_response_complete',
            'server_ai_request_error',
            'server_ai_knowledge_recommendations_served',
          ]),
        },
      }),
    }));
    expect(result.counts).toMatchObject({
      serverRequestsStarted: 1,
      serverResponsesCompleted: 1,
      serverRequestErrors: 1,
      serverRecommendedQuestionsServed: 1,
    });
    expect(result.serverAi).toMatchObject({
      requestsStarted: 1,
      responsesCompleted: 1,
      requestErrors: 1,
      errorRate: 1,
      averageLatencyMs: 1500,
      degradedCount: 0,
      emergencyCount: 0,
      withSourcesCount: 1,
      withSourcesRate: 1,
      averageSourcesCount: 3,
      recommendedQuestionsServed: 1,
      recommendedQuestionsReturned: 3,
    });
    expect(result.serverAi.providerBreakdown).toEqual([{ key: 'modal-direct', count: 1 }]);
    expect(result.serverAi.routeBreakdown).toEqual([{ key: 'task:glm_classify', count: 1 }]);
    expect(result.serverAi.errorCodeBreakdown).toEqual([{ key: 'AI_TIMEOUT', count: 1 }]);
    expect(result.serverAi.recommendedStageBreakdown).toEqual([{ key: 'newborn', count: 1 }]);
    expect(result.productEntrypointCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entrySource: 'home_suggested_question',
        serverStartCount: 1,
        serverResponseCount: 1,
        serverErrorCount: 0,
        hasServerStart: true,
        hasServerResponse: true,
      }),
      expect.objectContaining({
        entrySource: 'knowledge_detail',
        serverStartCount: 0,
        serverResponseCount: 0,
        serverErrorCount: 1,
        hasServerStart: false,
        hasServerResponse: false,
      }),
    ]));
  });

  it('getAIOverview 会把 ops 产品入口演练流量从真实入口覆盖中隔离', async () => {
    mockAnalyticsFindMany.mockResolvedValue([
      {
        eventName: 'app_home_suggested_question_click',
        page: 'HomeScreen',
        properties: {
          entrySource: 'home_suggested_question',
          stage: 'newborn',
          trafficKind: 'ops_product_entrypoint_smoke',
          reportId: 'ops-ai-entrypoint-smoke-home',
        },
      },
      {
        eventName: 'app_chat_prefill_entry',
        page: 'ChatScreen',
        properties: {
          source: 'home_suggested_question',
          entrySource: 'home_suggested_question',
          trafficKind: 'ops_product_entrypoint_smoke',
          reportId: 'ops-ai-entrypoint-smoke-home',
        },
      },
      {
        eventName: 'app_chat_message_send',
        page: 'ChatScreen',
        properties: {
          source: 'home_suggested_question',
          entrySource: 'home_suggested_question',
          trafficKind: 'ops_product_entrypoint_smoke',
          reportId: 'ops-ai-entrypoint-smoke-home',
        },
      },
      {
        eventName: 'server_ai_request_start',
        page: 'api/ai/ask',
        properties: {
          endpoint: 'ask',
          entrySource: 'home_suggested_question',
          reportId: 'ops-ai-entrypoint-smoke-home',
          clientRequestId: 'ops-ai-entrypoint-smoke-home-1',
        },
      },
      {
        eventName: 'server_ai_response_complete',
        page: 'api/ai/ask',
        properties: {
          endpoint: 'ask',
          entrySource: 'home_suggested_question',
          reportId: 'ops-ai-entrypoint-smoke-home',
          clientRequestId: 'ops-ai-entrypoint-smoke-home-1',
          durationMs: 1200,
          provider: 'system',
          model: 'rule-based',
          route: 'fallback:minimax_render',
          sourceReliability: 'authoritative',
          riskLevel: 'green',
          degraded: false,
          sourcesCount: 2,
        },
      },
    ]);

    const result = await getAIOverview(7);

    expect(result.productEntrypointCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entrySource: 'home_suggested_question',
        clickCount: 0,
        prefillCount: 0,
        messageCount: 0,
        serverStartCount: 0,
        serverResponseCount: 0,
        totalTrackedEvents: 0,
      }),
    ]));
    expect(result.opsProductEntrypointCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entrySource: 'home_suggested_question',
        clickCount: 1,
        prefillCount: 1,
        messageCount: 1,
        serverStartCount: 1,
        serverResponseCount: 1,
        serverErrorCount: 0,
        totalTrackedEvents: 5,
      }),
    ]));
    expect(result.serverAi).toMatchObject({
      opsEntrypointSmokeEventCount: 2,
    });
    expect(result.counts).toMatchObject({
      messagesSent: 0,
      responsesReceived: 0,
    });
    expect(result.entrySourceBreakdown).toEqual([]);
    expect(result.reportIdBreakdown).toEqual([]);
  });
});
