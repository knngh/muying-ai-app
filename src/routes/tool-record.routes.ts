import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createBabyMeasurement, createCareLog, createContraction, createDiaryEntry, createExpenseEntry,
  createFoodTrial, createMovement, createVaccinationRecord, createWeight, getBabyMeasurements,
  getCareLogs, getContractions, getDiaryEntries, getExpenseEntries, getFoodTrials, getMovements,
  getPackingItems, getVaccinationRecords, getWeights, upsertPackingItem,
} from '../controllers/tool-record.controller';
import {
  babyMeasurementBody, careLogBody, contractionRecordBody, diaryEntryBody, expenseEntryBody,
  foodTrialBody, movementRecordBody, packingItemBody, pregnancyWeightRecordBody,
  toolRecordsQuery, vaccinationRecordBody,
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
router.get('/care', queryRateLimiter, validate({ query: toolRecordsQuery }), getCareLogs);
router.post('/care', writeRateLimiter, validate({ body: careLogBody }), createCareLog);
router.get('/growth', queryRateLimiter, validate({ query: toolRecordsQuery }), getBabyMeasurements);
router.post('/growth', writeRateLimiter, validate({ body: babyMeasurementBody }), createBabyMeasurement);
router.get('/vaccinations', queryRateLimiter, validate({ query: toolRecordsQuery }), getVaccinationRecords);
router.post('/vaccinations', writeRateLimiter, validate({ body: vaccinationRecordBody }), createVaccinationRecord);
router.get('/foods', queryRateLimiter, validate({ query: toolRecordsQuery }), getFoodTrials);
router.post('/foods', writeRateLimiter, validate({ body: foodTrialBody }), createFoodTrial);
router.get('/packing', queryRateLimiter, getPackingItems);
router.post('/packing', writeRateLimiter, validate({ body: packingItemBody }), upsertPackingItem);

export default router;
