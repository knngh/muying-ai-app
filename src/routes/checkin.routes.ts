import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { writeRateLimiter, queryRateLimiter } from '../middlewares/rateLimiter.middleware';
import { checkin, getStatus, getPointsLogs, redeemPoints } from '../controllers/checkin.controller';
import { validate } from '../middlewares/validate.middleware';
import { pointsLogQuery, redeemPointsBody } from '../schemas/checkin.schema';

const router = Router();

router.use(authMiddleware);

router.post('/', writeRateLimiter, checkin);
router.get('/status', queryRateLimiter, getStatus);
router.get('/points-log', queryRateLimiter, validate({ query: pointsLogQuery }), getPointsLogs);
router.post('/redeem', writeRateLimiter, validate({ body: redeemPointsBody }), redeemPoints);

export default router;
