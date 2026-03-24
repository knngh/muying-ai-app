// AI Gateway 服务 - 支持多模型对接和流式响应

import { EventEmitter } from 'events';

// AI Gateway 配置
const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'http://localhost:8080/v1';
const AI_GATEWAY_KEY = process.env.AI_GATEWAY_KEY || '';

// 支持的模型列表
export const SUPPORTED_MODELS = {
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

回答格式：
- 先给出简洁的答案要点
- 再展开详细说明
- 最后给出相关建议

免责声明：
本回答由 AI 生成，仅供参考，不构成医疗建议。如有健康问题，请咨询专业医生。`;

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
  '过敏休克', '严重过敏'
];

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

// AI Gateway 请求接口
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
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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
  const model = options.model || DEFAULT_MODEL;
  
  const request: ChatRequest = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2000,
    stream: false,
  };

  try {
    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_GATEWAY_KEY}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Gateway] Error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data: ChatResponse = await response.json() as ChatResponse;
    return data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答这个问题。';
  } catch (error) {
    console.error('[AI Gateway] Request failed:', error);
    throw error;
  }
}

// 流式调用 AI Gateway
export async function* streamAIGateway(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): AsyncGenerator<string, void, unknown> {
  const model = options.model || DEFAULT_MODEL;
  
  const request: ChatRequest = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2000,
    stream: true,
  };

  try {
    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_GATEWAY_KEY}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Gateway Stream] Error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const MAX_BUFFER_SIZE = 512 * 1024; // 512KB 防止 OOM

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      if (buffer.length > MAX_BUFFER_SIZE) {
        throw new Error('AI 响应超出大小限制');
      }
      
      // 解析 SSE 格式
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留最后一个不完整的行

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  } catch (error) {
    console.error('[AI Gateway Stream] Failed:', error);
    throw error;
  }
}

// RAG 增强问答（带知识库检索）
export async function ragEnhancedAnswer(
  question: string,
  context?: string
): Promise<{
  answer: string;
  sources: Array<{ title: string; content: string }>;
  confidence: number;
}> {
  // 构建消息
  const messages: ChatMessage[] = [
    { role: 'system', content: MATERNAL_HEALTH_SYSTEM_PROMPT },
  ];

  // 如果有上下文，添加知识库信息
  if (context) {
    messages.push({
      role: 'system',
      content: `以下是相关知识库内容，请参考：

${context}

请基于以上知识回答用户问题。`,
    });
  }

  messages.push({ role: 'user', content: question });

  try {
    const answer = await callAIGateway(messages, {
      temperature: 0.7,
      maxTokens: 2000,
    });

    return {
      answer,
      sources: context ? [{ title: '知识库', content: context.substring(0, 200) + '...' }] : [],
      confidence: 0.85,
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
  } = {}
): Promise<string> {
  // 在消息开头添加系统提示
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: MATERNAL_HEALTH_SYSTEM_PROMPT },
    ...messages,
  ];

  return callAIGateway(fullMessages, options);
}

// 流式多轮对话
export async function* streamMultiTurnChat(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
  } = {}
): AsyncGenerator<string, void, unknown> {
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: MATERNAL_HEALTH_SYSTEM_PROMPT },
    ...messages,
  ];

  yield* streamAIGateway(fullMessages, options);
}

// 获取可用模型列表
export function getAvailableModels(): Array<{ id: string; name: string; provider: string }> {
  return Object.values(SUPPORTED_MODELS).map(({ id, name, provider }) => ({
    id,
    name,
    provider,
  }));
}

// 健康检查
export async function healthCheck(): Promise<{
  status: 'ok' | 'error';
  gateway: string;
  models: string[];
}> {
  try {
    // 尝试一个简单请求
    const response = await callAIGateway([
      { role: 'user', content: 'hi' },
    ], { maxTokens: 10 });

    return {
      status: response ? 'ok' : 'error',
      gateway: AI_GATEWAY_URL,
      models: Object.keys(SUPPORTED_MODELS),
    };
  } catch (error) {
    return {
      status: 'error',
      gateway: AI_GATEWAY_URL,
      models: Object.keys(SUPPORTED_MODELS),
    };
  }
}