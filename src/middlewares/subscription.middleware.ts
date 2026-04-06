import { NextFunction, Request, Response } from 'express';
import { getMembershipStatus, type MembershipFeatureCode } from '../services/subscription.service';

declare global {
  namespace Express {
    interface Request {
      subscription?: Awaited<ReturnType<typeof getMembershipStatus>>;
    }
  }
}

export async function subscriptionContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return next();
    }

    req.subscription = await getMembershipStatus(req.userId);
    return next();
  } catch (error) {
    return next(error);
  }
}

export function featureGate(feature: MembershipFeatureCode) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          code: 2005,
          message: '未授权，请先登录',
        });
      }

      const subscription = req.subscription || await getMembershipStatus(req.userId);
      req.subscription = subscription;

      const allowed = subscription.isVip && (subscription.plan?.features || []).includes(feature);
      if (!allowed) {
        return res.status(403).json({
          code: 4002,
          message: '该功能仅会员可用',
          data: {
            feature,
            upgradeUrl: '/membership',
          },
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
