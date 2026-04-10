// WebSocket 服务 - 为小程序和 App 提供 AI 流式对话
import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../middlewares/auth.middleware';
import { env } from '../config/env';
import {
  isEmergencyQuestion,
  getEmergencyResponse,
  streamMultiTurnChat,
} from './ai-gateway.service';
import { buildKnowledgePack, type SourceReference } from './knowledge.service';
import { buildUserProfileContext } from './ai-user-context.service';
import { appendConversationAssistantAnswer, saveConversationExchange } from './ai-session.service';
import {
  classifyMaternalChildQuestion,
  hasExcludedDomainSignal,
  hasHealthOrCareSignal,
  hasMaternalChildSignal,
} from './ai-domain.service';
import { consumeAiQuota } from './subscription.service';
import { chunkTrustedAnswer, generateTrustedAIResponse } from './trusted-ai.service';
// WebSocket 消息协议类型（与 shared/types/ai.ts 保持一致）
interface WsClientMessage {
  type: 'ask_stream' | 'chat_stream' | 'ping' | 'cancel'
  requestId: string
  payload: {
    question?: string
    messages?: Array<{ role: string; content: string }>
    conversationId?: string
    model?: string
    context?: string | Record<string, string | number | boolean | null>
  }
}

interface WsServerMessage {
  type: 'chunk' | 'done' | 'error' | 'emergency'
  requestId: string
  data: {
    content?: string
    isEmergency?: boolean
    error?: string
    sources?: SourceReference[]
    disclaimer?: string
    conversationId?: string
    triageCategory?: 'normal' | 'caution' | 'emergency' | 'out_of_scope'
    riskLevel?: 'green' | 'yellow' | 'red'
    structuredAnswer?: {
      conclusion: string
      reasons: string[]
      actions: string[]
      whenToSeekCare: string[]
      uncertaintyNote?: string
    }
    uncertainty?: {
      level: 'none' | 'medium' | 'high'
      message?: string
    }
    sourceReliability?: 'authoritative' | 'mixed' | 'medical_platform_only' | 'dataset_only' | 'none'
    model?: string
    provider?: string
    route?: string
    followUpQuestions?: string[]
    degraded?: boolean
  }
}

// 带认证信息的 WebSocket
interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
  requestCount?: number;
  lastResetTime?: number;
  canceledRequestIds?: Set<string>;
}

// Rate limiting constants
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds
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
  /(宝宝|婴儿|新生儿|幼儿|孩子|儿童).{0,8}(发烧|发热|咳嗽|腹泻|拉肚子|便秘|吐奶|湿疹|黄疸|皮疹|疫苗|奶量|喂奶|吃奶|夜醒|夜里总醒|夜间醒|睡觉|睡眠|哄睡|哭闹|闹觉|安抚|便便|辅食|厌奶|发育|体重|身高)/u,
  /(发烧|发热|咳嗽|腹泻|拉肚子|便秘|吐奶|湿疹|黄疸|皮疹|疫苗|奶量|喂奶|吃奶|夜醒|夜里总醒|夜间醒|睡觉|睡眠|哄睡|哭闹|闹觉|安抚|便便|辅食|厌奶|发育|体重|身高).{0,8}(宝宝|婴儿|新生儿|幼儿|孩子|儿童)/u,
  /宝宝月龄|婴儿护理|儿童护理|儿科|宝宝作息|宝宝睡眠/u,
  /\d{1,2}\s*个?月(宝宝|婴儿|孩子|儿童)/u,
];

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

function normalizeContextText(context: unknown): string | undefined {
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

  const lines = Object.entries(context as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 8)
    .map(([key, value]) => `${key} ${String(value).trim()}`)
    .filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : undefined;
}

function buildDisplayContext(context: unknown): string | undefined {
  if (!context) {
    return undefined;
  }

  if (typeof context === 'string') {
    const trimmed = context.trim();
    return trimmed ? `用户补充背景：\n${trimmed}` : undefined;
  }

  if (typeof context !== 'object' || Array.isArray(context)) {
    return undefined;
  }

  const lines = Object.entries(context as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 8)
    .map(([key, value]) => `- ${key}：${String(value).trim()}`)
    .filter(Boolean);

  return lines.length > 0 ? `用户补充背景：\n${lines.join('\n')}` : undefined;
}

function buildWsQuotaFingerprint(type: WsClientMessage['type'], payload: WsClientMessage['payload']): string {
  return JSON.stringify({
    type,
    question: payload.question,
    messages: payload.messages,
    conversationId: payload.conversationId,
    context: payload.context,
    model: payload.model,
  });
}

function shouldUseProfileHints(question: string, context?: unknown): boolean {
  const contextText = normalizeContextText(context);
  return !hasExplicitStageSignal(question)
    && !hasExplicitStageSignal(contextText)
    && !hasChildcareSceneSignal(question)
    && !hasChildcareSceneSignal(contextText);
}

function buildAnswerPolicy(question: string, context?: unknown): string {
  const contextText = normalizeContextText(context);
  const explicitStage = hasExplicitStageSignal(question) || hasExplicitStageSignal(contextText);
  const childcareScene = hasChildcareSceneSignal(question) || hasChildcareSceneSignal(contextText);
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

function buildPromptContext(question: string, context: unknown, profilePrompt?: string, knowledgeContext?: string): string {
  const allowProfileHints = shouldUseProfileHints(question, context);

  return [
    buildAnswerPolicy(question, context),
    allowProfileHints ? profilePrompt : undefined,
    buildDisplayContext(context),
    knowledgeContext,
  ].filter(Boolean).join('\n\n');
}

function isResumeContinuationContext(context: unknown): boolean {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return false;
  }

  return (context as Record<string, unknown>).模式 === '原答案续写';
}

function isRequestCanceled(ws: AuthenticatedWebSocket, requestId: string): boolean {
  return ws.canceledRequestIds?.has(requestId) || false;
}

function clearRequestCancellation(ws: AuthenticatedWebSocket, requestId: string): void {
  ws.canceledRequestIds?.delete(requestId);
}

async function resolveDomainDecision(
  userId: string | undefined,
  question: string,
  options?: {
    context?: unknown;
    history?: Array<string | { role?: string; content?: string }>;
  },
) {
  const initialDecision = classifyMaternalChildQuestion(question, {
    context: options?.context,
    history: options?.history,
  });

  if (initialDecision.status === 'in_scope' || !userId) {
    return initialDecision;
  }

  if (hasExcludedDomainSignal(question, { context: options?.context, history: options?.history })) {
    return initialDecision;
  }

  if (!hasHealthOrCareSignal(question, { context: options?.context, history: options?.history })) {
    return initialDecision;
  }

  const profileContext = await buildUserProfileContext(userId);
  const profileSignal = profileContext.retrievalHints.join('\n').trim();

  if (!profileSignal) {
    return initialDecision;
  }

  return hasMaternalChildSignal(profileSignal)
    ? { status: 'in_scope' as const }
    : initialDecision;
}

export function setupWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/ws/ai',
    maxPayload: 1024 * 1024,
    verifyClient: (info, callback) => {
      try {
        const authHeader = info.req.headers.authorization;
        const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.slice('Bearer '.length).trim()
          : '';
        const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
        const queryToken = url.searchParams.get('token') || '';
        const token = bearerToken || queryToken;

        if (!token) {
          callback(false, 401, 'Unauthorized: No token provided');
          return;
        }

        const decoded = jwt.verify(
          token,
          env.JWT_SECRET
        ) as JwtPayload;

        // 将 userId 附加到请求上，后续在 connection 事件中读取
        (info.req as any)._userId = decoded.userId;
        callback(true);
      } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
          callback(false, 401, 'Unauthorized: Token expired');
        } else {
          callback(false, 401, 'Unauthorized: Invalid token');
        }
      }
    },
  });

  // 心跳检测（30 秒间隔）
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as AuthenticatedWebSocket;
      if (client.isAlive === false) {
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
    ws.userId = (req as any)._userId;
    ws.isAlive = true;
    ws.canceledRequestIds = new Set();

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (rawData) => {
      let msg: WsClientMessage;

      try {
        msg = JSON.parse(rawData.toString());
      } catch {
        sendError(ws, 'unknown', '消息格式无效');
        return;
      }

      const { type, requestId, payload } = msg;

      if (type === 'ping') {
        ws.isAlive = true;
        return;
      }

      if (type === 'cancel') {
        ws.canceledRequestIds?.add(requestId);
        return;
      }

      if (!requestId) {
        sendError(ws, 'unknown', '缺少 requestId');
        return;
      }

      if (!msg.payload || typeof msg.payload !== 'object') {
        sendError(ws, msg.requestId || 'unknown', 'payload is required');
        return;
      }

      // Per-connection rate limiting for AI requests
      if (type === 'ask_stream' || type === 'chat_stream') {
        const now = Date.now();
        if (!ws.lastResetTime || now - ws.lastResetTime >= RATE_LIMIT_WINDOW_MS) {
          ws.requestCount = 0;
          ws.lastResetTime = now;
        }
        ws.requestCount = (ws.requestCount || 0) + 1;
        if (ws.requestCount > RATE_LIMIT_MAX_REQUESTS) {
          sendError(ws, requestId, '请求过于频繁，请稍后再试');
          return;
        }
      }

      try {
        if (type === 'ask_stream') {
          await handleAskStream(ws, requestId, payload);
        } else if (type === 'chat_stream') {
          await handleChatStream(ws, requestId, payload);
        } else {
          sendError(ws, requestId, `未知消息类型: ${type}`);
        }
      } catch (error: any) {
        console.error(`[WebSocket] Error handling ${type}:`, error);
        sendError(ws, requestId, error.message || '服务暂时不可用');
      }
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
    });
  });

  console.log('🔌 WebSocket server ready at /ws/ai');
  return wss;
}

function sendTrustedResult(
  ws: AuthenticatedWebSocket,
  requestId: string,
  result: Awaited<ReturnType<typeof generateTrustedAIResponse>>,
  conversationId?: string,
) {
  for (const chunk of chunkTrustedAnswer(result.answer)) {
    sendMessage(ws, {
      type: 'chunk',
      requestId,
      data: {
        content: chunk,
        isEmergency: result.isEmergency,
      },
    });
  }

  sendMessage(ws, {
    type: result.isEmergency ? 'emergency' : 'done',
    requestId,
    data: {
      content: result.isEmergency ? result.answer : undefined,
      isEmergency: result.isEmergency,
      sources: result.sources,
      disclaimer: result.disclaimer,
      conversationId,
      triageCategory: result.triageCategory,
      riskLevel: result.riskLevel,
      structuredAnswer: result.structuredAnswer,
      uncertainty: result.uncertainty,
      sourceReliability: result.sourceReliability,
      followUpQuestions: result.followUpQuestions,
      degraded: result.degraded,
      model: result.model,
      provider: result.provider,
      route: result.route,
    },
  });
}

// 处理单轮提问流式
async function handleAskStream(
  ws: AuthenticatedWebSocket,
  requestId: string,
  payload: WsClientMessage['payload']
) {
  const { question, model, context, conversationId } = payload;
  clearRequestCancellation(ws, requestId);

  if (!question) {
    sendError(ws, requestId, '请输入问题');
    return;
  }

  if (!(await ensureWsQuota(ws, requestId, buildWsQuotaFingerprint('ask_stream', payload)))) {
    return;
  }

  try {
    const result = await generateTrustedAIResponse({
      question,
      context,
      userId: ws.userId,
      model,
    });

    if (isRequestCanceled(ws, requestId) || ws.readyState !== WebSocket.OPEN) {
      clearRequestCancellation(ws, requestId);
      return;
    }

    const persistedConversationId = ws.userId && result.answer.trim()
      ? await saveConversationExchange({
        userId: ws.userId,
        conversationId,
        userQuestion: question,
        assistantAnswer: result.answer,
        isEmergency: result.isEmergency,
        sources: result.sources,
      })
      : conversationId;

    sendTrustedResult(ws, requestId, result, persistedConversationId);
  } catch (streamError: any) {
    console.error(`[WebSocket] Stream error in ask_stream:`, streamError);
    sendError(ws, requestId, streamError.message || '流式响应出错');
  }

  console.log(`[WebSocket QA] User: ${ws.userId}, Question: ${question.substring(0, 50)}...`);
}

// 处理多轮对话流式
async function handleChatStream(
  ws: AuthenticatedWebSocket,
  requestId: string,
  payload: WsClientMessage['payload']
) {
  const { messages, model, context, conversationId } = payload;
  const isResumeContinuation = isResumeContinuationContext(context);
  clearRequestCancellation(ws, requestId);

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    sendError(ws, requestId, '消息不能为空');
    return;
  }

  // 检测最后一条消息是否为紧急问题
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role === 'user' && !(await ensureWsQuota(ws, requestId, buildWsQuotaFingerprint('chat_stream', payload)))) {
    return;
  }

  // 转换消息格式（过滤掉客户端提供的 system 角色消息）
  const formattedMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  if (!isResumeContinuation) {
    try {
      const result = await generateTrustedAIResponse({
        question: lastMessage.content,
        context,
        userId: ws.userId,
        model,
        history: formattedMessages,
      });

      if (isRequestCanceled(ws, requestId) || ws.readyState !== WebSocket.OPEN) {
        clearRequestCancellation(ws, requestId);
        return;
      }

      const persistedConversationId = ws.userId && lastMessage.role === 'user' && result.answer.trim()
        ? await saveConversationExchange({
          userId: ws.userId,
          conversationId,
          userQuestion: lastMessage.content,
          assistantAnswer: result.answer,
          isEmergency: result.isEmergency,
          sources: result.sources,
        })
        : conversationId;

      sendTrustedResult(ws, requestId, result, persistedConversationId);
    } catch (streamError: any) {
      console.error(`[WebSocket] Stream error in chat_stream:`, streamError);
      sendError(ws, requestId, streamError.message || '流式响应出错');
    }
    return;
  }

  const profileContext = await buildUserProfileContext(ws.userId);
  const retrievalQuery = lastMessage.role === 'user'
    ? shouldUseProfileHints(lastMessage.content, context)
      ? [lastMessage.content, ...profileContext.retrievalHints].filter(Boolean).join(' ')
      : lastMessage.content
    : lastMessage.content;
  const knowledgePack = lastMessage.role === 'user'
    ? buildKnowledgePack(retrievalQuery, { limit: 3 })
    : { context: '', sources: [], followUpQuestions: [], results: [] };
  const finalContext = buildPromptContext(lastMessage.content, context, profileContext.prompt, knowledgePack.context);

  // 流式输出
  try {
    let answer = '';
    let resolvedRoute: { provider: string; model: string; route: string } | undefined;
    for await (const chunk of streamMultiTurnChat(formattedMessages, {
      model,
      context: finalContext,
      onRouteResolved: (route) => {
        resolvedRoute = route
      },
    })) {
      answer += chunk;
      if (isRequestCanceled(ws, requestId)) break;
      if (ws.readyState !== WebSocket.OPEN) break;
      sendMessage(ws, {
        type: 'chunk',
        requestId,
        data: { content: chunk },
      });
    }

    const wasCanceled = isRequestCanceled(ws, requestId);
    if (ws.readyState === WebSocket.OPEN) {
      const persistedConversationId = ws.userId && lastMessage.role === 'user' && answer.trim()
        ? isResumeContinuation
          ? await appendConversationAssistantAnswer({
            userId: ws.userId,
            conversationId,
            assistantAnswer: answer,
            sources: knowledgePack.sources,
          })
          : await saveConversationExchange({
            userId: ws.userId,
            conversationId,
            userQuestion: lastMessage.content,
            assistantAnswer: answer,
            sources: knowledgePack.sources,
          })
        : conversationId;

      sendMessage(ws, {
        type: 'done',
        requestId,
        data: {
          sources: knowledgePack.sources,
          disclaimer: '温馨提示：这份答复供您先参考，如症状持续、加重或您心里仍不踏实，请尽快咨询医生。',
          conversationId: persistedConversationId,
          model: resolvedRoute?.model || model,
          provider: resolvedRoute?.provider,
          route: resolvedRoute?.route,
        },
      });
    }
    if (wasCanceled) {
      clearRequestCancellation(ws, requestId);
    }
  } catch (streamError: any) {
    console.error(`[WebSocket] Stream error in chat_stream:`, streamError);
    sendError(ws, requestId, streamError.message || '流式响应出错');
  }

  console.log(`[WebSocket Chat] User: ${ws.userId}`);
}

// 发送消息辅助函数
function sendMessage(ws: WebSocket, message: WsServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// 发送错误辅助函数
function sendError(ws: WebSocket, requestId: string, error: string): void {
  sendMessage(ws, {
    type: 'error',
    requestId,
    data: { error },
  });
}

async function ensureWsQuota(
  ws: AuthenticatedWebSocket,
  requestId: string,
  fingerprint?: string,
): Promise<boolean> {
  if (!ws.userId) {
    sendError(ws, requestId, '未授权，请先登录');
    return false;
  }

  const result = await consumeAiQuota(ws.userId, { requestId, fingerprint });
  if (!result.allowed) {
    sendError(ws, requestId, '今日免费额度已用完，请升级会员后继续使用。');
    return false;
  }

  return true;
}
