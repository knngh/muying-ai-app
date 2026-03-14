import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse } from '../middlewares/error.middleware';

const prisma = new PrismaClient();

// 获取标签列表
export const getTags = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await prisma.tag.findMany({
      where: { articleCount: { gt: 0 } },
      orderBy: { articleCount: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        articleCount: true
      }
    });

    res.json(successResponse({ list: tags }));
  } catch (error) {
    next(error);
  }
};

// 获取标签下的文章
export const getArticlesByTag = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    const tag = await prisma.tag.findUnique({
      where: { slug }
    });

    if (!tag) {
      return res.status(404).json({
        code: 3003,
        message: '标签不存在'
      });
    }

    const skip = (Number(page) - 1) * Number(pageSize);

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where: {
          tags: { some: { tagId: tag.id } },
          status: 1,
          deletedAt: null
        },
        skip,
        take: Number(pageSize),
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          coverImage: true,
          viewCount: true,
          publishedAt: true
        }
      }),
      prisma.article.count({
        where: {
          tags: { some: { tagId: tag.id } },
          status: 1,
          deletedAt: null
        }
      })
    ]);

    res.json({
      code: 0,
      message: 'success',
      data: {
        tag,
        articles: {
          list: articles,
          pagination: {
            page: Number(page),
            pageSize: Number(pageSize),
            total,
            totalPages: Math.ceil(total / Number(pageSize))
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};