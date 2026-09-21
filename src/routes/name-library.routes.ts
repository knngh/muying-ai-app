import { Router } from 'express';
import { getNames } from '../controllers/name-library.controller';
import { queryRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { getNamesQuery } from '../schemas/name-library.schema';

const router = Router();

router.get('/', queryRateLimiter, validate({ query: getNamesQuery }), getNames);

export default router;
