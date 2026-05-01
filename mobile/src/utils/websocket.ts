// WebSocket 管理器 - React Native 版
// RN 有内置 WebSocket 全局对象，API 与浏览器相同

import { config } from '../config'
import type { SourceReference } from '../api/ai'
import { logError } from './logger'
import type {
  RiskLevel,
  TriageCategory,
  StructuredAnswer,
  UncertaintyInfo,
  SourceReliability,
  AIActionCard,
  AIServiceDisclosure,
} from '../../../shared/types'

type WsServerMessage = {
  type: 'chunk' | 'done' | 'error' | 'emergency'
  requestId: string
  data: {
    content?: string
    isEmergency?: boolean
    error?: string
    code?: number | string
    status?: number
    disclaimer?: string
    sources?: SourceReference[]
    actionCards?: AIActionCard[]
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
    aiDisclosure?: AIServiceDisclosure
  }
}
type MessageHandler = (msg: WsServerMessage) => void
type ReactNativeWebSocketOptions = {
  headers?: Record<string, string>
}
type ReactNativeWebSocketConstructor = new (
  url: string,
  protocols?: string | string[] | null,
  options?: ReactNativeWebSocketOptions,
) => WebSocket

class AIWebSocketManager {
  private ws: WebSocket | null = null
  private connected = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private listeners: Map<string, MessageHandler> = new Map()
  private pendingMessages: string[] = []
  private baseUrl = config.wsBaseUrl

  connect(token: string): void {
    if (this.connected) return
    const ReactNativeWebSocket = WebSocket as unknown as ReactNativeWebSocketConstructor

    this.ws = new ReactNativeWebSocket(
      `${this.baseUrl}/ws/ai`,
      undefined,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    this.ws.onopen = () => {
      this.connected = true
      this.reconnectAttempts = 0
      this.pendingMessages.forEach(msg => this.ws?.send(msg))
      this.pendingMessages = []
      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const msg: WsServerMessage = JSON.parse(event.data)
        const handler = this.listeners.get(msg.requestId)
        if (handler) handler(msg)
        if (msg.type === 'done' || msg.type === 'error' || msg.type === 'emergency') {
          this.listeners.delete(msg.requestId)
        }
      } catch (e) {
        logError('WebSocket.parse', e)
      }
    }

    this.ws.onclose = () => {
      this.connected = false
      this.stopHeartbeat()
      this.tryReconnect(token)
    }

    this.ws.onerror = () => {
      this.connected = false
    }
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.listeners.clear()
    this.pendingMessages = []
    this.ws?.close()
    this.ws = null
    this.connected = false
  }

  cancelRequest(requestId: string, closeSocket = false): void {
    this.listeners.delete(requestId)
    this.pendingMessages = this.pendingMessages.filter((message) => {
      try {
        const parsed = JSON.parse(message) as { requestId?: string }
        return parsed.requestId !== requestId
      } catch {
        return true
      }
    })

    if (closeSocket) {
      this.disconnect()
    }
  }

  send(
    type: 'ask_stream' | 'chat_stream',
    requestId: string,
    payload: Record<string, unknown>,
    onMessage: MessageHandler,
    token?: string,
  ): void {
    this.listeners.set(requestId, onMessage)
    const msg = JSON.stringify({ type, requestId, payload })

    if (this.connected && this.ws) {
      this.ws.send(msg)
    } else {
      this.pendingMessages.push(msg)
      if (!this.ws && token) this.connect(token)
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.connected && this.ws) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
  }

  private tryReconnect(token: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectTimer = setTimeout(() => this.connect(token), delay)
  }
}

export const wsManager = new AIWebSocketManager()
