import api from './index'
import type { AIActionCard, AIEntryMeta, AIMessage, AskResponse, ChatResponse, ChatSession, SourceReference } from '../../../shared/types'

export type { AIActionCard, AIEntryMeta, AIMessage, AskResponse, ChatResponse, ChatSession, SourceReference }

type ChatContext = string | Record<string, string | number | boolean | null>

export const aiApi = {
  ask: async (data: { question: string; context?: ChatContext; model?: string; clientRequestId?: string }) => {
    const res = await api.post<{
      answer: string
      sources?: AskResponse['sources']
      actionCards?: AskResponse['actionCards']
      isEmergency: boolean
      disclaimer: string
      conversationId?: string
      triageCategory?: AskResponse['triageCategory']
      riskLevel?: AskResponse['riskLevel']
      structuredAnswer?: AskResponse['structuredAnswer']
      followUpQuestions?: AskResponse['followUpQuestions']
      uncertainty?: AskResponse['uncertainty']
      sourceReliability?: AskResponse['sourceReliability']
      degraded?: AskResponse['degraded']
      model?: AskResponse['model']
      provider?: AskResponse['provider']
      route?: AskResponse['route']
      aiDisclosure?: AskResponse['aiDisclosure']
    }>('/ai/ask', {
      question: data.question,
      context: data.context,
      model: data.model,
      clientRequestId: data.clientRequestId,
    })

    return {
      answer: res.answer,
      sources: res.sources || [],
      actionCards: res.actionCards || [],
      isEmergency: res.isEmergency,
      conversationId: res.conversationId,
      disclaimer: res.disclaimer,
      triageCategory: res.triageCategory,
      riskLevel: res.riskLevel,
      structuredAnswer: res.structuredAnswer,
      followUpQuestions: res.followUpQuestions || [],
      uncertainty: res.uncertainty,
      sourceReliability: res.sourceReliability,
      degraded: res.degraded,
      model: res.model,
      provider: res.provider,
      route: res.route,
      aiDisclosure: res.aiDisclosure,
    } as AskResponse
  },
  chat: async (data: {
    messages: Array<{ role: string; content: string }>
    conversationId?: string
    context?: ChatContext
    model?: string
    clientRequestId?: string
  }) => {
    const res = await api.post<{
      message?: { content?: string }
      sources?: ChatResponse['sources']
      actionCards?: ChatResponse['actionCards']
      isEmergency: boolean
      disclaimer: string
      conversationId?: string
      triageCategory?: ChatResponse['triageCategory']
      riskLevel?: ChatResponse['riskLevel']
      structuredAnswer?: ChatResponse['structuredAnswer']
      followUpQuestions?: ChatResponse['followUpQuestions']
      uncertainty?: ChatResponse['uncertainty']
      sourceReliability?: ChatResponse['sourceReliability']
      degraded?: ChatResponse['degraded']
      model?: ChatResponse['model']
      provider?: ChatResponse['provider']
      route?: ChatResponse['route']
      aiDisclosure?: ChatResponse['aiDisclosure']
    }>('/ai/chat', data)

    return {
      response: res.message?.content || '',
      sources: res.sources || [],
      actionCards: res.actionCards || [],
      isEmergency: res.isEmergency,
      conversationId: res.conversationId,
      disclaimer: res.disclaimer,
      triageCategory: res.triageCategory,
      riskLevel: res.riskLevel,
      structuredAnswer: res.structuredAnswer,
      followUpQuestions: res.followUpQuestions || [],
      uncertainty: res.uncertainty,
      sourceReliability: res.sourceReliability,
      degraded: res.degraded,
      model: res.model,
      provider: res.provider,
      route: res.route,
      aiDisclosure: res.aiDisclosure,
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
  submitFeedback: async (data: {
    qaId: string
    feedback: 'helpful' | 'not_helpful' | 'wrong'
    comment?: string
    messageId?: string
    conversationId?: string
    reason?: 'missing_sources' | 'too_generic' | 'incorrect' | 'unsafe' | 'not_actionable' | 'other'
    actionTaken?: 'none' | 'added_to_calendar' | 'opened_knowledge' | 'opened_archive' | 'went_to_hospital'
    triageCategory?: AskResponse['triageCategory']
    riskLevel?: AskResponse['riskLevel']
    sourceReliability?: AskResponse['sourceReliability']
    route?: string
    provider?: string
    model?: string
    entrySource?: string
    articleSlug?: string
    reportId?: string
  }) => {
    return api.post<{ received: boolean }>('/ai/feedback', data)
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
  return '本功能提供母婴健康信息参考，不提供诊断、治疗或用药决策，不能替代医生面诊。'
}
