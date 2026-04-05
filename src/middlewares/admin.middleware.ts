import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError, ErrorCodes } from './error.middleware';

const ADMIN_USERNAMES = new Set(['admin']);

export const adminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) {
      throw new AppError('未授权，请先登录', ErrorCodes.TOKEN_INVALID, 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(req.userId) },
      select: { id: true, username: true, status: true },
    });

    if (!user || user.status !== 1 || !ADMIN_USERNAMES.has(user.username)) {
      throw new AppError('无权访问管理功能', ErrorCodes.NO_PERMISSION, 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};
