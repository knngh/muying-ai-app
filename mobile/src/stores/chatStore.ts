import { create } from 'zustand'
import { v4 as uuidv4 } from '../utils'
import type { AIMessage } from '../api/ai'
import { aiApi, getEmergencyWarning } from '../api/ai'
import { wsManager } from '../utils/websocket'
import { sessionStorage } from '../utils/storage'
import { useMembershipStore } from './membershipStore'

interface ChatState {
  messages: AIMessage[]
  conversationId: string | null
  loading: boolean
  loadingHistory: boolean
  initialized: boolean
  error: string | null
  streamingContent: string
  initialize: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  resetState: () => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  conversationId: null,
  loading: false,
  loadingHistory: false,
  initialized: false,
  error: null,
  streamingContent: '',

  resetState: () => {
    wsManager.disconnect()
    set({
      messages: [],
      conversationId: null,
      loading: false,
      loadingHistory: false,
      initialized: false,
      error: null,
      streamingContent: '',
    })
  },

  initialize: async () => {
    if (get().initialized) {
      return
    }

    set({ loadingHistory: true, error: null })

    try {
      const conversations = await aiApi.getConversations()
      const latest = conversations[0]

      if (latest?.id) {
        const session = await aiApi.getHistory(latest.id)
        set({
          messages: session.messages,
          conversationId: session.id,
          initialized: true,
          loadingHistory: false,
        })
        return
      }

      set({ initialized: true, loadingHistory: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({
        initialized: true,
        loadingHistory: false,
        error: err.message || '加载历史对话失败',
      })
    }
  },

  sendMessage: async (content: string) => {
    const userMessage: AIMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }

    set(state => ({
      messages: [...state.messages, userMessage],
      loading: true,
      error: null,
    }))

    try {
      const requestId = uuidv4()
      set({ streamingContent: '' })
      const history = get().messages.map(m => ({ role: m.role, content: m.content }))
      const token = await sessionStorage.getToken()

      let wsResolved = false
      let httpFallbackFired = false

      wsManager.send('chat_stream', requestId, {
        messages: history,
        conversationId: get().conversationId || undefined,
      }, (msg) => {
        if (httpFallbackFired) return
        if (msg.type === 'chunk' && msg.data.content) {
          set(state => ({ streamingContent: state.streamingContent + msg.data.content }))
        } else if (msg.type === 'done') {
          wsResolved = true
          const assistantMessage: AIMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: get().streamingContent,
            sources: msg.data.sources,
            createdAt: new Date().toISOString(),
          }
          set(state => ({
            messages: [...state.messages, assistantMessage],
            conversationId: msg.data.conversationId || state.conversationId,
            streamingContent: '',
            loading: false,
          }))
          void useMembershipStore.getState().ensureFreshQuota()
        } else if (msg.type === 'emergency') {
          wsResolved = true
          const emMsg: AIMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: msg.data.content || getEmergencyWarning(),
            isEmergency: true,
            createdAt: new Date().toISOString(),
          }
          set(state => ({
            messages: [...state.messages, emMsg],
            conversationId: msg.data.conversationId || state.conversationId,
            streamingContent: '',
            loading: false,
          }))
          void useMembershipStore.getState().ensureFreshQuota()
        } else if (msg.type === 'error') {
          wsResolved = true
          set({ error: msg.data.error || '服务暂时不可用', loading: false })
          if ((msg.data.error || '').includes('额度已用完')) {
            void useMembershipStore.getState().ensureFreshQuota()
          }
        }
      }, token || undefined)

      setTimeout(async () => {
        if (wsResolved) return
        if (get().loading && !get().streamingContent) {
          httpFallbackFired = true
          wsManager.cancelRequest(requestId, true)
          try {
            const response = await aiApi.chat({
              messages: get().messages.map(m => ({ role: m.role, content: m.content })),
              conversationId: get().conversationId || undefined,
              clientRequestId: requestId,
            }) as any
            const assistantMessage: AIMessage = {
              id: uuidv4(),
              role: 'assistant',
              content: response.message?.content || response.response || '',
              sources: response.sources,
              isEmergency: response.isEmergency,
              createdAt: new Date().toISOString(),
            }
            set(state => ({
              messages: [...state.messages, assistantMessage],
              conversationId: response.conversationId || state.conversationId,
              loading: false,
            }))
            void useMembershipStore.getState().ensureFreshQuota()
          } catch (error: unknown) {
            const err = error as { message?: string }
            set({ error: err.message || '发送消息失败', loading: false })
            if ((err.message || '').includes('额度已用完')) {
              void useMembershipStore.getState().ensureFreshQuota()
            }
          }
        }
      }, 5000)
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '发送消息失败，请重试', loading: false })
    }
  },

  clearMessages: () => {
    set({ messages: [], conversationId: null, error: null, streamingContent: '', initialized: false })
  },
}))
