import { Router } from 'express';
import {
  askQuestion,
  askQuestionStream,
  chat,
  chatStream,
  getConversations,
  getConversationHistory,
  deleteConversation,
  getModels,
  checkHealth,
  searchKnowledge,
  submitFeedback,
  getKnowledgeBaseStats,
} from '../controllers/ai.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { aiRateLimiter, queryRateLimiter, writeRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validate } from '../middlewares/validate.middleware';
import { askQuestionBody, chatBody, conversationIdParam, conversationsQuery, feedbackBody, searchKnowledgeQuery } from '../schemas/ai.schema';
import { quotaCheckMiddleware } from '../middlewares/quota.middleware';
import { subscriptionContextMiddleware } from '../middlewares/subscription.middleware';

const router = Router();

// 健康检查（无需认证）
router.get('/health', queryRateLimiter, checkHealth);

// 获取可用模型（无需认证）
router.get('/models', queryRateLimiter, getModels);

// 知识库统计（无需认证）
router.get('/knowledge/stats', queryRateLimiter, getKnowledgeBaseStats);

// 以下路由需要认证
router.use(authMiddleware);
router.use(subscriptionContextMiddleware);

// 对话历史
router.get('/conversations', queryRateLimiter, validate({ query: conversationsQuery }), getConversations);
router.get('/conversations/:conversationId', queryRateLimiter, validate({ params: conversationIdParam }), getConversationHistory);
router.delete('/conversations/:conversationId', writeRateLimiter, validate({ params: conversationIdParam }), deleteConversation);

// 用户提问（非流式）
router.post('/ask', aiRateLimiter, validate({ body: askQuestionBody }), quotaCheckMiddleware, askQuestion);

// 用户提问（流式响应）
router.post('/ask/stream', aiRateLimiter, validate({ body: askQuestionBody }), quotaCheckMiddleware, askQuestionStream);

// 多轮对话（非流式）
router.post('/chat', aiRateLimiter, validate({ body: chatBody }), quotaCheckMiddleware, chat);

// 多轮对话（流式响应）
router.post('/chat/stream', aiRateLimiter, validate({ body: chatBody }), quotaCheckMiddleware, chatStream);

// 知识库检索
router.get('/knowledge/search', aiRateLimiter, validate({ query: searchKnowledgeQuery }), searchKnowledge);

// 用户反馈
router.post('/feedback', writeRateLimiter, validate({ body: feedbackBody }), submitFeedback);

export default router;
