import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, ErrorCodes } from './error.middleware';
import { env } from '../config/env';

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: JwtPayload;
    }
  }
}

export interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

function isValidJwtPayload(payload: unknown): payload is JwtPayload {
  return typeof payload === 'object'
    && payload !== null
    && typeof (payload as { userId?: unknown }).userId === 'string'
    && /^\d+$/.test((payload as { userId: string }).userId);
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('未授权，请先登录', ErrorCodes.TOKEN_INVALID, 401);
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      throw new AppError('Token 无效', ErrorCodes.TOKEN_INVALID, 401);
    }

    const decoded = jwt.verify(
      token,
      env.JWT_SECRET
    );

    if (!isValidJwtPayload(decoded)) {
      throw new AppError('Token 无效', ErrorCodes.TOKEN_INVALID, 401);
    }

    req.userId = decoded.userId;
    next();
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token 已过期', ErrorCodes.TOKEN_EXPIRED, 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Token 无效', ErrorCodes.TOKEN_INVALID, 401));
    } else {
      next(error);
    }
  }
};

// 可选认证中间件（不强制要求登录）
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      if (token) {
        const decoded = jwt.verify(
          token,
          env.JWT_SECRET
        );
        if (isValidJwtPayload(decoded)) {
          req.userId = decoded.userId;
        }
      }
    }
    next();
  } catch (_error) {
    // 可选认证，忽略错误
    next();
  }
};
