import { Request, Response, NextFunction } from 'express';
import { successResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';
import {
  isEmergencyQuestion,
  getEmergencyResponse,
  ragEnhancedAnswer,
  multiTurnChat,
  streamMultiTurnChat,
  getAvailableModels,
  healthCheck,
  SUPPORTED_MODELS,
} from '../services/ai-gateway.service';
import { getRelatedContext, getKnowledgeStats } from '../services/knowledge.service';

// 用户提问（单轮）- 非流式
export const askQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, context, model } = req.body;
    const userId = req.userId;

    if (!question) {
      throw new AppError('请输入问题', ErrorCodes.PARAM_ERROR, 400);
    }

    // 检测紧急问题
    if (isEmergencyQuestion(question)) {
      return res.json(successResponse({
        answer: getEmergencyResponse(),
        isEmergency: true,
        sources: [],
        disclaimer: '🚨 重要提示：如遇紧急情况，请立即就医！',
      }));
    }

    // 从知识库获取相关上下文
    const knowledgeContext = getRelatedContext(question, 3);
    const finalContext = context || knowledgeContext;

    // 使用 RAG 增强问答
    const result = await ragEnhancedAnswer(question, finalContext);

    // 构建响应
    const response = {
      answer: result.answer,
      isEmergency: false,
      sources: result.sources,
      confidence: result.confidence,
      disclaimer: '⚠️ 免责声明：本回答由 AI 生成，仅供参考，不构成医疗建议。如有健康问题，请咨询专业医生。',
      followUpQuestions: [
        '还有其他问题吗？',
        '需要更详细的信息吗？',
      ],
      model: model || 'glm-4-flash',
    };

    console.log(`[AI QA] User: ${userId}, Question: ${question.substring(0, 50)}...`);

    res.json(successResponse(response));
  } catch (error) {
    next(error);
  }
};

// 用户提问（流式响应）
export const askQuestionStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, context, model } = req.body;
    const userId = req.userId;

    if (!question) {
      throw new AppError('请输入问题', ErrorCodes.PARAM_ERROR, 400);
    }

    // 检测紧急问题
    if (isEmergencyQuestion(question)) {
      // 紧急情况不使用流式，直接返回
      return res.json(successResponse({
        answer: getEmergencyResponse(),
        isEmergency: true,
      }));
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 构建消息
    const messages = [{ role: 'user' as const, content: question }];

    // 流式输出
    try {
      for await (const chunk of streamMultiTurnChat(messages, { model })) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      // 发送结束标记
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();

      console.log(`[AI QA Stream] User: ${userId}, Question: ${question.substring(0, 50)}...`);
    } catch (streamError) {
      console.error('[AI QA Stream] Error:', streamError);
      res.write(`data: ${JSON.stringify({ error: '服务暂时不可用' })}\n\n`);
      res.end();
    }
  } catch (error) {
    next(error);
  }
};

// 多轮对话 - 非流式
export const chat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages, model } = req.body;
    const userId = req.userId;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new AppError('消息不能为空', ErrorCodes.PARAM_ERROR, 400);
    }

    // 检测最后一条消息是否为紧急问题
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user' && isEmergencyQuestion(lastMessage.content)) {
      return res.json(successResponse({
        message: {
          role: 'assistant',
          content: getEmergencyResponse(),
          timestamp: new Date().toISOString(),
        },
        isEmergency: true,
        disclaimer: '🚨 重要提示：如遇紧急情况，请立即就医！',
      }));
    }

    // 转换消息格式
    const formattedMessages = messages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // 调用多轮对话
    const answer = await multiTurnChat(formattedMessages, { model });

    const response = {
      message: {
        role: 'assistant',
        content: answer,
        timestamp: new Date().toISOString(),
      },
      isEmergency: false,
      disclaimer: '⚠️ 免责声明：本回答由 AI 生成，仅供参考，不构成医疗建议。',
      model: model || 'glm-4-flash',
    };

    res.json(successResponse(response));
  } catch (error) {
    next(error);
  }
};

// 多轮对话 - 流式响应
export const chatStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages, model } = req.body;
    const userId = req.userId;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new AppError('消息不能为空', ErrorCodes.PARAM_ERROR, 400);
    }

    // 检测最后一条消息是否为紧急问题
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user' && isEmergencyQuestion(lastMessage.content)) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ content: getEmergencyResponse(), isEmergency: true })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return res.end();
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 转换消息格式
    const formattedMessages = messages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // 流式输出
    try {
      for await (const chunk of streamMultiTurnChat(formattedMessages, { model })) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();

      console.log(`[AI Chat Stream] User: ${userId}`);
    } catch (streamError) {
      console.error('[AI Chat Stream] Error:', streamError);
      res.write(`data: ${JSON.stringify({ error: '服务暂时不可用' })}\n\n`);
      res.end();
    }
  } catch (error) {
    next(error);
  }
};

// 获取可用模型列表
export const getModels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const models = getAvailableModels();
    res.json(successResponse({
      models,
      default: 'glm-4-flash',
    }));
  } catch (error) {
    next(error);
  }
};

// AI 服务健康检查
export const checkHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await healthCheck();
    res.json(successResponse(status));
  } catch (error) {
    next(error);
  }
};

// 知识库检索（保留原有接口）
export const searchKnowledge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, category, limit = 10 } = req.query;

    if (!q) {
      throw new AppError('请输入搜索关键词', ErrorCodes.PARAM_ERROR, 400);
    }

    // TODO: 实现向量检索
    // 当前返回模拟数据
    const mockResults = [
      {
        id: 'qa-001',
        question: `${q}相关问题`,
        answer: `这是关于"${q}"的专业解答...`,
        category: category || 'general',
        score: 0.92,
        source: '知识库',
      },
    ];

    res.json(successResponse({
      results: mockResults,
      total: mockResults.length,
      query: q,
    }));
  } catch (error) {
    next(error);
  }
};

// 用户反馈
export const submitFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qaId, feedback, comment } = req.body;
    const userId = req.userId;

    if (!qaId || !feedback) {
      throw new AppError('请提供完整的反馈信息', ErrorCodes.PARAM_ERROR, 400);
    }

    console.log(`[AI QA Feedback] User: ${userId}, QA: ${qaId}, Feedback: ${feedback}, Comment: ${comment || 'N/A'}`);

    res.json(successResponse({ received: true }, '感谢您的反馈'));
  } catch (error) {
    next(error);
  }
};

// 知识库统计
export const getKnowledgeBaseStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = getKnowledgeStats();
    res.json(successResponse(stats));
  } catch (error) {
    next(error);
  }
};