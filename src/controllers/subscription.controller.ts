import { NextFunction, Request, Response } from 'express';
import { successResponse } from '../middlewares/error.middleware';
import { checkFeatureAvailability, getMembershipStatus, getSubscriptionPlans } from '../services/subscription.service';

export async function getPlans(_req: Request, res: Response, next: NextFunction) {
  try {
    const plans = await getSubscriptionPlans();
    res.json(successResponse({ list: plans }));
  } catch (error) {
    next(error);
  }
}

export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await getMembershipStatus(req.userId!);
    res.json(successResponse(status));
  } catch (error) {
    next(error);
  }
}

export async function checkFeature(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await checkFeatureAvailability(req.userId!, req.body.feature);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
}
