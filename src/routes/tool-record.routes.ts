import { Router } from 'express';
import fs from 'fs';
import { ZodError } from 'zod';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AppError, ErrorCodes } from '../middlewares/error.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createBabyMeasurement, createCareLog, createContraction, createDiaryEntry, createExpenseEntry,
  createFoodTrial, createMovement, createVaccinationRecord, createWeight, getBabyMeasurements,
  getCareLogs, getContractions, getDiaryEntries, getExpenseEntries, getFoodTrials, getMovements,
  getPackingItems, getReportDocuments, getVaccinationRecords, getWeights, upsertPackingItem,
  addReportField, confirmReportField, createReportDocument, downloadReportDocument,
} from '../controllers/tool-record.controller';
import {
  babyMeasurementBody, careLogBody, contractionRecordBody, diaryEntryBody, expenseEntryBody,
  foodTrialBody, movementRecordBody, packingItemBody, pregnancyWeightRecordBody,
  reportDocumentBody, reportFieldBody, confirmReportFieldBody, toolRecordsQuery, vaccinationRecordBody,
} from '../schemas/tool-record.schema';
import { privateUploadImage } from '../middlewares/upload.middleware';

const uploadReportDocument = (req: Parameters<typeof privateUploadImage>[0], res: Parameters<typeof privateUploadImage>[1], next: Parameters<typeof privateUploadImage>[2]) => {
  privateUploadImage(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }

    try {
      req.body = reportDocumentBody.parse(req.body);
      next();
    } catch (error) {
      if (req.file?.path) void fs.promises.unlink(req.file.path).catch(() => undefined);
      if (error instanceof ZodError) {
        const messages = error.errors.map(item => `${item.path.join('.') || 'body'}: ${item.message}`);
        next(new AppError(messages.join('; '), ErrorCodes.PARAM_ERROR, 400));
        return;
      }
      next(error);
    }
  });
};

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
router.get('/reports', queryRateLimiter, validate({ query: toolRecordsQuery }), getReportDocuments);
router.post('/reports', writeRateLimiter, uploadReportDocument, createReportDocument);
router.get('/reports/:id/file', queryRateLimiter, downloadReportDocument);
router.post('/reports/:id/fields', writeRateLimiter, validate({ body: reportFieldBody }), addReportField);
router.post('/reports/:id/fields/:fieldId/confirm', writeRateLimiter, validate({ body: confirmReportFieldBody }), confirmReportField);

export default router;
