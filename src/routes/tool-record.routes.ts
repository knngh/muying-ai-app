import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createContraction, createDiaryEntry, createExpenseEntry, createMovement, createWeight,
  getContractions, getDiaryEntries, getExpenseEntries, getMovements, getWeights,
} from '../controllers/tool-record.controller';
import {
  contractionRecordBody, diaryEntryBody, expenseEntryBody, movementRecordBody,
  pregnancyWeightRecordBody, toolRecordsQuery,
} from '../schemas/tool-record.schema';

const router = Router();
router.use(authMiddleware);

router.get('/contractions', queryRateLimiter, validate({ query: toolRecordsQuery }), getContractions);
router.post('/contractions', writeRateLimiter, validate({ body: contractionRecordBody }), createContraction);
router.get('/movements', queryRateLimiter, validate({ query: toolRecordsQuery }), getMovements);
router.post('/movements', writeRateLimiter, validate({ body: movementRecordBody }), createMovement);
router.get('/weights', queryRateLimiter, validate({ query: toolRecordsQuery }), getWeights);
router.post('/weights', writeRateLimiter, validate({ body: pregnancyWeightRecordBody }), createWeight);
router.get('/diary', queryRateLimiter, validate({ query: toolRecordsQuery }), getDiaryEntries);
router.post('/diary', writeRateLimiter, validate({ body: diaryEntryBody }), createDiaryEntry);
router.get('/expenses', queryRateLimiter, validate({ query: toolRecordsQuery }), getExpenseEntries);
router.post('/expenses', writeRateLimiter, validate({ body: expenseEntryBody }), createExpenseEntry);

export default router;
