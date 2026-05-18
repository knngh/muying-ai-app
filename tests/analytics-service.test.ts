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

import {
  getAIOverview,
  getAcquisitionOverview,
  getActivationOverview,
  getAnalyticsFunnel,
  getRetentionOverview,
  recordAnalyticsEvent,
} from '../src/services/analytics.service';

describe('analytics.service 单元测试', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockAnalyticsCreate.mockReset();
    mockAnalyticsGroupBy.mockReset();
    mockAnalyticsFindMany.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it('getActivationOverview 会按生命周期资料就绪 + AI 提问或知识查看统计首日激活', async () => {
    mockAnalyticsFindMany.mockResolvedValue([
      {
        eventName: 'server_lifecycle_profile_ready',
        userId: 1n,
        clientId: null,
        sessionId: null,
        source: 'server',
        page: 'auth/profile',
        properties: { lifecycleStage: 'pregnant' },
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
      },
      {
        eventName: 'app_chat_message_send',
        userId: 1n,
        clientId: 'client-user-1',
        sessionId: 'session-user-1',
        source: 'app',
        page: 'ChatScreen',
        properties: { entrySource: 'home_suggested_question' },
        createdAt: new Date('2026-05-01T00:05:00.000Z'),
      },
      {
        eventName: 'server_lifecycle_profile_ready',
        userId: 2n,
        clientId: null,
        sessionId: null,
        source: 'server',
        page: 'auth/profile',
        properties: { lifecycleStage: 'postpartum' },
        createdAt: new Date('2026-05-01T00:10:00.000Z'),
      },
      {
        eventName: 'app_knowledge_detail_open',
        userId: 3n,
        clientId: 'client-user-3',
        sessionId: 'session-user-3',
        source: 'app',
        page: 'KnowledgeDetailScreen',
        properties: { articleSlug: 'feeding-guide' },
        createdAt: new Date('2026-05-01T00:15:00.000Z'),
      },
      {
        eventName: 'server_lifecycle_profile_ready',
        userId: null,
        clientId: null,
        sessionId: null,
        source: 'server',
        page: 'auth/profile',
        properties: {},
        createdAt: new Date('2026-05-01T00:20:00.000Z'),
      },
    ]);

    const result = await getActivationOverview(7);

    expect(mockAnalyticsFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        eventName: {
          in: expect.arrayContaining([
            'server_lifecycle_profile_ready',
            'app_chat_message_send',
            'app_knowledge_detail_open',
          ]),
        },
      }),
      select: {
        eventName: true,
        userId: true,
        clientId: true,
        sessionId: true,
        source: true,
        page: true,
        properties: true,
        createdAt: true,
      },
    }));
    expect(result.counts).toMatchObject({
      profileReadyUniqueCount: 2,
      aiQuestionUniqueCount: 1,
      knowledgeOpenUniqueCount: 1,
      valueActionUniqueCount: 2,
      activatedUniqueCount: 1,
      profileToActivationRate: 0.5,
      totalIdentifiedEvents: 4,
      totalUnidentifiedEvents: 1,
      identityCoverageRate: 0.8,
    });
    expect(result.breakdown.valueActionByEvent).toEqual([
      { key: 'app_chat_message_send', count: 1 },
      { key: 'app_knowledge_detail_open', count: 1 },
    ]);
  });

  it('getRetentionOverview 会按首个活跃日计算 D1/D7 留存并隔离 ops 演练流量', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
    mockAnalyticsFindMany.mockResolvedValue([
      {
        eventName: 'app_home_v1_exposure',
        userId: 1n,
        clientId: 'client-user-1',
        sessionId: 'session-user-1',
        source: 'app',
        page: 'HomeScreen',
        properties: {},
        createdAt: new Date('2026-05-01T00:10:00.000Z'),
      },
      {
        eventName: 'app_chat_message_send',
        userId: 1n,
        clientId: 'client-user-1',
        sessionId: 'session-user-1',
        source: 'app',
        page: 'ChatScreen',
        properties: { entrySource: 'home_suggested_question' },
        createdAt: new Date('2026-05-02T00:10:00.000Z'),
      },
      {
        eventName: 'app_knowledge_detail_share',
        userId: 1n,
        clientId: 'client-user-1',
        sessionId: 'session-user-1',
        source: 'app',
        page: 'KnowledgeDetailScreen',
        properties: { articleSlug: 'feeding-guide', channel: 'native_share' },
        createdAt: new Date('2026-05-02T00:20:00.000Z'),
      },
      {
        eventName: 'server_article_favorite',
        userId: 1n,
        clientId: null,
        sessionId: null,
        source: 'server',
        page: 'articles/favorite',
        properties: { articleId: '100' },
        createdAt: new Date('2026-05-02T00:30:00.000Z'),
      },
      {
        eventName: 'app_knowledge_detail_open',
        userId: 1n,
        clientId: 'client-user-1',
        sessionId: 'session-user-1',
        source: 'app',
        page: 'KnowledgeDetailScreen',
        properties: { articleSlug: 'feeding-guide' },
        createdAt: new Date('2026-05-08T00:10:00.000Z'),
      },
      {
        eventName: 'server_lifecycle_profile_ready',
        userId: 2n,
        clientId: null,
        sessionId: null,
        source: 'server',
        page: 'auth/profile',
        properties: { lifecycleStage: 'pregnant' },
        createdAt: new Date('2026-05-01T01:10:00.000Z'),
      },
      {
        eventName: 'app_home_v1_exposure',
        userId: null,
        clientId: 'client-3',
        sessionId: 'session-3',
        source: 'app',
        page: 'HomeScreen',
        properties: {},
        createdAt: new Date('2026-05-02T02:10:00.000Z'),
      },
      {
        eventName: 'app_home_checkin_click',
        userId: null,
        clientId: 'client-3',
        sessionId: 'session-3',
        source: 'app',
        page: 'HomeScreen',
        properties: {},
        createdAt: new Date('2026-05-03T02:10:00.000Z'),
      },
      {
        eventName: 'server_community_post_create',
        userId: null,
        clientId: 'client-3',
        sessionId: 'session-3',
        source: 'server',
        page: 'community/posts',
        properties: { postId: '200' },
        createdAt: new Date('2026-05-03T02:20:00.000Z'),
      },
      {
        eventName: 'server_community_comment_create',
        userId: null,
        clientId: 'client-3',
        sessionId: 'session-3',
        source: 'server',
        page: 'community/comments',
        properties: { postId: '200', commentId: '300' },
        createdAt: new Date('2026-05-03T02:30:00.000Z'),
      },
      {
        eventName: 'app_home_v1_exposure',
        userId: null,
        clientId: null,
        sessionId: null,
        source: 'app',
        page: 'HomeScreen',
        properties: {},
        createdAt: new Date('2026-05-01T03:10:00.000Z'),
      },
      {
        eventName: 'app_chat_message_send',
        userId: 99n,
        clientId: 'ops-client',
        sessionId: 'ops-session',
        source: 'app',
        page: 'ChatScreen',
        properties: {
          entrySource: 'home_suggested_question',
          trafficKind: 'ops_product_entrypoint_smoke',
        },
        createdAt: new Date('2026-05-01T04:10:00.000Z'),
      },
    ]);

    const result = await getRetentionOverview(30);

    expect(mockAnalyticsFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        eventName: {
          in: expect.arrayContaining([
            'app_home_v1_exposure',
            'app_chat_message_send',
            'app_knowledge_detail_open',
            'app_knowledge_detail_share',
            'server_lifecycle_profile_ready',
            'server_article_favorite',
            'server_community_post_create',
            'server_community_comment_create',
          ]),
        },
      }),
      select: {
        eventName: true,
        userId: true,
        clientId: true,
        sessionId: true,
        source: true,
        page: true,
        properties: true,
        createdAt: true,
      },
    }));
    expect(result.retentionDefinition).toMatchObject({
      identityPriority: ['userId', 'clientId', 'sessionId'],
      dayBoundary: 'UTC',
      returnWindows: [1, 7],
    });
    expect(result.summary).toMatchObject({
      cohortUserCount: 3,
      d1EligibleCohortUserCount: 3,
      d1RetainedUserCount: 2,
      d1RetentionRate: 0.6667,
      d7EligibleCohortUserCount: 3,
      d7RetainedUserCount: 1,
      d7RetentionRate: 0.3333,
      totalIdentifiedEvents: 10,
      totalUnidentifiedEvents: 1,
      identityCoverageRate: 0.9091,
      ignoredOpsEventCount: 1,
      retentionBehaviorEventCount: 4,
    });
    expect(result.breakdown.retentionBehaviorByEvent).toEqual(expect.arrayContaining([
      { key: 'app_knowledge_detail_share', count: 1 },
      { key: 'server_article_favorite', count: 1 },
      { key: 'server_community_post_create', count: 1 },
      { key: 'server_community_comment_create', count: 1 },
    ]));
    expect(result.cohorts).toEqual([
      {
        date: '2026-05-01',
        cohortUserCount: 2,
        d1Eligible: true,
        d1RetainedUserCount: 1,
        d1RetentionRate: 0.5,
        d7Eligible: true,
        d7RetainedUserCount: 1,
        d7RetentionRate: 0.5,
      },
      {
        date: '2026-05-02',
        cohortUserCount: 1,
        d1Eligible: true,
        d1RetainedUserCount: 1,
        d1RetentionRate: 1,
        d7Eligible: true,
        d7RetainedUserCount: 0,
        d7RetentionRate: 0,
      },
    ]);
  });

  it('getAcquisitionOverview 会按渠道、活动、场景和入口汇总获客到激活/付费信号', async () => {
    mockAnalyticsFindMany.mockResolvedValue([
      {
        eventName: 'mini_program_app_download_click',
        userId: null,
        clientId: 'client-xhs-1',
        sessionId: 'session-xhs-1',
        source: 'mini_program',
        page: 'KnowledgeDetailPage',
        properties: {
          channel: 'xiaohongshu',
          campaign: 'newborn-fever',
          scene: 'knowledge_detail_download_card',
          entrySource: 'knowledge_detail',
        },
        createdAt: new Date('2026-05-10T00:00:00.000Z'),
      },
      {
        eventName: 'server_lifecycle_profile_ready',
        userId: null,
        clientId: 'client-xhs-1',
        sessionId: 'session-xhs-1',
        source: 'server',
        page: 'auth/profile',
        properties: {
          channel: 'xiaohongshu',
          campaign: 'newborn-fever',
          lifecycleStage: 'postpartum',
        },
        createdAt: new Date('2026-05-10T00:05:00.000Z'),
      },
      {
        eventName: 'app_chat_message_send',
        userId: null,
        clientId: 'client-xhs-1',
        sessionId: 'session-xhs-1',
        source: 'app',
        page: 'ChatScreen',
        properties: {
          channel: 'xiaohongshu',
          campaign: 'newborn-fever',
          entrySource: 'home_suggested_question',
        },
        createdAt: new Date('2026-05-10T00:10:00.000Z'),
      },
      {
        eventName: 'app_order_created',
        userId: null,
        clientId: 'client-xhs-1',
        sessionId: 'session-xhs-1',
        source: 'server',
        page: 'MembershipScreen',
        properties: {
          channel: 'xiaohongshu',
          campaign: 'newborn-fever',
          planCode: 'quarterly',
        },
        createdAt: new Date('2026-05-10T00:20:00.000Z'),
      },
      {
        eventName: 'app_payment_success',
        userId: null,
        clientId: 'client-xhs-1',
        sessionId: 'session-xhs-1',
        source: 'server',
        page: 'MembershipScreen',
        properties: {
          channel: 'xiaohongshu',
          campaign: 'newborn-fever',
          amount: 49.9,
        },
        createdAt: new Date('2026-05-10T00:25:00.000Z'),
      },
      {
        eventName: 'mini_program_app_download_click',
        userId: null,
        clientId: 'client-community-1',
        sessionId: 'session-community-1',
        source: 'mini_program',
        page: 'CommunityPage',
        properties: {
          channel: 'wechat_private',
          campaign: 'seed-group',
          scene: 'community_download_card',
        },
        createdAt: new Date('2026-05-11T00:00:00.000Z'),
      },
      {
        eventName: 'app_knowledge_detail_open',
        userId: null,
        clientId: 'client-community-1',
        sessionId: 'session-community-1',
        source: 'app',
        page: 'KnowledgeDetailScreen',
        properties: {
          channel: 'wechat_private',
          campaign: 'seed-group',
          articleSlug: 'feeding-guide',
        },
        createdAt: new Date('2026-05-11T00:03:00.000Z'),
      },
      {
        eventName: 'mini_program_app_download_click',
        userId: null,
        clientId: null,
        sessionId: null,
        source: 'mini_program',
        page: 'KnowledgeDetailPage',
        properties: {
          channel: 'douyin',
          campaign: 'fever-video',
          scene: 'knowledge_detail_download_card',
        },
        createdAt: new Date('2026-05-11T00:04:00.000Z'),
      },
      {
        eventName: 'app_chat_message_send',
        userId: 99n,
        clientId: 'ops-client',
        sessionId: 'ops-session',
        source: 'app',
        page: 'ChatScreen',
        properties: {
          channel: 'ops',
          campaign: 'smoke',
          trafficKind: 'ops_product_entrypoint_smoke',
        },
        createdAt: new Date('2026-05-11T00:05:00.000Z'),
      },
    ]);

    const result = await getAcquisitionOverview(7);

    expect(mockAnalyticsFindMany).toHaveBeenCalledWith(expect.objectContaining({
      select: {
        eventName: true,
        userId: true,
        clientId: true,
        sessionId: true,
        source: true,
        page: true,
        properties: true,
        createdAt: true,
      },
    }));
    expect(result.acquisitionDefinition).toMatchObject({
      acquisitionEvent: 'mini_program_app_download_click',
      activationEvents: ['server_lifecycle_profile_ready', 'app_chat_message_send', 'app_knowledge_detail_open'],
      paymentEvents: ['app_order_created', 'app_payment_success'],
      ignoredTrafficKinds: ['ops_product_entrypoint_smoke'],
    });
    expect(result.summary).toMatchObject({
      acquisitionEventCount: 3,
      acquisitionUniqueCount: 2,
      activatedUniqueCount: 2,
      orderCreatedUniqueCount: 1,
      paymentSuccessUniqueCount: 1,
      unidentifiedEventCount: 1,
      ignoredOpsEventCount: 1,
      acquisitionToActivationRate: 1,
      acquisitionToPaymentRate: 0.5,
      identityCoverageRate: 0.875,
    });
    expect(result.breakdown.byChannel).toEqual([
      {
        key: 'xiaohongshu',
        eventCount: 5,
        acquisitionEventCount: 1,
        acquisitionUniqueCount: 1,
        activatedUniqueCount: 1,
        orderCreatedUniqueCount: 1,
        paymentSuccessUniqueCount: 1,
        acquisitionToActivationRate: 1,
        acquisitionToPaymentRate: 1,
      },
      {
        key: 'wechat_private',
        eventCount: 2,
        acquisitionEventCount: 1,
        acquisitionUniqueCount: 1,
        activatedUniqueCount: 1,
        orderCreatedUniqueCount: 0,
        paymentSuccessUniqueCount: 0,
        acquisitionToActivationRate: 1,
        acquisitionToPaymentRate: 0,
      },
      {
        key: 'douyin',
        eventCount: 1,
        acquisitionEventCount: 1,
        acquisitionUniqueCount: 0,
        activatedUniqueCount: 0,
        orderCreatedUniqueCount: 0,
        paymentSuccessUniqueCount: 0,
        acquisitionToActivationRate: null,
        acquisitionToPaymentRate: null,
      },
    ]);
    expect(result.breakdown.byCampaign).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'newborn-fever',
        acquisitionUniqueCount: 1,
        activatedUniqueCount: 1,
        paymentSuccessUniqueCount: 1,
      }),
      expect.objectContaining({
        key: 'seed-group',
        acquisitionUniqueCount: 1,
        activatedUniqueCount: 1,
      }),
    ]));
    expect(result.breakdown.byScene).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'knowledge_detail_download_card',
        acquisitionEventCount: 2,
        acquisitionUniqueCount: 1,
      }),
      expect.objectContaining({
        key: 'community_download_card',
        acquisitionEventCount: 1,
        acquisitionUniqueCount: 1,
      }),
    ]));
    expect(result.topAcquisitionSegments[0]).toMatchObject({
      channel: 'xiaohongshu',
      campaign: 'newborn-fever',
      scene: 'knowledge_detail_download_card',
      acquisitionUniqueCount: 1,
      activatedUniqueCount: 1,
      paymentSuccessUniqueCount: 1,
    });
  });

  it('getAcquisitionOverview 会优先使用 acquisition 归因字段，避免事件自有 channel 污染获客渠道', async () => {
    mockAnalyticsFindMany.mockResolvedValue([
      {
        eventName: 'mini_program_app_download_click',
        userId: null,
        clientId: 'client-share-1',
        sessionId: 'session-share-1',
        source: 'mini_program',
        page: 'KnowledgeDetailPage',
        properties: {
          channel: 'share_app_message',
          acquisitionChannel: 'xiaohongshu',
          campaign: 'newborn-fever',
          acquisitionCampaign: 'p7-newborn-fever',
          scene: 'share_panel',
          acquisitionScene: 'knowledge_detail_download_card',
          entrySource: 'knowledge_share',
          acquisitionEntrySource: 'knowledge_detail',
        },
        createdAt: new Date('2026-05-12T00:00:00.000Z'),
      },
      {
        eventName: 'app_knowledge_detail_open',
        userId: null,
        clientId: 'client-share-1',
        sessionId: 'session-share-1',
        source: 'app',
        page: 'KnowledgeDetailScreen',
        properties: {
          channel: 'native_share',
          acquisitionChannel: 'xiaohongshu',
          acquisitionCampaign: 'p7-newborn-fever',
          acquisitionScene: 'knowledge_detail_download_card',
          entrySource: 'knowledge_detail',
          acquisitionEntrySource: 'knowledge_detail',
        },
        createdAt: new Date('2026-05-12T00:05:00.000Z'),
      },
    ]);

    const result = await getAcquisitionOverview(7);

    expect(result.breakdown.byChannel).toEqual([
      expect.objectContaining({
        key: 'xiaohongshu',
        eventCount: 2,
        acquisitionEventCount: 1,
        activatedUniqueCount: 1,
      }),
    ]);
    expect(result.breakdown.byCampaign).toEqual([
      expect.objectContaining({
        key: 'p7-newborn-fever',
        acquisitionUniqueCount: 1,
        activatedUniqueCount: 1,
      }),
    ]);
    expect(result.breakdown.byScene).toEqual([
      expect.objectContaining({
        key: 'knowledge_detail_download_card',
        acquisitionEventCount: 1,
      }),
    ]);
    expect(result.breakdown.byEntrySource).toEqual([
      expect.objectContaining({
        key: 'knowledge_detail',
        acquisitionUniqueCount: 1,
        activatedUniqueCount: 1,
      }),
    ]);
    expect(result.topAcquisitionSegments[0]).toMatchObject({
      channel: 'xiaohongshu',
      campaign: 'p7-newborn-fever',
      scene: 'knowledge_detail_download_card',
      entrySource: 'knowledge_detail',
      activatedUniqueCount: 1,
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
