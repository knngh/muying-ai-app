import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { aiRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { quotaCheckMiddleware } from '../middlewares/quota.middleware';
import { requireToolAIFeature } from '../middlewares/tool-ai-feature.middleware';
import { successResponse } from '../middlewares/error.middleware';
import { toolAIReviewBody } from '../schemas/tool-ai-review.schema';
import { generateToolAIReview } from '../services/tool-ai-review.service';

const router = Router();
// Independent of record storage tables: this release requires no schema migration.
router.post('/ai-review', authMiddleware, aiRateLimiter, validate({ body: toolAIReviewBody }),
  requireToolAIFeature('TOOL_AI_REVIEW_ENABLED'), quotaCheckMiddleware, async (req, res, next) => {
    try { res.json(successResponse(await generateToolAIReview(req.body))); }
    catch (error) { next(error); }
  });
export default router;
