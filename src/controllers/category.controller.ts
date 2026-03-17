import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';
import { cache, CacheKeys, CacheTTL } from '../services/cache.service';

const prisma = new PrismaClient();

/**
 * 获取分类列表（带缓存）
 * - 分类变化频率低，缓存30分钟
 */
export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { level, parentId, isActive } = req.query;

    // 如果是获取所有启用的分类（无筛选条件），使用缓存
    const shouldCache = !level && !parentId && isActive === undefined;
    
    if (shouldCache) {
      const cached = cache.get<any>(CacheKeys.CATEGORIES_ALL);
      if (cached) {
        console.log('[Cache] Hit: categories:all');
        return res.json(cached);
      }
    }

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

    const response = successResponse({ list: categories });

    // 缓存结果
    if (shouldCache) {
      cache.set(CacheKeys.CATEGORIES_ALL, response, CacheTTL.LONG);
      console.log('[Cache] Set: categories:all');
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 获取分类详情（带缓存）
 */
export const getCategoryBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    // 尝试从缓存获取
    const cacheKey = CacheKeys.CATEGORY_DETAIL(slug);
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      console.log(`[Cache] Hit: ${cacheKey}`);
      return res.json(cached);
    }

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

    const response = successResponse(category);
    
    // 缓存结果
    cache.set(cacheKey, response, CacheTTL.LONG);
    console.log(`[Cache] Set: ${cacheKey}`);

    res.json(response);
  } catch (error) {
    next(error);
  }
};