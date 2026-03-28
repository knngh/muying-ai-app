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
  }),

  actions: {
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
      this.loading = true
      this.error = null

      try {
        const requestId = generateId()
        this.streamingContent = ''
        const history = this.messages.map(m => ({ role: m.role, content: m.content }))

        let wsResolved = false
        let httpFallbackFired = false

        wsManager.send('chat_stream', requestId, {
          messages: history,
          conversationId: this.conversationId || undefined,
        }, (msg) => {
          if (httpFallbackFired) return
          if (msg.type === 'chunk' && msg.data.content) {
            this.streamingContent += msg.data.content
          } else if (msg.type === 'done') {
            wsResolved = true
            const assistantMessage: AIMessage = {
              id: generateId(),
              role: 'assistant',
              content: this.streamingContent,
              sources: msg.data.sources,
              createdAt: new Date().toISOString(),
            }
            this.messages.push(assistantMessage)
            this.conversationId = msg.data.conversationId || this.conversationId
            this.streamingContent = ''
            this.loading = false
          } else if (msg.type === 'emergency') {
            wsResolved = true
            const emergencyMsg: AIMessage = {
              id: generateId(),
              role: 'assistant',
              content: msg.data.content || getEmergencyWarning(),
              isEmergency: true,
              createdAt: new Date().toISOString(),
            }
            this.messages.push(emergencyMsg)
            this.conversationId = msg.data.conversationId || this.conversationId
            this.streamingContent = ''
            this.loading = false
          } else if (msg.type === 'error') {
            wsResolved = true
            this.error = msg.data.error || '服务暂时不可用'
            this.loading = false
          }
        })

        setTimeout(() => {
          if (wsResolved) return
          if (this.loading && !this.streamingContent) {
            httpFallbackFired = true
            this.fallbackToHttp()
          }
        }, 5000)
      } catch (error: unknown) {
        await this.fallbackToHttp()
      }
    },

    async fallbackToHttp() {
      try {
        const response = await aiApi.chat({
          messages: this.messages.map(m => ({ role: m.role, content: m.content })),
          conversationId: this.conversationId || undefined,
        }) as any

        const assistantMessage: AIMessage = {
          id: generateId(),
          role: 'assistant',
          content: response.message?.content || response.response || '',
          sources: response.sources,
          isEmergency: response.isEmergency,
          createdAt: new Date().toISOString(),
        }

        this.messages.push(assistantMessage)
        this.conversationId = response.conversationId || this.conversationId
      } catch (error: unknown) {
        const err = error as { message?: string }
        this.error = err.message || '发送消息失败，请重试'
      } finally {
        this.loading = false
      }
    },

    clearMessages() {
      this.messages = []
      this.conversationId = null
      this.error = null
      this.streamingContent = ''
    },
  },
})
