import { NextFunction, Request, Response } from 'express';
import { successResponse } from '../middlewares/error.middleware';
import {
  confirmAlipayPaymentCallback,
  confirmAlipayPayment,
  confirmWechatPaymentCallback,
  confirmWechatPayment,
  createPaymentOrder,
  getPaymentOrder,
} from '../services/subscription.service';

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await createPaymentOrder(req.userId!, req.body.planCode, req.body.payChannel);
    res.status(201).json(successResponse(order, '订单创建成功'));
  } catch (error) {
    next(error);
  }
}

export async function wechatCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const result = req.paymentCallbackAuth?.mode === 'signature'
      ? await confirmWechatPaymentCallback(req.body.orderNo, req.body.tradeNo, req.body.amount)
      : await confirmWechatPayment(req.userId!, req.body.orderNo, req.body.tradeNo);
    res.json(successResponse(result, '微信支付回调处理成功'));
  } catch (error) {
    next(error);
  }
}

export async function alipayCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const result = req.paymentCallbackAuth?.mode === 'signature'
      ? await confirmAlipayPaymentCallback(req.body.orderNo, req.body.tradeNo, req.body.amount)
      : await confirmAlipayPayment(req.userId!, req.body.orderNo, req.body.tradeNo);
    res.json(successResponse(result, '支付宝支付回调处理成功'));
  } catch (error) {
    next(error);
  }
}

export async function getOrderByOrderNo(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await getPaymentOrder(req.userId!, req.params.orderNo);
    res.json(successResponse(order));
  } catch (error) {
    next(error);
  }
}
