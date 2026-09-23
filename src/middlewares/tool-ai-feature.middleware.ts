import type { RequestHandler } from 'express';
import { ErrorCodes } from './error.middleware';

/** Server-side kill switch: always checked before quota or provider calls. */
export function requireToolAIFeature(flag: 'NAME_EVALUATION_AI_ENABLED' | 'TOOL_AI_REVIEW_ENABLED' | 'EXPENSE_CANDIDATES_AI_ENABLED'): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (process.env[flag] !== 'true') {
      res.status(503).json({ code: ErrorCodes.THIRD_PARTY_ERROR, message: '这项 AI 功能暂未开放，可继续使用本机工具' });
      return;
    }
    next();
  };
}
