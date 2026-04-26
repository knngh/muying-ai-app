import { Router } from 'express';
import { getVaccines, getVaccineById } from '../controllers/vaccine.controller';
import { queryRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParam } from '../schemas/common.schema';
import { getVaccinesQuery } from '../schemas/vaccine.schema';

const router = Router();

router.get('/', queryRateLimiter, validate({ query: getVaccinesQuery }), getVaccines);
router.get('/:id', queryRateLimiter, validate({ params: idParam }), getVaccineById);

export default router;
