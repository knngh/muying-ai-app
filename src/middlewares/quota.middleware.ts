import { NextFunction, Request, Response } from 'express';
import { consumeAiQuota } from '../services/subscription.service';

declare global {
  namespace Express {
    interface Request {
      quota?: Awaited<ReturnType<typeof consumeAiQuota>>['quota'];
    }
  }
}

function buildQuotaFingerprint(req: Request): string | undefined {
  if (!req.body || typeof req.body !== 'object') {
    return undefined;
  }

  return JSON.stringify({
    path: req.path,
    question: req.body.question,
    messages: req.body.messages,
    context: req.body.context,
    conversationId: req.body.conversationId,
    model: req.body.model,
  });
}

export async function quotaCheckMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return res.status(401).json({
        code: 2005,
        message: '未授权，请先登录',
      });
    }

    const clientRequestId = typeof req.body?.clientRequestId === 'string'
      ? req.body.clientRequestId
      : undefined;
    const result = await consumeAiQuota(req.userId, {
      requestId: clientRequestId,
      fingerprint: buildQuotaFingerprint(req),
    });
    req.quota = result.quota;

    if (!result.allowed) {
      return res.status(429).json({
        code: 4003,
        message: '今日免费额度已用完',
        data: {
          quota: result.quota,
          upgradeUrl: '/membership',
        },
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
