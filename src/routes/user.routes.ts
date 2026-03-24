import { Router } from 'express';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  getReadHistory,
  recordReadHistory,
  getUserStats
} from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { paginationQuery } from '../schemas/common.schema';

const router = Router();

// 所有路由需要认证
router.use(authMiddleware);

// 收藏相关
router.get('/favorites', queryRateLimiter, validate({ query: paginationQuery }), getFavorites);
router.post('/favorites', writeRateLimiter, addFavorite);
router.delete('/favorites/:articleId', writeRateLimiter, removeFavorite);

// 阅读历史
router.get('/read-history', queryRateLimiter, validate({ query: paginationQuery }), getReadHistory);
router.post('/read-history', writeRateLimiter, recordReadHistory);

// 统计数据
router.get('/stats', getUserStats);

export default router;