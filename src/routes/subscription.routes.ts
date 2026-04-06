import { Router } from 'express';
import { getPlans, getStatus, checkFeature } from '../controllers/subscription.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { checkFeatureBody } from '../schemas/subscription.schema';
import { subscriptionContextMiddleware } from '../middlewares/subscription.middleware';

const router = Router();

router.get('/plans', queryRateLimiter, getPlans);

router.use(authMiddleware, subscriptionContextMiddleware);

router.get('/status', queryRateLimiter, getStatus);
router.post('/check-feature', writeRateLimiter, validate({ body: checkFeatureBody }), checkFeature);

export default router;
