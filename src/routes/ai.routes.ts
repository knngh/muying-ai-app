import { Router } from 'express';
import {
  askQuestion,
  askQuestionStream,
  chat,
  chatStream,
  getModels,
  checkHealth,
  searchKnowledgeBase,
  submitFeedback,
  getKnowledgeBaseStats,
  getRecommendedQuestions,
  getKnowledgeCategories,
} from '../controllers/ai.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { aiRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

// 健康检查（无需认证）
router.get('/health', checkHealth);

// 获取可用模型（无需认证）
router.get('/models', getModels);

// 知识库统计（无需认证）
router.get('/knowledge/stats', getKnowledgeBaseStats);

// 热门推荐问题（无需认证）
router.get('/knowledge/recommended', getRecommendedQuestions);

// 知识库分类（无需认证）
router.get('/knowledge/categories', getKnowledgeCategories);

// 知识库搜索（无需认证）
router.get('/knowledge/search', searchKnowledgeBase);

// 以下路由需要认证
router.use(authMiddleware);

// 用户提问（非流式）
router.post('/ask', aiRateLimiter, askQuestion);

// 用户提问（流式响应）
router.post('/ask/stream', aiRateLimiter, askQuestionStream);

// 多轮对话（非流式）
router.post('/chat', aiRateLimiter, chat);

// 多轮对话（流式响应）
router.post('/chat/stream', aiRateLimiter, chatStream);

// 用户反馈
router.post('/feedback', submitFeedback);

export default router;