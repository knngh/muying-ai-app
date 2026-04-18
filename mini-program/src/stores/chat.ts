import { defineStore } from 'pinia'
import { v4 as uuidv4 } from '@/utils/index'
import { aiApi, getEmergencyWarning } from '@/api/ai'
import { wsManager } from '@/utils/websocket'
import type { AIMessage } from '@/api/ai'

const RECENT_CHAT_QUESTIONS_STORAGE_KEY = 'recentChatQuestions'
const MAX_RECENT_CHAT_QUESTIONS = 4

function generateId() {
  return uuidv4()
}

type ChatContext = string | Record<string, string | number | boolean | null>

interface SendMessageOptions {
  appendUserMessage?: boolean
  context?: ChatContext
  resumeMessageId?: string | null
  transportMessages?: Array<{ role: 'user' | 'assistant'; content: string }>
}

function mergeSources(current?: AIMessage['sources'], incoming?: AIMessage['sources']) {
  if (!incoming?.length) {
    return current
  }

  if (!current?.length) {
    return incoming.map(source => ({ ...source }))
  }

  const next = [...current.map(source => ({ ...source }))]
  incoming.forEach((source) => {
    const exists = next.some(item => item.url === source.url && item.title === source.title)
    if (!exists) {
      next.push({ ...source })
    }
  })
  return next
}

function appendText(base: string, addition: string) {
  const trimmedAddition = addition.trim()
  if (!trimmedAddition) {
    return base
  }

  return `${base}${trimmedAddition}`
}

interface RecentChatQuestionItem {
  question: string
  updatedAt: string
}

function normalizeQuestion(content: string) {
  return content.replace(/\s+/g, ' ').trim()
}

function persistRecentQuestion(content: string) {
  const question = normalizeQuestion(content)
  if (!question) {
    return
  }

  const stored = uni.getStorageSync(RECENT_CHAT_QUESTIONS_STORAGE_KEY) as RecentChatQuestionItem[] | null
  const current = Array.isArray(stored) ? stored : []
  const deduped = current.filter(item => normalizeQuestion(item.question) !== question)
  const next: RecentChatQuestionItem[] = [
    {
      question,
      updatedAt: new Date().toISOString(),
    },
    ...deduped,
  ].slice(0, MAX_RECENT_CHAT_QUESTIONS)

  uni.setStorageSync(RECENT_CHAT_QUESTIONS_STORAGE_KEY, next)
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
    canResume: false,
    resumeMessageId: null as string | null,
    fallbackTimer: null as ReturnType<typeof setTimeout> | null,
  }),

  actions: {
    appendToAssistantMessage(messageId: string | null, content: string, payload?: Partial<AIMessage>) {
      const trimmedContent = content.trim()
      if (!trimmedContent || !messageId) {
        return
      }

      const targetMessage = this.messages.find(message => message.id === messageId && message.role === 'assistant')
      if (!targetMessage) {
        this.appendAssistantMessage(trimmedContent, payload)
        return
      }

      targetMessage.content = appendText(targetMessage.content, trimmedContent)
      targetMessage.sources = mergeSources(targetMessage.sources, payload?.sources)
      targetMessage.isEmergency = payload?.isEmergency ?? targetMessage.isEmergency
      targetMessage.triageCategory = payload?.triageCategory ?? targetMessage.triageCategory
      targetMessage.riskLevel = payload?.riskLevel ?? targetMessage.riskLevel
      targetMessage.structuredAnswer = payload?.structuredAnswer ?? targetMessage.structuredAnswer
      targetMessage.uncertainty = payload?.uncertainty ?? targetMessage.uncertainty
      targetMessage.sourceReliability = payload?.sourceReliability ?? targetMessage.sourceReliability
      targetMessage.followUpQuestions = payload?.followUpQuestions ?? targetMessage.followUpQuestions
      targetMessage.confidence = payload?.confidence ?? targetMessage.confidence
      targetMessage.degraded = payload?.degraded ?? targetMessage.degraded
      targetMessage.model = payload?.model ?? targetMessage.model
      targetMessage.provider = payload?.provider ?? targetMessage.provider
      targetMessage.route = payload?.route ?? targetMessage.route
    },

    finalizeAssistantMessage(content: string, payload?: Partial<AIMessage>, options: { resumeMessageId?: string | null } = {}) {
      if (options.resumeMessageId) {
        this.appendToAssistantMessage(options.resumeMessageId, content, payload)
        return
      }

      this.appendAssistantMessage(content, payload)
    },

    buildResumeContext(messageId: string) {
      const messageIndex = this.messages.findIndex(message => message.id === messageId)
      const currentAnswer = messageIndex >= 0 ? this.messages[messageIndex]?.content?.trim() || '' : ''
      const relatedQuestion = [...(messageIndex >= 0 ? this.messages.slice(0, messageIndex) : this.messages)]
        .reverse()
        .find(message => message.role === 'user')
        ?.content
        ?.trim() || ''

      return {
        模式: '原答案续写',
        当前问题: relatedQuestion,
        已有回答: currentAnswer,
        续写要求: '请直接从已有回答末尾自然续写，不要重复前文，不要写“继续回答”或解释你在续写。',
      } satisfies Record<string, string>
    },

    buildResumeTransportMessages(messageId: string) {
      const messageIndex = this.messages.findIndex(message => message.id === messageId)
      const currentAnswer = messageIndex >= 0 ? this.messages[messageIndex]?.content?.trim() || '' : ''
      const answerTail = currentAnswer.slice(-180)
      const visibleHistory = this.messages
        .map(message => ({ role: message.role, content: message.content }))
        .filter((message): message is { role: 'user' | 'assistant'; content: string } => message.role === 'user' || message.role === 'assistant')

      return [
        ...visibleHistory,
        {
          role: 'user' as const,
          content: `请紧接着你上一条回答的末尾继续写下去，不要从头改写，不要重复已经说过的内容。上一条回答最后已写到：${answerTail || '（前文较短，请直接自然续写）'}`,
        },
      ]
    },

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
      this.canResume = false
      this.resumeMessageId = null
    },

    async initialize() {
      if (this.initialized) {
        return
      }

      this.error = null
      this.loadingHistory = false
      this.initialized = true
    },

    async sendMessage(content: string, options: SendMessageOptions = {}) {
      const {
        appendUserMessage = true,
        context,
        resumeMessageId = null,
        transportMessages,
      } = options

      if (appendUserMessage) {
        const userMessage: AIMessage = {
          id: generateId(),
          role: 'user',
          content,
          createdAt: new Date().toISOString(),
        }

        this.messages.push(userMessage)
        persistRecentQuestion(content)
      }

      this.clearFallbackTimer()
      this.loading = true
      this.error = null
      this.stopRequested = false
      this.canResume = false
      this.resumeMessageId = resumeMessageId

      try {
        const requestId = generateId()
        this.activeRequestId = requestId
        this.streamingContent = ''
        const history = transportMessages || this.messages.map(m => ({ role: m.role, content: m.content }))

        let wsResolved = false
        let httpFallbackFired = false

        wsManager.send('chat_stream', requestId, {
          messages: history,
          conversationId: this.conversationId || undefined,
          context,
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
            this.finalizeAssistantMessage(this.streamingContent, {
              sources: msg.data.sources,
              triageCategory: msg.data.triageCategory,
              riskLevel: msg.data.riskLevel,
              structuredAnswer: msg.data.structuredAnswer,
              uncertainty: msg.data.uncertainty,
              sourceReliability: msg.data.sourceReliability,
              followUpQuestions: msg.data.followUpQuestions,
              model: msg.data.model,
              provider: msg.data.provider,
              route: msg.data.route,
              degraded: msg.data.degraded,
            }, { resumeMessageId: this.resumeMessageId })
            this.conversationId = msg.data.conversationId || this.conversationId
            this.streamingContent = ''
            this.clearFallbackTimer()
            this.activeRequestId = null
            this.loading = false
            this.canResume = false
            this.resumeMessageId = null
          } else if (msg.type === 'emergency') {
            wsResolved = true
            this.finalizeAssistantMessage(msg.data.content || getEmergencyWarning(), {
              isEmergency: true,
              triageCategory: msg.data.triageCategory,
              riskLevel: msg.data.riskLevel,
              structuredAnswer: msg.data.structuredAnswer,
              uncertainty: msg.data.uncertainty,
              sourceReliability: msg.data.sourceReliability,
              followUpQuestions: msg.data.followUpQuestions,
              provider: 'system',
              route: 'emergency',
            }, { resumeMessageId: this.resumeMessageId })
            this.conversationId = msg.data.conversationId || this.conversationId
            this.streamingContent = ''
            this.clearFallbackTimer()
            this.activeRequestId = null
            this.loading = false
            this.canResume = false
            this.resumeMessageId = null
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
            void this.fallbackToHttp(requestId, {
              context,
              resumeMessageId: this.resumeMessageId,
              transportMessages: history,
            })
          }
        }, 5000)
      } catch (error: unknown) {
        await this.fallbackToHttp(this.activeRequestId, {
          context,
          resumeMessageId: this.resumeMessageId,
          transportMessages,
        })
      }
    },

    stopGenerating() {
      if (!this.loading) {
        return
      }

      const hasInterruptedContent = !!this.streamingContent.trim() || !!this.activeRequestId
      this.stopRequested = true
      this.clearFallbackTimer()
      if (this.activeRequestId) {
        wsManager.cancelRequest(this.activeRequestId, {
          notifyServer: true,
        })
      }

      if (this.resumeMessageId) {
        this.appendToAssistantMessage(this.resumeMessageId, this.streamingContent)
      } else if (this.streamingContent.trim()) {
        const resumeMessage: AIMessage = {
          id: generateId(),
          role: 'assistant',
          content: this.streamingContent.trim(),
          createdAt: new Date().toISOString(),
        }
        this.messages.push(resumeMessage)
        this.resumeMessageId = resumeMessage.id
      } else {
        const lastAssistantMessage = [...this.messages].reverse().find(message => message.role === 'assistant')
        this.resumeMessageId = lastAssistantMessage?.id || null
      }

      this.streamingContent = ''
      this.error = null
      this.loading = false
      this.activeRequestId = null
      this.canResume = hasInterruptedContent && !!this.resumeMessageId
    },

    async resumeLastAnswer() {
      if (this.loading || !this.canResume || !this.resumeMessageId) {
        return
      }

      await this.sendMessage('', {
        appendUserMessage: false,
        context: this.buildResumeContext(this.resumeMessageId),
        resumeMessageId: this.resumeMessageId,
        transportMessages: this.buildResumeTransportMessages(this.resumeMessageId),
      })
    },

    async fallbackToHttp(requestId: string | null, options: SendMessageOptions = {}) {
      if (!requestId || this.activeRequestId !== requestId || this.stopRequested) {
        return
      }

      try {
        const response = await aiApi.chat({
          messages: options.transportMessages || this.messages.map(m => ({ role: m.role, content: m.content })),
          conversationId: this.conversationId || undefined,
          context: options.context,
        }) as any

        if (this.activeRequestId !== requestId || this.stopRequested) {
          return
        }

        this.finalizeAssistantMessage(response.message?.content || response.response || '', {
          sources: response.sources,
          isEmergency: response.isEmergency,
          triageCategory: response.triageCategory,
          riskLevel: response.riskLevel,
          structuredAnswer: response.structuredAnswer,
          uncertainty: response.uncertainty,
          sourceReliability: response.sourceReliability,
          followUpQuestions: response.followUpQuestions,
          confidence: response.confidence,
          model: response.model,
          provider: response.provider,
          route: response.route,
          degraded: response.degraded,
        }, { resumeMessageId: this.resumeMessageId })
        this.conversationId = response.conversationId || this.conversationId
        this.canResume = false
        this.resumeMessageId = null
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
      this.canResume = false
      this.resumeMessageId = null
    },
  },
})
