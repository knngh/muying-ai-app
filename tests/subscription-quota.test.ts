const mockSubscriptionFindFirst = jest.fn();
const mockExecuteRaw = jest.fn();
const mockQueryRaw = jest.fn();
const mockUserDailyQuotaUpdate = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDelete = jest.fn();

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    subscription: {
      findFirst: mockSubscriptionFindFirst,
    },
    userDailyQuota: {
      update: mockUserDailyQuotaUpdate,
    },
    $executeRaw: mockExecuteRaw,
    $queryRaw: mockQueryRaw,
  },
}));

jest.mock('../src/services/cache.service', () => ({
  cache: {
    get: mockCacheGet,
    set: mockCacheSet,
    delete: mockCacheDelete,
  },
}));

import { consumeAiQuota, getTodayQuota } from '../src/services/subscription.service';

describe('subscription.service 配额单元测试', () => {
  beforeEach(() => {
    mockSubscriptionFindFirst.mockReset();
    mockExecuteRaw.mockReset();
    mockQueryRaw.mockReset();
    mockUserDailyQuotaUpdate.mockReset();
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
    mockCacheDelete.mockReset();
  });

  it('免费用户额度已用尽时，不应再执行 update', async () => {
    mockCacheGet.mockReturnValue(null);
    mockSubscriptionFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockQueryRaw.mockResolvedValue([
      {
        id: 1n,
        userId: 1n,
        quotaDate: new Date('2026-04-06T00:00:00.000Z'),
        aiUsed: 3,
        aiLimit: 3,
      },
    ]);

    const result = await consumeAiQuota('1');

    expect(result).toMatchObject({
      allowed: false,
      quota: {
        aiUsedToday: 3,
        aiLimit: 3,
        remainingToday: 0,
        isUnlimited: false,
      },
    });
    expect(mockUserDailyQuotaUpdate).not.toHaveBeenCalled();
  });

  it('免费用户有剩余额度时，应递增 aiUsed 并返回剩余次数', async () => {
    mockCacheGet.mockReturnValue(null);
    mockSubscriptionFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockQueryRaw.mockResolvedValue([
      {
        id: 2n,
        userId: 2n,
        quotaDate: new Date('2026-04-06T00:00:00.000Z'),
        aiUsed: 1,
        aiLimit: 3,
      },
    ]);
    mockUserDailyQuotaUpdate.mockResolvedValue({
      id: 2n,
      quotaDate: new Date('2026-04-06T00:00:00.000Z'),
      aiUsed: 2,
      aiLimit: 3,
    });

    const result = await consumeAiQuota('2');

    expect(mockUserDailyQuotaUpdate).toHaveBeenCalledWith({
      where: { id: 2n },
      data: {
        aiUsed: {
          increment: 1,
        },
      },
    });
    expect(result).toMatchObject({
      allowed: true,
      quota: {
        aiUsedToday: 2,
        aiLimit: 3,
        remainingToday: 1,
        isUnlimited: false,
      },
    });
  });

  it('会员用户今日额度应视为无限，并允许继续消费', async () => {
    mockCacheGet.mockReturnValue({
      status: 'active',
      subscription: {
        id: 3n,
        expireAt: new Date('2026-05-01T00:00:00.000Z'),
        planId: 1n,
        planCode: 'monthly',
        plan: {
          id: '1',
          code: 'monthly',
          name: '连续包月',
          price: 19.9,
          durationDays: 30,
          monthlyPriceLabel: '¥19.9 / 月',
          description: 'test',
          features: ['ai_unlimited'],
        },
      },
    });
    mockQueryRaw.mockResolvedValue([
      {
        id: 3n,
        userId: 3n,
        quotaDate: new Date('2026-04-06T00:00:00.000Z'),
        aiUsed: 9,
        aiLimit: 9999,
      },
    ]);
    mockUserDailyQuotaUpdate.mockResolvedValue({
      id: 3n,
      quotaDate: new Date('2026-04-06T00:00:00.000Z'),
      aiUsed: 10,
      aiLimit: 9999,
    });

    const quota = await getTodayQuota('3');
    const result = await consumeAiQuota('3');

    expect(quota).toMatchObject({
      aiUsedToday: 9,
      aiLimit: 9999,
      remainingToday: 9999,
      isUnlimited: true,
    });
    expect(result).toMatchObject({
      allowed: true,
      quota: {
        aiUsedToday: 10,
        aiLimit: 9999,
        remainingToday: 9999,
        isUnlimited: true,
      },
    });
  });

  it('同一 clientRequestId 的重复请求不应重复扣减额度', async () => {
    let cachedDedupResult: Awaited<ReturnType<typeof consumeAiQuota>> | null = null;

    mockCacheGet.mockImplementation((key: string) => {
      if (key.startsWith('quota:dedup:')) {
        return cachedDedupResult;
      }
      return null;
    });
    mockCacheSet.mockImplementation((key: string, value: Awaited<ReturnType<typeof consumeAiQuota>>) => {
      if (key.startsWith('quota:dedup:')) {
        cachedDedupResult = value;
      }
    });
    mockSubscriptionFindFirst.mockResolvedValueOnce(null);
    mockQueryRaw.mockResolvedValue([
      {
        id: 4n,
        userId: 4n,
        quotaDate: new Date('2026-04-06T00:00:00.000Z'),
        aiUsed: 1,
        aiLimit: 3,
      },
    ]);
    mockUserDailyQuotaUpdate.mockResolvedValue({
      id: 4n,
      quotaDate: new Date('2026-04-06T00:00:00.000Z'),
      aiUsed: 2,
      aiLimit: 3,
    });

    const first = await consumeAiQuota('4', {
      requestId: 'req_12345678',
      fingerprint: '{"messages":["hello"]}',
    });
    const second = await consumeAiQuota('4', {
      requestId: 'req_12345678',
      fingerprint: '{"messages":["hello"]}',
    });

    expect(mockUserDailyQuotaUpdate).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});
