import crypto from 'crypto';
import { env } from '../config/env';

export type PaymentProvider = 'wechat' | 'alipay';

export interface PaymentCallbackPayload {
  orderNo: string;
  tradeNo?: string;
  amount?: number;
  paymentStatus: 'success';
}

export function getPaymentCallbackSecret(provider: PaymentProvider): string {
  return provider === 'wechat'
    ? env.WECHAT_PAYMENT_CALLBACK_SECRET
    : env.ALIPAY_PAYMENT_CALLBACK_SECRET;
}

export function buildPaymentCallbackSignaturePayload(
  provider: PaymentProvider,
  timestamp: string,
  payload: PaymentCallbackPayload,
): string {
  return [
    `provider=${provider}`,
    `timestamp=${timestamp}`,
    `orderNo=${payload.orderNo}`,
    `tradeNo=${payload.tradeNo || ''}`,
    `paymentStatus=${payload.paymentStatus}`,
    `amount=${payload.amount ?? ''}`,
  ].join('\n');
}

export function signPaymentCallbackPayload(
  provider: PaymentProvider,
  timestamp: string,
  payload: PaymentCallbackPayload,
  secret?: string,
): string {
  const resolvedSecret = secret ?? getPaymentCallbackSecret(provider);
  return crypto
    .createHmac('sha256', resolvedSecret)
    .update(buildPaymentCallbackSignaturePayload(provider, timestamp, payload))
    .digest('hex');
}

function safeCompareSignature(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(actual, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyPaymentCallbackSignature(input: {
  provider: PaymentProvider;
  timestamp?: string | string[];
  signature?: string | string[];
  payload: PaymentCallbackPayload;
}): { verified: true } | { verified: false; reason: string; code: 'missing' | 'invalid' | 'config' } {
  const timestamp = Array.isArray(input.timestamp) ? input.timestamp[0] : input.timestamp;
  const signature = Array.isArray(input.signature) ? input.signature[0] : input.signature;

  if (!timestamp || !signature) {
    return {
      verified: false,
      reason: '支付回调签名缺失',
      code: 'missing',
    };
  }

  const secret = getPaymentCallbackSecret(input.provider);
  if (!secret) {
    return {
      verified: false,
      reason: '未配置支付回调签名密钥',
      code: 'config',
    };
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) {
    return {
      verified: false,
      reason: '支付回调时间戳无效',
      code: 'invalid',
    };
  }

  const maxSkewMs = env.PAYMENT_CALLBACK_MAX_SKEW_SECONDS * 1000;
  if (Math.abs(Date.now() - timestampMs) > maxSkewMs) {
    return {
      verified: false,
      reason: '支付回调时间戳已过期',
      code: 'invalid',
    };
  }

  const expectedSignature = signPaymentCallbackPayload(
    input.provider,
    String(timestampMs),
    input.payload,
    secret,
  );

  if (!safeCompareSignature(expectedSignature, signature)) {
    return {
      verified: false,
      reason: '支付回调签名无效',
      code: 'invalid',
    };
  }

  return { verified: true };
}
