// 共享 AI 相关类型

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceReference[]
  actionCards?: AIActionCard[]
  entryMeta?: AIEntryMeta
  isEmergency?: boolean
  triageCategory?: TriageCategory
  riskLevel?: RiskLevel
  structuredAnswer?: StructuredAnswer
  uncertainty?: UncertaintyInfo
  sourceReliability?: SourceReliability
  followUpQuestions?: string[]
  confidence?: number
  model?: string
  provider?: string
  route?: string
  degraded?: boolean
  createdAt: string
}

export type RiskLevel = 'green' | 'yellow' | 'red'
export type TriageCategory = 'normal' | 'caution' | 'emergency' | 'out_of_scope'
export type SourceReliability = 'authoritative' | 'mixed' | 'medical_platform_only' | 'dataset_only' | 'none'
export type AIActionCardType = 'calendar' | 'knowledge' | 'archive' | 'follow_up'
export type AIActionCardPriority = 'primary' | 'secondary'

export interface AIEntryMeta {
  entrySource?: string
  stage?: string
  articleSlug?: string
  articleTitle?: string
  articleSourceOrg?: string | null
  articleTopic?: string | null
  reportId?: string
  reportStageLabel?: string
  reportHighlightIndex?: number
}

export interface AIActionCard {
  id: string
  type: AIActionCardType
  label: string
  title: string
  description?: string
  priority: AIActionCardPriority
  payload?: {
    eventTitle?: string
    eventDescription?: string
    eventType?: 'checkup' | 'vaccine' | 'reminder' | 'exercise' | 'diet' | 'other'
    targetDate?: string
    knowledgeKeyword?: string
    sourceUrl?: string
    prefillQuestion?: string
    archiveFocus?: 'timeline' | 'report' | 'export'
  }
}

export interface StructuredAnswer {
  conclusion: string
  reasons: string[]
  actions: string[]
  whenToSeekCare: string[]
  uncertaintyNote?: string
}

export interface UncertaintyInfo {
  level: 'none' | 'medium' | 'high'
  message?: string
}

export interface SourceReference {
  title: string
  url?: string
  source: string
  relevance: number
  excerpt?: string
  category?: string
  sourceOrg?: string
  updatedAt?: string
  audience?: string
  topic?: string
  riskLevelDefault?: RiskLevel
  region?: string
  sourceType?: 'authority' | 'dataset' | 'editorial' | 'unknown'
  sourceClass?: 'official' | 'medical_platform' | 'dataset' | 'unknown'
  authoritative?: boolean
}

export interface ChatSession {
  id: string
  title?: string
  summary?: string
  messageCount?: number
  lastMessagePreview?: string
  messages: AIMessage[]
  createdAt: string
  updatedAt: string
}

export interface AskRequest {
  question: string
  conversationId?: string
  model?: string
  context?: string | Record<string, string | number | boolean | null>
}

export interface AskResponse {
  answer: string
  sources: SourceReference[]
  actionCards?: AIActionCard[]
  isEmergency: boolean
  conversationId?: string
  disclaimer: string
  triageCategory?: TriageCategory
  riskLevel?: RiskLevel
  structuredAnswer?: StructuredAnswer
  uncertainty?: UncertaintyInfo
  sourceReliability?: SourceReliability
  followUpQuestions?: string[]
  confidence?: number
  model?: string
  provider?: string
  route?: string
  degraded?: boolean
}

export interface ChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  conversationId?: string
  model?: string
  context?: string | Record<string, string | number | boolean | null>
}

export interface ChatResponse {
  response: string
  sources: SourceReference[]
  actionCards?: AIActionCard[]
  isEmergency: boolean
  conversationId?: string
  disclaimer: string
  triageCategory?: TriageCategory
  riskLevel?: RiskLevel
  structuredAnswer?: StructuredAnswer
  uncertainty?: UncertaintyInfo
  sourceReliability?: SourceReliability
  followUpQuestions?: string[]
  confidence?: number
  model?: string
  provider?: string
  route?: string
  degraded?: boolean
}

// WebSocket 消息协议
export interface WsClientMessage {
  type: 'ask_stream' | 'chat_stream'
  requestId: string
  payload: {
    question?: string
    messages?: Array<{ role: string; content: string }>
    conversationId?: string
    model?: string
    context?: string | Record<string, string | number | boolean | null>
  }
}

export interface WsServerMessage {
  type: 'chunk' | 'done' | 'error' | 'emergency'
  requestId: string
  data: {
    content?: string
    isEmergency?: boolean
    error?: string
    sources?: SourceReference[]
    actionCards?: AIActionCard[]
    disclaimer?: string
    conversationId?: string
    triageCategory?: TriageCategory
    riskLevel?: RiskLevel
    structuredAnswer?: StructuredAnswer
    uncertainty?: UncertaintyInfo
    sourceReliability?: SourceReliability
    followUpQuestions?: string[]
    degraded?: boolean
    model?: string
    provider?: string
    route?: string
  }
}
