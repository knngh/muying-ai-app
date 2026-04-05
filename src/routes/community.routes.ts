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
  getReplies,
  createComment,
  deleteComment,
  createReport,
  getReports,
  handleReport
} from '../controllers/community.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { getPostsQuery, createPostBody, createCommentBody, updatePostBody, createReportBody, getReportsQuery, handleReportBody, postIdParam, commentIdParam, reportIdParam, postCommentsParam, commentRepliesParam } from '../schemas/community.schema';
import { paginationQuery } from '../schemas/common.schema';

const router = Router();

// 帖子列表（公开，可选认证）
router.get('/posts', optionalAuthMiddleware, queryRateLimiter, validate({ query: getPostsQuery }), getPosts);

// 帖子详情（公开，可选认证）
router.get('/posts/:id', optionalAuthMiddleware, queryRateLimiter, validate({ params: postIdParam }), getPostById);

// 创建帖子（需认证）
router.post('/posts', authMiddleware, writeRateLimiter, validate({ body: createPostBody }), createPost);

// 更新帖子（需认证）
router.put('/posts/:id', authMiddleware, writeRateLimiter, validate({ params: postIdParam, body: updatePostBody }), updatePost);

// 删除帖子（需认证）
router.delete('/posts/:id', authMiddleware, writeRateLimiter, validate({ params: postIdParam }), deletePost);

// 点赞（需认证）
router.post('/posts/:id/like', authMiddleware, writeRateLimiter, validate({ params: postIdParam }), likePost);
router.delete('/posts/:id/like', authMiddleware, writeRateLimiter, validate({ params: postIdParam }), unlikePost);

// 评论列表（公开）
router.get('/posts/:postId/comments', queryRateLimiter, validate({ params: postCommentsParam, query: paginationQuery }), getComments);
router.get('/comments/:id/replies', queryRateLimiter, validate({ params: commentRepliesParam, query: paginationQuery }), getReplies);

// 创建评论（需认证）
router.post('/posts/:postId/comments', authMiddleware, writeRateLimiter, validate({ params: postCommentsParam, body: createCommentBody }), createComment);

// 删除评论（需认证）
router.delete('/comments/:id', authMiddleware, writeRateLimiter, validate({ params: commentIdParam }), deleteComment);

// 举报帖子/评论（需认证）
router.post('/reports', authMiddleware, writeRateLimiter, validate({ body: createReportBody }), createReport);
router.get('/reports', authMiddleware, adminMiddleware, queryRateLimiter, validate({ query: getReportsQuery }), getReports);
router.patch('/reports/:id', authMiddleware, adminMiddleware, writeRateLimiter, validate({ params: reportIdParam, body: handleReportBody }), handleReport);

export default router;
