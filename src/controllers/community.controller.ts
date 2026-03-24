import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { successResponse, paginatedResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';

/**
 * 获取帖子列表
 */
export const getPosts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      category, 
      sort = 'latest', 
      tag,
      keyword,
      page = 1, 
      pageSize = 20 
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);

    // 构建查询条件
    const where: any = {
      status: 'published',
      deletedAt: null
    };

    if (category) {
      where.categoryId = BigInt(category as string);
    }

    if (tag) {
      where.tags = {
        some: { tagId: BigInt(tag as string) }
      };
    }

    if (keyword) {
      where.OR = [
        { title: { contains: keyword as string } },
        { content: { contains: keyword as string } }
      ];
    }

    // 排序
    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'popular') {
      orderBy = [{ viewCount: 'desc' }, { likeCount: 'desc' }];
    } else if (sort === 'hot') {
      orderBy = { commentCount: 'desc' };
    }

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        orderBy,
        skip,
        take: Number(pageSize),
        include: {
          author: {
            select: { id: true, nickname: true, avatar: true }
          },
          tags: {
            include: {
              tag: { select: { id: true, name: true, slug: true } }
            }
          },
          _count: {
            select: { comments: true, likes: true }
          }
        }
      }),
      prisma.communityPost.count({ where })
    ]);

    const list = posts.map(post => ({
      ...post,
      tags: (post as any).tags.map((t: any) => t.tag),
      commentCount: (post as any)._count.comments,
      likeCount: (post as any)._count.likes
    }));

    res.json(paginatedResponse(list, Number(page), Number(pageSize), total));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取帖子详情
 */
export const getPostById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const post = await prisma.communityPost.findUnique({
      where: { id: BigInt(id) },
      include: {
        author: {
          select: { id: true, nickname: true, avatar: true, createdAt: true }
        },
        tags: {
          include: { tag: true }
        }
      }
    });

    if (!post || post.status !== 'published' || post.deletedAt) {
      throw new AppError('帖子不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    // 增加浏览量
    await prisma.communityPost.update({
      where: { id: BigInt(id) },
      data: { viewCount: { increment: 1 } }
    });

    // 检查是否已点赞
    let isLiked = false;
    if (userId) {
      const like = await prisma.communityPostLike.findFirst({
        where: { userId: BigInt(userId), postId: BigInt(id) }
      });
      isLiked = !!like;
    }

    res.json(successResponse({
      ...post,
      tags: (post as any).tags.map((t: any) => t.tag),
      isLiked
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建帖子
 */
export const createPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { title, content, categoryId, tags, anonymous } = req.body;

    if (!title || !content) {
      throw new AppError('标题和内容不能为空', ErrorCodes.PARAM_ERROR, 400);
    }

    // 创建帖子
    const post = await prisma.communityPost.create({
      data: {
        authorId: BigInt(userId!),
        title,
        content,
        categoryId: categoryId ? BigInt(categoryId) : null,
        isAnonymous: anonymous || false,
        status: 'published', // 直接发布，后续可加审核
        tags: tags ? {
          create: (tags as string[]).map(tagId => ({
            tagId: BigInt(tagId)
          }))
        } : undefined
      },
      include: {
        tags: { include: { tag: true } }
      }
    });

    res.status(201).json(successResponse(post, '发布成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新帖子
 */
export const updatePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { title, content, categoryId, tags } = req.body;

    // 检查帖子是否存在且属于当前用户
    const existingPost = await prisma.communityPost.findUnique({
      where: { id: BigInt(id) }
    });

    if (!existingPost) {
      throw new AppError('帖子不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    if (existingPost.authorId.toString() !== userId) {
      throw new AppError('无权修改此帖子', ErrorCodes.NO_PERMISSION, 403);
    }

    // 更新帖子
    const post = await prisma.communityPost.update({
      where: { id: BigInt(id) },
      data: {
        title,
        content,
        categoryId: categoryId ? BigInt(categoryId) : null,
        updatedAt: new Date()
      }
    });

    res.json(successResponse(post, '更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 删除帖子（软删除）
 */
export const deletePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // 检查帖子是否存在且属于当前用户
    const post = await prisma.communityPost.findUnique({
      where: { id: BigInt(id) }
    });

    if (!post) {
      throw new AppError('帖子不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    if (post.authorId.toString() !== userId) {
      throw new AppError('无权删除此帖子', ErrorCodes.NO_PERMISSION, 403);
    }

    // 软删除
    await prisma.communityPost.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() }
    });

    res.json(successResponse(null, '删除成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 点赞帖子
 */
export const likePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // 检查是否已点赞
    const existingLike = await prisma.communityPostLike.findFirst({
      where: { userId: BigInt(userId!), postId: BigInt(id) }
    });

    if (existingLike) {
      throw new AppError('已点赞', ErrorCodes.PARAM_ERROR, 400);
    }

    // 创建点赞记录并更新计数
    await Promise.all([
      prisma.communityPostLike.create({
        data: { userId: BigInt(userId!), postId: BigInt(id) }
      }),
      prisma.communityPost.update({
        where: { id: BigInt(id) },
        data: { likeCount: { increment: 1 } }
      })
    ]);

    res.json(successResponse({ liked: true }, '点赞成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 取消点赞
 */
export const unlikePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const like = await prisma.communityPostLike.findFirst({
      where: { userId: BigInt(userId!), postId: BigInt(id) }
    });

    if (!like) {
      throw new AppError('未点赞', ErrorCodes.PARAM_ERROR, 400);
    }

    await Promise.all([
      prisma.communityPostLike.delete({ where: { id: like.id } }),
      prisma.communityPost.update({
        where: { id: BigInt(id) },
        data: { likeCount: { decrement: 1 } }
      })
    ]);

    res.json(successResponse({ liked: false }, '取消点赞成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取帖子评论
 */
export const getComments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { postId } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);

    const [comments, total] = await Promise.all([
      prisma.communityComment.findMany({
        where: { 
          postId: BigInt(postId),
          parentId: null, // 只获取一级评论
          deletedAt: null 
        },
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, nickname: true, avatar: true }
          },
          replies: {
            where: { deletedAt: null },
            include: {
              author: { select: { id: true, nickname: true, avatar: true } }
            },
            take: 5
          },
          _count: {
            select: { replies: true }
          }
        }
      }),
      prisma.communityComment.count({ 
        where: { postId: BigInt(postId), parentId: null, deletedAt: null } 
      })
    ]);

    const list = comments.map(comment => ({
      ...comment,
      replyCount: (comment as any)._count.replies
    }));

    res.json(paginatedResponse(list, Number(page), Number(pageSize), total));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建评论
 */
export const createComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;
    const { content, parentId, replyToId } = req.body;

    if (!content) {
      throw new AppError('评论内容不能为空', ErrorCodes.PARAM_ERROR, 400);
    }

    // 检查帖子是否存在
    const post = await prisma.communityPost.findUnique({
      where: { id: BigInt(postId) }
    });

    if (!post || post.deletedAt) {
      throw new AppError('帖子不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    // 创建评论
    const comment = await prisma.communityComment.create({
      data: {
        postId: BigInt(postId),
        authorId: BigInt(userId!),
        content,
        parentId: parentId ? BigInt(parentId) : null,
        replyToId: replyToId ? BigInt(replyToId) : null
      },
      include: {
        author: { select: { id: true, nickname: true, avatar: true } }
      }
    });

    // 更新帖子评论数
    await prisma.communityPost.update({
      where: { id: BigInt(postId) },
      data: { commentCount: { increment: 1 } }
    });

    res.status(201).json(successResponse(comment, '评论成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 删除评论
 */
export const deleteComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const comment = await prisma.communityComment.findUnique({
      where: { id: BigInt(id) }
    });

    if (!comment) {
      throw new AppError('评论不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    if (comment.authorId.toString() !== userId) {
      throw new AppError('无权删除此评论', ErrorCodes.NO_PERMISSION, 403);
    }

    // 软删除
    await prisma.communityComment.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() }
    });

    // 更新帖子评论数
    await prisma.communityPost.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } }
    });

    res.json(successResponse(null, '删除成功'));
  } catch (error) {
    next(error);
  }
};