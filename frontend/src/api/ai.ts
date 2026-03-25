import api from './index'

// ==================== 类型定义 ====================

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceReference[]
  isEmergency?: boolean
  createdAt: string
}

export interface SourceReference {
  title: string
  url?: string
  source: string
  relevance: number
}

export interface ChatSession {
  id: string
  messages: AIMessage[]
  createdAt: string
  updatedAt: string
}

export interface AskRequest {
  question: string
  conversationId?: string
}

export interface AskResponse {
  answer: string
  sources: SourceReference[]
  isEmergency: boolean
  conversationId?: string
  disclaimer: string
}

export interface ChatRequest {
  message: string
  conversationId?: string
  history?: Array<{ role: string; content: string }>
}

export interface ChatResponse {
  response: string
  sources: SourceReference[]
  isEmergency: boolean
  conversationId?: string
  disclaimer: string
}

// ==================== AI 问答 API ====================

export const aiApi = {
  // 单轮问答
  ask: async (data: AskRequest): Promise<AskResponse> => {
    const res = await api.post<{
      answer: string
      sources?: SourceReference[]
      isEmergency: boolean
      disclaimer: string
    }>('/ai/ask', { question: data.question })

    return {
      answer: res.answer,
      sources: res.sources || [],
      isEmergency: res.isEmergency,
      conversationId: data.conversationId,
      disclaimer: res.disclaimer,
    }
  },

  // 多轮对话
  chat: async (data: ChatRequest): Promise<ChatResponse> => {
    const messages = [
      ...(data.history || []),
      { role: 'user', content: data.message },
    ]
    const res = await api.post<{
      message?: { content?: string }
      isEmergency: boolean
      disclaimer: string
    }>('/ai/chat', { messages })

    return {
      response: res.message?.content || '',
      sources: [],
      isEmergency: res.isEmergency,
      conversationId: data.conversationId,
      disclaimer: res.disclaimer,
    }
  },

  // 获取对话历史
  getHistory: async (_conversationId: string): Promise<ChatSession> => {
    throw new Error('当前后端未提供对话历史接口')
  },

  // 获取所有对话列表
  getConversations: async (): Promise<ChatSession[]> => {
    return []
  },

  // 删除对话
  deleteConversation: async (_conversationId: string): Promise<void> => {
    return
  },
}

// ==================== 紧急关键词检测 ====================

export const emergencyKeywords = [
  '出血', '大出血', '阴道出血', '腹痛剧烈', '剧烈疼痛',
  '昏迷', '晕厥', '抽搐', '高烧', '呼吸困难',
  '胎动减少', '胎动消失', '破水', '羊水破了',
  '早产', '流产', '宫外孕', '前置胎盘',
  '妊娠高血压', '子痫', 'HELLP综合征',
  '脐带脱垂', '胎盘早剥', '胎儿窘迫',
  '新生儿窒息', '意外', '中毒', '过敏休克',
]

export function detectEmergency(text: string): boolean {
  const lowerText = text.toLowerCase()
  return emergencyKeywords.some(keyword => lowerText.includes(keyword))
}

export function getEmergencyWarning(): string {
  return '⚠️ 紧急情况提示\n\n检测到您可能遇到了紧急情况。\n\n🚨 请立即就医，不要等待！\n\n紧急情况请联系：\n• 拨打 120 急救电话\n• 前往最近医院急诊\n• 联系您的产科医生'
}

// ==================== 免责声明 ====================

export function getDisclaimer(): string {
  return `⚠️ 免责声明

本AI助手提供的回答仅供参考，不构成医疗建议。

🚨 重要提示：
• 如有身体不适，请立即就医
• 紧急情况请拨打120或前往医院急诊
• 本AI回答不能替代专业医生的诊断和建议

内容来源：部分回答参考自专业医学资料，仅供参考学习。`
}
