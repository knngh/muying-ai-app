import { create } from 'zustand'
import { calendarApi } from '../api/modules'
import type { CalendarEvent, PregnancyCustomTodo, PregnancyDiary, PregnancyTodoProgress } from '../api/modules'
import dayjs from 'dayjs'
import { logError } from '../utils/logger'

interface CalendarState {
  events: CalendarEvent[]
  todoProgress: PregnancyTodoProgress[]
  customTodos: PregnancyCustomTodo[]
  diaries: PregnancyDiary[]
  selectedEvent: CalendarEvent | null
  currentMonth: string
  loading: boolean
  error: string | null
  fetchEvents: (startDate?: string, endDate?: string) => Promise<void>
  fetchTodoContext: (week: number) => Promise<void>
  fetchDiaries: (week?: number) => Promise<void>
  createEvent: (data: Partial<CalendarEvent>) => Promise<CalendarEvent>
  updateEvent: (id: number, data: Partial<CalendarEvent>) => Promise<CalendarEvent>
  deleteEvent: (id: number) => Promise<void>
  completeEvent: (id: number) => Promise<CalendarEvent>
  toggleTodoProgress: (week: number, todoKey: string, completed: boolean) => Promise<void>
  saveDiary: (week: number, content: string) => Promise<void>
  deleteDiary: (week: number) => Promise<void>
  createCustomTodo: (week: number, content: string) => Promise<void>
  updateCustomTodo: (id: string, content: string) => Promise<void>
  deleteCustomTodo: (id: string) => Promise<void>
  selectEvent: (event: CalendarEvent | null) => void
  setCurrentMonth: (month: string) => void
  getEventsByDate: (date: string) => CalendarEvent[]
  getUpcomingEvents: (days?: number) => Promise<CalendarEvent[]>
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  todoProgress: [],
  customTodos: [],
  diaries: [],
  selectedEvent: null,
  currentMonth: dayjs().format('YYYY-MM'),
  loading: false,
  error: null,

  fetchEvents: async (startDate, endDate) => {
    set({ loading: true, error: null })
    try {
      const events = await calendarApi.getEvents({ startDate, endDate }) as CalendarEvent[]
      set({ events, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '获取事件失败', loading: false })
    }
  },

  fetchTodoContext: async (week) => {
    try {
      const [todoProgress, customTodos, diaries] = await Promise.all([
        calendarApi.getTodoProgress({ week }) as Promise<PregnancyTodoProgress[]>,
        calendarApi.getCustomTodos({ week }) as Promise<PregnancyCustomTodo[]>,
        calendarApi.getDiaries({ week }) as Promise<PregnancyDiary[]>,
      ])
      set({ todoProgress, customTodos, diaries, error: null })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({
        todoProgress: [],
        customTodos: [],
        diaries: [],
        error: err.message || '获取待办失败',
      })
    }
  },

  fetchDiaries: async (week) => {
    try {
      const diaries = await calendarApi.getDiaries(week ? { week } : undefined) as PregnancyDiary[]
      set({ diaries, error: null })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({
        diaries: [],
        error: err.message || '获取记录失败',
      })
    }
  },

  createEvent: async (data) => {
    set({ loading: true })
    try {
      const newEvent = await calendarApi.createEvent(data) as CalendarEvent
      set(state => ({ events: [...state.events, newEvent], loading: false }))
      return newEvent
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '创建事件失败', loading: false })
      throw error
    }
  },

  updateEvent: async (id, data) => {
    set({ loading: true })
    try {
      const updated = await calendarApi.updateEvent(id, data) as CalendarEvent
      set(state => ({ events: state.events.map(e => e.id === id ? updated : e), loading: false }))
      return updated
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '更新事件失败', loading: false })
      throw error
    }
  },

  deleteEvent: async (id) => {
    set({ loading: true })
    try {
      await calendarApi.deleteEvent(id)
      set(state => ({ events: state.events.filter(e => e.id !== id), loading: false }))
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '删除事件失败', loading: false })
    }
  },

  completeEvent: async (id) => {
    try {
      const updated = await calendarApi.completeEvent(id) as CalendarEvent
      set(state => ({ events: state.events.map(e => e.id === id ? updated : e) }))
      return updated
    } catch (_e) {
      logError('CalendarStore.completeEvent', _e)
      throw _e
    }
  },

  toggleTodoProgress: async (week, todoKey, completed) => {
    try {
      const progress = await calendarApi.updateTodoProgress({ week, todoKey, completed }) as PregnancyTodoProgress
      set((state) => {
        const nextProgress = state.todoProgress.filter(item => !(item.week === week && item.todoKey === todoKey))
        if (completed) {
          nextProgress.push(progress)
        }
        return { todoProgress: nextProgress }
      })
    } catch (_error) {
      logError('CalendarStore.toggleTodoProgress', _error)
      throw _error
    }
  },

  saveDiary: async (week, content) => {
    try {
      const diary = await calendarApi.saveDiary({ week, content }) as PregnancyDiary
      set((state) => ({
        diaries: [...state.diaries.filter((item) => item.week !== week), diary],
      }))
    } catch (_error) {
      logError('CalendarStore.saveDiary', _error)
      throw _error
    }
  },

  deleteDiary: async (week) => {
    try {
      await calendarApi.deleteDiary(week)
      set((state) => ({
        diaries: state.diaries.filter((item) => item.week !== week),
      }))
    } catch (_error) {
      logError('CalendarStore.deleteDiary', _error)
      throw _error
    }
  },

  createCustomTodo: async (week, content) => {
    try {
      const todo = await calendarApi.createCustomTodo({ week, content }) as PregnancyCustomTodo
      set((state) => ({ customTodos: [...state.customTodos, todo] }))
    } catch (_error) {
      logError('CalendarStore.createCustomTodo', _error)
      throw _error
    }
  },

  updateCustomTodo: async (id, content) => {
    try {
      const todo = await calendarApi.updateCustomTodo(id, { content }) as PregnancyCustomTodo
      set((state) => ({
        customTodos: state.customTodos.map(item => item.id === id ? todo : item),
      }))
    } catch (_error) {
      logError('CalendarStore.updateCustomTodo', _error)
      throw _error
    }
  },

  deleteCustomTodo: async (id) => {
    try {
      const result = await calendarApi.deleteCustomTodo(id) as { id: string; week: number; todoKey: string }
      set((state) => ({
        customTodos: state.customTodos.filter(item => item.id !== id),
        todoProgress: state.todoProgress.filter(item => !(item.week === result.week && item.todoKey === result.todoKey)),
      }))
    } catch (_error) {
      logError('CalendarStore.deleteCustomTodo', _error)
      throw _error
    }
  },

  selectEvent: (event) => set({ selectedEvent: event }),

  setCurrentMonth: (month) => {
    set({ currentMonth: month })
    const start = dayjs(month).startOf('month').format('YYYY-MM-DD')
    const end = dayjs(month).endOf('month').format('YYYY-MM-DD')
    get().fetchEvents(start, end)
  },

  getEventsByDate: (date) => get().events.filter(e => e.eventDate === date),

  getUpcomingEvents: async (days = 7) => {
    try {
      const startDate = dayjs().format('YYYY-MM-DD')
      const endDate = dayjs().add(days, 'day').format('YYYY-MM-DD')
      return await calendarApi.getEvents({ startDate, endDate }) as CalendarEvent[]
    } catch (_e) {
      return []
    }
  },
}))
