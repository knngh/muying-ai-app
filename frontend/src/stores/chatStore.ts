import { create } from 'zustand'
import { v4 as uuidv4 } from '@/utils/uuid'
import type { AIMessage, ChatSession } from '@/api/ai'
import { aiApi } from '@/api/ai'

interface ChatState {
  messages: AIMessage[]
  conversations: ChatSession[]
  conversationId: string | null
  loading: boolean
  loadingHistory: boolean
  initialized: boolean
  error: string | null
  initialize: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  loadConversations: () => Promise<void>
  loadHistory: (conversationId: string) => Promise<void>
  deleteConversation: (conversationId: string) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  conversations: [],
  conversationId: null,
  loading: false,
  loadingHistory: false,
  initialized: false,
  error: null,

  initialize: async () => {
    if (get().initialized) {
      return
    }

    set({ loadingHistory: true, error: null })

    try {
      const conversations = await aiApi.getConversations()
      const latestConversation = conversations[0]

      if (latestConversation?.id) {
        const session = await aiApi.getHistory(latestConversation.id)
        set({
          conversations,
          messages: session.messages,
          conversationId: session.id,
          initialized: true,
          loadingHistory: false,
        })
        return
      }

      set({
        conversations,
        initialized: true,
        loadingHistory: false,
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({
        initialized: true,
        loadingHistory: false,
        error: err.message || '加载对话历史失败',
      })
    }
  },

  sendMessage: async (content: string) => {
    const historyBeforeSend = get().messages.map(message => ({
      role: message.role,
      content: message.content,
    }))

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
      const response = await aiApi.chat({
        message: content,
        conversationId: get().conversationId || undefined,
        history: historyBeforeSend,
      })

      const assistantMessage: AIMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response.response,
        sources: response.sources,
        isEmergency: response.isEmergency,
        createdAt: new Date().toISOString(),
      }

      set(state => ({
        messages: [...state.messages, assistantMessage],
        conversationId: response.conversationId || state.conversationId,
        loading: false,
      }))

      await get().loadConversations()
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({
        error: err.message || '发送消息失败，请重试',
        loading: false,
      })
    }
  },

  clearMessages: () => {
    set({
      messages: [],
      conversationId: null,
      error: null,
    })
  },

  loadConversations: async () => {
    try {
      const conversations = await aiApi.getConversations()
      set({ conversations })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '加载对话列表失败' })
    }
  },

  loadHistory: async (conversationId: string) => {
    set({ loadingHistory: true, error: null })

    try {
      const session = await aiApi.getHistory(conversationId)
      set({
        messages: session.messages,
        conversationId: session.id,
        loadingHistory: false,
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({
        error: err.message || '加载历史对话失败',
        loadingHistory: false,
      })
    }
  },

  deleteConversation: async (conversationId: string) => {
    try {
      await aiApi.deleteConversation(conversationId)
      const currentConversationId = get().conversationId
      const remaining = get().conversations.filter(item => item.id !== conversationId)

      set({
        conversations: remaining,
        messages: currentConversationId === conversationId ? [] : get().messages,
        conversationId: currentConversationId === conversationId ? null : currentConversationId,
      })

      if (currentConversationId === conversationId && remaining[0]?.id) {
        await get().loadHistory(remaining[0].id)
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '删除对话失败' })
    }
  },
}))
