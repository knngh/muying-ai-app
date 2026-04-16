import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { writeRateLimiter, queryRateLimiter } from '../middlewares/rateLimiter.middleware';
import { checkin, getStatus, getPointsLogs, redeemPoints } from '../controllers/checkin.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', writeRateLimiter, checkin);
router.get('/status', queryRateLimiter, getStatus);
router.get('/points-log', queryRateLimiter, getPointsLogs);
router.post('/redeem', writeRateLimiter, redeemPoints);

export default router;
