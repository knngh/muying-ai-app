import { create } from 'zustand'
import { v4 as uuidv4 } from '@/utils/uuid'
import type { AIMessage } from '@/api/ai'
import { aiApi, detectEmergency, getEmergencyWarning } from '@/api/ai'

interface ChatState {
  // 数据
  messages: AIMessage[]
  conversationId: string | null
  
  // 状态
  loading: boolean
  error: string | null
  
  // 操作
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  loadHistory: (conversationId: string) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  // 初始状态
  messages: [],
  conversationId: null,
  loading: false,
  error: null,

  // 发送消息
  sendMessage: async (content: string) => {
    const userMessage: AIMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }

    // 检测紧急关键词
    const isEmergency = detectEmergency(content)

    set(state => ({
      messages: [...state.messages, userMessage],
      loading: true,
      error: null,
    }))

    try {
      // 如果是紧急情况，直接返回警告
      if (isEmergency) {
        const emergencyMessage: AIMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: getEmergencyWarning(),
          isEmergency: true,
          createdAt: new Date().toISOString(),
        }
        set(state => ({
          messages: [...state.messages, emergencyMessage],
          loading: false,
        }))
        return
      }

      // 调用 AI API
      const response = await aiApi.chat({
        message: content,
        conversationId: get().conversationId || undefined,
        history: get().messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
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
        conversationId: response.conversationId,
        loading: false,
      }))
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({
        error: err.message || '发送消息失败，请重试',
        loading: false,
      })
    }
  },

  // 清空消息
  clearMessages: () => {
    set({
      messages: [],
      conversationId: null,
      error: null,
    })
  },

  // 加载历史对话
  loadHistory: async (conversationId: string) => {
    set({ loading: true, error: null })
    
    try {
      const session = await aiApi.getHistory(conversationId)
      set({
        messages: session.messages,
        conversationId: session.id,
        loading: false,
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({
        error: err.message || '加载历史对话失败',
        loading: false,
      })
    }
  },
}))