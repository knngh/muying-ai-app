import { ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from './error.middleware';

/**
 * 统一输入校验中间件
 * 支持对 body / query / params 分别校验
 */
export function validate(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query) as Request['query'];
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params) as Request['params'];
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map(e => {
          const path = e.path.join('.');
          return path ? `${path}: ${e.message}` : e.message;
        });
        next(new AppError(messages.join('; '), ErrorCodes.PARAM_ERROR, 400));
      } else {
        next(err);
      }
    }
  };
}
