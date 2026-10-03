import { useEffect } from 'react'
import { calendarApi } from '@/api/modules'
import { useAppStore } from '@/stores/appStore'
import { storage } from '@/utils/storage'
import { isCalendarReminderDue, showCalendarNotification } from '@/utils/calendarNotifications'
import dayjs from 'dayjs'

export function useCalendarNotifications() {
  const userId = useAppStore((state) => state.user?.id)
  useEffect(() => {
    if (!userId || !('Notification' in window)) return
    let active = true
    let checking = false
    const check = async () => {
      if (checking || Notification.permission !== 'granted' || !storage.getItem('token')) return
      checking = true
      try {
        const events = await calendarApi.getEvents({
          startDate: dayjs().format('YYYY-MM-DD'),
          endDate: dayjs().add(2, 'day').format('YYYY-MM-DD'),
        })
        if (!active) return
        for (const event of events) {
          if (!isCalendarReminderDue(event)) continue
          const key = `calendar-notified:${userId}:${event.id}`
          const revision = `${event.eventDate}:${event.startTime || '09:00'}:${event.reminderMinutes || 1440}`
          if (storage.getItem(key) === revision) continue
          await showCalendarNotification(event, userId, () => active && !!storage.getItem('token'))
          if (active) storage.setItem(key, revision)
        }
      } catch {
        // Permission may be revoked while the request is in flight. Retry on
        // the next check without disrupting reading or recording workflows.
      } finally { checking = false }
    }
    void check()
    const timer = window.setInterval(() => { void check() }, 60_000)
    const refresh = () => { void check() }
    window.addEventListener('calendar-reminders-changed', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('calendar-reminders-changed', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [userId])
}
