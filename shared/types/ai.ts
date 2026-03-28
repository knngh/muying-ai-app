// 共享 AI 相关类型

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
  excerpt?: string
  category?: string
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
  context?: string | Record<string, string | number | boolean | null>
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
  context?: string | Record<string, string | number | boolean | null>
}

export interface ChatResponse {
  response: string
  sources: SourceReference[]
  isEmergency: boolean
  conversationId?: string
  disclaimer: string
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
    context?: string
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
    disclaimer?: string
    conversationId?: string
  }
}
