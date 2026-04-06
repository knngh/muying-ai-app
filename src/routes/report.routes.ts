import { Router } from 'express';
import {
  generateWeeklyReportController,
  getLatestWeeklyReportController,
  getWeeklyReportListController,
} from '../controllers/report.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { featureGate, subscriptionContextMiddleware } from '../middlewares/subscription.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.use(authMiddleware, subscriptionContextMiddleware, featureGate('weekly_report'));

router.get('/weekly/latest', queryRateLimiter, getLatestWeeklyReportController);
router.get('/weekly/list', queryRateLimiter, getWeeklyReportListController);
router.post('/weekly/generate', writeRateLimiter, generateWeeklyReportController);

export default router;
