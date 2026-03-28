import { Request, Response, NextFunction } from 'express';
import { successResponse, AppError, ErrorCodes } from '../middlewares/error.middleware';
import {
  isEmergencyQuestion,
  getEmergencyResponse,
  ragEnhancedAnswer,
  multiTurnChat,
  streamMultiTurnChat,
  getAvailableModels,
  getDefaultModel,
  healthCheck,
} from '../services/ai-gateway.service';
import { buildKnowledgePack, searchQA, getKnowledgeStats } from '../services/knowledge.service';
import { buildUserProfileContext } from '../services/ai-user-context.service';
import {
  saveConversationExchange,
  listUserChatSessions,
  getUserChatSession,
  softDeleteUserChatSession,
} from '../services/ai-session.service';

const AI_DISCLAIMER = '⚠️ 免责声明：本回答由 AI 生成，仅供参考，不构成医疗建议。如有健康问题，请咨询专业医生。';
const EMERGENCY_DISCLAIMER = '🚨 重要提示：如遇紧急情况，请立即就医！';
const DEGRADED_DISCLAIMER = '⚠️ 当前 AI 服务暂时不可用，以下内容基于知识库整理，仅供参考，不构成医疗建议。';
const DEFAULT_MODEL_ID = getDefaultModel();
const EXPLICIT_STAGE_PATTERNS = [
  /孕早期|怀孕早期|怀孕初期|刚怀孕/u,
  /孕中期|怀孕中期/u,
  /孕晚期|怀孕晚期|怀孕后期/u,
  /备孕/u,
  /产后|月子/u,
  /新生儿/u,
  /\d{1,2}\s*周/u,
  /怀孕\d{1,2}\s*个?月/u,
  /\d{1,2}\s*个?月龄/u,
  /\d{1,2}\s*个?月宝宝/u,
];
const CHILDCARE_SCENE_PATTERNS = [
  /(宝宝|婴儿|新生儿|幼儿|孩子|儿童).{0,8}(发烧|发热|咳嗽|腹泻|拉肚子|便秘|吐奶|湿疹|黄疸|皮疹|疫苗|奶量|喂奶|吃奶|夜醒|便便)/u,
  /(发烧|发热|咳嗽|腹泻|拉肚子|便秘|吐奶|湿疹|黄疸|皮疹|疫苗|奶量|喂奶|吃奶|夜醒|便便).{0,8}(宝宝|婴儿|新生儿|幼儿|孩子|儿童)/u,
  /宝宝月龄|婴儿护理|儿童护理|儿科/u,
  /\d{1,2}\s*个?月(宝宝|婴儿|孩子|儿童)/u,
];

function normalizeContext(context: unknown): string | undefined {
  if (!context) {
    return undefined;
  }

  if (typeof context === 'string') {
    const trimmed = context.trim();
    return trimmed || undefined;
  }

  if (typeof context !== 'object' || Array.isArray(context)) {
    return undefined;
  }

  const labelMap: Record<string, string> = {
    stage: '当前阶段',
    weeks: '孕周',
    week: '孕周',
    babyAge: '宝宝年龄',
    ageMonths: '宝宝月龄',
    symptoms: '补充症状',
    notes: '补充说明',
  };

  const lines = Object.entries(context as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 8)
    .map(([key, value]) => `- ${labelMap[key] || key}：${String(value)}`);

  if (lines.length === 0) {
    return undefined;
  }

  return `用户补充背景：\n${lines.join('\n')}`;
}

function buildMergedContext(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join('\n\n');
}

function hasExplicitStageSignal(text?: string): boolean {
  if (!text) {
    return false;
  }

  return EXPLICIT_STAGE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasChildcareSceneSignal(text?: string): boolean {
  if (!text) {
    return false;
  }

  return CHILDCARE_SCENE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasExplicitStructuredContext(context: unknown): boolean {
  if (!context) {
    return false;
  }

  if (typeof context === 'string') {
    return hasExplicitStageSignal(context);
  }

  if (typeof context !== 'object' || Array.isArray(context)) {
    return false;
  }

  const record = context as Record<string, unknown>;
  return ['stage', 'weeks', 'week', 'babyAge', 'ageMonths'].some((key) => {
    const value = record[key];
    return value !== undefined && value !== null && value !== '';
  });
}

function shouldUseProfileHints(question: string, userContext: unknown): boolean {
  return !hasExplicitStageSignal(question)
    && !hasExplicitStructuredContext(userContext)
    && !hasChildcareSceneSignal(question);
}

function buildAnswerPolicy(question: string, userContext: unknown): string {
  const explicitStage = hasExplicitStageSignal(question) || hasExplicitStructuredContext(userContext);
  const childcareScene = hasChildcareSceneSignal(question);
  const lines = [
    '回答策略：',
    '- 以用户当前问题和本轮补充信息为优先。',
    '- 用户历史档案仅作辅助参考，可能不是最新状态。',
  ];

  if (explicitStage) {
    lines.push('- 本轮问题中已明确给出阶段、孕周或月龄时，请以本轮描述为准，不要被历史档案覆盖。');
    lines.push('- 如果本轮描述和历史档案不一致，先回答当前问题，只在结尾用一句话提醒用户确认最新阶段。');
  } else if (childcareScene) {
    lines.push('- 本轮问题明显指向宝宝/儿童护理场景时，不要套用孕期档案或孕周信息。');
  } else {
    lines.push('- 若用户未明确说明阶段、孕周或月龄，可谨慎参考历史档案补充建议。');
  }

  return lines.join('\n');
}

function buildGatewayFallbackAnswer(
  question: string,
  knowledgePack: Awaited<ReturnType<typeof resolveKnowledge>>['knowledgePack']
): string {
  if (knowledgePack.results.length === 0) {
    return [
      '当前 AI 服务暂时不可用，我先给你一个稳妥建议：',
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
    '当前 AI 服务暂时不可用，我先根据知识库给你整理可参考内容：',
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

async function resolveKnowledge(question: string, userId?: string, userContext?: unknown) {
  const profileContext = await buildUserProfileContext(userId);
  const retrievalQuery = shouldUseProfileHints(question, userContext)
    ? [question, ...profileContext.retrievalHints].filter(Boolean).join(' ')
    : question;
  const knowledgePack = buildKnowledgePack(retrievalQuery, { limit: 3 });

  return {
    profileContext,
    knowledgePack,
    finalContext: buildMergedContext(
      profileContext.prompt,
      knowledgePack.context,
    ),
  };
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

// 用户提问（单轮）- 非流式
export const askQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, context, model, conversationId } = req.body;
    const userId = req.userId;

    if (!question) {
      throw new AppError('请输入问题', ErrorCodes.PARAM_ERROR, 400);
    }

    if (isEmergencyQuestion(question)) {
      const persistedConversationId = userId
        ? await saveConversationExchange({
          userId,
          conversationId,
          userQuestion: question,
          assistantAnswer: getEmergencyResponse(),
          isEmergency: true,
        })
        : conversationId;

      return res.json(successResponse({
        answer: getEmergencyResponse(),
        isEmergency: true,
        sources: [],
        confidence: 1,
        disclaimer: EMERGENCY_DISCLAIMER,
        followUpQuestions: [],
        model: model || DEFAULT_MODEL_ID,
        conversationId: persistedConversationId,
      }));
    }

    const { profileContext, knowledgePack } = await resolveKnowledge(question, userId, context);
    const finalContext = buildPromptContext(question, context, profileContext.prompt, knowledgePack.context);
    const result = await ragEnhancedAnswer(question, finalContext);

    const persistedConversationId = userId
      ? await saveConversationExchange({
        userId,
        conversationId,
        userQuestion: question,
        assistantAnswer: result.answer,
        sources: knowledgePack.sources,
      })
      : conversationId;

    res.json(successResponse({
      answer: result.answer,
      isEmergency: false,
      sources: knowledgePack.sources,
      confidence: estimateConfidence(knowledgePack.results[0]?.score || result.confidence * 100),
      disclaimer: result.confidence > 0 ? AI_DISCLAIMER : DEGRADED_DISCLAIMER,
      followUpQuestions: knowledgePack.followUpQuestions,
      model: model || DEFAULT_MODEL_ID,
      conversationId: persistedConversationId,
    }));
  } catch (error) {
    next(error);
  }
};

// 用户提问（流式响应）
export const askQuestionStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, context, model, conversationId } = req.body;
    const userId = req.userId;

    if (!question) {
      throw new AppError('请输入问题', ErrorCodes.PARAM_ERROR, 400);
    }

    if (isEmergencyQuestion(question)) {
      const persistedConversationId = userId
        ? await saveConversationExchange({
          userId,
          conversationId,
          userQuestion: question,
          assistantAnswer: getEmergencyResponse(),
          isEmergency: true,
        })
        : conversationId;

      return res.json(successResponse({
        answer: getEmergencyResponse(),
        isEmergency: true,
        sources: [],
        disclaimer: EMERGENCY_DISCLAIMER,
        conversationId: persistedConversationId,
      }));
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const { profileContext, knowledgePack } = await resolveKnowledge(question, userId, context);
    const finalContext = buildPromptContext(question, context, profileContext.prompt, knowledgePack.context);
    const messages = [{ role: 'user' as const, content: question }];

    try {
      let answer = '';
      for await (const chunk of streamMultiTurnChat(messages, { model, context: finalContext })) {
        answer += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      const persistedConversationId = userId
        ? await saveConversationExchange({
          userId,
          conversationId,
          userQuestion: question,
          assistantAnswer: answer,
          sources: knowledgePack.sources,
        })
        : conversationId;

      res.write(`data: ${JSON.stringify({
        done: true,
        sources: knowledgePack.sources,
        disclaimer: AI_DISCLAIMER,
        followUpQuestions: knowledgePack.followUpQuestions,
        conversationId: persistedConversationId,
      })}\n\n`);
      res.end();
    } catch (streamError) {
      console.error('[AI QA Stream] Error:', streamError);
      const fallbackAnswer = buildGatewayFallbackAnswer(question, knowledgePack);
      const persistedConversationId = userId
        ? await saveConversationExchange({
          userId,
          conversationId,
          userQuestion: question,
          assistantAnswer: fallbackAnswer,
          sources: knowledgePack.sources,
        })
        : conversationId;

      res.write(`data: ${JSON.stringify({ content: fallbackAnswer })}\n\n`);
      res.write(`data: ${JSON.stringify({
        done: true,
        degraded: true,
        sources: knowledgePack.sources,
        disclaimer: DEGRADED_DISCLAIMER,
        followUpQuestions: knowledgePack.followUpQuestions,
        conversationId: persistedConversationId,
      })}\n\n`);
      res.end();
    }
  } catch (error) {
    next(error);
  }
};

// 多轮对话 - 非流式
export const chat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages, context, model, conversationId } = req.body;
    const userId = req.userId;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new AppError('消息不能为空', ErrorCodes.PARAM_ERROR, 400);
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user' && isEmergencyQuestion(lastMessage.content)) {
      const persistedConversationId = userId
        ? await saveConversationExchange({
          userId,
          conversationId,
          userQuestion: lastMessage.content,
          assistantAnswer: getEmergencyResponse(),
          isEmergency: true,
        })
        : conversationId;

      return res.json(successResponse({
        message: {
          role: 'assistant',
          content: getEmergencyResponse(),
          timestamp: new Date().toISOString(),
        },
        isEmergency: true,
        sources: [],
        followUpQuestions: [],
        disclaimer: EMERGENCY_DISCLAIMER,
        conversationId: persistedConversationId,
      }));
    }

    const formattedMessages = messages.map((message: any) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));

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

    try {
      answer = await multiTurnChat(formattedMessages, {
        model,
        context: finalContext,
      });
    } catch (chatError) {
      console.error('[AI Chat] Error:', chatError);
      answer = buildGatewayFallbackAnswer(lastMessage.content, knowledgePack);
      degraded = true;
    }

    const persistedConversationId = userId && lastMessage.role === 'user'
      ? await saveConversationExchange({
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
      model: model || DEFAULT_MODEL_ID,
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

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new AppError('消息不能为空', ErrorCodes.PARAM_ERROR, 400);
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user' && isEmergencyQuestion(lastMessage.content)) {
      const persistedConversationId = userId
        ? await saveConversationExchange({
          userId,
          conversationId,
          userQuestion: lastMessage.content,
          assistantAnswer: getEmergencyResponse(),
          isEmergency: true,
        })
        : conversationId;

      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ content: getEmergencyResponse(), isEmergency: true })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true, disclaimer: EMERGENCY_DISCLAIMER, conversationId: persistedConversationId })}\n\n`);
      return res.end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const formattedMessages = messages.map((message: any) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));

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

    try {
      let answer = '';
      for await (const chunk of streamMultiTurnChat(formattedMessages, {
        model,
        context: finalContext,
      })) {
        answer += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      const persistedConversationId = userId && lastMessage.role === 'user'
        ? await saveConversationExchange({
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
        conversationId: persistedConversationId,
      })}\n\n`);
      res.end();
    } catch (streamError) {
      console.error('[AI Chat Stream] Error:', streamError);
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
