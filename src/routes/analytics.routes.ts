import { Router } from 'express';
import {
  createAnalyticsEvent,
  getAIOverviewController,
  getAcquisitionOverviewController,
  getActivationOverviewController,
  getAnalyticsFunnelController,
  getRetentionOverviewController,
} from '../controllers/analytics.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { analyticsFunnelQuery, createAnalyticsEventBody } from '../schemas/analytics.schema';

const router = Router();

router.post('/events', optionalAuthMiddleware, writeRateLimiter, validate({ body: createAnalyticsEventBody }), createAnalyticsEvent);
router.get('/funnel', authMiddleware, adminMiddleware, queryRateLimiter, validate({ query: analyticsFunnelQuery }), getAnalyticsFunnelController);
router.get('/ai-overview', authMiddleware, adminMiddleware, queryRateLimiter, validate({ query: analyticsFunnelQuery }), getAIOverviewController);
router.get('/activation-overview', authMiddleware, adminMiddleware, queryRateLimiter, validate({ query: analyticsFunnelQuery }), getActivationOverviewController);
router.get('/retention-overview', authMiddleware, adminMiddleware, queryRateLimiter, validate({ query: analyticsFunnelQuery }), getRetentionOverviewController);
router.get('/acquisition-overview', authMiddleware, adminMiddleware, queryRateLimiter, validate({ query: analyticsFunnelQuery }), getAcquisitionOverviewController);

export default router;
