import { Router } from 'express';
import {
  getArticles,
  getArticleBySlug,
  getRelatedArticles,
  searchArticles,
  likeArticle,
  unlikeArticle,
  favoriteArticle,
  unfavoriteArticle,
  getCacheStats
} from '../controllers/article.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { queryRateLimiter, searchRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

// 公开路由 - 查询（宽松限流）
router.get('/', queryRateLimiter, getArticles);
router.get('/search', searchRateLimiter, searchArticles);
router.get('/:slug', queryRateLimiter, getArticleBySlug);
router.get('/:id/related', queryRateLimiter, getRelatedArticles);

// 需要认证的路由 - 写入（中等限流）
router.post('/:id/like', authMiddleware, writeRateLimiter, likeArticle);
router.delete('/:id/like', authMiddleware, writeRateLimiter, unlikeArticle);
router.post('/:id/favorite', authMiddleware, writeRateLimiter, favoriteArticle);
router.delete('/:id/favorite', authMiddleware, writeRateLimiter, unfavoriteArticle);

// 调试路由（生产环境应禁用）
if (process.env.NODE_ENV !== 'production') {
  router.get('/debug/cache', getCacheStats);
}

export default router;