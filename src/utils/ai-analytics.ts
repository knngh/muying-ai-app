import { Prisma } from '@prisma/client';
import type { AnalyticsEventName } from '../config/analytics-events';
import { recordServerAnalyticsEvent } from '../services/analytics.service';
import { logger } from './logger';

export type AIAnalyticsEndpoint = 'ask' | 'ask_stream' | 'chat' | 'chat_stream';

type ChatHistoryForAnalytics = Array<{
  role: 'user' | 'assistant';
  content: string;
}>;

type ContextKind = 'none' | 'string' | 'object' | 'array' | 'other';

type AnalyticsPrimitive = string | number | boolean | null;
type AnalyticsPropertyValue = AnalyticsPrimitive | string[];

export interface AIRequestAnalyticsMetadata {
  endpoint: AIAnalyticsEndpoint;
  page: string;
  requestId: string;
  userId?: string;
  questionLength: number;
  historyCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  requestedModel?: string;
  clientRequestId?: string;
  contextKind: ContextKind;
  contextKeys?: string[];
  entrySource?: string;
  articleSlug?: string;
  reportId?: string;
  stage?: string;
  trafficKind?: string;
  hasConversationId: boolean;
  resumeContinuation?: boolean;
}

interface AIAnalyticsResultLike {
  answer?: unknown;
  sources?: unknown[];
  isEmergency?: boolean;
  triageCategory?: string;
  riskLevel?: string;
  structuredAnswer?: unknown;
  uncertainty?: {
    level?: unknown;
  };
  sourceReliability?: string;
  followUpQuestions?: unknown[];
  confidence?: number;
  degraded?: boolean;
  model?: string;
  provider?: string;
  route?: string;
}

function getEndpointPage(endpoint: AIAnalyticsEndpoint): string {
  switch (endpoint) {
    case 'ask_stream':
      return 'api/ai/ask/stream';
    case 'chat':
      return 'api/ai/chat';
    case 'chat_stream':
      return 'api/ai/chat/stream';
    case 'ask':
    default:
      return 'api/ai/ask';
  }
}

function getContextKind(context: unknown): ContextKind {
  if (context === undefined || context === null) {
    return 'none';
  }
  if (typeof context === 'string') {
    return 'string';
  }
  if (Array.isArray(context)) {
    return 'array';
  }
  if (typeof context === 'object') {
    return 'object';
  }
  return 'other';
}

function toContextRecord(context: unknown): Record<string, unknown> {
  return context && typeof context === 'object' && !Array.isArray(context)
    ? context as Record<string, unknown>
    : {};
}

function sanitizeToken(value: unknown, maxLength = 120): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.slice(0, maxLength);
}

function sanitizeContextKey(value: string): string | undefined {
  const normalized = value.replace(/[^\w.-]/g, '').slice(0, 40);
  return normalized || undefined;
}

function compactProperties(
  input: Record<string, AnalyticsPropertyValue | undefined>,
): Prisma.InputJsonObject {
  const compacted: Record<string, AnalyticsPropertyValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      compacted[key] = value;
    }
  }
  return compacted as Prisma.InputJsonObject;
}

function getCommonProperties(
  metadata: AIRequestAnalyticsMetadata,
): Record<string, AnalyticsPropertyValue | undefined> {
  return {
    endpoint: metadata.endpoint,
    requestId: metadata.requestId,
    questionLength: metadata.questionLength,
    historyCount: metadata.historyCount,
    userMessageCount: metadata.userMessageCount,
    assistantMessageCount: metadata.assistantMessageCount,
    requestedModel: metadata.requestedModel,
    clientRequestId: metadata.clientRequestId,
    contextKind: metadata.contextKind,
    contextKeys: metadata.contextKeys,
    entrySource: metadata.entrySource,
    articleSlug: metadata.articleSlug,
    reportId: metadata.reportId,
    stage: metadata.stage,
    trafficKind: metadata.trafficKind,
    hasConversationId: metadata.hasConversationId,
    resumeContinuation: metadata.resumeContinuation,
  };
}

function getNumericField(error: unknown, key: 'code' | 'statusCode' | 'status'): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getStringField(error: unknown, key: 'code' | 'name'): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  return sanitizeToken((error as Record<string, unknown>)[key], 80);
}

function getErrorCode(error: unknown): string | undefined {
  const stringCode = getStringField(error, 'code');
  if (stringCode) {
    return stringCode;
  }

  const numericCode = getNumericField(error, 'code');
  return numericCode === undefined ? undefined : String(numericCode);
}

function recordAIAnalyticsEvent(
  eventName: AnalyticsEventName,
  metadata: AIRequestAnalyticsMetadata,
  properties: Prisma.InputJsonObject,
) {
  void recordServerAnalyticsEvent(eventName, {
    userId: metadata.userId,
    page: metadata.page,
    properties,
  }).catch((error) => {
    logger.warn('ai.analytics.record_failed', {
      component: 'ai.analytics',
      event: eventName,
      requestId: metadata.requestId,
      err: error,
    });
  });
}

export function buildAIRequestAnalyticsMetadata(input: {
  endpoint: AIAnalyticsEndpoint;
  requestId: string;
  userId?: string;
  question: unknown;
  context?: unknown;
  model?: unknown;
  conversationId?: unknown;
  clientRequestId?: unknown;
  history?: ChatHistoryForAnalytics;
  isResumeContinuation?: boolean;
}): AIRequestAnalyticsMetadata {
  const contextRecord = toContextRecord(input.context);
  const contextKeys = Object.keys(contextRecord)
    .map(sanitizeContextKey)
    .filter((key): key is string => Boolean(key))
    .slice(0, 12);
  const history = input.history || [];
  const userMessageCount = history.filter((message) => message.role === 'user').length;
  const assistantMessageCount = history.filter((message) => message.role === 'assistant').length;

  return {
    endpoint: input.endpoint,
    page: getEndpointPage(input.endpoint),
    requestId: input.requestId,
    userId: input.userId,
    questionLength: String(input.question ?? '').length,
    historyCount: history.length,
    userMessageCount,
    assistantMessageCount,
    requestedModel: sanitizeToken(input.model, 120),
    clientRequestId: sanitizeToken(input.clientRequestId, 120),
    contextKind: getContextKind(input.context),
    contextKeys: contextKeys.length > 0 ? contextKeys : undefined,
    entrySource: sanitizeToken(contextRecord.entrySource, 80),
    articleSlug: sanitizeToken(contextRecord.articleSlug, 160),
    reportId: sanitizeToken(contextRecord.reportId, 120),
    stage: sanitizeToken(contextRecord.stage, 80),
    trafficKind: sanitizeToken(contextRecord.trafficKind, 80),
    hasConversationId: Boolean(input.conversationId),
    resumeContinuation: input.isResumeContinuation === undefined ? undefined : input.isResumeContinuation,
  };
}

export function buildAIRequestStartAnalyticsProperties(
  metadata: AIRequestAnalyticsMetadata,
): Prisma.InputJsonObject {
  return compactProperties(getCommonProperties(metadata));
}

export function buildAIResponseCompleteAnalyticsProperties(
  metadata: AIRequestAnalyticsMetadata,
  result: AIAnalyticsResultLike,
  input: {
    durationMs: number;
    conversationPersisted: boolean;
  },
): Prisma.InputJsonObject {
  return compactProperties({
    ...getCommonProperties(metadata),
    durationMs: input.durationMs,
    conversationPersisted: input.conversationPersisted,
    provider: sanitizeToken(result.provider, 120),
    model: sanitizeToken(result.model, 160),
    route: sanitizeToken(result.route, 300),
    riskLevel: sanitizeToken(result.riskLevel, 40),
    triageCategory: sanitizeToken(result.triageCategory, 60),
    sourceReliability: sanitizeToken(result.sourceReliability, 80),
    degraded: result.degraded === undefined ? undefined : Boolean(result.degraded),
    isEmergency: result.isEmergency === undefined ? undefined : Boolean(result.isEmergency),
    sourcesCount: Array.isArray(result.sources) ? result.sources.length : 0,
    followUpQuestionsCount: Array.isArray(result.followUpQuestions) ? result.followUpQuestions.length : 0,
    confidence: typeof result.confidence === 'number' && Number.isFinite(result.confidence)
      ? Number(result.confidence.toFixed(4))
      : undefined,
    uncertaintyLevel: sanitizeToken(result.uncertainty?.level, 40),
  });
}

export function buildAIRequestErrorAnalyticsProperties(
  metadata: AIRequestAnalyticsMetadata,
  error: unknown,
  input: {
    durationMs: number;
  },
): Prisma.InputJsonObject {
  return compactProperties({
    ...getCommonProperties(metadata),
    durationMs: input.durationMs,
    errorName: getStringField(error, 'name') || (error instanceof Error ? error.name : undefined),
    errorCode: getErrorCode(error),
    statusCode: getNumericField(error, 'statusCode') || getNumericField(error, 'status'),
  });
}

export function recordAIRequestStart(metadata: AIRequestAnalyticsMetadata) {
  recordAIAnalyticsEvent('server_ai_request_start', metadata, buildAIRequestStartAnalyticsProperties(metadata));
}

export function recordAIResponseComplete(
  metadata: AIRequestAnalyticsMetadata,
  result: AIAnalyticsResultLike,
  input: {
    durationMs: number;
    conversationPersisted: boolean;
  },
) {
  recordAIAnalyticsEvent(
    'server_ai_response_complete',
    metadata,
    buildAIResponseCompleteAnalyticsProperties(metadata, result, input),
  );
}

export function recordAIRequestError(
  metadata: AIRequestAnalyticsMetadata | undefined,
  error: unknown,
  input: {
    durationMs: number;
  },
) {
  if (!metadata) {
    return;
  }

  recordAIAnalyticsEvent(
    'server_ai_request_error',
    metadata,
    buildAIRequestErrorAnalyticsProperties(metadata, error, input),
  );
}

export function recordKnowledgeRecommendedQuestionsServed(input: {
  stage: string | null;
  requestedLimit: number;
  returnedCount: number;
  source: string;
}) {
  const properties = compactProperties({
    stage: sanitizeToken(input.stage, 80) || null,
    requestedLimit: Number.isFinite(input.requestedLimit) ? input.requestedLimit : 0,
    returnedCount: Number.isFinite(input.returnedCount) ? input.returnedCount : 0,
    source: sanitizeToken(input.source, 80),
  });

  void recordServerAnalyticsEvent('server_ai_knowledge_recommendations_served', {
    page: 'api/ai/knowledge/recommended-questions',
    properties,
  }).catch((error) => {
    logger.warn('ai.analytics.recommended_questions_record_failed', {
      component: 'ai.analytics',
      event: 'server_ai_knowledge_recommendations_served',
      err: error,
    });
  });
}
