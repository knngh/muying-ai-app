import { Router } from 'express';
import { getCategories, getCategoryBySlug } from '../controllers/category.controller';
import { queryRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.get('/', queryRateLimiter, getCategories);
router.get('/:slug', queryRateLimiter, getCategoryBySlug);

export default router;
