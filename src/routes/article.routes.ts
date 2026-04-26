import { Router } from 'express';
import {
  getArticles,
  getArticleBySlug,
  getAuthorityArticleTranslation,
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
import { validate } from '../middlewares/validate.middleware';
import { getArticlesQuery, relatedArticlesQuery, searchArticlesQuery } from '../schemas/article.schema';
import { idParam, slugParam } from '../schemas/common.schema';

const router = Router();

// 公开路由 - 查询（宽松限流）
router.get('/', queryRateLimiter, validate({ query: getArticlesQuery }), getArticles);
router.get('/search', searchRateLimiter, validate({ query: searchArticlesQuery }), searchArticles);
router.get('/:slug/translation', queryRateLimiter, validate({ params: slugParam }), getAuthorityArticleTranslation);
router.get('/:slug', queryRateLimiter, validate({ params: slugParam }), getArticleBySlug);
router.get('/:id/related', queryRateLimiter, validate({ params: idParam, query: relatedArticlesQuery }), getRelatedArticles);

// 需要认证的路由 - 写入（中等限流）
router.post('/:id/like', authMiddleware, writeRateLimiter, validate({ params: idParam }), likeArticle);
router.delete('/:id/like', authMiddleware, writeRateLimiter, validate({ params: idParam }), unlikeArticle);
router.post('/:id/favorite', authMiddleware, writeRateLimiter, validate({ params: idParam }), favoriteArticle);
router.delete('/:id/favorite', authMiddleware, writeRateLimiter, validate({ params: idParam }), unfavoriteArticle);

// 调试路由（生产环境应禁用）
if (process.env.NODE_ENV !== 'production') {
  router.get('/debug/cache', getCacheStats);
}

export default router;
