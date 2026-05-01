// AI Gateway 服务 - 支持混合路由、多模型对接和流式响应

const OPENROUTER_BASE_URL = process.env.AI_OPENROUTER_URL || process.env.OPENROUTER_API_URL || 'https://api.minimaxi.com/v1';
const OPENROUTER_KEY = process.env.AI_OPENROUTER_KEY || process.env.OPENROUTER_API_KEY || process.env.AI_GATEWAY_KEY || '';
const OPENROUTER_MODEL = process.env.AI_OPENROUTER_MODEL || 'MiniMax-M2.7';
const OPENROUTER_PROVIDER = process.env.AI_OPENROUTER_PROVIDER || 'minimax';
const OPENROUTER_SITE_URL = process.env.AI_OPENROUTER_SITE_URL || '';
const OPENROUTER_APP_NAME = process.env.AI_OPENROUTER_APP_NAME || '';
const AI_PROVIDER_TIMEOUT_MS = Math.max(
  5000,
  Number.parseInt(process.env.AI_PROVIDER_TIMEOUT_MS || '25000', 10) || 25000,
);
const LEGACY_GATEWAY_URL = process.env.AI_GATEWAY_URL || OPENROUTER_BASE_URL;
const LEGACY_GATEWAY_KEY = process.env.AI_GATEWAY_KEY || OPENROUTER_KEY;
const AI_ROUTING_ENABLED = process.env.AI_ROUTING_ENABLED === 'true';
const AI_GENERAL_URL = process.env.AI_GENERAL_URL || OPENROUTER_BASE_URL;
const AI_GENERAL_KEY = process.env.AI_GENERAL_KEY || OPENROUTER_KEY;
const AI_GENERAL_MODEL = process.env.AI_GENERAL_MODEL || OPENROUTER_MODEL;
const AI_GENERAL_PROVIDER = process.env.AI_GENERAL_PROVIDER || OPENROUTER_PROVIDER;
const AI_KIMI_URL = process.env.AI_KIMI_URL || OPENROUTER_BASE_URL;
const AI_KIMI_KEY = process.env.AI_KIMI_KEY || OPENROUTER_KEY;
const AI_KIMI_MODEL = process.env.AI_KIMI_MODEL || OPENROUTER_MODEL;
const AI_KIMI_PROVIDER = process.env.AI_KIMI_PROVIDER || OPENROUTER_PROVIDER;
const AI_MINIMAX_URL = process.env.AI_MINIMAX_URL || OPENROUTER_BASE_URL;
const AI_MINIMAX_KEY = process.env.AI_MINIMAX_KEY || OPENROUTER_KEY;
const AI_MINIMAX_MODEL = process.env.AI_MINIMAX_MODEL || OPENROUTER_MODEL;
const AI_MINIMAX_PROVIDER = process.env.AI_MINIMAX_PROVIDER || OPENROUTER_PROVIDER;
const AI_GLM_URL = process.env.AI_GLM_URL || OPENROUTER_BASE_URL;
const AI_GLM_KEY = process.env.AI_GLM_KEY || OPENROUTER_KEY;
const AI_GLM_MODEL = process.env.AI_GLM_MODEL || OPENROUTER_MODEL;
const AI_GLM_PROVIDER = process.env.AI_GLM_PROVIDER || OPENROUTER_PROVIDER;
const AI_MEDICAL_PRIMARY_URL = process.env.AI_MEDICAL_PRIMARY_URL || OPENROUTER_BASE_URL;
const AI_MEDICAL_PRIMARY_KEY = process.env.AI_MEDICAL_PRIMARY_KEY || OPENROUTER_KEY;
const AI_MEDICAL_PRIMARY_MODEL = process.env.AI_MEDICAL_PRIMARY_MODEL || process.env.AI_DEFAULT_MODEL || OPENROUTER_MODEL;
const AI_MEDICAL_PRIMARY_PROVIDER = process.env.AI_MEDICAL_PRIMARY_PROVIDER || OPENROUTER_PROVIDER;
const AI_MEDICAL_SECONDARY_URL = process.env.AI_MEDICAL_SECONDARY_URL || '';
const AI_MEDICAL_SECONDARY_KEY = process.env.AI_MEDICAL_SECONDARY_KEY || '';
const AI_MEDICAL_SECONDARY_MODEL = process.env.AI_MEDICAL_SECONDARY_MODEL || '';
const AI_MEDICAL_SECONDARY_PROVIDER = process.env.AI_MEDICAL_SECONDARY_PROVIDER || '';

const MODEL_ALIASES: Record<string, string> = {
  'Baichuan-M3': OPENROUTER_MODEL,
  'baichuan-m3': OPENROUTER_MODEL,
  'deepseek-ai/DeepSeek-V3': OPENROUTER_MODEL,
  'deepseek-chat': OPENROUTER_MODEL,
  'kimi2.5': OPENROUTER_MODEL,
  'kimi-2.5': OPENROUTER_MODEL,
  'kimi-k2.5': OPENROUTER_MODEL,
  'glm5': OPENROUTER_MODEL,
  'glm-5': OPENROUTER_MODEL,
  'glm-5-flash': OPENROUTER_MODEL,
  'minimax2.5': OPENROUTER_MODEL,
  'minmax2.5': OPENROUTER_MODEL,
  'minimax-2.5': OPENROUTER_MODEL,
  'minimax-m1': OPENROUTER_MODEL,
  'MiniMax-M2.7': OPENROUTER_MODEL,
  'minimax-m2.7': OPENROUTER_MODEL,
};

interface SupportedModel {
  id: string;
  apiModel?: string;
  name: string;
  provider: string;
  maxTokens: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface ChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message?: {
      role: string;
      content: string;
    };
    delta?: {
      content?: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GatewayProvider {
  id: string;
  label: string;
  provider: string;
  routeKind: 'general' | 'medical' | 'legacy' | 'manual' | 'task';
  url: string;
  key: string;
  model: string;
  supportsStreaming: boolean;
}

export type AITaskModelRole = 'glm_classify' | 'kimi_reason' | 'minimax_render';

export interface AIGatewayRouteInfo {
  provider: string;
  model: string;
  route: GatewayProvider['routeKind'];
  label: string;
}

export interface AIGatewayTextResult {
  answer: string;
  route: AIGatewayRouteInfo;
}

export interface AITaskModelBinding {
  role: AITaskModelRole;
  model: string;
  provider: string;
  configured: boolean;
}

// 支持的模型列表
export const SUPPORTED_MODELS: Record<string, SupportedModel> = {
  [OPENROUTER_MODEL]: {
    id: OPENROUTER_MODEL,
    name: OPENROUTER_MODEL,
    provider: OPENROUTER_PROVIDER,
    maxTokens: 8192,
  },
};

// 默认模型
const DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || OPENROUTER_MODEL;

// 母婴健康系统提示词
const MATERNAL_HEALTH_SYSTEM_PROMPT = `你是一位专业的母婴健康顾问，拥有丰富的妇产科和儿科知识。

回答要求：
1. 专业、准确、有同理心
2. 使用通俗易懂的语言，避免过多专业术语
3. 如涉及用药或治疗建议，必须提醒咨询医生
4. 不要给出具体药物剂量
5. 对于不确定的问题，建议咨询专业医生
6. 对于孕妇和婴幼儿问题，要格外谨慎
7. 直接面向提问用户表达，优先使用“您”“宝宝”“孩子”等称呼
8. 先用一两句温和的话接住用户的担心，再给出清晰建议
9. 不要使用“作者”“提问者”“患者自述”“上述描述者”等生硬或第三人称表述

回答格式：
- 先用简短、温和的话安抚或回应用户
- 再给出简洁的答案要点
- 再展开详细说明
- 最后给出可执行的相关建议

免责声明：
这份答复用于帮助您先做初步了解，不替代医生面诊；如果症状明显、持续加重或您心里很不踏实，请尽快咨询医生。`;

// 紧急关键词列表
const EMERGENCY_KEYWORDS = [
  '出血', '大出血', '流血不止',
  '昏迷', '晕厥', '失去意识',
  '剧痛', '剧烈疼痛', '腹痛剧烈',
  '呼吸困难', '喘不上气',
  '抽搐', '惊厥', '癫痫',
  '高烧', '高热', '40度',
  '胎动减少', '胎动消失', '没有胎动',
  '破水', '羊水破了',
  '早产', '宫缩频繁',
  '窒息', '婴儿窒息',
  '中毒', '误食',
  '过敏休克', '严重过敏',
];

const MEDICAL_ROUTING_PATTERNS = [
  /用药|吃药|药量|剂量|退烧药|抗生素|头孢|阿莫西林|布洛芬|美林|对乙酰氨基酚|处方药|外用药|雾化|输液|挂水/u,
  /发烧|发热|高烧|咳嗽|腹泻|拉肚子|呕吐|便血|咳痰|黄疸|湿疹|皮疹|过敏|感染|肺炎|支气管炎|中耳炎|流感|哮喘|惊厥/u,
  /诊断|确诊|治疗|手术|住院|复诊|检查单|化验单|报告单|血常规|尿常规|B超|彩超|CT|核磁|指标|报告/u,
  /胎动减少|宫缩|见红|破水|流血|腹痛|高血压|血压高|尿蛋白|糖耐|胎盘|羊水/u,
];

function resolveGatewayChatCompletionsUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }

  return `${trimmed}/chat/completions`;
}

function resolveModelName(model?: string): string {
  const selectedModel = MODEL_ALIASES[model || DEFAULT_MODEL] || model || DEFAULT_MODEL;
  return SUPPORTED_MODELS[selectedModel]?.apiModel || selectedModel;
}

function resolveModelConfig(model?: string): SupportedModel | undefined {
  const selectedModel = MODEL_ALIASES[model || DEFAULT_MODEL] || model || DEFAULT_MODEL;
  return SUPPORTED_MODELS[selectedModel];
}

function getUniqueSupportedModels(): SupportedModel[] {
  return Object.values(SUPPORTED_MODELS)
    .filter((model, index, models) => {
      const identity = model.apiModel || model.id;
      return models.findIndex(item => (item.apiModel || item.id) === identity) === index;
    });
}

function inferProviderName(url: string, model: string, fallback: string): string {
  const text = `${url} ${model}`.toLowerCase();
  if (text.includes('minimax') || text.includes('minimaxi')) {
    return 'minimax';
  }
  if (text.includes('openrouter')) {
    return 'openrouter';
  }
  if (text.includes('baichuan')) {
    return 'baichuan';
  }
  if (text.includes('siliconflow')) {
    return 'siliconflow';
  }
  if (text.includes('deepseek')) {
    return 'deepseek';
  }
  return fallback;
}

function supportsStreaming(provider: string, model: string, url: string): boolean {
  const text = `${provider} ${model} ${url}`.toLowerCase();
  return !text.includes('baichuan');
}

function buildProvider(
  id: string,
  label: string,
  routeKind: GatewayProvider['routeKind'],
  url: string,
  key: string,
  model: string,
  fallbackProvider: string
): GatewayProvider | null {
  if (!url) {
    return null;
  }

  const resolvedModel = resolveModelName(model);
  const provider = inferProviderName(url, resolvedModel, fallbackProvider);

  return {
    id,
    label,
    provider,
    routeKind,
    url: resolveGatewayChatCompletionsUrl(url),
    key,
    model: resolvedModel,
    supportsStreaming: supportsStreaming(provider, resolvedModel, url),
  };
}

function buildLegacyProvider(requestedModel?: string): GatewayProvider | null {
  return buildProvider(
    'legacy-default',
    'legacy-default',
    requestedModel ? 'manual' : 'legacy',
    LEGACY_GATEWAY_URL,
    LEGACY_GATEWAY_KEY,
    requestedModel || DEFAULT_MODEL,
    resolveModelConfig(requestedModel || DEFAULT_MODEL)?.provider || 'legacy'
  );
}

function buildGeneralProvider(): GatewayProvider | null {
  if (!AI_ROUTING_ENABLED || !AI_GENERAL_KEY) {
    return null;
  }

  return buildProvider(
    'general-primary',
    'general-primary',
    'general',
    AI_GENERAL_URL,
    AI_GENERAL_KEY,
    AI_GENERAL_MODEL,
    AI_GENERAL_PROVIDER
  );
}

function buildMedicalPrimaryProvider(): GatewayProvider | null {
  if (!AI_ROUTING_ENABLED) {
    return null;
  }

  return buildProvider(
    'medical-primary',
    'medical-primary',
    'medical',
    AI_MEDICAL_PRIMARY_URL,
    AI_MEDICAL_PRIMARY_KEY,
    AI_MEDICAL_PRIMARY_MODEL,
    AI_MEDICAL_PRIMARY_PROVIDER || 'medical'
  );
}

function buildMedicalSecondaryProvider(): GatewayProvider | null {
  if (!AI_ROUTING_ENABLED || !AI_MEDICAL_SECONDARY_URL) {
    return null;
  }

  return buildProvider(
    'medical-secondary',
    'medical-secondary',
    'medical',
    AI_MEDICAL_SECONDARY_URL,
    AI_MEDICAL_SECONDARY_KEY,
    AI_MEDICAL_SECONDARY_MODEL || AI_MEDICAL_PRIMARY_MODEL,
    AI_MEDICAL_SECONDARY_PROVIDER || 'medical'
  );
}

function buildTaskProvider(
  id: string,
  label: string,
  url: string,
  key: string,
  model: string,
  fallbackProvider: string
): GatewayProvider | null {
  return buildProvider(id, label, 'task', url, key, model, fallbackProvider);
}

function buildKimiTaskProvider(): GatewayProvider | null {
  return buildTaskProvider('task-kimi', 'task-kimi', AI_KIMI_URL, AI_KIMI_KEY, AI_KIMI_MODEL, AI_KIMI_PROVIDER);
}

function buildMiniMaxTaskProvider(): GatewayProvider | null {
  return buildTaskProvider('task-minimax', 'task-minimax', AI_MINIMAX_URL, AI_MINIMAX_KEY, AI_MINIMAX_MODEL, AI_MINIMAX_PROVIDER);
}

function buildGLMTaskProvider(): GatewayProvider | null {
  return buildTaskProvider('task-glm', 'task-glm', AI_GLM_URL, AI_GLM_KEY, AI_GLM_MODEL, AI_GLM_PROVIDER);
}

function dedupeProviders(providers: Array<GatewayProvider | null>): GatewayProvider[] {
  const unique = new Map<string, GatewayProvider>();

  for (const provider of providers) {
    if (!provider) {
      continue;
    }

    const key = `${provider.url}::${provider.model}`;
    if (!unique.has(key)) {
      unique.set(key, provider);
    }
  }

  return Array.from(unique.values());
}

function buildRoutingSignalText(messages: ChatMessage[]): string {
  const recentUserMessages = messages
    .filter((message) => message.role === 'user' && message.content.trim())
    .slice(-3)
    .map((message) => message.content.trim());

  if (recentUserMessages.length > 0) {
    return recentUserMessages.join('\n');
  }

  return messages
    .filter((message) => message.role !== 'system' && message.content.trim())
    .slice(-4)
    .map((message) => message.content.trim())
    .join('\n');
}

function shouldUseMedicalRoute(messages: ChatMessage[]): boolean {
  const routingText = buildRoutingSignalText(messages);
  return MEDICAL_ROUTING_PATTERNS.some((pattern) => pattern.test(routingText));
}

function resolveProviderChain(
  messages: ChatMessage[],
  options: {
    model?: string;
  } = {}
): GatewayProvider[] {
  const requestedModel = options.model ? (MODEL_ALIASES[options.model] || options.model) : undefined;
  const requestedConfig = requestedModel ? resolveModelConfig(requestedModel) : undefined;

  if (requestedModel) {
    if (requestedConfig?.provider === 'deepseek') {
      return dedupeProviders([
        buildGeneralProvider(),
        buildLegacyProvider(requestedModel),
      ]);
    }

    if (requestedConfig?.provider === 'baichuan') {
      return dedupeProviders([
        buildMedicalPrimaryProvider(),
        buildMedicalSecondaryProvider(),
        buildLegacyProvider(requestedModel),
      ]);
    }

    return dedupeProviders([buildLegacyProvider(requestedModel)]);
  }

  if (!AI_ROUTING_ENABLED) {
    return dedupeProviders([buildLegacyProvider()]);
  }

  if (shouldUseMedicalRoute(messages)) {
    return dedupeProviders([
      buildMedicalPrimaryProvider(),
      buildMedicalSecondaryProvider(),
      buildLegacyProvider(),
    ]);
  }

  return dedupeProviders([
    buildGeneralProvider(),
    buildMedicalPrimaryProvider(),
    buildMedicalSecondaryProvider(),
    buildLegacyProvider(),
  ]);
}

function resolveTaskProviderChain(taskRole: AITaskModelRole): GatewayProvider[] {
  switch (taskRole) {
    case 'glm_classify':
      return dedupeProviders([
        buildGLMTaskProvider(),
        buildLegacyProvider('glm-5'),
        buildGeneralProvider(),
        buildLegacyProvider(),
      ]);
    case 'kimi_reason':
      return dedupeProviders([
        buildKimiTaskProvider(),
        buildLegacyProvider('kimi-k2.5'),
        buildMedicalPrimaryProvider(),
        buildLegacyProvider(),
      ]);
    case 'minimax_render':
      return dedupeProviders([
        buildMiniMaxTaskProvider(),
        buildLegacyProvider('minimax-2.5'),
        buildGeneralProvider(),
        buildLegacyProvider(),
      ]);
    default:
      return dedupeProviders([buildLegacyProvider()]);
  }
}

function buildGatewayHeaders(provider: GatewayProvider, stream = false): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (stream) {
    headers.Accept = 'text/event-stream';
  }

  if (provider.key) {
    headers.Authorization = `Bearer ${provider.key}`;
  }

  if (provider.provider === 'openrouter' || provider.url.includes('openrouter.ai')) {
    if (OPENROUTER_SITE_URL) {
      headers['HTTP-Referer'] = OPENROUTER_SITE_URL;
    }
    if (OPENROUTER_APP_NAME) {
      headers['X-Title'] = OPENROUTER_APP_NAME;
    }
  }

  return headers;
}

function buildMessagesWithKnowledgeContext(
  messages: ChatMessage[],
  context?: string
): ChatMessage[] {
  const systemParts = [MATERNAL_HEALTH_SYSTEM_PROMPT];
  if (context) {
    systemParts.push(`以下是相关知识库内容，请参考：

${context}

请优先基于以上知识回答用户问题；若知识库未覆盖，再给出审慎的通用建议。`);
  }

  return [
    { role: 'system', content: systemParts.join('\n\n') },
    ...messages.filter(message => message.role !== 'system'),
  ];
}

async function requestProvider(
  provider: GatewayProvider,
  messages: ChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<Response> {
  const request: ChatRequest = {
    model: provider.model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2000,
    stream: options.stream ?? false,
  };

  const timeoutMs = options.timeoutMs && Number.isFinite(options.timeoutMs)
    ? Math.max(1000, options.timeoutMs)
    : AI_PROVIDER_TIMEOUT_MS;

  try {
    return await fetch(provider.url, {
      method: 'POST',
      headers: buildGatewayHeaders(provider, options.stream),
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`AI Gateway timeout after ${timeoutMs}ms`);
    }

    throw error;
  }
}

async function callProvider(
  provider: GatewayProvider,
  messages: ChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<string> {
  const response = await requestProvider(provider, messages, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AI Gateway:${provider.label}] Error:`, response.status, errorText);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data: ChatResponse = await response.json() as ChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (content == null) {
    throw new Error('AI provider returned empty response');
  }
  return content;
}

function toRouteInfo(provider: GatewayProvider): AIGatewayRouteInfo {
  return {
    provider: provider.provider,
    model: provider.model,
    route: provider.routeKind,
    label: provider.label,
  };
}

async function* streamProvider(
  provider: GatewayProvider,
  messages: ChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
  } = {}
): AsyncGenerator<string, void, unknown> {
  if (!provider.supportsStreaming) {
    const finalAnswer = await callProvider(provider, messages, options);
    if (finalAnswer) {
      yield finalAnswer;
    }
    return;
  }

  const response = await requestProvider(provider, messages, {
    ...options,
    stream: true,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AI Gateway Stream:${provider.label}] Error:`, response.status, errorText);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const MAX_BUFFER_SIZE = 512 * 1024;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    if (buffer.length > MAX_BUFFER_SIZE) {
      throw new Error('系统响应超出大小限制');
    }

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) {
        continue;
      }

      const data = line.slice(6);
      if (data === '[DONE]') {
        return;
      }

      try {
        const parsed = JSON.parse(data) as ChatResponse;
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch {
        // 忽略非 JSON 行
      }
    }
  }
}

// 检测是否为紧急问题
export function isEmergencyQuestion(question: string): boolean {
  return EMERGENCY_KEYWORDS.some(keyword => question.includes(keyword));
}

// 生成紧急问题回复
export function getEmergencyResponse(): string {
  return `⚠️ 您描述的情况可能比较紧急，请立即就医，不要等待！

如遇紧急情况请拨打：
- 急救电话：120
- 产科急诊：前往最近医院

不要在网上寻求建议，时间就是生命！`;
}

// 非流式调用 AI Gateway
export async function callAIGateway(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const providers = resolveProviderChain(messages, { model: options.model });
  if (providers.length === 0) {
    throw new Error('未配置可用的服务提供方');
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      return await callProvider(provider, messages, options);
    } catch (error) {
      lastError = error;
      console.error(`[AI Router] Provider failed: ${provider.label}`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('问答服务不可用');
}

export async function callAIGatewayDetailed(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<AIGatewayTextResult> {
  const providers = resolveProviderChain(messages, { model: options.model });
  if (providers.length === 0) {
    throw new Error('未配置可用的服务提供方');
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      const answer = await callProvider(provider, messages, options);
      return {
        answer,
        route: toRouteInfo(provider),
      };
    } catch (error) {
      lastError = error;
      console.error(`[AI Router] Provider failed: ${provider.label}`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('问答服务不可用');
}

export async function callTaskModelDetailed(
  taskRole: AITaskModelRole,
  messages: ChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<AIGatewayTextResult> {
  const providers = resolveTaskProviderChain(taskRole);
  if (providers.length === 0) {
    throw new Error(`未配置可用的任务模型: ${taskRole}`);
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      const answer = await callProvider(provider, messages, options);
      return {
        answer,
        route: toRouteInfo(provider),
      };
    } catch (error) {
      lastError = error;
      console.error(`[AI Task Router] Provider failed: ${taskRole} -> ${provider.label}`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`任务模型不可用: ${taskRole}`);
}

// 流式调用 AI Gateway
export async function* streamAIGateway(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    onRouteResolved?: (route: AIGatewayRouteInfo) => void;
  } = {}
): AsyncGenerator<string, void, unknown> {
  const providers = resolveProviderChain(messages, { model: options.model });
  if (providers.length === 0) {
    throw new Error('未配置可用的服务提供方');
  }

  let lastError: unknown;

  for (const provider of providers) {
    let hasOutput = false;

    try {
      options.onRouteResolved?.(toRouteInfo(provider));
      for await (const chunk of streamProvider(provider, messages, options)) {
        hasOutput = true;
        yield chunk;
      }
      return;
    } catch (error) {
      lastError = error;
      console.error(`[AI Router] Stream provider failed: ${provider.label}`, error);
      if (hasOutput) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('问答服务不可用');
}

// RAG 增强问答（带知识库检索）
export async function ragEnhancedAnswer(
  question: string,
  context?: string
): Promise<{
  answer: string;
  sources: Array<{ title: string; content: string }>;
  confidence: number;
  route?: AIGatewayRouteInfo;
}> {
  const messages = buildMessagesWithKnowledgeContext([
    { role: 'user', content: question },
  ], context);

  try {
    const result = await callAIGatewayDetailed(messages, {
      temperature: 0.7,
      maxTokens: 2000,
    });

    return {
      answer: result.answer,
      sources: context ? [{ title: '知识库', content: context.substring(0, 200) + '...' }] : [],
      confidence: 0.85,
      route: result.route,
    };
  } catch (error) {
    console.error('[RAG] Error:', error);
    return {
      answer: '抱歉，服务暂时不可用，请稍后再试。如有紧急问题，请直接咨询医生。',
      sources: [],
      confidence: 0,
    };
  }
}

// 多轮对话（带历史）
export async function multiTurnChat(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    context?: string;
  } = {}
): Promise<string> {
  const fullMessages = buildMessagesWithKnowledgeContext(messages, options.context);

  return callAIGateway(fullMessages, options);
}

export async function multiTurnChatDetailed(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    context?: string;
  } = {}
): Promise<AIGatewayTextResult> {
  const fullMessages = buildMessagesWithKnowledgeContext(messages, options.context);

  return callAIGatewayDetailed(fullMessages, options);
}

// 流式多轮对话
export async function* streamMultiTurnChat(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    context?: string;
    onRouteResolved?: (route: AIGatewayRouteInfo) => void;
  } = {}
): AsyncGenerator<string, void, unknown> {
  const fullMessages = buildMessagesWithKnowledgeContext(messages, options.context);

  yield* streamAIGateway(fullMessages, options);
}

// 获取可用模型列表
export function getAvailableModels(): Array<{ id: string; name: string; provider: string }> {
  return getUniqueSupportedModels()
    .map(({ id, name, provider }) => ({
      id,
      name,
      provider,
    }));
}

export function getTaskModelBindings(): AITaskModelBinding[] {
  const bindings: Array<{ role: AITaskModelRole; provider: GatewayProvider | null }> = [
    { role: 'glm_classify', provider: buildGLMTaskProvider() },
    { role: 'kimi_reason', provider: buildKimiTaskProvider() },
    { role: 'minimax_render', provider: buildMiniMaxTaskProvider() },
  ];

  return bindings.map(({ role, provider }) => ({
    role,
    model: provider?.model || '',
    provider: provider?.provider || '',
    configured: Boolean(provider),
  }));
}

export function getDefaultModel(): string {
  const selectedModel = MODEL_ALIASES[DEFAULT_MODEL] || DEFAULT_MODEL;
  return SUPPORTED_MODELS[selectedModel]?.id || selectedModel;
}

// 健康检查
export async function healthCheck(): Promise<{
  status: 'ok' | 'error';
  gateway: string;
  models: string[];
  mode: 'config-only';
  providers: AIGatewayRouteInfo[];
  taskBindings: AITaskModelBinding[];
  routing?: {
    enabled: boolean;
    generalProvider?: string;
    medicalProviders: string[];
  };
}> {
  const providers = AI_ROUTING_ENABLED
    ? dedupeProviders([
      buildGeneralProvider(),
      buildMedicalPrimaryProvider(),
      buildMedicalSecondaryProvider(),
      buildLegacyProvider(),
    ])
    : dedupeProviders([buildLegacyProvider()]);

  return {
    status: providers.length > 0 ? 'ok' : 'error',
    gateway: AI_ROUTING_ENABLED ? 'hybrid-routing' : (providers[0]?.url || resolveGatewayChatCompletionsUrl(LEGACY_GATEWAY_URL)),
    models: getUniqueSupportedModels().map(model => model.id),
    mode: 'config-only',
    providers: providers.map((provider) => toRouteInfo(provider)),
    taskBindings: getTaskModelBindings(),
    routing: {
      enabled: AI_ROUTING_ENABLED,
      generalProvider: buildGeneralProvider()?.provider,
      medicalProviders: [
        buildMedicalPrimaryProvider()?.provider,
        buildMedicalSecondaryProvider()?.provider,
      ].filter(Boolean) as string[],
    },
  };
}
