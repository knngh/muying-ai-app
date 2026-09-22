import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { successResponse } from '../middlewares/error.middleware';
import { createWechatReminderBody, wechatReminderClientIdParam } from '../schemas/wechat-reminder.schema';
import { cancelWechatReminder, enqueueWechatReminder } from '../services/wechat-reminder.service';

const router = Router();
router.use(authMiddleware);

router.post('/reminders', writeRateLimiter, validate({ body: createWechatReminderBody }), async (req, res, next) => {
  try {
    res.json(successResponse(await enqueueWechatReminder(req.userId!, req.body), '微信提醒已加入发送队列'));
  } catch (error) {
    next(error);
  }
});

router.delete('/reminders/:clientReminderId', writeRateLimiter, validate({ params: wechatReminderClientIdParam }), async (req, res, next) => {
  try {
    res.json(successResponse(await cancelWechatReminder(req.userId!, req.params.clientReminderId), '微信提醒已取消'));
  } catch (error) {
    next(error);
  }
});

export default router;
