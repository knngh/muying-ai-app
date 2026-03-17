import { create } from 'zustand'
import { CalendarEvent, calendarApi } from '@/api/modules'
import dayjs from 'dayjs'

interface CalendarState {
  // 数据
  events: CalendarEvent[]
  selectedEvent: CalendarEvent | null
  
  // 当前选中的月份
  currentMonth: string // YYYY-MM 格式
  
  // 状态
  loading: boolean
  error: string | null
  
  // 操作
  fetchEvents: (startDate?: string, endDate?: string) => Promise<void>
  createEvent: (data: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateEvent: (id: number, data: Partial<CalendarEvent>) => Promise<void>
  deleteEvent: (id: number) => Promise<void>
  completeEvent: (id: number) => Promise<void>
  selectEvent: (event: CalendarEvent | null) => void
  setCurrentMonth: (month: string) => void
  getEventsByDate: (date: string) => CalendarEvent[]
  getUpcomingEvents: (days?: number) => Promise<CalendarEvent[]>
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  // 初始状态
  events: [],
  selectedEvent: null,
  currentMonth: dayjs().format('YYYY-MM'),
  loading: false,
  error: null,

  // 获取事件列表
  fetchEvents: async (startDate, endDate) => {
    set({ loading: true, error: null })
    
    try {
      const events = await calendarApi.getEvents({
        startDate,
        endDate,
      }) as CalendarEvent[]
      
      set({ events, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ 
        error: err.message || '获取事件列表失败', 
        loading: false 
      })
    }
  },

  // 创建事件
  createEvent: async (data) => {
    set({ loading: true, error: null })
    
    try {
      const newEvent = await calendarApi.createEvent(data) as CalendarEvent
      set(state => ({
        events: [...state.events, newEvent],
        loading: false,
      }))
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ 
        error: err.message || '创建事件失败', 
        loading: false 
      })
    }
  },

  // 更新事件
  updateEvent: async (id, data) => {
    set({ loading: true, error: null })
    
    try {
      const updatedEvent = await calendarApi.updateEvent(id, data) as CalendarEvent
      set(state => ({
        events: state.events.map(e => 
          e.id === id ? updatedEvent : e
        ),
        loading: false,
      }))
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ 
        error: err.message || '更新事件失败', 
        loading: false 
      })
    }
  },

  // 删除事件
  deleteEvent: async (id) => {
    set({ loading: true, error: null })
    
    try {
      await calendarApi.deleteEvent(id)
      set(state => ({
        events: state.events.filter(e => e.id !== id),
        loading: false,
      }))
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ 
        error: err.message || '删除事件失败', 
        loading: false 
      })
    }
  },

  // 标记完成
  completeEvent: async (id) => {
    try {
      const updatedEvent = await calendarApi.completeEvent(id) as CalendarEvent
      set(state => ({
        events: state.events.map(e => 
          e.id === id ? updatedEvent : e
        ),
      }))
    } catch (error: unknown) {
      console.error('标记完成失败:', error)
    }
  },

  // 选择事件
  selectEvent: (event) => {
    set({ selectedEvent: event })
  },

  // 设置当前月份
  setCurrentMonth: (month) => {
    set({ currentMonth: month })
    // 获取该月的事件
    const start = dayjs(month).startOf('month').format('YYYY-MM-DD')
    const end = dayjs(month).endOf('month').format('YYYY-MM-DD')
    get().fetchEvents(start, end)
  },

  // 获取指定日期的事件
  getEventsByDate: (date) => {
    return get().events.filter(e => e.eventDate === date)
  },

  // 获取近期事件
  getUpcomingEvents: async (days = 7) => {
    try {
      const events = await calendarApi.getUpcoming(days) as CalendarEvent[]
      return events
    } catch (error) {
      console.error('获取近期事件失败:', error)
      return []
    }
  },
}))