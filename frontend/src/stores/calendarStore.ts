import { create } from 'zustand'
import { CalendarEvent, calendarApi } from '@/api/modules'
import dayjs from 'dayjs'

interface CalendarState {
  events: CalendarEvent[]
  selectedEvent: CalendarEvent | null
  currentMonth: string
  loading: boolean
  error: string | null
  fetchEvents: (startDate?: string, endDate?: string) => Promise<void>
  createEvent: (data: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<boolean>
  updateEvent: (id: number, data: Partial<CalendarEvent>) => Promise<boolean>
  deleteEvent: (id: number) => Promise<boolean>
  completeEvent: (id: number) => Promise<boolean>
  selectEvent: (event: CalendarEvent | null) => void
  setCurrentMonth: (month: string) => void
  getEventsByDate: (date: string) => CalendarEvent[]
  getUpcomingEvents: (days?: number) => Promise<CalendarEvent[]>
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  selectedEvent: null,
  currentMonth: dayjs().format('YYYY-MM'),
  loading: false,
  error: null,

  fetchEvents: async (startDate, endDate) => {
    set({ loading: true, error: null })
    try {
      const events = (await calendarApi.getEvents({ startDate, endDate })) as CalendarEvent[]
      set({ events, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '获取事件列表失败', loading: false })
    }
  },

  createEvent: async (data) => {
    set({ loading: true, error: null })
    try {
      const newEvent = (await calendarApi.createEvent(data)) as CalendarEvent
      set((state) => ({
        events: [...state.events, newEvent],
        loading: false,
      }))
      return true
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '创建事件失败', loading: false })
      return false
    }
  },

  updateEvent: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const updatedEvent = (await calendarApi.updateEvent(id, data)) as CalendarEvent
      set((state) => ({
        events: state.events.map((e) => (e.id === id ? updatedEvent : e)),
        loading: false,
      }))
      return true
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '更新事件失败', loading: false })
      return false
    }
  },

  deleteEvent: async (id) => {
    set({ loading: true, error: null })
    try {
      await calendarApi.deleteEvent(id)
      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
        loading: false,
      }))
      return true
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '删除事件失败', loading: false })
      return false
    }
  },

  completeEvent: async (id) => {
    try {
      const updatedEvent = (await calendarApi.completeEvent(id)) as CalendarEvent
      set((state) => ({
        events: state.events.map((e) => (e.id === id ? updatedEvent : e)),
      }))
      return true
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '标记完成失败' })
      return false
    }
  },

  selectEvent: (event) => {
    set({ selectedEvent: event })
  },

  setCurrentMonth: (month) => {
    set({ currentMonth: month })
  },

  getEventsByDate: (date) => {
    return get().events.filter((e) => e.eventDate === date)
  },

  // 获取近期事件（用 getEvents + 日期范围替代不存在的 getUpcoming 接口）
  getUpcomingEvents: async (days = 7) => {
    try {
      const startDate = dayjs().format('YYYY-MM-DD')
      const endDate = dayjs().add(days, 'day').format('YYYY-MM-DD')
      const events = (await calendarApi.getEvents({ startDate, endDate })) as CalendarEvent[]
      return events
    } catch (error) {
      console.error('获取近期事件失败:', error)
      return []
    }
  },
}))
