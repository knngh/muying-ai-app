import { Router } from 'express';
import { getVaccines, getVaccineById } from '../controllers/vaccine.controller';

const router = Router();

router.get('/', getVaccines);
router.get('/:id', getVaccineById);

export default router;