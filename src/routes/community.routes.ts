import { Router } from 'express';
import {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  getComments,
  createComment,
  deleteComment
} from '../controllers/community.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { getPostsQuery, createPostBody, createCommentBody } from '../schemas/community.schema';
import { paginationQuery } from '../schemas/common.schema';

const router = Router();

// 帖子列表（公开，可选认证）
router.get('/posts', optionalAuthMiddleware, queryRateLimiter, validate({ query: getPostsQuery }), getPosts);

// 帖子详情（公开，可选认证）
router.get('/posts/:id', optionalAuthMiddleware, queryRateLimiter, getPostById);

// 创建帖子（需认证）
router.post('/posts', authMiddleware, writeRateLimiter, validate({ body: createPostBody }), createPost);

// 更新帖子（需认证）
router.put('/posts/:id', authMiddleware, writeRateLimiter, updatePost);

// 删除帖子（需认证）
router.delete('/posts/:id', authMiddleware, writeRateLimiter, deletePost);

// 点赞（需认证）
router.post('/posts/:id/like', authMiddleware, writeRateLimiter, likePost);
router.delete('/posts/:id/like', authMiddleware, writeRateLimiter, unlikePost);

// 评论列表（公开）
router.get('/posts/:postId/comments', queryRateLimiter, validate({ query: paginationQuery }), getComments);

// 创建评论（需认证）
router.post('/posts/:postId/comments', authMiddleware, writeRateLimiter, validate({ body: createCommentBody }), createComment);

// 删除评论（需认证）
router.delete('/comments/:id', authMiddleware, writeRateLimiter, deleteComment);

export default router;