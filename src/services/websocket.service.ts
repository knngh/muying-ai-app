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
import { saveConversationExchange } from './ai-session.service';
// WebSocket 消息协议类型（与 shared/types/ai.ts 保持一致）
interface WsClientMessage {
  type: 'ask_stream' | 'chat_stream' | 'ping'
  requestId: string
  payload: {
    question?: string
    messages?: Array<{ role: string; content: string }>
    conversationId?: string
    model?: string
    context?: string
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
  }
}

// 带认证信息的 WebSocket
interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
  requestCount?: number;
  lastResetTime?: number;
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

function hasExplicitStageSignal(text?: string): boolean {
  if (!text) {
    return false;
  }

  return EXPLICIT_STAGE_PATTERNS.some((pattern) => pattern.test(text));
}

function shouldUseProfileHints(question: string, context?: string): boolean {
  return !hasExplicitStageSignal(question) && !hasExplicitStageSignal(context);
}

function buildAnswerPolicy(question: string, context?: string): string {
  const explicitStage = hasExplicitStageSignal(question) || hasExplicitStageSignal(context);
  const lines = [
    '回答策略：',
    '- 以用户当前问题和本轮补充信息为优先。',
    '- 用户历史档案仅作辅助参考，可能不是最新状态。',
  ];

  if (explicitStage) {
    lines.push('- 本轮问题中已明确给出阶段、孕周或月龄时，请以本轮描述为准，不要被历史档案覆盖。');
    lines.push('- 如果本轮描述和历史档案不一致，先回答当前问题，只在结尾用一句话提醒用户确认最新阶段。');
  } else {
    lines.push('- 若用户未明确说明阶段、孕周或月龄，可谨慎参考历史档案补充建议。');
  }

  return lines.join('\n');
}

function buildPromptContext(question: string, context: string | undefined, profilePrompt?: string, knowledgeContext?: string): string {
  const explicitStage = hasExplicitStageSignal(question) || hasExplicitStageSignal(context);

  return [
    buildAnswerPolicy(question, context),
    explicitStage ? undefined : profilePrompt,
    context?.trim() ? `用户补充背景：\n${context.trim()}` : undefined,
    knowledgeContext,
  ].filter(Boolean).join('\n\n');
}

export function setupWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/ws/ai',
    maxPayload: 1024 * 1024,
    verifyClient: (info, callback) => {
      try {
        // 从 URL query 中提取 token
        const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
        const token = url.searchParams.get('token');

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

// 处理单轮提问流式
async function handleAskStream(
  ws: AuthenticatedWebSocket,
  requestId: string,
  payload: WsClientMessage['payload']
) {
  const { question, model, context, conversationId } = payload;

  if (!question) {
    sendError(ws, requestId, '请输入问题');
    return;
  }

  // 紧急问题检测
  if (isEmergencyQuestion(question)) {
    const persistedConversationId = ws.userId
      ? await saveConversationExchange({
        userId: ws.userId,
        conversationId,
        userQuestion: question,
        assistantAnswer: getEmergencyResponse(),
        isEmergency: true,
      })
      : conversationId;

    sendMessage(ws, {
      type: 'emergency',
      requestId,
      data: {
        content: getEmergencyResponse(),
        isEmergency: true,
        disclaimer: '🚨 重要提示：如遇紧急情况，请立即就医！',
        conversationId: persistedConversationId,
      },
    });
    return;
  }

  const profileContext = await buildUserProfileContext(ws.userId);
  const retrievalQuery = shouldUseProfileHints(question, context)
    ? [question, ...profileContext.retrievalHints].filter(Boolean).join(' ')
    : question;
  const knowledgePack = buildKnowledgePack(retrievalQuery, { limit: 3 });
  const finalContext = buildPromptContext(question, context, profileContext.prompt, knowledgePack.context);

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user' as const, content: question },
  ];

  // 流式输出
  try {
    let answer = '';
    for await (const chunk of streamMultiTurnChat(messages, {
      model,
      context: finalContext,
    })) {
      answer += chunk;
      if (ws.readyState !== WebSocket.OPEN) break;
      sendMessage(ws, {
        type: 'chunk',
        requestId,
        data: { content: chunk },
      });
    }

    if (ws.readyState === WebSocket.OPEN) {
      const persistedConversationId = ws.userId
        ? await saveConversationExchange({
          userId: ws.userId,
          conversationId,
          userQuestion: question,
          assistantAnswer: answer,
          sources: knowledgePack.sources,
        })
        : conversationId;

      sendMessage(ws, {
        type: 'done',
        requestId,
        data: {
          sources: knowledgePack.sources,
          disclaimer: '⚠️ 免责声明：本回答由 AI 生成，仅供参考，不构成医疗建议。如有健康问题，请咨询专业医生。',
          conversationId: persistedConversationId,
        },
      });
    }
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

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    sendError(ws, requestId, '消息不能为空');
    return;
  }

  // 检测最后一条消息是否为紧急问题
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role === 'user' && isEmergencyQuestion(lastMessage.content)) {
    const persistedConversationId = ws.userId
      ? await saveConversationExchange({
        userId: ws.userId,
        conversationId,
        userQuestion: lastMessage.content,
        assistantAnswer: getEmergencyResponse(),
        isEmergency: true,
      })
      : conversationId;

    sendMessage(ws, {
      type: 'emergency',
      requestId,
      data: {
        content: getEmergencyResponse(),
        isEmergency: true,
        disclaimer: '🚨 重要提示：如遇紧急情况，请立即就医！',
        conversationId: persistedConversationId,
      },
    });
    return;
  }

  // 转换消息格式（过滤掉客户端提供的 system 角色消息）
  const formattedMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

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
    for await (const chunk of streamMultiTurnChat(formattedMessages, {
      model,
      context: finalContext,
    })) {
      answer += chunk;
      if (ws.readyState !== WebSocket.OPEN) break;
      sendMessage(ws, {
        type: 'chunk',
        requestId,
        data: { content: chunk },
      });
    }

    if (ws.readyState === WebSocket.OPEN) {
      const persistedConversationId = ws.userId && lastMessage.role === 'user'
        ? await saveConversationExchange({
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
          disclaimer: '⚠️ 免责声明：本回答由 AI 生成，仅供参考，不构成医疗建议。',
          conversationId: persistedConversationId,
        },
      });
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
