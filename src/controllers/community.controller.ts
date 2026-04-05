import { Prisma } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { successResponse, paginatedResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';
import { assertCommunityContentAllowed } from '../services/community-moderation.service';
import { applyCommunityReportAction, CommunityReportAction, reviewCommunityReport } from '../services/community-report-review.service';

const formatCommunityPost = (
  post: any,
  options: {
    categoryName?: string;
    isLiked?: boolean;
    commentCount?: number;
    likeCount?: number;
  } = {}
) => ({
  ...post,
  categoryId: post.categoryId?.toString(),
  categoryName: options.categoryName,
  isAnonymous: Boolean(post.isAnonymous),
  isPinned: Boolean(post.isPinned),
  isFeatured: Boolean(post.isFeatured),
  tags: Array.isArray(post.tags) ? post.tags.map((item: any) => item.tag ?? item) : [],
  commentCount: options.commentCount ?? post.commentCount ?? 0,
  likeCount: options.likeCount ?? post.likeCount ?? 0,
  isLiked: options.isLiked ?? post.isLiked ?? false,
});

const collectCommentThreadIds = async (rootId: bigint): Promise<bigint[]> => {
  const ids: bigint[] = [rootId];
  let frontier: bigint[] = [rootId];

  while (frontier.length > 0) {
    const children = await prisma.communityComment.findMany({
      where: {
        parentId: { in: frontier },
        deletedAt: null,
      },
      select: { id: true },
    });

    frontier = children.map((item) => item.id);
    ids.push(...frontier);
  }

  return ids;
};

const softDeleteCommentThread = async (commentId: bigint) => {
  const comment = await prisma.communityComment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true },
  });

  if (!comment) {
    throw new AppError('评论不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
  }

  const threadIds = await collectCommentThreadIds(comment.id);
  const deletedAt = new Date();

  const deletedCount = await prisma.$transaction(async (tx) => {
    const deleteResult = await tx.communityComment.updateMany({
      where: {
        id: { in: threadIds },
        deletedAt: null,
      },
      data: { deletedAt }
    });

    if (deleteResult.count > 0) {
      const post = await tx.communityPost.findUnique({
        where: { id: comment.postId },
        select: { commentCount: true }
      });

      await tx.communityPost.update({
        where: { id: comment.postId },
        data: { commentCount: Math.max(0, (post?.commentCount ?? 0) - deleteResult.count) }
      });
    }

    return deleteResult.count;
  });

  return { deletedCount, postId: comment.postId };
};

const formatCommunityReport = (report: any) => ({
  id: report.id.toString(),
  targetType: report.targetType,
  reason: report.reason,
  description: report.description,
  status: report.status,
  actionTaken: report.actionTaken || 'none',
  decisionReason: report.decisionReason,
  handledByAI: Boolean(report.handledByAI),
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
  handledAt: report.handledAt,
  reporter: report.reporter ? {
    id: report.reporter.id.toString(),
    username: report.reporter.username,
    nickname: report.reporter.nickname,
  } : null,
  post: report.post ? {
    id: report.post.id.toString(),
    title: report.post.title,
    content: report.post.content,
    status: report.post.status,
    deletedAt: report.post.deletedAt,
    author: report.post.author ? {
      id: report.post.author.id.toString(),
      username: report.post.author.username,
      nickname: report.post.author.nickname,
    } : null,
  } : null,
  comment: report.comment ? {
    id: report.comment.id.toString(),
    content: report.comment.content,
    deletedAt: report.comment.deletedAt,
    author: report.comment.author ? {
      id: report.comment.author.id.toString(),
      username: report.comment.author.username,
      nickname: report.comment.author.nickname,
    } : null,
  } : null,
});

/**
 * 获取帖子列表
 */
export const getPosts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
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
            select: { id: true, username: true, nickname: true, avatar: true }
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

    const likedPostIds = userId
      ? new Set(
        (await prisma.communityPostLike.findMany({
          where: {
            userId: BigInt(userId),
            postId: { in: posts.map((post) => post.id) },
          },
          select: { postId: true },
        })).map((item) => item.postId.toString())
      )
      : new Set<string>();

    const categoryIds = Array.from(new Set(posts.map((post) => post.categoryId?.toString()).filter(Boolean))) as string[];
    const categories = categoryIds.length
      ? await prisma.category.findMany({
        where: { id: { in: categoryIds.map((id) => BigInt(id)) } },
        select: { id: true, name: true },
      })
      : [];
    const categoryNameMap = new Map(categories.map((item) => [item.id.toString(), item.name]));

    const list = posts.map(post => formatCommunityPost(post, {
      categoryName: post.categoryId ? categoryNameMap.get(post.categoryId.toString()) : undefined,
      commentCount: (post as any)._count.comments,
      likeCount: (post as any)._count.likes,
      isLiked: likedPostIds.has(post.id.toString()),
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
          select: { id: true, username: true, nickname: true, avatar: true, createdAt: true }
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

    const category = post.categoryId
      ? await prisma.category.findUnique({
        where: { id: post.categoryId },
        select: { id: true, name: true },
      })
      : null;

    res.json(successResponse(formatCommunityPost(post, {
      categoryName: category?.name,
      isLiked
    })));
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

    assertCommunityContentAllowed(title, content);

    // 创建帖子
    const post = await prisma.communityPost.create({
      data: {
        authorId: BigInt(userId!),
        title,
        content,
        categoryId: categoryId ? BigInt(categoryId) : null,
        isAnonymous: anonymous ? 1 : 0,
        status: 'published', // 直接发布，后续可加审核
        tags: tags && tags.length ? {
          create: (tags as string[]).map(tagId => ({
            tagId: BigInt(tagId)
          }))
        } : undefined
      },
      include: {
        author: {
          select: { id: true, username: true, nickname: true, avatar: true }
        },
        tags: { include: { tag: true } }
      }
    });

    const category = post.categoryId
      ? await prisma.category.findUnique({
        where: { id: post.categoryId },
        select: { id: true, name: true },
      })
      : null;

    res.status(201).json(successResponse(formatCommunityPost(post, {
      categoryName: category?.name,
    }), '发布成功'));
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
    const { title, content, categoryId, tags, anonymous } = req.body;

    assertCommunityContentAllowed(title, content);

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
        categoryId: categoryId !== undefined ? BigInt(categoryId) : undefined,
        isAnonymous: anonymous !== undefined ? (anonymous ? 1 : 0) : undefined,
        updatedAt: new Date(),
        tags: tags ? {
          deleteMany: {},
          create: (tags as string[]).map(tagId => ({
            tagId: BigInt(tagId)
          }))
        } : undefined
      },
      include: {
        author: {
          select: { id: true, username: true, nickname: true, avatar: true }
        },
        tags: { include: { tag: true } }
      }
    });

    const category = post.categoryId
      ? await prisma.category.findUnique({
        where: { id: post.categoryId },
        select: { id: true, name: true },
      })
      : null;

    res.json(successResponse(formatCommunityPost(post, {
      categoryName: category?.name,
    }), '更新成功'));
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
            select: { id: true, username: true, nickname: true, avatar: true }
          },
          replies: {
            where: { deletedAt: null },
            include: {
              author: { select: { id: true, username: true, nickname: true, avatar: true } }
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
 * 获取某条评论下的回复列表
 */
export const getReplies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    const parentComment = await prisma.communityComment.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, deletedAt: true }
    });

    if (!parentComment || parentComment.deletedAt) {
      throw new AppError('评论不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    const skip = (Number(page) - 1) * Number(pageSize);

    const [replies, total] = await Promise.all([
      prisma.communityComment.findMany({
        where: {
          parentId: BigInt(id),
          deletedAt: null
        },
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: { id: true, username: true, nickname: true, avatar: true }
          }
        }
      }),
      prisma.communityComment.count({
        where: {
          parentId: BigInt(id),
          deletedAt: null
        }
      })
    ]);

    res.json(paginatedResponse(replies, Number(page), Number(pageSize), total));
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

    assertCommunityContentAllowed(content);

    // 检查帖子是否存在
    const post = await prisma.communityPost.findUnique({
      where: { id: BigInt(postId) }
    });

    if (!post || post.deletedAt) {
      throw new AppError('帖子不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    const normalizedParentId = parentId ? BigInt(parentId) : null;
    const normalizedReplyToId = replyToId ? BigInt(replyToId) : null;

    if (normalizedReplyToId && !normalizedParentId) {
      throw new AppError('回复评论时必须指定一级评论', ErrorCodes.PARAM_ERROR, 400);
    }

    const [parentComment, replyToComment] = await Promise.all([
      normalizedParentId
        ? prisma.communityComment.findUnique({ where: { id: normalizedParentId } })
        : null,
      normalizedReplyToId
        ? prisma.communityComment.findUnique({ where: { id: normalizedReplyToId } })
        : null,
    ]);

    if (normalizedParentId) {
      if (!parentComment || parentComment.deletedAt) {
        throw new AppError('回复的评论不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
      }
      if (parentComment.postId.toString() !== postId) {
        throw new AppError('评论不属于当前帖子', ErrorCodes.PARAM_ERROR, 400);
      }
      if (parentComment.parentId) {
        throw new AppError('仅支持回复一级评论', ErrorCodes.PARAM_ERROR, 400);
      }
    }

    if (normalizedReplyToId) {
      if (!replyToComment || replyToComment.deletedAt) {
        throw new AppError('回复目标不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
      }
      if (replyToComment.postId.toString() !== postId) {
        throw new AppError('回复目标不属于当前帖子', ErrorCodes.PARAM_ERROR, 400);
      }
      const belongsToThread = replyToComment.id.toString() === normalizedParentId!.toString()
        || replyToComment.parentId?.toString() === normalizedParentId!.toString();
      if (!belongsToThread) {
        throw new AppError('回复目标不属于当前评论线程', ErrorCodes.PARAM_ERROR, 400);
      }
    }

    // 创建评论
    const comment = await prisma.communityComment.create({
      data: {
        postId: BigInt(postId),
        authorId: BigInt(userId!),
        content,
        parentId: normalizedParentId,
        replyToId: normalizedReplyToId
      },
      include: {
        author: { select: { id: true, username: true, nickname: true, avatar: true } }
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

    const { deletedCount } = await softDeleteCommentThread(comment.id);

    res.json(successResponse({ deletedCount }, '删除成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 举报帖子或评论
 */
export const createReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { targetType, targetId, reason, description } = req.body as {
      targetType: 'post' | 'comment';
      targetId: string;
      reason: string;
      description?: string;
    };

    let postId: bigint | null = null;
    let commentId: bigint | null = null;

    if (targetType === 'post') {
      const post = await prisma.communityPost.findUnique({
        where: { id: BigInt(targetId) },
        select: { id: true, authorId: true, deletedAt: true, status: true }
      });

      if (!post || post.deletedAt || post.status !== 'published') {
        throw new AppError('帖子不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
      }

      if (post.authorId.toString() === userId) {
        throw new AppError('不能举报自己发布的帖子', ErrorCodes.PARAM_ERROR, 400);
      }

      postId = post.id;
    } else {
      const comment = await prisma.communityComment.findUnique({
        where: { id: BigInt(targetId) },
        select: { id: true, authorId: true, deletedAt: true, postId: true }
      });

      if (!comment || comment.deletedAt) {
        throw new AppError('评论不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
      }

      if (comment.authorId.toString() === userId) {
        throw new AppError('不能举报自己的评论', ErrorCodes.PARAM_ERROR, 400);
      }

      commentId = comment.id;
      postId = comment.postId;
    }

    const existingReport = await prisma.communityReport.findFirst({
      where: {
        reporterId: BigInt(userId!),
        targetType,
        postId,
        commentId,
        status: 'pending'
      },
      select: { id: true }
    });

    if (existingReport) {
      throw new AppError('你已经提交过该举报，正在处理', ErrorCodes.PARAM_ERROR, 400);
    }

    const report = await prisma.communityReport.create({
      data: {
        reporterId: BigInt(userId!),
        targetType,
        postId,
        commentId,
        reason,
        description: description?.trim() || null,
        status: 'pending'
      },
      select: {
        id: true,
        targetType: true,
        description: true,
        reason: true,
        status: true,
        createdAt: true,
        post: {
          select: {
            title: true,
            content: true,
          },
        },
        comment: {
          select: {
            content: true,
          },
        },
      }
    });

    const reviewResult = await reviewCommunityReport({
      targetType,
      reason,
      reportDescription: description?.trim() || null,
      targetTitle: report.post?.title ?? null,
      targetContent: report.post?.content ?? report.comment?.content ?? '',
    });

    let finalStatus = report.status;
    let finalActionTaken: CommunityReportAction = 'none';
    let finalDecisionReason: string | null = null;
    let finalHandledAt: Date | null = null;
    let finalHandledByAI = 0;

    if (reviewResult.status !== 'pending') {
      finalStatus = reviewResult.status;
      finalActionTaken = reviewResult.actionTaken;
      finalDecisionReason = reviewResult.decisionReason;
      finalHandledAt = new Date();
      finalHandledByAI = reviewResult.handledByAI ? 1 : 0;

      await prisma.$transaction(async (tx) => {
        const updateData: Prisma.CommunityReportUpdateInput = {
          status: finalStatus,
          actionTaken: finalActionTaken,
          decisionReason: finalDecisionReason,
          handledAt: finalHandledAt,
          handledByAI: finalHandledByAI,
        };

        await tx.communityReport.update({
          where: { id: report.id },
          data: updateData,
        });

        if (reviewResult.status === 'reviewed' && reviewResult.actionTaken !== 'none') {
          if (reviewResult.actionTaken === 'hide_post' && postId) {
            await tx.communityPost.update({
              where: { id: postId },
              data: { status: 'hidden' },
            });
          } else if (reviewResult.actionTaken === 'delete_comment' && commentId) {
            const threadIds = await collectCommentThreadIds(commentId);
            const deletedAt = new Date();
            const deleteResult = await tx.communityComment.updateMany({
              where: {
                id: { in: threadIds },
                deletedAt: null,
              },
              data: { deletedAt },
            });

            if (deleteResult.count > 0 && postId) {
              const postRecord = await tx.communityPost.findUnique({
                where: { id: postId },
                select: { commentCount: true },
              });

              await tx.communityPost.update({
                where: { id: postId },
                data: { commentCount: Math.max(0, (postRecord?.commentCount ?? 0) - deleteResult.count) },
              });
            }
          }
        }
      });
    }

    res.status(201).json(successResponse({
      id: report.id.toString(),
      targetType: report.targetType,
      reason: report.reason,
      status: finalStatus,
      actionTaken: finalActionTaken,
      decisionReason: finalDecisionReason,
      handledByAI: Boolean(finalHandledByAI),
      handledAt: finalHandledAt,
      createdAt: report.createdAt,
    }, '举报已提交，我们会尽快处理'));
  } catch (error) {
    next(error);
  }
};

/**
 * 管理端获取举报列表
 */
export const getReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, pageSize = 20, status, targetType } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (targetType) {
      where.targetType = targetType;
    }

    const [reports, total] = await Promise.all([
      prisma.communityReport.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: [
          { status: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          reporter: {
            select: { id: true, username: true, nickname: true },
          },
          post: {
            select: {
              id: true,
              title: true,
              content: true,
              status: true,
              deletedAt: true,
              author: {
                select: { id: true, username: true, nickname: true },
              },
            },
          },
          comment: {
            select: {
              id: true,
              content: true,
              deletedAt: true,
              author: {
                select: { id: true, username: true, nickname: true },
              },
            },
          },
        },
      }),
      prisma.communityReport.count({ where }),
    ]);

    res.json(paginatedResponse(reports.map(formatCommunityReport), Number(page), Number(pageSize), total));
  } catch (error) {
    next(error);
  }
};

/**
 * 管理端处理举报
 */
export const handleReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, actionTaken = 'none', decisionReason } = req.body as {
      status: 'reviewed' | 'rejected';
      actionTaken?: CommunityReportAction;
      decisionReason?: string;
    };

    const report = await prisma.communityReport.findUnique({
      where: { id: BigInt(id) },
      include: {
        reporter: {
          select: { id: true, username: true, nickname: true },
        },
        post: {
          select: {
            id: true,
            title: true,
            content: true,
            status: true,
            deletedAt: true,
            author: {
              select: { id: true, username: true, nickname: true },
            },
          },
        },
        comment: {
          select: {
            id: true,
            content: true,
            deletedAt: true,
            author: {
              select: { id: true, username: true, nickname: true },
            },
          },
        },
      },
    });

    if (!report) {
      throw new AppError('举报记录不存在', ErrorCodes.ARTICLE_NOT_FOUND, 404);
    }

    const normalizedAction: CommunityReportAction = status === 'reviewed'
      ? (actionTaken || (report.targetType === 'post' ? 'hide_post' : 'delete_comment'))
      : 'none';
    const handledAt = new Date();
    const updateData: Prisma.CommunityReportUpdateInput = {
      status,
      actionTaken: normalizedAction,
      decisionReason: decisionReason?.trim() || null,
      handledAt,
      handledByAI: 0,
    };

    await prisma.communityReport.update({
      where: { id: report.id },
      data: updateData,
    });

    if (status === 'reviewed' && normalizedAction !== 'none') {
      if (normalizedAction === 'delete_comment' && report.commentId) {
        await softDeleteCommentThread(report.commentId);
      } else {
        await applyCommunityReportAction(report.id, normalizedAction);
      }
    }

    const updatedReport = await prisma.communityReport.findUnique({
      where: { id: report.id },
      include: {
        reporter: {
          select: { id: true, username: true, nickname: true },
        },
        post: {
          select: {
            id: true,
            title: true,
            content: true,
            status: true,
            deletedAt: true,
            author: {
              select: { id: true, username: true, nickname: true },
            },
          },
        },
        comment: {
          select: {
            id: true,
            content: true,
            deletedAt: true,
            author: {
              select: { id: true, username: true, nickname: true },
            },
          },
        },
      },
    });

    res.json(successResponse(updatedReport ? formatCommunityReport(updatedReport) : null, '处理成功'));
  } catch (error) {
    next(error);
  }
};
