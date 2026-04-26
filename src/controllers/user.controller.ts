import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { successResponse, paginatedResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';
import { calculatePregnancyWeekFromDueDate } from '../utils/pregnancy';
import { buildPregnancyProfile } from '../utils/pregnancy-profile';

/**
 * 获取用户收藏列表
 */
export const getFavorites = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { type = 'article', page = 1, pageSize = 20 } = req.query;
    const favoriteType = typeof type === 'string' ? type : 'article';

    const skip = (Number(page) - 1) * Number(pageSize);

    const where: Prisma.UserFavoriteWhereInput = {
      userId: BigInt(userId!),
      favType: favoriteType
    };

    const [favorites, total] = await Promise.all([
      prisma.userFavorite.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: {
          article: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverImage: true,
              summary: true,
              viewCount: true,
              likeCount: true,
              publishedAt: true
            }
          }
        }
      }),
      prisma.userFavorite.count({ where })
    ]);

    const list = favorites.map(f => ({
      id: f.id,
      createdAt: f.createdAt,
      article: f.article
    }));

    res.json(paginatedResponse(list, Number(page), Number(pageSize), total));
  } catch (error) {
    next(error);
  }
};

/**
 * 添加收藏
 */
export const addFavorite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { articleId } = req.body;

    if (!articleId) {
      throw new AppError('请提供文章ID', ErrorCodes.PARAM_ERROR, 400);
    }

    // 检查是否已收藏
    const existing = await prisma.userFavorite.findFirst({
      where: { 
        userId: BigInt(userId!), 
        favType: 'article', 
        favId: BigInt(articleId) 
      }
    });

    if (existing) {
      throw new AppError('已收藏该文章', ErrorCodes.PARAM_ERROR, 400);
    }

    // 事务内创建收藏并更新计数
    const favorite = await prisma.$transaction(async (tx) => {
      const record = await tx.userFavorite.create({
        data: {
          userId: BigInt(userId!),
          favType: 'article',
          favId: BigInt(articleId)
        }
      });
      await tx.article.update({
        where: { id: BigInt(articleId) },
        data: { collectCount: { increment: 1 } }
      });
      return record;
    });

    res.json(successResponse(favorite, '收藏成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 取消收藏
 */
export const removeFavorite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { articleId } = req.params;

    const favorite = await prisma.userFavorite.findFirst({
      where: { 
        userId: BigInt(userId!), 
        favType: 'article', 
        favId: BigInt(articleId) 
      }
    });

    if (!favorite) {
      throw new AppError('未收藏该文章', ErrorCodes.PARAM_ERROR, 400);
    }

    // 事务内删除收藏并更新计数，用 Math.max 防止负数
    await prisma.$transaction(async (tx) => {
      await tx.userFavorite.delete({ where: { id: favorite.id } });
      const article = await tx.article.findUnique({
        where: { id: BigInt(articleId) },
        select: { collectCount: true },
      });
      await tx.article.update({
        where: { id: BigInt(articleId) },
        data: { collectCount: Math.max(0, (article?.collectCount ?? 1) - 1) }
      });
    });

    res.json(successResponse(null, '取消收藏成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取阅读历史
 */
export const getReadHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { page = 1, pageSize = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);

    const [history, total] = await Promise.all([
      prisma.userReadHistory.findMany({
        where: { userId: BigInt(userId!) },
        skip,
        take: Number(pageSize),
        orderBy: { updatedAt: 'desc' },
        include: {
          article: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverImage: true,
              summary: true,
              readingTime: true,
              viewCount: true
            }
          }
        }
      }),
      prisma.userReadHistory.count({ where: { userId: BigInt(userId!) } })
    ]);

    const list = history.map(h => ({
      id: h.id,
      readDuration: h.readDuration,
      progress: h.progress,
      updatedAt: h.updatedAt,
      article: h.article
    }));

    res.json(paginatedResponse(list, Number(page), Number(pageSize), total));
  } catch (error) {
    next(error);
  }
};

/**
 * 记录阅读历史
 */
export const recordReadHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { articleId, readDuration, progress } = req.body;

    if (!articleId) {
      throw new AppError('请提供文章ID', ErrorCodes.PARAM_ERROR, 400);
    }

    // 更新或创建阅读记录
    const existing = await prisma.userReadHistory.findUnique({
      where: {
        userId_articleId: {
          userId: BigInt(userId!),
          articleId: BigInt(articleId)
        }
      }
    });

    if (existing) {
      await prisma.userReadHistory.update({
        where: { id: existing.id },
        data: {
          readDuration: (existing.readDuration || 0) + (readDuration || 0),
          progress: progress || existing.progress,
          updatedAt: new Date()
        }
      });
    } else {
      await prisma.userReadHistory.create({
        data: {
          userId: BigInt(userId!),
          articleId: BigInt(articleId),
          readDuration: readDuration || 0,
          progress: progress || 0
        }
      });
    }

    res.json(successResponse(null, '记录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取用户统计数据
 */
export const getUserStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;

    const [favoriteCount, readCount, likeCount] = await Promise.all([
      prisma.userFavorite.count({ where: { userId: BigInt(userId!) } }),
      prisma.userReadHistory.count({ where: { userId: BigInt(userId!) } }),
      prisma.userLike.count({ where: { userId: BigInt(userId!) } })
    ]);

    res.json(successResponse({
      favoriteCount,
      readCount,
      likeCount
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取孕期档案聚合数据
 */
export const getPregnancyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId!) },
      select: {
        pregnancyStatus: true,
        dueDate: true,
        babyBirthday: true,
      },
    });

    if (!user) {
      throw new AppError('用户不存在', ErrorCodes.USER_NOT_FOUND, 404);
    }

    const currentWeek = user.dueDate
      ? calculatePregnancyWeekFromDueDate(user.dueDate)
      : undefined;

    let completedTodoCount = 0;
    let customTodoCount = 0;
    let weeklyDiaryDate: Date | null = null;
    let weeklyDiaryContent: string | null = null;

    if (user.dueDate && currentWeek) {
      const [todoProgressCount, customTodosCount, diary] = await Promise.all([
        prisma.userPregnancyTodoProgress.count({
          where: {
            userId: BigInt(userId!),
            week: currentWeek,
          },
        }),
        prisma.userPregnancyCustomTodo.count({
          where: {
            userId: BigInt(userId!),
            week: currentWeek,
          },
        }),
        prisma.userPregnancyDiary.findUnique({
          where: {
            userId_week: {
              userId: BigInt(userId!),
              week: currentWeek,
            },
          },
        }),
      ]);

      completedTodoCount = todoProgressCount;
      customTodoCount = customTodosCount;
      weeklyDiaryDate = diary?.updatedAt ?? null;
      weeklyDiaryContent = diary?.content ?? null;
    }

    const profile = buildPregnancyProfile(user, {
      completedTodoCount,
      customTodoCount,
      weeklyDiaryDate,
      weeklyDiaryContent,
    });

    res.json(successResponse(profile));
  } catch (error) {
    next(error);
  }
};
