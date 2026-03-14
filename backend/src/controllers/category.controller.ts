import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';

const prisma = new PrismaClient();

// 获取分类列表
export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { level, parentId, isActive } = req.query;

    const where: any = {};
    
    if (level) {
      where.level = parseInt(level as string);
    }
    
    if (parentId) {
      where.parentId = parentId === 'null' ? null : BigInt(parentId as string);
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true' ? 1 : 0;
    } else {
      where.isActive = 1; // 默认只返回启用的分类
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { id: 'asc' }
      ],
      include: {
        children: {
          where: { isActive: 1 },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    res.json(successResponse({ list: categories }));
  } catch (error) {
    next(error);
  }
};

// 获取分类详情
export const getCategoryBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: {
          where: { isActive: 1 },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!category) {
      throw new AppError('分类不存在', ErrorCodes.CATEGORY_NOT_FOUND, 404);
    }

    res.json(successResponse(category));
  } catch (error) {
    next(error);
  }
};