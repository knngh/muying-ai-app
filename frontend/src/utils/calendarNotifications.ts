import type { CalendarEvent } from '@/api/modules'
import { dateOnly } from './dateOnly'

export function calendarReminderTime(event: CalendarEvent): number {
  const time = event.startTime || '09:00'
  return new Date(`${dateOnly(event.eventDate)}T${time}`).getTime() - (event.reminderMinutes || 1440) * 60_000
}

export function isCalendarReminderDue(event: CalendarEvent, now = Date.now()): boolean {
  if (!event.reminderEnabled || event.isCompleted) return false
  const startsAt = new Date(`${dateOnly(event.eventDate)}T${event.startTime || '09:00'}`).getTime()
  return calendarReminderTime(event) <= now && now <= startsAt
}

const localNotifications = new Set<Notification>()

export async function closeCalendarNotifications() {
  for (const notification of localNotifications) notification.close()
  localNotifications.clear()
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(async (registration) => {
      const notifications = await registration.getNotifications()
      for (const notification of notifications) {
        if (notification.tag.startsWith('calendar-')) notification.close()
      }
    }))
  }
}

export async function showCalendarNotification(event: CalendarEvent, userId: string | number, isActive = () => true) {
  const options = {
    body: `${dateOnly(event.eventDate)} ${event.startTime || '09:00'} · ${event.description || '请查看孕育日历中的安排'}`,
    tag: `calendar-${userId}-${event.id}-${dateOnly(event.eventDate)}`,
    data: { url: '/calendar' },
  }
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('/notifications-sw.js')
    const registration = await navigator.serviceWorker.ready
    if (isActive()) await registration.showNotification(event.title, options)
  } else {
    if (!isActive()) return
    const notification = new Notification(event.title, options)
    localNotifications.add(notification)
    notification.onclose = () => { localNotifications.delete(notification) }
    notification.onclick = () => { window.focus(); window.location.assign('/calendar'); notification.close() }
  }
}
