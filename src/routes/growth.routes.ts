import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { growthProfileBody, growthRecordBody, growthRecordsQuery } from '../schemas/growth.schema';
import { getProfile, upsertProfile, getRecords, createRecord } from '../controllers/growth.controller';

const router = Router();

router.use(authMiddleware);

router.get('/profile', queryRateLimiter, getProfile);
router.post('/profile', writeRateLimiter, validate({ body: growthProfileBody }), upsertProfile);
router.get('/records', queryRateLimiter, validate({ query: growthRecordsQuery }), getRecords);
router.post('/records', writeRateLimiter, validate({ body: growthRecordBody }), createRecord);

export default router;
