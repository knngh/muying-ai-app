import { defineStore } from 'pinia'
import { v4 as uuidv4 } from '@/utils/index'
import { aiApi, detectEmergency, getEmergencyWarning } from '@/api/ai'
import { wsManager } from '@/utils/websocket'
import type { AIMessage } from '@/api/ai'

function generateId() {
  return uuidv4()
}

export interface RecommendedQuestion {
  id: string
  question: string
  category: string
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [] as AIMessage[],
    conversationId: null as string | null,
    loading: false,
    error: null as string | null,
    streamingContent: '',
    // 推荐问题
    recommendedQuestions: [] as RecommendedQuestion[],
    recommendedLoading: false,
  }),

  getters: {
    hasMessages: (state) => state.messages.length > 0,
    lastAssistantMessage: (state) => {
      for (let i = state.messages.length - 1; i >= 0; i--) {
        if (state.messages[i].role === 'assistant') return state.messages[i]
      }
      return null
    },
  },

  actions: {
    // 获取推荐问题
    async fetchRecommendedQuestions() {
      this.recommendedLoading = true
      try {
        const res = await aiApi.getRecommendedQuestions(6) as any
        this.recommendedQuestions = res.questions || []
      } catch (error) {
        console.error('获取推荐问题失败:', error)
        // 使用本地默认推荐
        this.recommendedQuestions = [
          { id: '1', question: '怀孕初期需要注意什么？', category: 'pregnancy-early' },
          { id: '2', question: '孕期可以运动吗？', category: 'pregnancy-mid' },
          { id: '3', question: '宝宝什么时候开始添加辅食？', category: 'infant-care' },
          { id: '4', question: '产后多久可以恢复运动？', category: 'postpartum' },
          { id: '5', question: '新生儿黄疸怎么办？', category: 'newborn' },
          { id: '6', question: '孕期饮食有哪些禁忌？', category: 'nutrition' },
        ]
      } finally {
        this.recommendedLoading = false
      }
    },

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

        // Race condition guard
        let wsResolved = false
        let httpFallbackFired = false

        wsManager.send('chat_stream', requestId, { messages: history }, (msg) => {
          if (httpFallbackFired) return
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

        // HTTP 降级
        setTimeout(() => {
          if (wsResolved) return
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
