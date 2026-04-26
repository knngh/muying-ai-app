import { Router } from 'express';
import { getTags, getArticlesByTag } from '../controllers/tag.controller';
import { queryRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { paginationQuery, slugParam } from '../schemas/common.schema';

const router = Router();

router.get('/', queryRateLimiter, getTags);
router.get('/:slug/articles', queryRateLimiter, validate({ params: slugParam, query: paginationQuery }), getArticlesByTag);

export default router;
