import { create } from 'zustand'
import { v4 as uuidv4 } from '../utils'
import type { AIMessage } from '../api/ai'
import { aiApi, detectEmergency, getEmergencyWarning } from '../api/ai'
import { wsManager } from '../utils/websocket'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface ChatState {
  messages: AIMessage[]
  conversationId: string | null
  loading: boolean
  error: string | null
  streamingContent: string
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  conversationId: null,
  loading: false,
  error: null,
  streamingContent: '',

  sendMessage: async (content: string) => {
    const userMessage: AIMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }

    const isEmergency = detectEmergency(content)

    set(state => ({
      messages: [...state.messages, userMessage],
      loading: true,
      error: null,
    }))

    try {
      if (isEmergency) {
        const emergencyMessage: AIMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: getEmergencyWarning(),
          isEmergency: true,
          createdAt: new Date().toISOString(),
        }
        set(state => ({ messages: [...state.messages, emergencyMessage], loading: false }))
        return
      }

      // WebSocket 流式
      const requestId = uuidv4()
      set({ streamingContent: '' })
      const history = get().messages.map(m => ({ role: m.role, content: m.content }))
      const token = await AsyncStorage.getItem('token')

      // Race condition guard: prevent both WS and HTTP fallback from producing messages
      let wsResolved = false
      let httpFallbackFired = false

      wsManager.send('chat_stream', requestId, { messages: history }, (msg) => {
        if (httpFallbackFired) return // HTTP fallback already handled this request
        if (msg.type === 'chunk' && msg.data.content) {
          set(state => ({ streamingContent: state.streamingContent + msg.data.content }))
        } else if (msg.type === 'done') {
          wsResolved = true
          const assistantMessage: AIMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: get().streamingContent,
            createdAt: new Date().toISOString(),
          }
          set(state => ({
            messages: [...state.messages, assistantMessage],
            streamingContent: '',
            loading: false,
          }))
        } else if (msg.type === 'emergency') {
          wsResolved = true
          const emMsg: AIMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: msg.data.content || getEmergencyWarning(),
            isEmergency: true,
            createdAt: new Date().toISOString(),
          }
          set(state => ({ messages: [...state.messages, emMsg], streamingContent: '', loading: false }))
        } else if (msg.type === 'error') {
          wsResolved = true
          set({ error: msg.data.error || '服务暂时不可用', loading: false })
        }
      }, token || undefined)

      // 超时降级到 HTTP
      setTimeout(async () => {
        if (wsResolved) return // WS already completed, no fallback needed
        if (get().loading && !get().streamingContent) {
          httpFallbackFired = true
          try {
            const response = await aiApi.chat({
              messages: get().messages.map(m => ({ role: m.role, content: m.content })),
            }) as any
            const assistantMessage: AIMessage = {
              id: uuidv4(),
              role: 'assistant',
              content: response.message?.content || response.response || '',
              isEmergency: response.isEmergency,
              createdAt: new Date().toISOString(),
            }
            set(state => ({
              messages: [...state.messages, assistantMessage],
              loading: false,
            }))
          } catch (error: unknown) {
            const err = error as { message?: string }
            set({ error: err.message || '发送消息失败', loading: false })
          }
        }
      }, 5000)
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '发送消息失败，请重试', loading: false })
    }
  },

  clearMessages: () => {
    set({ messages: [], conversationId: null, error: null, streamingContent: '' })
  },
}))
