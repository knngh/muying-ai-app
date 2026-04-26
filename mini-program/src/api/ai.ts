import api from './request'
import type { AIMessage, AskResponse, ChatResponse, ChatSession } from '../../../shared/types'

export type { AIMessage, AskResponse, ChatResponse, ChatSession }
export type { SourceReference } from '../../../shared/types'

type ChatContext = string | Record<string, string | number | boolean | null>

export const aiApi = {
  ask: async (data: { question: string; context?: ChatContext; model?: string }) => {
    const res = await api.post<{
      answer: string
      sources?: AskResponse['sources']
      isEmergency: boolean
      disclaimer: string
      conversationId?: string
      triageCategory?: AskResponse['triageCategory']
      riskLevel?: AskResponse['riskLevel']
      structuredAnswer?: AskResponse['structuredAnswer']
      uncertainty?: AskResponse['uncertainty']
      sourceReliability?: AskResponse['sourceReliability']
      followUpQuestions?: AskResponse['followUpQuestions']
      confidence?: AskResponse['confidence']
      degraded?: AskResponse['degraded']
      model?: AskResponse['model']
      provider?: AskResponse['provider']
      route?: AskResponse['route']
    }>('/ai/ask', {
      question: data.question,
      context: data.context,
      model: data.model,
    })

    return {
      answer: res.answer,
      sources: res.sources || [],
      isEmergency: res.isEmergency,
      conversationId: res.conversationId,
      disclaimer: res.disclaimer,
      triageCategory: res.triageCategory,
      riskLevel: res.riskLevel,
      structuredAnswer: res.structuredAnswer,
      uncertainty: res.uncertainty,
      sourceReliability: res.sourceReliability,
      followUpQuestions: res.followUpQuestions,
      confidence: res.confidence,
      degraded: res.degraded,
      model: res.model,
      provider: res.provider,
      route: res.route,
    } as AskResponse
  },
  chat: async (data: { messages: Array<{ role: string; content: string }>; conversationId?: string; context?: ChatContext; model?: string }) => {
    const res = await api.post<{
      message?: { content?: string }
      sources?: ChatResponse['sources']
      isEmergency: boolean
      disclaimer: string
      conversationId?: string
      triageCategory?: ChatResponse['triageCategory']
      riskLevel?: ChatResponse['riskLevel']
      structuredAnswer?: ChatResponse['structuredAnswer']
      uncertainty?: ChatResponse['uncertainty']
      sourceReliability?: ChatResponse['sourceReliability']
      followUpQuestions?: ChatResponse['followUpQuestions']
      confidence?: ChatResponse['confidence']
      degraded?: ChatResponse['degraded']
      model?: ChatResponse['model']
      provider?: ChatResponse['provider']
      route?: ChatResponse['route']
    }>('/ai/chat', data)

    return {
      response: res.message?.content || '',
      sources: res.sources || [],
      isEmergency: res.isEmergency,
      conversationId: res.conversationId,
      disclaimer: res.disclaimer,
      triageCategory: res.triageCategory,
      riskLevel: res.riskLevel,
      structuredAnswer: res.structuredAnswer,
      uncertainty: res.uncertainty,
      sourceReliability: res.sourceReliability,
      followUpQuestions: res.followUpQuestions,
      confidence: res.confidence,
      degraded: res.degraded,
      model: res.model,
      provider: res.provider,
      route: res.route,
    } as ChatResponse
  },
  getHistory: async (conversationId: string): Promise<ChatSession> => {
    return api.get<ChatSession>(`/ai/conversations/${conversationId}`)
  },
  getConversations: async (page = 1, pageSize = 20): Promise<ChatSession[]> => {
    const res = await api.get<{ list: ChatSession[]; pagination: { total: number } }>('/ai/conversations', { page, pageSize })
    return res.list || []
  },
  deleteConversation: async (conversationId: string) => {
    await api.delete(`/ai/conversations/${conversationId}`)
  },
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
  return '特别提示\n\n系统已识别到当前问题需要优先关注。\n\n建议尽快联系线下专业人员，结合实际情况获取进一步帮助。'
}

export function getDisclaimer(): string {
  return '免责声明：本功能由系统辅助生成，适用于母婴健康知识咨询、护理建议参考和就医前信息整理，不提供诊断结论、处方开具或具体治疗方案，也不能替代医生面诊、检查和专业判断。'
}
