import { z } from 'zod';

export const createOrderBody = z.object({
  planCode: z.enum(['monthly', 'quarterly', 'yearly']),
  payChannel: z.enum(['wechat', 'alipay']).default('wechat'),
});

export const paymentCallbackBody = z.object({
  orderNo: z.string().min(1, '订单号不能为空').max(64, '订单号过长'),
  tradeNo: z.string().max(128, '交易号过长').optional(),
  amount: z.number().positive('支付金额必须大于 0').optional(),
  paymentStatus: z.enum(['success']).default('success'),
});

export const paymentOrderParam = z.object({
  orderNo: z.string().min(1, '订单号不能为空').max(64, '订单号过长'),
});
