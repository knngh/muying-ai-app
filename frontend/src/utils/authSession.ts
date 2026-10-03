import type { User } from '@/api/modules'
import { storage } from './storage'
import { closeCalendarNotifications } from './calendarNotifications'

// A document navigation also discards every private store and pending response.
// A client-side route change alone leaves the previous account's data alive.
export function startSession(token: string, user: User) {
  storage.setItem('app_user', JSON.stringify(user))
  storage.setItem('token', token)
  window.location.replace('/knowledge')
}

export async function endSession() {
  storage.removeItem('token')
  storage.removeItem('app_user')
  try { await closeCalendarNotifications() } catch { /* Revoked permissions cannot prevent logout. */ }
  window.location.replace('/login')
}
