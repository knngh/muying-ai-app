import { Router } from 'express';
import { getCategories, getCategoryBySlug } from '../controllers/category.controller';
import { queryRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { getCategoriesQuery } from '../schemas/category.schema';
import { slugParam } from '../schemas/common.schema';

const router = Router();

router.get('/', queryRateLimiter, validate({ query: getCategoriesQuery }), getCategories);
router.get('/:slug', queryRateLimiter, validate({ params: slugParam }), getCategoryBySlug);

export default router;
