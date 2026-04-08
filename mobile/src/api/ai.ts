import api from './index'
import type { AIMessage, AskResponse, ChatResponse, ChatSession, SourceReference } from '../../../shared/types'

export type { AIMessage, AskResponse, ChatResponse, ChatSession, SourceReference }

export const aiApi = {
  ask: async (data: { question: string; context?: string; model?: string; clientRequestId?: string }) => {
    const res = await api.post<{
      answer: string
      sources?: AskResponse['sources']
      isEmergency: boolean
      disclaimer: string
      conversationId?: string
    }>('/ai/ask', {
      question: data.question,
      context: data.context,
      model: data.model,
      clientRequestId: data.clientRequestId,
    })

    return {
      answer: res.answer,
      sources: res.sources || [],
      isEmergency: res.isEmergency,
      conversationId: res.conversationId,
      disclaimer: res.disclaimer,
    } as AskResponse
  },
  chat: async (data: {
    messages: Array<{ role: string; content: string }>
    conversationId?: string
    context?: string
    model?: string
    clientRequestId?: string
  }) => {
    const res = await api.post<{
      message?: { content?: string }
      sources?: ChatResponse['sources']
      isEmergency: boolean
      disclaimer: string
      conversationId?: string
    }>('/ai/chat', data)

    return {
      response: res.message?.content || '',
      sources: res.sources || [],
      isEmergency: res.isEmergency,
      conversationId: res.conversationId,
      disclaimer: res.disclaimer,
    } as ChatResponse
  },
  getHistory: async (conversationId: string): Promise<ChatSession> => {
    return api.get<ChatSession>(`/ai/conversations/${conversationId}`)
  },
  getConversations: async (): Promise<ChatSession[]> => {
    const res = await api.get<{ conversations: ChatSession[] }>('/ai/conversations')
    return res.conversations || []
  },
  deleteConversation: async (conversationId: string) => {
    await api.delete(`/ai/conversations/${conversationId}`)
  },
}

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
  return emergencyKeywords.some(keyword => text.includes(keyword))
}

export function getEmergencyWarning(): string {
  return '紧急情况提示\n\n检测到您可能遇到了紧急情况。\n\n请立即就医，不要等待！\n\n紧急情况请联系：\n- 拨打 120 急救电话\n- 前往最近医院急诊\n- 联系您的产科医生'
}

export function getDisclaimer(): string {
  return '免责声明：本功能提供的回答仅供参考，不构成医疗建议。如有身体不适，请立即就医。紧急情况请拨打120。'
}
