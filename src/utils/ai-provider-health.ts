import {
  callTaskModelDetailed,
  getAIGatewayErrorOpsMessage,
  getTaskModelBindings,
  type AIGatewayRouteInfo,
  type AITaskModelBinding,
  type AITaskModelRole,
} from '../services/ai-gateway.service';

const DEFAULT_TASK_ROLE: AITaskModelRole = 'glm_classify';
export const DEFAULT_AI_PROVIDER_HEALTH_TIMEOUT_MS = 12000;
const DEFAULT_MAX_TOKENS = 80;
const DEFAULT_PROMPT = '只回答数字：strawberry 里有几个字母 r？';
const DEFAULT_EXPECTED_ANSWER = '3';
const SUPPORTED_TASK_ROLES = new Set<AITaskModelRole>(['glm_classify', 'kimi_reason', 'minimax_render']);

export interface AIProviderHealthReport {
  generatedAt: string;
  status: 'ok' | 'failed' | 'degraded';
  taskRole: AITaskModelRole | string;
  timeoutMs: number;
  maxTokens: number;
  expectedAnswer: string;
  binding: AITaskModelBinding | null;
  call: {
    attempted: boolean;
    ok: boolean;
    elapsedMs: number;
    answerPreview?: string;
    expectedMatched?: boolean;
    route?: AIGatewayRouteInfo;
    error?: {
      message: string;
      gatewayStatus?: number;
      gatewayProvider?: string;
      gatewayModel?: string;
    };
  };
}

export interface AIProviderHealthOptions {
  taskRole?: string;
  timeoutMs?: number;
  maxTokens?: number;
  prompt?: string;
  expectedAnswer?: string;
  stopOnPrimaryProviderFailure?: boolean;
  now?: string;
  callTaskModel?: typeof callTaskModelDetailed;
  getBindings?: typeof getTaskModelBindings;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeTaskRole(value?: string): AITaskModelRole | null {
  if (!value) {
    return DEFAULT_TASK_ROLE;
  }
  return SUPPORTED_TASK_ROLES.has(value as AITaskModelRole) ? value as AITaskModelRole : null;
}

function redactedErrorMessage(error: unknown): string {
  const message = getAIGatewayErrorOpsMessage(error);
  return message
    .replace(/Authorization\s+Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Authorization Bearer [redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(api[_-]?key|token)(["'\s:=]+)[A-Za-z0-9._~+/=-]+/gi, '$1$2[redacted]')
    .slice(0, 500);
}

function answerMatchesExpected(answer: string, expectedAnswer: string): boolean {
  const normalizedAnswer = answer.trim();
  const normalizedExpected = expectedAnswer.trim();
  if (!normalizedExpected) {
    return Boolean(normalizedAnswer);
  }

  return new RegExp(`(^|\\D)${normalizedExpected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\D|$)`, 'u')
    .test(normalizedAnswer);
}

function isTransientGatewayFailure(status?: number): boolean {
  return typeof status === 'number' && status >= 500 && status < 600;
}

function isProviderTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /^AI Gateway timeout after \d+ms$/u.test(error.message);
}

export async function buildAIProviderHealthReport(
  options: AIProviderHealthOptions = {},
): Promise<AIProviderHealthReport> {
  const startedAt = Date.now();
  const taskRole = normalizeTaskRole(options.taskRole);
  const timeoutMs = normalizePositiveInteger(options.timeoutMs, DEFAULT_AI_PROVIDER_HEALTH_TIMEOUT_MS);
  const maxTokens = normalizePositiveInteger(options.maxTokens, DEFAULT_MAX_TOKENS);
  const expectedAnswer = options.expectedAnswer ?? DEFAULT_EXPECTED_ANSWER;
  const prompt = options.prompt || DEFAULT_PROMPT;
  const bindings = (options.getBindings || getTaskModelBindings)();
  const binding = taskRole ? bindings.find((item) => item.role === taskRole) || null : null;

  if (!taskRole) {
    return {
      generatedAt: options.now || new Date().toISOString(),
      status: 'failed',
      taskRole: options.taskRole || '',
      timeoutMs,
      maxTokens,
      expectedAnswer,
      binding: null,
      call: {
        attempted: false,
        ok: false,
        elapsedMs: Date.now() - startedAt,
        error: {
          message: `Unsupported task role: ${options.taskRole || ''}`,
        },
      },
    };
  }

  try {
    const result = await (options.callTaskModel || callTaskModelDetailed)(taskRole, [
      { role: 'user', content: prompt },
    ], {
      temperature: 0,
      maxTokens,
      timeoutMs,
      stopOnProviderFailure: options.stopOnPrimaryProviderFailure === false || !binding?.provider
        ? undefined
        : [binding.provider],
    });
    const answerPreview = result.answer.trim().slice(0, 120);
    const expectedMatched = answerMatchesExpected(result.answer, expectedAnswer);

    return {
      generatedAt: options.now || new Date().toISOString(),
      status: expectedMatched ? 'ok' : 'failed',
      taskRole,
      timeoutMs,
      maxTokens,
      expectedAnswer,
      binding,
      call: {
        attempted: true,
        ok: expectedMatched,
        elapsedMs: Date.now() - startedAt,
        answerPreview,
        expectedMatched,
        route: result.route,
      },
    };
  } catch (error) {
    const gatewayError = error as {
      gatewayStatus?: number;
      gatewayProvider?: string;
      gatewayModel?: string;
    };
    const gatewayProvider = gatewayError.gatewayProvider || binding?.provider;
    const gatewayModel = gatewayError.gatewayModel || binding?.model;
    const degraded = isTransientGatewayFailure(gatewayError.gatewayStatus)
      || (Boolean(binding?.configured && binding.provider) && isProviderTimeout(error));

    return {
      generatedAt: options.now || new Date().toISOString(),
      status: degraded ? 'degraded' : 'failed',
      taskRole,
      timeoutMs,
      maxTokens,
      expectedAnswer,
      binding,
      call: {
        attempted: true,
        ok: false,
        elapsedMs: Date.now() - startedAt,
        error: {
          message: redactedErrorMessage(error),
          gatewayStatus: gatewayError.gatewayStatus,
          gatewayProvider,
          gatewayModel,
        },
      },
    };
  }
}
