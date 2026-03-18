import { defineStore } from 'pinia'
import { calendarApi } from '@/api/modules'
import type { CalendarEvent } from '@/api/modules'
import dayjs from 'dayjs'

export const useCalendarStore = defineStore('calendar', {
  state: () => ({
    events: [] as CalendarEvent[],
    selectedEvent: null as CalendarEvent | null,
    currentMonth: dayjs().format('YYYY-MM'),
    loading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchEvents(startDate?: string, endDate?: string) {
      this.loading = true
      this.error = null
      try {
        const events = await calendarApi.getEvents({ startDate, endDate }) as CalendarEvent[]
        this.events = events
      } catch (error: unknown) {
        const err = error as { message?: string }
        this.error = err.message || '获取事件列表失败'
      } finally {
        this.loading = false
      }
    },

    async createEvent(data: Partial<CalendarEvent>) {
      this.loading = true
      try {
        const newEvent = await calendarApi.createEvent(data) as CalendarEvent
        this.events.push(newEvent)
      } catch (error: unknown) {
        const err = error as { message?: string }
        this.error = err.message || '创建事件失败'
      } finally {
        this.loading = false
      }
    },

    async updateEvent(id: number, data: Partial<CalendarEvent>) {
      this.loading = true
      try {
        const updatedEvent = await calendarApi.updateEvent(id, data) as CalendarEvent
        const index = this.events.findIndex(e => e.id === id)
        if (index !== -1) this.events[index] = updatedEvent
      } catch (error: unknown) {
        const err = error as { message?: string }
        this.error = err.message || '更新事件失败'
      } finally {
        this.loading = false
      }
    },

    async deleteEvent(id: number) {
      this.loading = true
      try {
        await calendarApi.deleteEvent(id)
        this.events = this.events.filter(e => e.id !== id)
      } catch (error: unknown) {
        const err = error as { message?: string }
        this.error = err.message || '删除事件失败'
      } finally {
        this.loading = false
      }
    },

    async completeEvent(id: number) {
      try {
        const updatedEvent = await calendarApi.completeEvent(id) as CalendarEvent
        const index = this.events.findIndex(e => e.id === id)
        if (index !== -1) this.events[index] = updatedEvent
      } catch (error: unknown) {
        console.error('标记完成失败:', error)
      }
    },

    selectEvent(event: CalendarEvent | null) {
      this.selectedEvent = event
    },

    setCurrentMonth(month: string) {
      this.currentMonth = month
      const start = dayjs(month).startOf('month').format('YYYY-MM-DD')
      const end = dayjs(month).endOf('month').format('YYYY-MM-DD')
      this.fetchEvents(start, end)
    },

    getEventsByDate(date: string): CalendarEvent[] {
      return this.events.filter(e => e.eventDate === date)
    },

    async getUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
      try {
        const startDate = dayjs().format('YYYY-MM-DD')
        const endDate = dayjs().add(days, 'day').format('YYYY-MM-DD')
        return await calendarApi.getEvents({ startDate, endDate }) as CalendarEvent[]
      } catch (_error) {
        return []
      }
    },
  },
})
