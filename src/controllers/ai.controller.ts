import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { successResponse, paginatedResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';
import {
  getAvailableModels,
  getDefaultModel,
  getTaskModelBindings,
  healthCheck,
} from '../services/ai-gateway.service';
import { searchQAWithRewrite, getKnowledgeStats } from '../services/knowledge.service';
import { buildUserProfileContext } from '../services/ai-user-context.service';
import {
  saveConversationExchange,
  appendConversationAssistantAnswer,
  listUserChatSessions,
  getUserChatSession,
  softDeleteUserChatSession,
} from '../services/ai-session.service';
import { chunkTrustedAnswer, generateTrustedAIResponse } from '../services/trusted-ai.service';
import {
  shouldUseProfileHints,
  isResumeContinuationContext,
} from '../services/ai-context.service';
import { buildAIActionCards } from '../services/ai-action-card.service';
import { logger, genRequestId } from '../utils/logger';

const DEFAULT_MODEL_ID = getDefaultModel();

type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function buildTrustedResponsePayload(
  result: Awaited<ReturnType<typeof generateTrustedAIResponse>>,
  model?: string,
  conversationId?: string,
) {
  const actionCards = buildAIActionCards(result);
  return {
    answer: result.answer,
    message: {
      role: 'assistant' as const,
      content: result.answer,
      timestamp: new Date().toISOString(),
    },
    isEmergency: result.isEmergency,
    sources: result.sources,
    confidence: result.confidence,
    disclaimer: result.disclaimer,
    followUpQuestions: result.followUpQuestions,
    triageCategory: result.triageCategory,
    riskLevel: result.riskLevel,
    structuredAnswer: result.structuredAnswer,
    uncertainty: result.uncertainty,
    sourceReliability: result.sourceReliability,
    degraded: result.degraded,
    actionCards,
    model: result.model || model || DEFAULT_MODEL_ID,
    provider: result.provider,
    route: result.route,
    conversationId,
  };
}

function setSseHeaders(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

function streamTrustedResult(
  res: Response,
  result: Awaited<ReturnType<typeof generateTrustedAIResponse>>,
  model: string | undefined,
  conversationId: string | undefined,
) {
  const actionCards = buildAIActionCards(result);
  setSseHeaders(res);

  for (const chunk of chunkTrustedAnswer(result.answer)) {
    res.write(`data: ${JSON.stringify({ content: chunk, isEmergency: result.isEmergency })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({
    done: true,
    sources: result.sources,
    disclaimer: result.disclaimer,
    followUpQuestions: result.followUpQuestions,
    triageCategory: result.triageCategory,
    riskLevel: result.riskLevel,
    structuredAnswer: result.structuredAnswer,
    uncertainty: result.uncertainty,
    sourceReliability: result.sourceReliability,
    degraded: result.degraded,
    actionCards,
    model: result.model || model || DEFAULT_MODEL_ID,
    provider: result.provider,
    route: result.route,
    conversationId,
  })}\n\n`);
  res.end();
}

// 用户提问（单轮）- 非流式
export const askQuestion = async (req: Request, res: Response, next: NextFunction) => {
  const requestId = genRequestId();
  const startedAt = Date.now();
  try {
    const { question, context, model, conversationId } = req.body;
    const userId = req.userId;

    if (!question) {
      throw new AppError('请输入问题', ErrorCodes.PARAM_ERROR, 400);
    }

    logger.info('ai.ask.start', {
      component: 'ai.controller',
      event: 'ask.start',
      requestId,
      userId,
      questionPreview: String(question).slice(0, 80),
      model,
    });

    const result = await generateTrustedAIResponse({
      question,
      context,
      userId,
      model,
    });
    const persistedConversationId = userId
      ? await saveConversationExchange({
        userId,
        conversationId,
        userQuestion: question,
        assistantAnswer: result.answer,
        isEmergency: result.isEmergency,
        sources: result.sources,
      })
      : conversationId;

    logger.info('ai.ask.done', {
      component: 'ai.controller',
      event: 'ask.done',
      requestId,
      userId,
      durationMs: Date.now() - startedAt,
      isEmergency: result.isEmergency,
      riskLevel: result.riskLevel,
      degraded: result.degraded,
      provider: result.provider,
      route: result.route,
      sourceCount: result.sources?.length || 0,
    });

    res.json(successResponse(buildTrustedResponsePayload(result, model, persistedConversationId)));
  } catch (error) {
    logger.error('ai.ask.error', {
      component: 'ai.controller',
      event: 'ask.error',
      requestId,
      userId: req.userId,
      durationMs: Date.now() - startedAt,
      err: error,
    });
    next(error);
  }
};

// 用户提问（流式响应）
export const askQuestionStream = async (req: Request, res: Response, next: NextFunction) => {
  const requestId = genRequestId();
  const startedAt = Date.now();
  try {
    const { question, context, model, conversationId } = req.body;
    const userId = req.userId;

    if (!question) {
      throw new AppError('请输入问题', ErrorCodes.PARAM_ERROR, 400);
    }

    logger.info('ai.ask_stream.start', {
      component: 'ai.controller',
      event: 'ask_stream.start',
      requestId,
      userId,
      questionPreview: String(question).slice(0, 80),
      model,
    });

    const result = await generateTrustedAIResponse({
      question,
      context,
      userId,
      model,
    });
    const persistedConversationId = userId
      ? await saveConversationExchange({
        userId,
        conversationId,
        userQuestion: question,
        assistantAnswer: result.answer,
        isEmergency: result.isEmergency,
        sources: result.sources,
      })
      : conversationId;

    logger.info('ai.ask_stream.done', {
      component: 'ai.controller',
      event: 'ask_stream.done',
      requestId,
      userId,
      durationMs: Date.now() - startedAt,
      isEmergency: result.isEmergency,
      riskLevel: result.riskLevel,
      degraded: result.degraded,
      provider: result.provider,
      route: result.route,
    });

    streamTrustedResult(res, result, model, persistedConversationId);
  } catch (error) {
    logger.error('ai.ask_stream.error', {
      component: 'ai.controller',
      event: 'ask_stream.error',
      requestId,
      userId: req.userId,
      durationMs: Date.now() - startedAt,
      err: error,
    });
    if (res.headersSent) {
      res.end();
      return;
    }
    next(error);
  }
};

// 多轮对话 - 非流式
export const chat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages, context, model, conversationId } = req.body;
    const userId = req.userId;
    const isResumeContinuation = isResumeContinuationContext(context);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new AppError('消息不能为空', ErrorCodes.PARAM_ERROR, 400);
    }

    const lastMessage = messages[messages.length - 1];
    const formattedMessages: ChatHistoryMessage[] = messages.map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: String(message.content ?? ''),
    }));

    const trustedResult = await generateTrustedAIResponse({
      question: lastMessage.content,
      context,
      userId,
      model,
      history: formattedMessages,
    });

    const persistedConversationId = userId && lastMessage.role === 'user'
      ? isResumeContinuation
        ? await appendConversationAssistantAnswer({
          userId,
          conversationId,
          assistantAnswer: trustedResult.answer,
          sources: trustedResult.sources,
        })
        : await saveConversationExchange({
          userId,
          conversationId,
          userQuestion: lastMessage.content,
          assistantAnswer: trustedResult.answer,
          isEmergency: trustedResult.isEmergency,
          sources: trustedResult.sources,
        })
      : conversationId;

    return res.json(successResponse(buildTrustedResponsePayload(trustedResult, model, persistedConversationId)));
  } catch (error) {
    next(error);
  }
};

// 多轮对话 - 流式响应
export const chatStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages, context, model, conversationId } = req.body;
    const userId = req.userId;
    const isResumeContinuation = isResumeContinuationContext(context);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new AppError('消息不能为空', ErrorCodes.PARAM_ERROR, 400);
    }

    const lastMessage = messages[messages.length - 1];
    const formattedMessages: ChatHistoryMessage[] = messages.map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: String(message.content ?? ''),
    }));

    const trustedResult = await generateTrustedAIResponse({
      question: lastMessage.content,
      context,
      userId,
      model,
      history: formattedMessages,
    });

    const persistedConversationId = userId && lastMessage.role === 'user'
      ? isResumeContinuation
        ? await appendConversationAssistantAnswer({
          userId,
          conversationId,
          assistantAnswer: trustedResult.answer,
          sources: trustedResult.sources,
        })
        : await saveConversationExchange({
          userId,
          conversationId,
          userQuestion: lastMessage.content,
          assistantAnswer: trustedResult.answer,
          isEmergency: trustedResult.isEmergency,
          sources: trustedResult.sources,
        })
      : conversationId;

    return streamTrustedResult(res, trustedResult, model, persistedConversationId);
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    next(error);
  }
};

export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(Number(req.query.pageSize || 20), 50);
    const offset = (page - 1) * pageSize;

    const { rows, total } = await listUserChatSessions(userId!, pageSize, offset);
    res.json(paginatedResponse(rows, page, pageSize, total));
  } catch (error) {
    next(error);
  }
};

export const getConversationHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;
    const session = await getUserChatSession(userId!, conversationId);

    if (!session) {
      throw new AppError('对话不存在', ErrorCodes.PARAM_ERROR, 404);
    }

    res.json(successResponse(session));
  } catch (error) {
    next(error);
  }
};

export const deleteConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;
    const deleted = await softDeleteUserChatSession(userId!, conversationId);

    if (!deleted) {
      throw new AppError('对话不存在', ErrorCodes.PARAM_ERROR, 404);
    }

    res.json(successResponse({ deleted: true }, '删除成功'));
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
      taskBindings: getTaskModelBindings(),
      default: DEFAULT_MODEL_ID,
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

// 知识库检索
export const searchKnowledge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '');
    const category = req.query.category ? String(req.query.category) : undefined;
    const limit = Math.min(Number(req.query.limit || 10), 20);
    const userId = req.userId;

    if (!q.trim()) {
      throw new AppError('请输入搜索关键词', ErrorCodes.PARAM_ERROR, 400);
    }

    const profileContext = await buildUserProfileContext(userId);
    const searchQuery = shouldUseProfileHints(q, undefined)
      ? [q, ...profileContext.retrievalHints].filter(Boolean).join(' ')
      : q;

    const results = (await searchQAWithRewrite(searchQuery, { category, limit })).map((item) => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
      category: item.category,
      tags: item.tags,
      score: item.sourceReference.relevance,
      source: item.source,
      excerpt: item.sourceReference.excerpt,
    }));

    res.json(successResponse({
      results,
      total: results.length,
      query: q,
      personalized: searchQuery !== q,
    }));
  } catch (error) {
    next(error);
  }
};

// 用户反馈
export const submitFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      qaId,
      feedback,
      comment,
      messageId,
      conversationId,
      reason,
      actionTaken,
      triageCategory,
      riskLevel,
      sourceReliability,
      route,
      provider,
      model,
      entrySource,
      articleSlug,
      reportId,
    } = req.body;
    const userId = req.userId;

    if (!qaId || !feedback) {
      throw new AppError('请提供完整的反馈信息', ErrorCodes.PARAM_ERROR, 400);
    }

    // 持久化到 analytics_events（复用已有通用事件表，无需新迁移）
    try {
      await prisma.analyticsEvent.create({
        data: {
          userId: userId ? BigInt(userId) : null,
          eventName: 'ai_qa_feedback',
          source: 'ai_controller',
          properties: {
            qaId: String(qaId),
            feedback: String(feedback),
            comment: comment ? String(comment).slice(0, 500) : null,
            messageId: messageId ? String(messageId) : null,
            conversationId: conversationId ? String(conversationId) : null,
            reason: reason ? String(reason) : null,
            actionTaken: actionTaken ? String(actionTaken) : null,
            triageCategory: triageCategory ? String(triageCategory) : null,
            riskLevel: riskLevel ? String(riskLevel) : null,
            sourceReliability: sourceReliability ? String(sourceReliability) : null,
            route: route ? String(route) : null,
            provider: provider ? String(provider) : null,
            model: model ? String(model) : null,
            entrySource: entrySource ? String(entrySource) : null,
            articleSlug: articleSlug ? String(articleSlug) : null,
            reportId: reportId ? String(reportId) : null,
          },
        },
      });
    } catch (persistError) {
      // 写入失败不影响业务主流程，仅记日志
      console.error('[AI QA Feedback] 持久化失败:', persistError);
    }

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
