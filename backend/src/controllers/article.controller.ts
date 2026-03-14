import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse, paginatedResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';

const prisma = new PrismaClient();

// 获取文章列表
export const getArticles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      category,
      tag,
      stage,
      difficulty,
      contentType,
      sort = 'latest',
      page = 1,
      pageSize = 20
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);

    // 构建查询条件
    const where: any = {
      status: 1, // 只返回已发布的文章
      deletedAt: null
    };

    if (category) {
      where.category = { slug: category };
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (contentType) {
      where.contentType = contentType;
    }

    // 排序
    let orderBy: any = { publishedAt: 'desc' };
    if (sort === 'popular') {
      orderBy = { viewCount: 'desc' };
    } else if (sort === 'recommended') {
      where.isRecommended = 1;
      orderBy = { publishedAt: 'desc' };
    }

    // 查询文章
    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy,
        skip,
        take: Number(pageSize),
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          coverImage: true,
          difficulty: true,
          targetStage: true,
          readingTime: true,
          viewCount: true,
          likeCount: true,
          isRecommended: true,
          isFeatured: true,
          publishedAt: true,
          category: {
            select: { id: true, name: true, slug: true }
          },
          author: {
            select: { id: true, name: true, avatar: true, title: true }
          },
          tags: {
            include: {
              tag: { select: { id: true, name: true, slug: true } }
            }
          }
        }
      }),
      prisma.article.count({ where })
    ]);

    // 格式化返回数据
    const list = articles.map(article => ({
      ...article,
      tags: article.tags.map(t => t.tag)
    }));

    res.json(paginatedResponse(list, Number(page), Number(pageSize), total));
  } catch (error) {
    next(error);
  }
};

// 获取文章详情
export const getArticleBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const userId = req.userId;

    const article = await prisma.article.findUnique({
      where: { slug },
      include: {
        category: {
          include: { parent: true }
        },
        author: true,
        tags: {
          include: { tag: true }
        }
      }
    });

    if (!article || article.status !== 1 || article.deletedAt) {
      throw new AppError('文章不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    // 增加浏览量
    await prisma.article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } }
    });

    // 检查用户是否已点赞/收藏
    let isLiked = false;
    let isFavorited = false;

    if (userId) {
      const [like, favorite] = await Promise.all([
        prisma.userLike.findFirst({
          where: { userId: BigInt(userId), likeType: 'article', likeId: article.id }
        }),
        prisma.userFavorite.findFirst({
          where: { userId: BigInt(userId), favType: 'article', favId: article.id }
        })
      ]);
      isLiked = !!like;
      isFavorited = !!favorite;
    }

    res.json(successResponse({
      ...article,
      tags: article.tags.map(t => t.tag),
      isLiked,
      isFavorited
    }));
  } catch (error) {
    next(error);
  }
};

// 获取相关文章
export const getRelatedArticles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = Number(req.query.limit) || 5;

    const article = await prisma.article.findUnique({
      where: { id: BigInt(id) },
      select: { categoryId: true, tags: true }
    });

    if (!article) {
      throw new AppError('文章不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    // 查找同分类或同标签的文章
    const relatedArticles = await prisma.article.findMany({
      where: {
        AND: [
          { id: { not: BigInt(id) } },
          { status: 1 },
          { deletedAt: null },
          {
            OR: [
              { categoryId: article.categoryId },
              { tags: { some: { tagId: { in: article.tags.map(t => t.tagId) } } } }
            ]
          }
        ]
      },
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        coverImage: true,
        viewCount: true,
        publishedAt: true
      }
    });

    res.json(successResponse({ list: relatedArticles }));
  } catch (error) {
    next(error);
  }
};

// 搜索文章
export const searchArticles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, page = 1, pageSize = 20 } = req.query;

    if (!q || typeof q !== 'string') {
      throw new AppError('请输入搜索关键词', ErrorCodes.PARAM_ERROR, 400);
    }

    const skip = (Number(page) - 1) * Number(pageSize);

    // 记录搜索日志
    await prisma.searchLog.create({
      data: {
        keyword: q,
        userId: req.userId ? BigInt(req.userId) : null,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // 使用全文搜索
    const [articles, total] = await Promise.all([
      prisma.$queryRaw`
        SELECT id, title, slug, summary, cover_image, view_count, published_at
        FROM articles
        WHERE status = 1 
        AND deleted_at IS NULL
        AND MATCH(title, content) AGAINST(${q} IN NATURAL LANGUAGE MODE)
        LIMIT ${Number(pageSize)} OFFSET ${skip}
      `,
      prisma.$queryRaw`
        SELECT COUNT(*) as total
        FROM articles
        WHERE status = 1 
        AND deleted_at IS NULL
        AND MATCH(title, content) AGAINST(${q} IN NATURAL LANGUAGE MODE)
      `
    ]);

    res.json(paginatedResponse(articles, Number(page), Number(pageSize), Number((total as any)[0]?.total || 0)));
  } catch (error) {
    next(error);
  }
};

// 点赞文章
export const likeArticle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    // 检查是否已点赞
    const existingLike = await prisma.userLike.findFirst({
      where: { userId: BigInt(userId), likeType: 'article', likeId: BigInt(id) }
    });

    if (existingLike) {
      throw new AppError('已点赞', ErrorCodes.PARAM_ERROR, 400);
    }

    // 创建点赞记录并更新计数
    await Promise.all([
      prisma.userLike.create({
        data: { userId: BigInt(userId), likeType: 'article', likeId: BigInt(id) }
      }),
      prisma.article.update({
        where: { id: BigInt(id) },
        data: { likeCount: { increment: 1 } }
      })
    ]);

    res.json(successResponse({ liked: true }, '点赞成功'));
  } catch (error) {
    next(error);
  }
};

// 取消点赞
export const unlikeArticle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const like = await prisma.userLike.findFirst({
      where: { userId: BigInt(userId), likeType: 'article', likeId: BigInt(id) }
    });

    if (!like) {
      throw new AppError('未点赞', ErrorCodes.PARAM_ERROR, 400);
    }

    await Promise.all([
      prisma.userLike.delete({ where: { id: like.id } }),
      prisma.article.update({
        where: { id: BigInt(id) },
        data: { likeCount: { decrement: 1 } }
      })
    ]);

    res.json(successResponse({ liked: false }, '取消点赞成功'));
  } catch (error) {
    next(error);
  }
};

// 收藏文章
export const favoriteArticle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    // 检查是否已收藏
    const existingFavorite = await prisma.userFavorite.findFirst({
      where: { userId: BigInt(userId), favType: 'article', favId: BigInt(id) }
    });

    if (existingFavorite) {
      throw new AppError('已收藏', ErrorCodes.PARAM_ERROR, 400);
    }

    // 创建收藏记录并更新计数
    await Promise.all([
      prisma.userFavorite.create({
        data: { userId: BigInt(userId), favType: 'article', favId: BigInt(id) }
      }),
      prisma.article.update({
        where: { id: BigInt(id) },
        data: { collectCount: { increment: 1 } }
      })
    ]);

    res.json(successResponse({ favorited: true }, '收藏成功'));
  } catch (error) {
    next(error);
  }
};

// 取消收藏
export const unfavoriteArticle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const favorite = await prisma.userFavorite.findFirst({
      where: { userId: BigInt(userId), favType: 'article', favId: BigInt(id) }
    });

    if (!favorite) {
      throw new AppError('未收藏', ErrorCodes.PARAM_ERROR, 400);
    }

    await Promise.all([
      prisma.userFavorite.delete({ where: { id: favorite.id } }),
      prisma.article.update({
        where: { id: BigInt(id) },
        data: { collectCount: { decrement: 1 } }
      })
    ]);

    res.json(successResponse({ favorited: false }, '取消收藏成功'));
  } catch (error) {
    next(error);
  }
};