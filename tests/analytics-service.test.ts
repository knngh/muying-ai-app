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
});
