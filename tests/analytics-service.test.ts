const mockAnalyticsCreate = jest.fn();
const mockAnalyticsGroupBy = jest.fn();

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    analyticsEvent: {
      create: mockAnalyticsCreate,
      groupBy: mockAnalyticsGroupBy,
    },
  },
}));

import { getAnalyticsFunnel, recordAnalyticsEvent } from '../src/services/analytics.service';

describe('analytics.service 单元测试', () => {
  beforeEach(() => {
    mockAnalyticsCreate.mockReset();
    mockAnalyticsGroupBy.mockReset();
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
});
