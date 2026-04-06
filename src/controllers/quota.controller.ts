import { NextFunction, Request, Response } from 'express';
import { successResponse } from '../middlewares/error.middleware';
import { getTodayQuota } from '../services/subscription.service';

export async function getTodayQuotaController(req: Request, res: Response, next: NextFunction) {
  try {
    const quota = await getTodayQuota(req.userId!);
    res.json(successResponse(quota));
  } catch (error) {
    next(error);
  }
}
