import api from './request'
import type { AIMessage, AskResponse, ChatResponse } from '../../../shared/types'

export type { AIMessage, AskResponse, ChatResponse }
export type { SourceReference } from '../../../shared/types'

export const aiApi = {
  ask: async (data: { question: string; context?: string; model?: string }) => {
    const res = await api.post<{
      answer: string
      sources?: AskResponse['sources']
      isEmergency: boolean
      disclaimer: string
    }>('/ai/ask', {
      question: data.question,
      context: data.context,
      model: data.model,
    })

    return {
      answer: res.answer,
      sources: res.sources || [],
      isEmergency: res.isEmergency,
      disclaimer: res.disclaimer,
    } as AskResponse
  },
  chat: async (data: { messages: Array<{ role: string; content: string }>; model?: string }) => {
    const res = await api.post<{
      message?: { content?: string }
      isEmergency: boolean
      disclaimer: string
    }>('/ai/chat', data)

    return {
      response: res.message?.content || '',
      sources: [],
      isEmergency: res.isEmergency,
      disclaimer: res.disclaimer,
    } as ChatResponse
  },
  getHistory: async (_conversationId: string) => {
    throw new Error('当前后端未提供对话历史接口')
  },
  getConversations: async () => [],
  deleteConversation: async (_conversationId: string) => undefined,
}

// 紧急关键词检测
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
  return '紧急情况提示\n\n检测到您可能遇到了紧急情况。\n\n请立即就医，不要等待！\n\n紧急情况请联系：\n- 拨打 120 急救电话\n- 前往最近医院急诊\n- 联系您的产科医生'
}

export function getDisclaimer(): string {
  return '免责声明：本AI助手提供的回答仅供参考，不构成医疗建议。如有身体不适，请立即就医。紧急情况请拨打120。'
}
