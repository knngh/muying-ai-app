// WebSocket 管理器 - 用于 AI 流式对话
type MessageHandler = (data: { type: string; requestId: string; data: { content?: string; isEmergency?: boolean; error?: string; disclaimer?: string } }) => void

class AIWebSocketManager {
  private socket: UniApp.SocketTask | null = null
  private connected = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private listeners: Map<string, MessageHandler> = new Map()
  private pendingMessages: string[] = []
  private baseUrl = import.meta.env.VITE_WS_URL || 'wss://beihu.me'

  connect(): void {
    const token = uni.getStorageSync('token')
    if (!token) return

    this.socket = uni.connectSocket({
      url: `${this.baseUrl}/ws/ai?token=${token}`,
      success: () => {},
    })

    this.socket.onOpen(() => {
      console.log('[WebSocket] Connected')
      this.connected = true
      this.reconnectAttempts = 0
      // 发送待发送消息
      this.pendingMessages.forEach(msg => this.socket?.send({ data: msg }))
      this.pendingMessages = []
      // 心跳
      this.startHeartbeat()
    })

    this.socket.onMessage((res) => {
      try {
        const msg = JSON.parse(res.data as string)
        const handler = this.listeners.get(msg.requestId)
        if (handler) {
          handler(msg)
        }
        // 清理已完成的监听
        if (msg.type === 'done' || msg.type === 'error' || msg.type === 'emergency') {
          this.listeners.delete(msg.requestId)
        }
      } catch (e) {
        console.error('[WebSocket] Parse error:', e)
      }
    })

    this.socket.onClose(() => {
      console.log('[WebSocket] Disconnected')
      this.connected = false
      this.stopHeartbeat()
      this.tryReconnect()
    })

    this.socket.onError((err) => {
      console.error('[WebSocket] Error:', err)
      this.connected = false
    })
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.socket?.close({})
    this.socket = null
    this.connected = false
  }

  send(type: 'ask_stream' | 'chat_stream', requestId: string, payload: Record<string, unknown>, onMessage: MessageHandler): void {
    this.listeners.set(requestId, onMessage)
    const msg = JSON.stringify({ type, requestId, payload })

    if (this.connected && this.socket) {
      this.socket.send({ data: msg })
    } else {
      this.pendingMessages.push(msg)
      if (!this.socket) this.connect()
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.connected && this.socket) {
        this.socket.send({ data: JSON.stringify({ type: 'ping' }) })
      }
    }, 25000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }
}

export const wsManager = new AIWebSocketManager()
