import { Router } from 'express';
import { createNameEvaluation, getNames } from '../controllers/name-library.controller';
import { aiRateLimiter, queryRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { evaluateNamesBody, getNamesQuery } from '../schemas/name-library.schema';
import { authMiddleware } from '../middlewares/auth.middleware';
import { quotaCheckMiddleware } from '../middlewares/quota.middleware';
import { requireToolAIFeature } from '../middlewares/tool-ai-feature.middleware';

const router = Router();

router.get('/', queryRateLimiter, validate({ query: getNamesQuery }), getNames);
router.post('/evaluate', authMiddleware, aiRateLimiter, validate({ body: evaluateNamesBody }),
  requireToolAIFeature('NAME_EVALUATION_AI_ENABLED'), quotaCheckMiddleware, createNameEvaluation);

export default router;
