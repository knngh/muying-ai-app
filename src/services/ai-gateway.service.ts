// AI Gateway 服务 - 支持混合路由、多模型对接和流式响应

const LEGACY_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'http://localhost:8080/v1';
const LEGACY_GATEWAY_KEY = process.env.AI_GATEWAY_KEY || '';
const AI_ROUTING_ENABLED = process.env.AI_ROUTING_ENABLED === 'true';
const AI_GENERAL_URL = process.env.AI_GENERAL_URL || process.env.SILICONFLOW_API_URL || 'https://api.siliconflow.cn/v1/chat/completions';
const AI_GENERAL_KEY = process.env.AI_GENERAL_KEY || process.env.SILICONFLOW_API_KEY || '';
const AI_GENERAL_MODEL = process.env.AI_GENERAL_MODEL || 'deepseek-ai/DeepSeek-V3';
const AI_GENERAL_PROVIDER = process.env.AI_GENERAL_PROVIDER || 'siliconflow';
const AI_MEDICAL_PRIMARY_URL = process.env.AI_MEDICAL_PRIMARY_URL || LEGACY_GATEWAY_URL;
const AI_MEDICAL_PRIMARY_KEY = process.env.AI_MEDICAL_PRIMARY_KEY || LEGACY_GATEWAY_KEY;
const AI_MEDICAL_PRIMARY_MODEL = process.env.AI_MEDICAL_PRIMARY_MODEL || (process.env.AI_DEFAULT_MODEL || 'baichuan-m3');
const AI_MEDICAL_PRIMARY_PROVIDER = process.env.AI_MEDICAL_PRIMARY_PROVIDER || '';
const AI_MEDICAL_SECONDARY_URL = process.env.AI_MEDICAL_SECONDARY_URL || '';
const AI_MEDICAL_SECONDARY_KEY = process.env.AI_MEDICAL_SECONDARY_KEY || '';
const AI_MEDICAL_SECONDARY_MODEL = process.env.AI_MEDICAL_SECONDARY_MODEL || '';
const AI_MEDICAL_SECONDARY_PROVIDER = process.env.AI_MEDICAL_SECONDARY_PROVIDER || '';

const MODEL_ALIASES: Record<string, string> = {
  'Baichuan-M3': 'baichuan-m3',
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
  routeKind: 'general' | 'medical' | 'legacy' | 'manual';
  url: string;
  key: string;
  model: string;
  supportsStreaming: boolean;
}

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

// 支持的模型列表
export const SUPPORTED_MODELS: Record<string, SupportedModel> = {
  'kimi-k2.5': {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    provider: 'dashscope',
    maxTokens: 16384,
  },
  'glm-4': {
    id: 'glm-4',
    name: 'GLM-4',
    provider: 'zhipu',
    maxTokens: 4096,
  },
  'glm-4-flash': {
    id: 'glm-4-flash',
    name: 'GLM-4-Flash',
    provider: 'zhipu',
    maxTokens: 4096,
  },
  'gemini-pro': {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'google',
    maxTokens: 8192,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    maxTokens: 4096,
  },
  'deepseek-chat': {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    maxTokens: 4096,
  },
  'baichuan-m3': {
    id: 'baichuan-m3',
    apiModel: 'Baichuan-M3',
    name: 'Baichuan M3',
    provider: 'baichuan',
    maxTokens: 8192,
  },
};

// 默认模型
const DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'glm-4-flash';

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
    'general-deepseek',
    'general-deepseek',
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
  } = {}
): Promise<Response> {
  const request: ChatRequest = {
    model: provider.model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2000,
    stream: options.stream ?? false,
  };

  return fetch(provider.url, {
    method: 'POST',
    headers: buildGatewayHeaders(provider, options.stream),
    body: JSON.stringify(request),
  });
}

async function callProvider(
  provider: GatewayProvider,
  messages: ChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const response = await requestProvider(provider, messages, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AI Gateway:${provider.label}] Error:`, response.status, errorText);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data: ChatResponse = await response.json() as ChatResponse;
  return data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答这个问题。';
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
      throw new Error('AI 响应超出大小限制');
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
    throw new Error('未配置可用的 AI 提供方');
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

  throw lastError instanceof Error ? lastError : new Error('AI 服务不可用');
}

export async function callAIGatewayDetailed(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<AIGatewayTextResult> {
  const providers = resolveProviderChain(messages, { model: options.model });
  if (providers.length === 0) {
    throw new Error('未配置可用的 AI 提供方');
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

  throw lastError instanceof Error ? lastError : new Error('AI 服务不可用');
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
    throw new Error('未配置可用的 AI 提供方');
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

  throw lastError instanceof Error ? lastError : new Error('AI 服务不可用');
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
