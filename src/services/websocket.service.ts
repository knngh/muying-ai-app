// WebSocket 服务 - 为小程序和 App 提供 AI 流式对话
import { IncomingMessage, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../middlewares/auth.middleware';
import { env } from '../config/env';
import { type SourceReference } from './knowledge.service';
import { appendConversationAssistantAnswer, saveConversationExchange } from './ai-session.service';
import { consumeAiQuota } from './subscription.service';
import { chunkTrustedAnswer, generateTrustedAIResponse } from './trusted-ai.service';
import { isResumeContinuationContext } from './ai-context.service';
import { buildAIActionCards } from './ai-action-card.service';
import { buildAIServiceDisclosure, type AIServiceDisclosure } from './ai-disclosure.service';
// WebSocket 消息协议类型（与 shared/types/ai.ts 保持一致）
interface AuthenticatedUpgradeRequest extends IncomingMessage {
  _userId?: string
}

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
    code?: number | string
    status?: number
    sources?: SourceReference[]
    actionCards?: Array<{
      id: string
      type: 'calendar' | 'knowledge' | 'archive' | 'follow_up'
      label: string
      title: string
      description?: string
      priority: 'primary' | 'secondary'
      payload?: {
        eventTitle?: string
        eventDescription?: string
        eventType?: 'checkup' | 'vaccine' | 'reminder' | 'exercise' | 'diet' | 'other'
        targetDate?: string
        knowledgeKeyword?: string
        sourceUrl?: string
        prefillQuestion?: string
        archiveFocus?: 'timeline' | 'report' | 'export'
      }
    }>
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
    aiDisclosure?: AIServiceDisclosure
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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message
    ? error.message
    : fallback;
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

function isRequestCanceled(ws: AuthenticatedWebSocket, requestId: string): boolean {
  return ws.canceledRequestIds?.has(requestId) || false;
}

function clearRequestCancellation(ws: AuthenticatedWebSocket, requestId: string): void {
  ws.canceledRequestIds?.delete(requestId);
}

export function setupWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/ws/ai',
    maxPayload: 1024 * 1024,
    verifyClient: (info, callback) => {
      const req = info.req as AuthenticatedUpgradeRequest;

      try {
        const authHeader = req.headers.authorization;
        const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.slice('Bearer '.length).trim()
          : '';
        const url = new URL(req.url || '', `http://${req.headers.host}`);
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
        req._userId = decoded.userId;
        callback(true);
      } catch (error: unknown) {
        if (error instanceof jwt.TokenExpiredError) {
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
    const upgradeRequest = req as AuthenticatedUpgradeRequest;
    ws.userId = upgradeRequest._userId;
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
      } catch (error: unknown) {
        console.error(`[WebSocket] Error handling ${type}:`, error);
        sendError(ws, requestId, getErrorMessage(error, '服务暂时不可用'));
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
  const actionCards = buildAIActionCards(result);
  const aiDisclosure = buildAIServiceDisclosure(result.model, result.provider);
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
      actionCards,
      model: result.model,
      provider: result.provider,
      route: result.route,
      aiDisclosure,
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
  } catch (streamError: unknown) {
    console.error(`[WebSocket] Stream error in ask_stream:`, streamError);
    sendError(ws, requestId, getErrorMessage(streamError, '流式响应出错'));
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
      ? isResumeContinuation
        ? await appendConversationAssistantAnswer({
          userId: ws.userId,
          conversationId,
          assistantAnswer: result.answer,
          sources: result.sources,
        })
        : await saveConversationExchange({
          userId: ws.userId,
          conversationId,
          userQuestion: lastMessage.content,
          assistantAnswer: result.answer,
          isEmergency: result.isEmergency,
          sources: result.sources,
        })
      : conversationId;

    sendTrustedResult(ws, requestId, result, persistedConversationId);
  } catch (streamError: unknown) {
    console.error(`[WebSocket] Stream error in chat_stream:`, streamError);
    sendError(ws, requestId, getErrorMessage(streamError, '流式响应出错'));
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
function sendError(
  ws: WebSocket,
  requestId: string,
  error: string,
  extras: { code?: number | string; status?: number } = {},
): void {
  sendMessage(ws, {
    type: 'error',
    requestId,
    data: {
      error,
      code: extras.code,
      status: extras.status,
    },
  });
}

async function ensureWsQuota(
  ws: AuthenticatedWebSocket,
  requestId: string,
  fingerprint?: string,
): Promise<boolean> {
  if (!ws.userId) {
    sendError(ws, requestId, '未授权，请先登录', { status: 401, code: 2005 });
    return false;
  }

  const result = await consumeAiQuota(ws.userId, { requestId, fingerprint });
  if (!result.allowed) {
    sendError(ws, requestId, '今日免费额度已用完，请升级会员后继续使用。', {
      status: 429,
      code: 4003,
    });
    return false;
  }

  return true;
}
