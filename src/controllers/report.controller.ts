import { NextFunction, Request, Response } from 'express';
import { successResponse } from '../middlewares/error.middleware';
import {
  generateWeeklyReport,
  getLatestWeeklyReport,
  getWeeklyReportList,
} from '../services/subscription.service';

export async function getLatestWeeklyReportController(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await getLatestWeeklyReport(req.userId!);
    res.json(successResponse(report));
  } catch (error) {
    next(error);
  }
}

export async function getWeeklyReportListController(req: Request, res: Response, next: NextFunction) {
  try {
    const reports = await getWeeklyReportList(req.userId!);
    res.json(successResponse({ list: reports }));
  } catch (error) {
    next(error);
  }
}

export async function generateWeeklyReportController(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await generateWeeklyReport(req.userId!);
    res.status(201).json(successResponse(report, '周报生成成功'));
  } catch (error) {
    next(error);
  }
}
