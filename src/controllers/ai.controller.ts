import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { successResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';
import {
  isEmergencyQuestion,
  getEmergencyResponse,
  multiTurnChatDetailed,
  streamMultiTurnChat,
  getAvailableModels,
  getDefaultModel,
  getTaskModelBindings,
  healthCheck,
} from '../services/ai-gateway.service';
import { buildKnowledgePack, searchQA, getKnowledgeStats } from '../services/knowledge.service';
import { buildUserProfileContext } from '../services/ai-user-context.service';
import {
  saveConversationExchange,
  appendConversationAssistantAnswer,
  listUserChatSessions,
  getUserChatSession,
  softDeleteUserChatSession,
} from '../services/ai-session.service';
import { type AIDomainDecision } from '../services/ai-domain.service';
import { chunkTrustedAnswer, generateTrustedAIResponse } from '../services/trusted-ai.service';
import {
  normalizeContext,
  buildMergedContext,
  shouldUseProfileHints,
  buildAnswerPolicy,
  resolveKnowledge,
  isResumeContinuationContext,
} from '../services/ai-context.service';
import { logger, genRequestId } from '../utils/logger';

const AI_DISCLAIMER = '温馨提示：这份答复用于帮助您先做初步了解，不能替代医生面诊；如果症状明显、持续加重，或您仍然不放心，请及时就医。';
const EMERGENCY_DISCLAIMER = '🚨 重要提示：如遇紧急情况，请立即就医！';
const DEGRADED_DISCLAIMER = '温馨提示：当前问答服务暂时不可用，以下内容由知识库整理，供您先参考；若身体不适明显，请及时就医。';
const DEFAULT_MODEL_ID = getDefaultModel();

function buildGatewayFallbackAnswer(
  question: string,
  knowledgePack: Awaited<ReturnType<typeof resolveKnowledge>>['knowledgePack']
): string {
  if (knowledgePack.results.length === 0) {
    return [
    '当前问答服务暂时不可用，我先给你一个稳妥建议：',
      '1. 先观察症状变化，避免自行用药或处理。',
      '2. 可以补充孕周、宝宝月龄、持续时间、体温或检查结果，我会继续按知识库帮你检索。',
      '3. 如果出现高热、持续出血、呼吸困难、精神状态明显变差等情况，请尽快线下就医。',
      `问题回顾：${question}`,
    ].join('\n');
  }

  const sections = knowledgePack.results.slice(0, 2).map((item, index) => {
    return [
      `${index + 1}. ${item.question}`,
      item.answer,
    ].join('\n');
  });

  return [
    '当前问答服务暂时不可用，我先根据知识库给你整理可参考内容：',
    ...sections,
    '如果你愿意，可以继续补充更具体的症状、孕周或宝宝月龄，我会继续按知识库帮你细化。',
  ].join('\n\n');
}

function estimateConfidence(score?: number): number {
  if (!score || score <= 0) {
    return 0.35;
  }

  return Math.max(0.35, Math.min(0.96, Number((score / 100).toFixed(2))));
}

function buildPromptContext(
  question: string,
  userContext: unknown,
  profilePrompt?: string,
  knowledgeContext?: string
): string {
  const allowProfileHints = shouldUseProfileHints(question, userContext);

  return buildMergedContext(
    buildAnswerPolicy(question, userContext),
    allowProfileHints ? profilePrompt : undefined,
    normalizeContext(userContext),
    knowledgeContext,
  );
}

async function persistDomainDecisionExchange(
  userId: string | undefined,
  conversationId: string | undefined,
  question: string,
  answer: string,
) {
  if (!userId) {
    return conversationId;
  }

  return saveConversationExchange({
    userId,
    conversationId,
    userQuestion: question,
    assistantAnswer: answer,
  });
}

function respondWithDomainDecision(
  res: Response,
  decision: AIDomainDecision,
  model: string | undefined,
  conversationId: string | undefined,
) {
  return res.json(successResponse({
    answer: decision.answer,
    isEmergency: false,
    sources: [],
    confidence: 1,
    disclaimer: decision.disclaimer,
    followUpQuestions: [],
    model: model || DEFAULT_MODEL_ID,
    conversationId,
  }));
}

function buildTrustedResponsePayload(
  result: Awaited<ReturnType<typeof generateTrustedAIResponse>>,
  model?: string,
  conversationId?: string,
) {
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
    const formattedMessages = messages.map((message: any) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));

    if (!isResumeContinuation) {
      const trustedResult = await generateTrustedAIResponse({
        question: lastMessage.content,
        context,
        userId,
        model,
        history: formattedMessages,
      });

      const persistedConversationId = userId && lastMessage.role === 'user'
        ? await saveConversationExchange({
          userId,
          conversationId,
          userQuestion: lastMessage.content,
          assistantAnswer: trustedResult.answer,
          isEmergency: trustedResult.isEmergency,
          sources: trustedResult.sources,
        })
        : conversationId;

      return res.json(successResponse(buildTrustedResponsePayload(trustedResult, model, persistedConversationId)));
    }

    const profileContext = await buildUserProfileContext(userId);
    const allowProfileHints = lastMessage.role === 'user'
      ? shouldUseProfileHints(lastMessage.content, context)
      : false;
    const retrievalQuery = lastMessage.role === 'user'
      ? allowProfileHints
      ? [lastMessage.content, ...profileContext.retrievalHints].filter(Boolean).join(' ')
      : lastMessage.content
      : lastMessage.content;
    const knowledgePack = lastMessage.role === 'user'
      ? buildKnowledgePack(retrievalQuery, { limit: 3 })
      : { context: '', sources: [], followUpQuestions: [], results: [] };

    const finalContext = buildPromptContext(lastMessage.content, context, profileContext.prompt, knowledgePack.context);
    let answer: string;
    let degraded = false;
    let routeInfo: { provider: string; model: string; route: string } | undefined;

    try {
      const result = await multiTurnChatDetailed(formattedMessages, {
        model,
        context: finalContext,
      });
      answer = result.answer;
      routeInfo = result.route;
    } catch (chatError) {
      logger.error('ai.chat.gateway_error', {
        component: 'ai.controller',
        event: 'chat.gateway_error',
        userId,
        err: chatError,
      });
      answer = buildGatewayFallbackAnswer(lastMessage.content, knowledgePack);
      degraded = true;
    }

    const persistedConversationId = userId && lastMessage.role === 'user'
      ? isResumeContinuation
        ? await appendConversationAssistantAnswer({
          userId,
          conversationId,
          assistantAnswer: answer,
          sources: knowledgePack.sources,
        })
        : await saveConversationExchange({
          userId,
          conversationId,
          userQuestion: lastMessage.content,
          assistantAnswer: answer,
          sources: knowledgePack.sources,
        })
      : conversationId;

    res.json(successResponse({
      message: {
        role: 'assistant',
        content: answer,
        timestamp: new Date().toISOString(),
      },
      isEmergency: false,
      sources: knowledgePack.sources,
      confidence: estimateConfidence(knowledgePack.results[0]?.score),
      followUpQuestions: knowledgePack.followUpQuestions,
      disclaimer: degraded ? DEGRADED_DISCLAIMER : AI_DISCLAIMER,
      degraded,
      model: routeInfo?.model || model || DEFAULT_MODEL_ID,
      provider: routeInfo?.provider,
      route: routeInfo?.route,
      conversationId: persistedConversationId,
    }));
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
    const formattedMessages = messages.map((message: any) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));

    if (!isResumeContinuation) {
      const trustedResult = await generateTrustedAIResponse({
        question: lastMessage.content,
        context,
        userId,
        model,
        history: formattedMessages,
      });

      const persistedConversationId = userId && lastMessage.role === 'user'
        ? await saveConversationExchange({
          userId,
          conversationId,
          userQuestion: lastMessage.content,
          assistantAnswer: trustedResult.answer,
          isEmergency: trustedResult.isEmergency,
          sources: trustedResult.sources,
        })
        : conversationId;

      return streamTrustedResult(res, trustedResult, model, persistedConversationId);
    }

    setSseHeaders(res);

    const profileContext = await buildUserProfileContext(userId);
    const allowProfileHints = lastMessage.role === 'user'
      ? shouldUseProfileHints(lastMessage.content, context)
      : false;
    const retrievalQuery = lastMessage.role === 'user'
      ? allowProfileHints
      ? [lastMessage.content, ...profileContext.retrievalHints].filter(Boolean).join(' ')
      : lastMessage.content
      : lastMessage.content;
    const knowledgePack = lastMessage.role === 'user'
      ? buildKnowledgePack(retrievalQuery, { limit: 3 })
      : { context: '', sources: [], followUpQuestions: [], results: [] };

    const finalContext = buildPromptContext(lastMessage.content, context, profileContext.prompt, knowledgePack.context);
    let resolvedRoute: { provider: string; model: string; route: string } | undefined;

    try {
      let answer = '';
      for await (const chunk of streamMultiTurnChat(formattedMessages, {
        model,
        context: finalContext,
        onRouteResolved: (route) => {
          resolvedRoute = route;
        },
      })) {
        answer += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      const persistedConversationId = userId && lastMessage.role === 'user'
        ? isResumeContinuation
          ? await appendConversationAssistantAnswer({
            userId,
            conversationId,
            assistantAnswer: answer,
            sources: knowledgePack.sources,
          })
          : await saveConversationExchange({
            userId,
            conversationId,
            userQuestion: lastMessage.content,
            assistantAnswer: answer,
            sources: knowledgePack.sources,
          })
        : conversationId;

      res.write(`data: ${JSON.stringify({
        done: true,
        sources: knowledgePack.sources,
        followUpQuestions: knowledgePack.followUpQuestions,
        disclaimer: AI_DISCLAIMER,
        model: resolvedRoute?.model || model || DEFAULT_MODEL_ID,
        provider: resolvedRoute?.provider,
        route: resolvedRoute?.route,
        conversationId: persistedConversationId,
      })}\n\n`);
      res.end();
    } catch (streamError) {
      logger.error('ai.chat_stream.gateway_error', {
        component: 'ai.controller',
        event: 'chat_stream.gateway_error',
        userId,
        err: streamError,
      });
      const fallbackAnswer = buildGatewayFallbackAnswer(lastMessage.content, knowledgePack);
      const persistedConversationId = userId && lastMessage.role === 'user'
        ? await saveConversationExchange({
          userId,
          conversationId,
          userQuestion: lastMessage.content,
          assistantAnswer: fallbackAnswer,
          sources: knowledgePack.sources,
        })
        : conversationId;

      res.write(`data: ${JSON.stringify({ content: fallbackAnswer })}\n\n`);
      res.write(`data: ${JSON.stringify({
        done: true,
        degraded: true,
        sources: knowledgePack.sources,
        followUpQuestions: knowledgePack.followUpQuestions,
        disclaimer: DEGRADED_DISCLAIMER,
        conversationId: persistedConversationId,
      })}\n\n`);
      res.end();
    }
  } catch (error) {
    next(error);
  }
};

export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const limit = Math.min(Number(req.query.limit || 20), 50);

    const sessions = await listUserChatSessions(userId!, limit);
    res.json(successResponse({ conversations: sessions }));
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

    const results = searchQA(searchQuery, { category, limit }).map((item) => ({
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
    const { qaId, feedback, comment } = req.body;
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
