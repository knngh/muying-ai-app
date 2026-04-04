import { defineStore } from 'pinia'
import { v4 as uuidv4 } from '@/utils/index'
import { aiApi, getEmergencyWarning } from '@/api/ai'
import { wsManager } from '@/utils/websocket'
import type { AIMessage } from '@/api/ai'

function generateId() {
  return uuidv4()
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [] as AIMessage[],
    conversationId: null as string | null,
    loading: false,
    loadingHistory: false,
    initialized: false,
    error: null as string | null,
    streamingContent: '',
    activeRequestId: null as string | null,
    stopRequested: false,
    fallbackTimer: null as ReturnType<typeof setTimeout> | null,
  }),

  actions: {
    clearFallbackTimer() {
      if (this.fallbackTimer) {
        clearTimeout(this.fallbackTimer)
        this.fallbackTimer = null
      }
    },

    appendAssistantMessage(content: string, payload?: Partial<AIMessage>) {
      const trimmedContent = content.trim()
      if (!trimmedContent) {
        return
      }

      this.messages.push({
        id: generateId(),
        role: 'assistant',
        content: trimmedContent,
        createdAt: new Date().toISOString(),
        ...payload,
      })
    },

    resetState() {
      this.clearFallbackTimer()
      wsManager.disconnect()
      this.messages = []
      this.conversationId = null
      this.loading = false
      this.loadingHistory = false
      this.initialized = false
      this.error = null
      this.streamingContent = ''
      this.activeRequestId = null
      this.stopRequested = false
    },

    async initialize() {
      if (this.initialized) {
        return
      }

      this.loadingHistory = true
      this.error = null

      try {
        const conversations = await aiApi.getConversations()
        const latest = conversations[0]

        if (latest?.id) {
          const session = await aiApi.getHistory(latest.id)
          this.messages = session.messages
          this.conversationId = session.id
        }

        this.initialized = true
        this.loadingHistory = false
      } catch (error: unknown) {
        const err = error as { message?: string }
        this.error = err.message || '加载历史对话失败'
        this.initialized = true
        this.loadingHistory = false
      }
    },

    async sendMessage(content: string) {
      const userMessage: AIMessage = {
        id: generateId(),
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      }

      this.messages.push(userMessage)
      this.clearFallbackTimer()
      this.loading = true
      this.error = null
      this.stopRequested = false

      try {
        const requestId = generateId()
        this.activeRequestId = requestId
        this.streamingContent = ''
        const history = this.messages.map(m => ({ role: m.role, content: m.content }))

        let wsResolved = false
        let httpFallbackFired = false

        wsManager.send('chat_stream', requestId, {
          messages: history,
          conversationId: this.conversationId || undefined,
        }, (msg) => {
          if (httpFallbackFired || this.activeRequestId !== requestId) return
          if (this.stopRequested) {
            if (msg.type === 'done' || msg.type === 'emergency') {
              this.conversationId = msg.data.conversationId || this.conversationId
              this.clearFallbackTimer()
              this.activeRequestId = null
            } else if (msg.type === 'error') {
              this.clearFallbackTimer()
              this.activeRequestId = null
            }
            return
          }
          if (msg.type === 'chunk' && msg.data.content) {
            this.streamingContent += msg.data.content
          } else if (msg.type === 'done') {
            wsResolved = true
            this.appendAssistantMessage(this.streamingContent, {
              sources: msg.data.sources,
            })
            this.conversationId = msg.data.conversationId || this.conversationId
            this.streamingContent = ''
            this.clearFallbackTimer()
            this.activeRequestId = null
            this.loading = false
          } else if (msg.type === 'emergency') {
            wsResolved = true
            this.appendAssistantMessage(msg.data.content || getEmergencyWarning(), {
              isEmergency: true,
            })
            this.conversationId = msg.data.conversationId || this.conversationId
            this.streamingContent = ''
            this.clearFallbackTimer()
            this.activeRequestId = null
            this.loading = false
          } else if (msg.type === 'error') {
            wsResolved = true
            this.clearFallbackTimer()
            this.activeRequestId = null
            this.error = msg.data.error || '服务暂时不可用'
            this.streamingContent = ''
            this.loading = false
          }
        })

        this.fallbackTimer = setTimeout(() => {
          if (wsResolved || this.activeRequestId !== requestId || this.stopRequested) return
          if (this.loading && !this.streamingContent) {
            httpFallbackFired = true
            wsManager.cancelRequest(requestId, {
              notifyServer: true,
              dropListener: true,
              closeSocket: true,
            })
            void this.fallbackToHttp(requestId)
          }
        }, 5000)
      } catch (error: unknown) {
        await this.fallbackToHttp(this.activeRequestId)
      }
    },

    stopGenerating() {
      if (!this.loading) {
        return
      }

      this.stopRequested = true
      this.clearFallbackTimer()
      if (this.activeRequestId) {
        wsManager.cancelRequest(this.activeRequestId, {
          notifyServer: true,
        })
      }

      this.appendAssistantMessage(this.streamingContent)
      this.streamingContent = ''
      this.error = null
      this.loading = false
    },

    async fallbackToHttp(requestId: string | null) {
      if (!requestId || this.activeRequestId !== requestId || this.stopRequested) {
        return
      }

      try {
        const response = await aiApi.chat({
          messages: this.messages.map(m => ({ role: m.role, content: m.content })),
          conversationId: this.conversationId || undefined,
        }) as any

        if (this.activeRequestId !== requestId || this.stopRequested) {
          return
        }

        this.appendAssistantMessage(response.message?.content || response.response || '', {
          sources: response.sources,
          isEmergency: response.isEmergency,
        })
        this.conversationId = response.conversationId || this.conversationId
      } catch (error: unknown) {
        if (this.activeRequestId !== requestId || this.stopRequested) {
          return
        }
        const err = error as { message?: string }
        this.error = err.message || '发送消息失败，请重试'
      } finally {
        if (this.activeRequestId === requestId) {
          this.clearFallbackTimer()
          this.activeRequestId = null
          this.loading = false
        }
      }
    },

    clearMessages() {
      this.clearFallbackTimer()
      wsManager.disconnect()
      this.messages = []
      this.conversationId = null
      this.error = null
      this.streamingContent = ''
      this.initialized = false
      this.activeRequestId = null
      this.stopRequested = false
    },
  },
})
