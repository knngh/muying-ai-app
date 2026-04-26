import { Request, Response, NextFunction } from 'express';
import {
  performCheckin,
  getCheckinStatus,
  getPointsLogs as getPointsLogsService,
  redeemPoints as redeemPointsService,
} from '../services/checkin.service';
import { ErrorCodes } from '../middlewares/error.middleware';

export async function checkin(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await performCheckin(req.userId!);
    res.json({ code: ErrorCodes.SUCCESS, message: '签到成功', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getCheckinStatus(req.userId!);
    res.json({ code: ErrorCodes.SUCCESS, message: 'ok', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getPointsLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const result = await getPointsLogsService(req.userId!, page, pageSize);
    res.json({ code: ErrorCodes.SUCCESS, message: 'ok', data: result });
  } catch (err) {
    next(err);
  }
}

export async function redeemPoints(req: Request, res: Response, next: NextFunction) {
  try {
    const { points } = req.body;
    if (typeof points !== 'number') {
      return res.status(400).json({ code: ErrorCodes.PARAM_ERROR, message: 'points 必须为数字' });
    }
    const result = await redeemPointsService(req.userId!, points);
    res.json({ code: ErrorCodes.SUCCESS, message: '兑换成功', data: result });
  } catch (err) {
    next(err);
  }
}
