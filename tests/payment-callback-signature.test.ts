const mockPaymentFindUnique = jest.fn();
const mockTransaction = jest.fn();
const mockQueryRaw = jest.fn();
const mockExecuteRaw = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDelete = jest.fn();
const mockRecordServerAnalyticsEvent = jest.fn();

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    paymentOrder: {
      findUnique: mockPaymentFindUnique,
      findUniqueOrThrow: mockPaymentFindUnique,
    },
    subscription: {
      findFirst: jest.fn(),
    },
    userDailyQuota: {
      update: jest.fn(),
    },
    $transaction: mockTransaction,
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
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
import {
  buildPaymentCallbackSignaturePayload,
  signPaymentCallbackPayload,
  verifyPaymentCallbackSignature,
} from '../src/services/payment-callback.service';
import { confirmWechatPaymentCallback } from '../src/services/subscription.service';

describe('payment callback signature 单元测试', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      WECHAT_PAYMENT_CALLBACK_SECRET: 'wechat-secret',
      PAYMENT_CALLBACK_MAX_SKEW_SECONDS: '300',
    };
    mockPaymentFindUnique.mockReset();
    mockTransaction.mockReset();
    mockQueryRaw.mockReset();
    mockExecuteRaw.mockReset();
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
    mockCacheDelete.mockReset();
    mockRecordServerAnalyticsEvent.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('应能基于约定串生成并验证回调签名', () => {
    const timestamp = String(Date.now());
    const payload = {
      orderNo: 'SUB202604060001',
      tradeNo: 'WX-123',
      amount: 19.9,
      paymentStatus: 'success' as const,
    };

    const raw = buildPaymentCallbackSignaturePayload('wechat', timestamp, payload);
    expect(raw).toContain('provider=wechat');
    expect(raw).toContain('orderNo=SUB202604060001');

    const signature = signPaymentCallbackPayload('wechat', timestamp, payload, 'wechat-secret');
    const result = verifyPaymentCallbackSignature({
      provider: 'wechat',
      timestamp,
      signature,
      payload,
    });

    expect(result).toEqual({ verified: true });
  });

  it('错误签名应被拒绝', () => {
    const result = verifyPaymentCallbackSignature({
      provider: 'wechat',
      timestamp: String(Date.now()),
      signature: 'invalid-signature',
      payload: {
        orderNo: 'SUB202604060001',
        paymentStatus: 'success',
      },
    });

    expect(result).toMatchObject({
      verified: false,
      code: 'invalid',
    });
  });

  it('真实回调确认时应校验支付渠道和金额', async () => {
    mockPaymentFindUnique.mockResolvedValue({
      id: 1n,
      userId: 1n,
      planId: 1n,
      orderNo: 'SUB202604060001',
      tradeNo: null,
      payChannel: 'alipay',
      status: 'pending',
      paidAt: null,
      amount: { toNumber: () => 29.9 },
      createdAt: new Date('2026-04-06T00:00:00.000Z'),
      plan: {
        code: 'monthly',
        name: '连续包月',
        durationDays: 30,
      },
    });

    await expect(confirmWechatPaymentCallback('SUB202604060001', 'WX-123', 19.9)).rejects.toMatchObject<AppError>({
      code: ErrorCodes.PARAM_ERROR,
      statusCode: 400,
      message: '支付渠道不匹配',
    });

    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
