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

// WebSocket 消息协议
export interface WsClientMessage {
  type: 'ask_stream' | 'chat_stream'
  requestId: string
  payload: {
    question?: string
    messages?: Array<{ role: string; content: string }>
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
    sources?: Array<{ title: string; content: string }>
    disclaimer?: string
  }
}
