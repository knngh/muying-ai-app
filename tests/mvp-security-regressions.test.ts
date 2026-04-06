const mockFindUnique = jest.fn();
const mockTransaction = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDelete = jest.fn();
const mockRecordServerAnalyticsEvent = jest.fn();

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    paymentOrder: {
      findUnique: mockFindUnique,
    },
    $transaction: mockTransaction,
  },
}));

jest.mock('../src/services/cache.service', () => ({
  cache: {
    get: mockCacheGet,
    set: mockCacheSet,
    delete: mockCacheDelete,
  },
}));

jest.mock('../src/services/analytics.service', () => ({
  recordServerAnalyticsEvent: mockRecordServerAnalyticsEvent,
}));

import { AppError, ErrorCodes } from '../src/middlewares/error.middleware';
import { paymentCallbackAccessMiddleware } from '../src/middlewares/payment-callback.middleware';
import { createAnalyticsEventBody } from '../src/schemas/analytics.schema';
import { confirmWechatPayment, getPaymentOrder } from '../src/services/subscription.service';

describe('MVP 安全回归测试', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockTransaction.mockReset();
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
    mockCacheDelete.mockReset();
    mockRecordServerAnalyticsEvent.mockReset();
  });

  it('禁止读取其他用户的订单', async () => {
    mockFindUnique.mockResolvedValue({
      id: 1n,
      userId: 999n,
      orderNo: 'SUB202604060001',
      amount: { toNumber: () => 19.9 },
      payChannel: 'wechat',
      status: 'pending',
      createdAt: new Date('2026-04-06T00:00:00.000Z'),
      paidAt: null,
      plan: {
        code: 'monthly',
        name: '连续包月',
      },
    });

    await expect(getPaymentOrder('123', 'SUB202604060001')).rejects.toMatchObject<AppError>({
      code: ErrorCodes.NO_PERMISSION,
      statusCode: 403,
      message: '无权查看该订单',
    });
  });

  it('禁止确认其他用户的订单', async () => {
    mockFindUnique.mockResolvedValue({
      id: 1n,
      userId: 999n,
      orderNo: 'SUB202604060001',
      tradeNo: null,
      status: 'pending',
      planId: 1n,
      paidAt: null,
      amount: { toNumber: () => 19.9 },
      payChannel: 'wechat',
      createdAt: new Date('2026-04-06T00:00:00.000Z'),
      plan: {
        code: 'monthly',
        name: '连续包月',
        durationDays: 30,
      },
    });

    await expect(confirmWechatPayment('123', 'SUB202604060001')).rejects.toMatchObject<AppError>({
      code: ErrorCodes.NO_PERMISSION,
      statusCode: 403,
      message: '无权操作该订单',
    });

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockRecordServerAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('公共 analytics 写入不允许伪造 server 来源', () => {
    expect(() =>
      createAnalyticsEventBody.parse({
        eventName: 'app_membership_exposure',
        source: 'server',
        page: 'MembershipScreen',
      }),
    ).toThrow();
  });

  it('支付回调默认不允许通过普通 Bearer Token 回退认证', () => {
    const middleware = paymentCallbackAccessMiddleware('wechat');
    const next = jest.fn();

    middleware({
      body: {
        orderNo: 'SUB202604060001',
        paymentStatus: 'success',
      },
      headers: {
        authorization: 'Bearer fake-token',
      },
      header(name: string) {
        return undefined;
      },
    } as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining<AppError>({
      code: ErrorCodes.NO_PERMISSION,
      statusCode: 401,
      message: '支付回调签名缺失',
    }));
  });
});
