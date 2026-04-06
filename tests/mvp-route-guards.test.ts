import type { Router } from 'express';

const authMiddleware = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'auth' });
const writeRateLimiter = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'write' });
const queryRateLimiter = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'query' });
const aiRateLimiter = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'ai' });
const quotaCheckMiddleware = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'quota' });
const subscriptionContextMiddleware = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'subscription' });
const wechatCallbackAccess = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'wechatCallbackAccess' });
const alipayCallbackAccess = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'alipayCallbackAccess' });

const createOrder = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'createOrder' });
const wechatCallback = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'wechatCallback' });
const alipayCallback = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'alipayCallback' });
const getOrderByOrderNo = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getOrder' });

const askQuestion = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'askQuestion' });
const askQuestionStream = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'askQuestionStream' });
const chat = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'chat' });
const chatStream = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'chatStream' });
const getConversations = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getConversations' });
const getConversationHistory = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getConversationHistory' });
const deleteConversation = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'deleteConversation' });
const getModels = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getModels' });
const checkHealth = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'checkHealth' });
const searchKnowledge = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'searchKnowledge' });
const submitFeedback = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'submitFeedback' });
const getKnowledgeBaseStats = Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: 'getKnowledgeBaseStats' });

const validate = jest.fn((schema: { body?: unknown; params?: unknown; query?: unknown }) => {
  const kind = schema.body ? 'body' : schema.params ? 'params' : schema.query ? 'query' : 'unknown';
  return Object.assign((_req: unknown, _res: unknown, next: () => void) => next(), { _id: `validate:${kind}` });
});

jest.mock('../src/controllers/payment.controller', () => ({
  createOrder,
  wechatCallback,
  alipayCallback,
  getOrderByOrderNo,
}));

jest.mock('../src/controllers/ai.controller', () => ({
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
}));

jest.mock('../src/middlewares/auth.middleware', () => ({
  authMiddleware,
}));

jest.mock('../src/middlewares/rateLimiter.middleware', () => ({
  writeRateLimiter,
  queryRateLimiter,
  aiRateLimiter,
}));

jest.mock('../src/middlewares/validate.middleware', () => ({
  validate,
}));

jest.mock('../src/middlewares/quota.middleware', () => ({
  quotaCheckMiddleware,
}));

jest.mock('../src/middlewares/subscription.middleware', () => ({
  subscriptionContextMiddleware,
}));

jest.mock('../src/middlewares/payment-callback.middleware', () => ({
  paymentCallbackAccessMiddleware: jest.fn((provider: 'wechat' | 'alipay') =>
    provider === 'wechat' ? wechatCallbackAccess : alipayCallbackAccess),
}));

import paymentRoutes from '../src/routes/payment.routes';
import aiRoutes from '../src/routes/ai.routes';

function findRoute(router: Router, path: string, method: 'get' | 'post' | 'delete') {
  return (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> } }> })
    .stack
    .find((layer) => layer.route?.path === path && layer.route.methods[method])?.route;
}

function getRouteHandles(router: Router, path: string, method: 'get' | 'post' | 'delete') {
  const route = findRoute(router, path, method);
  if (!route) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }

  return route.stack.map((layer) => layer.handle);
}

describe('MVP 路由守卫回归测试', () => {
  it('支付回调路由必须先经过回调访问控制中间件', () => {
    const wechatHandles = getRouteHandles(paymentRoutes, '/callback/wechat', 'post');
    const alipayHandles = getRouteHandles(paymentRoutes, '/callback/alipay', 'post');

    expect(wechatHandles[0]).toBe(writeRateLimiter);
    expect((wechatHandles[1] as { _id?: string })._id).toBe('validate:body');
    expect(wechatHandles[2]).toBe(wechatCallbackAccess);
    expect(alipayHandles[0]).toBe(writeRateLimiter);
    expect((alipayHandles[1] as { _id?: string })._id).toBe('validate:body');
    expect(alipayHandles[2]).toBe(alipayCallbackAccess);
    expect(wechatHandles[wechatHandles.length - 1]).toBe(wechatCallback);
    expect(alipayHandles[alipayHandles.length - 1]).toBe(alipayCallback);
  });

  it('订单查询路由必须要求鉴权', () => {
    const handles = getRouteHandles(paymentRoutes, '/order/:orderNo', 'get');

    expect(handles[0]).toBe(authMiddleware);
    expect(handles[handles.length - 1]).toBe(getOrderByOrderNo);
  });

  it('AI 提问路由必须先校验参数再扣额度', () => {
    const askHandles = getRouteHandles(aiRoutes, '/ask', 'post');
    const askStreamHandles = getRouteHandles(aiRoutes, '/ask/stream', 'post');
    const chatHandles = getRouteHandles(aiRoutes, '/chat', 'post');
    const chatStreamHandles = getRouteHandles(aiRoutes, '/chat/stream', 'post');

    for (const handles of [askHandles, askStreamHandles, chatHandles, chatStreamHandles]) {
      expect(handles[0]).toBe(aiRateLimiter);
      expect((handles[1] as { _id?: string })._id).toBe('validate:body');
      expect(handles[2]).toBe(quotaCheckMiddleware);
    }

    expect(askHandles[askHandles.length - 1]).toBe(askQuestion);
    expect(askStreamHandles[askStreamHandles.length - 1]).toBe(askQuestionStream);
    expect(chatHandles[chatHandles.length - 1]).toBe(chat);
    expect(chatStreamHandles[chatStreamHandles.length - 1]).toBe(chatStream);
  });
});
