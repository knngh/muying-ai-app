import { Router } from 'express';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  getReadHistory,
  recordReadHistory,
  getUserStats,
  getPregnancyProfile,
} from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { paginationQuery } from '../schemas/common.schema';
import { addFavoriteBody, articleIdParam, recordReadHistoryBody } from '../schemas/user.schema';
import { uploadImage } from '../middlewares/upload.middleware';
import prisma from '../config/database';
import { successResponse } from '../middlewares/error.middleware';

const router = Router();

// 所有路由需要认证
router.use(authMiddleware);

// 收藏相关
router.get('/favorites', queryRateLimiter, validate({ query: paginationQuery }), getFavorites);
router.post('/favorites', writeRateLimiter, validate({ body: addFavoriteBody }), addFavorite);
router.delete('/favorites/:articleId', writeRateLimiter, validate({ params: articleIdParam }), removeFavorite);

// 阅读历史
router.get('/read-history', queryRateLimiter, validate({ query: paginationQuery }), getReadHistory);
router.post('/read-history', writeRateLimiter, validate({ body: recordReadHistoryBody }), recordReadHistory);

// 统计数据
router.get('/stats', queryRateLimiter, getUserStats);
router.get('/pregnancy-profile', queryRateLimiter, getPregnancyProfile);

// 头像上传
router.post('/avatar', writeRateLimiter, uploadImage, async (req, res, next) => {
  try {
    const userId = req.userId;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ code: 1001, message: '请选择图片' });
    }
    const avatarUrl = `/uploads/${file.filename}`;
    await prisma.user.update({
      where: { id: BigInt(userId!) },
      data: { avatar: avatarUrl },
    });
    res.json(successResponse({ avatar: avatarUrl }));
  } catch (error) {
    next(error);
  }
});

export default router;
