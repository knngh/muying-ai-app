import { NextFunction, Request, Response } from 'express';
import { successResponse } from '../middlewares/error.middleware';
import { getAnalyticsFunnel, recordAnalyticsEvent } from '../services/analytics.service';

export async function createAnalyticsEvent(req: Request, res: Response, next: NextFunction) {
  try {
    await recordAnalyticsEvent({
      eventName: req.body.eventName,
      source: req.body.source,
      userId: req.userId,
      page: req.body.page,
      clientId: req.body.clientId,
      sessionId: req.body.sessionId,
      properties: req.body.properties,
    });

    res.status(201).json(successResponse({ accepted: true }, '事件记录成功'));
  } catch (error) {
    next(error);
  }
}

export async function getAnalyticsFunnelController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getAnalyticsFunnel(req.query.rangeDays as unknown as number);
    res.json(successResponse(data));
  } catch (error) {
    next(error);
  }
}
