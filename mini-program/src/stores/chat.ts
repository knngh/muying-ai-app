import { defineStore } from 'pinia'
import { wsManager } from '@/utils/websocket'
import { aiApi, detectEmergency, getDisclaimer, getEmergencyWarning } from '@/api/ai'
import type { AIMessage, ChatSession, SourceReference } from '@/api/ai'

interface ChatState {
  conversations: ChatSession[]
  currentConversationId: string | null
  messages: AIMessage[]
  streamingContent: string
  isStreaming: boolean
  isLoadingHistory: boolean
  isLoadingConversations: boolean
}

let messageCounter = 0
function genMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`
}

function genRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    conversations: [],
    currentConversationId: null,
    messages: [],
    streamingContent: '',
    isStreaming: false,
    isLoadingHistory: false,
    isLoadingConversations: false,
  }),

  actions: {
    async loadConversations() {
      if (this.isLoadingConversations) return
      this.isLoadingConversations = true
      try {
        const sessions = await aiApi.getConversations()
        this.conversations = sessions
      } catch (e) {
        console.error('[ChatStore] 加载会话列表失败:', e)
      } finally {
        this.isLoadingConversations = false
      }
    },

    async loadConversationHistory(conversationId: string) {
      this.isLoadingHistory = true
      try {
        const session = await aiApi.getHistory(conversationId)
        this.currentConversationId = conversationId
        this.messages = session.messages || []
      } catch (e) {
        console.error('[ChatStore] 加载对话历史失败:', e)
      } finally {
        this.isLoadingHistory = false
      }
    },

    startNewConversation() {
      this.currentConversationId = null
      this.messages = []
      this.streamingContent = ''
      this.isStreaming = false
    },

    async sendMessage(question: string) {
      if (this.isStreaming || !question.trim()) return

      const isEmergency = detectEmergency(question)

      // 添加用户消息
      const userMessage: AIMessage = {
        id: genMessageId(),
        role: 'user',
        content: question,
        isEmergency,
        createdAt: new Date().toISOString(),
      }
      this.messages.push(userMessage)

      // 准备助手消息占位
      const assistantMessage: AIMessage = {
        id: genMessageId(),
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      }
      this.messages.push(assistantMessage)

      this.isStreaming = true
      this.streamingContent = ''

      const requestId = genRequestId()

      // 构建历史消息
      const history = this.messages
        .filter(m => m.id !== assistantMessage.id)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }))

      const useChat = history.length > 1

      wsManager.send(
        useChat ? 'chat_stream' : 'ask_stream',
        requestId,
        useChat
          ? { messages: history, conversationId: this.currentConversationId || undefined }
          : { question, conversationId: this.currentConversationId || undefined },
        (msg) => {
          const { type, data } = msg

          if (type === 'chunk' && data.content) {
            this.streamingContent += data.content
            // 更新助手消息内容
            const lastMsg = this.messages[this.messages.length - 1]
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = this.streamingContent
            }
            if (data.isEmergency) {
              assistantMessage.isEmergency = true
            }
          }

          if (type === 'emergency') {
            const lastMsg = this.messages[this.messages.length - 1]
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = data.content || getEmergencyWarning()
              lastMsg.isEmergency = true
              lastMsg.sources = data.sources
              lastMsg.triageCategory = data.triageCategory
              lastMsg.riskLevel = data.riskLevel
              lastMsg.structuredAnswer = data.structuredAnswer
              lastMsg.uncertainty = data.uncertainty
              lastMsg.sourceReliability = data.sourceReliability
              lastMsg.followUpQuestions = data.followUpQuestions
              lastMsg.degraded = data.degraded
              lastMsg.model = data.model
              lastMsg.provider = data.provider
              lastMsg.route = data.route
              lastMsg.aiDisclosure = data.aiDisclosure
            }
            if (data.conversationId) {
              this.currentConversationId = data.conversationId
            }
            this.isStreaming = false
            this.streamingContent = ''
            this.loadConversations()
          }

          if (type === 'done') {
            const lastMsg = this.messages[this.messages.length - 1]
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.sources = data.sources
              lastMsg.triageCategory = data.triageCategory
              lastMsg.riskLevel = data.riskLevel
              lastMsg.structuredAnswer = data.structuredAnswer
              lastMsg.uncertainty = data.uncertainty
              lastMsg.sourceReliability = data.sourceReliability
              lastMsg.followUpQuestions = data.followUpQuestions
              lastMsg.degraded = data.degraded
              lastMsg.model = data.model
              lastMsg.provider = data.provider
              lastMsg.route = data.route
              lastMsg.aiDisclosure = data.aiDisclosure
            }
            if (data.conversationId) {
              this.currentConversationId = data.conversationId
            }
            this.isStreaming = false
            this.streamingContent = ''
            // 刷新会话列表
            this.loadConversations()
          }

          if (type === 'error') {
            const lastMsg = this.messages[this.messages.length - 1]
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = data.error || '抱歉，回答生成失败，请稍后重试。'
            }
            this.isStreaming = false
            this.streamingContent = ''
          }
        },
      )
    },

    cancelStreaming() {
      if (!this.isStreaming) return
      // 取消当前流式请求
      this.isStreaming = false
      this.streamingContent = ''
    },

    async deleteConversation(conversationId: string) {
      try {
        await aiApi.deleteConversation(conversationId)
        this.conversations = this.conversations.filter(c => c.id !== conversationId)
        if (this.currentConversationId === conversationId) {
          this.startNewConversation()
        }
      } catch (e) {
        console.error('[ChatStore] 删除会话失败:', e)
      }
    },
  },
})
