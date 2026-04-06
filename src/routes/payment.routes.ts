import { Router } from 'express';
import {
  alipayCallback,
  createOrder,
  getOrderByOrderNo,
  wechatCallback,
} from '../controllers/payment.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { paymentCallbackAccessMiddleware } from '../middlewares/payment-callback.middleware';
import { createOrderBody, paymentCallbackBody, paymentOrderParam } from '../schemas/payment.schema';

const router = Router();

router.post('/create-order', authMiddleware, writeRateLimiter, validate({ body: createOrderBody }), createOrder);
router.post('/callback/wechat', writeRateLimiter, validate({ body: paymentCallbackBody }), paymentCallbackAccessMiddleware('wechat'), wechatCallback);
router.post('/callback/alipay', writeRateLimiter, validate({ body: paymentCallbackBody }), paymentCallbackAccessMiddleware('alipay'), alipayCallback);
router.get('/order/:orderNo', authMiddleware, queryRateLimiter, validate({ params: paymentOrderParam }), getOrderByOrderNo);

export default router;
