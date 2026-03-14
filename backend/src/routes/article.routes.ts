import { Router } from 'express';
import {
  getArticles,
  getArticleBySlug,
  getRelatedArticles,
  searchArticles,
  likeArticle,
  unlikeArticle,
  favoriteArticle,
  unfavoriteArticle
} from '../controllers/article.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// 公开路由
router.get('/', getArticles);
router.get('/search', searchArticles);
router.get('/:slug', getArticleBySlug);
router.get('/:id/related', getRelatedArticles);

// 需要认证的路由
router.post('/:id/like', authMiddleware, likeArticle);
router.delete('/:id/like', authMiddleware, unlikeArticle);
router.post('/:id/favorite', authMiddleware, favoriteArticle);
router.delete('/:id/favorite', authMiddleware, unfavoriteArticle);

export default router;