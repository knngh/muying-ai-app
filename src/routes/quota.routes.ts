import { Router } from 'express';
import { getTodayQuotaController } from '../controllers/quota.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { queryRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.use(authMiddleware);
router.get('/today', queryRateLimiter, getTodayQuotaController);

export default router;
