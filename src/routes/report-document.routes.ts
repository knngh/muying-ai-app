import { Router } from 'express';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { uploadReportDocument } from '../middlewares/report-upload.middleware';
import { reportParams, reportFieldParams, reportListQuery, reportFieldBody, confirmReportFieldBody } from '../schemas/report-document.schema';
import { getReportDocuments, createReportDocument, addReportField, confirmReportField, downloadReportDocument, deleteReportDocument } from '../controllers/report-document.controller';

// Mounted under tool-records, after authMiddleware.
const router = Router();
router.get('/', queryRateLimiter, validate({ query: reportListQuery }), getReportDocuments);
router.post('/', writeRateLimiter, uploadReportDocument, createReportDocument);
router.get('/:id/file', queryRateLimiter, validate({ params: reportParams }), downloadReportDocument);
router.delete('/:id', writeRateLimiter, validate({ params: reportParams }), deleteReportDocument);
router.post('/:id/fields', writeRateLimiter, validate({ params: reportParams, body: reportFieldBody }), addReportField);
router.post('/:id/fields/:fieldId/confirm', writeRateLimiter, validate({ params: reportFieldParams, body: confirmReportFieldBody }), confirmReportField);
export default router;
