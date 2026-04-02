import { Router } from 'express';
import { getVaccines, getVaccineById } from '../controllers/vaccine.controller';
import { queryRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.get('/', queryRateLimiter, getVaccines);
router.get('/:id', queryRateLimiter, getVaccineById);

export default router;
