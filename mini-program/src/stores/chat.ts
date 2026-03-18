import { defineStore } from 'pinia'
import { v4 as uuidv4 } from '@/utils/index'
import { aiApi, detectEmergency, getEmergencyWarning } from '@/api/ai'
import { wsManager } from '@/utils/websocket'
import type { AIMessage } from '@/api/ai'

// 使用 utils 中的 v4
function generateId() {
  return uuidv4()
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [] as AIMessage[],
    conversationId: null as string | null,
    loading: false,
    error: null as string | null,
    streamingContent: '',
  }),

  actions: {
    async sendMessage(content: string) {
      const userMessage: AIMessage = {
        id: generateId(),
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      }

      const isEmergency = detectEmergency(content)

      this.messages.push(userMessage)
      this.loading = true
      this.error = null

      try {
        if (isEmergency) {
          const emergencyMessage: AIMessage = {
            id: generateId(),
            role: 'assistant',
            content: getEmergencyWarning(),
            isEmergency: true,
            createdAt: new Date().toISOString(),
          }
          this.messages.push(emergencyMessage)
          this.loading = false
          return
        }

        // 使用 WebSocket 流式对话
        const requestId = generateId()
        this.streamingContent = ''

        const history = this.messages.map(m => ({ role: m.role, content: m.content }))

        // Race condition guard: prevent both WS and HTTP fallback from producing messages
        let wsResolved = false
        let httpFallbackFired = false

        wsManager.send('chat_stream', requestId, { messages: history }, (msg) => {
          if (httpFallbackFired) return // HTTP fallback already handled this request
          if (msg.type === 'chunk' && msg.data.content) {
            this.streamingContent += msg.data.content
          } else if (msg.type === 'done') {
            wsResolved = true
            const assistantMessage: AIMessage = {
              id: generateId(),
              role: 'assistant',
              content: this.streamingContent,
              createdAt: new Date().toISOString(),
            }
            this.messages.push(assistantMessage)
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
            this.streamingContent = ''
            this.loading = false
          } else if (msg.type === 'error') {
            wsResolved = true
            this.error = msg.data.error || '服务暂时不可用'
            this.loading = false
          }
        })

        // 如果 WebSocket 发送失败，降级为 HTTP
        setTimeout(() => {
          if (wsResolved) return // WS already completed, no fallback needed
          if (this.loading && !this.streamingContent) {
            httpFallbackFired = true
            this.fallbackToHttp(content)
          }
        }, 5000)
      } catch (error: unknown) {
        await this.fallbackToHttp(content)
      }
    },

    async fallbackToHttp(content: string) {
      try {
        const response = await aiApi.chat({
          messages: this.messages.map(m => ({ role: m.role, content: m.content })),
        }) as any

        const assistantMessage: AIMessage = {
          id: generateId(),
          role: 'assistant',
          content: response.message?.content || response.response || '',
          isEmergency: response.isEmergency,
          createdAt: new Date().toISOString(),
        }

        this.messages.push(assistantMessage)
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
