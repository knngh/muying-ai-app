import { Router } from 'express';
import { getTags, getArticlesByTag } from '../controllers/tag.controller';
import { queryRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.get('/', queryRateLimiter, getTags);
router.get('/:slug/articles', queryRateLimiter, getArticlesByTag);

export default router;