import type { BrowserContext } from '@playwright/test'
import { test, expect, login, logout, navigate, deferred, type SavedEvent } from './fixtures'

test.use({ serviceWorkers: 'allow' })

type DisplayedNotification = { id: number; title: string; options: NotificationOptions; active: boolean }

// Keep the browser's real service-worker registration/lifecycle. Only the OS
// notification surface and permission prompt are replaced, so CI never sends
// actual desktop notifications. The capture lives outside the page to survive
// logout navigations and detect notifications from a stale account.
async function captureNotifications(context: BrowserContext, permission: NotificationPermission = 'default', decision: NotificationPermission = 'granted') {
  const displayed: DisplayedNotification[] = []
  let prompts = 0
  await context.exposeBinding('__notificationPrompt', () => { prompts += 1; return decision })
  await context.exposeBinding('__notificationDisplay', (_source, title: string, options: NotificationOptions) => {
    const id = displayed.length
    displayed.push({ id, title, options, active: true })
    return id
  })
  await context.exposeBinding('__notificationList', () => displayed.filter((item) => item.active))
  await context.exposeBinding('__notificationClose', (_source, id: number) => { displayed[id].active = false })
  await context.addInitScript(({ initialPermission }) => {
    type CaptureWindow = Window & {
      __notificationPrompt: () => Promise<NotificationPermission>
      __notificationDisplay: (title: string, options: NotificationOptions) => Promise<number>
      __notificationList: () => Promise<DisplayedNotification[]>
      __notificationClose: (id: number) => Promise<void>
    }
    const capture = window as unknown as CaptureWindow
    let currentPermission = initialPermission
    class CapturedNotification {
      static get permission() { return currentPermission }
      static async requestPermission() {
        currentPermission = await capture.__notificationPrompt()
        return currentPermission
      }
      onclick: (() => void) | null = null
      private id: Promise<number>
      constructor(title: string, options: NotificationOptions = {}) {
        this.id = capture.__notificationDisplay(title, options)
      }
      close() { void this.id.then((id) => capture.__notificationClose(id)) }
    }
    Object.defineProperty(window, 'Notification', { configurable: true, value: CapturedNotification })
    ServiceWorkerRegistration.prototype.showNotification = async function (title, options = {}) {
      await capture.__notificationDisplay(title, options)
    }
    ServiceWorkerRegistration.prototype.getNotifications = async function () {
      const items = await capture.__notificationList()
      return items.map((item) => ({
        title: item.title, tag: item.options.tag, data: item.options.data,
        close: () => { void capture.__notificationClose(item.id) },
      })) as Notification[]
    }
  }, { initialPermission: permission })
  return { displayed, promptCount: () => prompts }
}

function reminder(overrides: Partial<SavedEvent> = {}): SavedEvent {
  return {
    id: '1', userId: '1', title: 'A 的产检提醒', eventDate: '2026-09-28T00:00:00.000Z',
    startTime: '12:10', eventType: 'checkup', reminderEnabled: true,
    reminderMinutes: 30, isCompleted: false, status: 0, ...overrides,
  }
}

test('notification permission is requested only by a user click and a due reminder uses the real service worker', async ({ page, context, api }) => {
  const notifications = await captureNotifications(context)
  api.events = [reminder()]
  await login(page)
  await navigate(page, '孕育日历')
  await expect(page.getByRole('button', { name: '开启网页通知' })).toBeVisible()
  expect(notifications.promptCount()).toBe(0)
  expect(notifications.displayed).toEqual([])
  await page.getByRole('button', { name: '开启网页通知' }).click()
  await expect(page.getByRole('status')).toHaveText('网页通知已开启')
  await expect.poll(() => notifications.displayed.map((item) => item.title)).toEqual(['A 的产检提醒'])
  expect(notifications.promptCount()).toBe(1)
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return registration?.active?.scriptURL
  })).toContain('/notifications-sw.js')
})

test('denied notification permission gives guidance and never sends reminders', async ({ page, context, api }) => {
  const notifications = await captureNotifications(context, 'default', 'denied')
  api.events = [reminder()]
  await login(page)
  await navigate(page, '孕育日历')
  await page.getByRole('button', { name: '开启网页通知' }).click()
  await expect(page.getByRole('status')).toContainText('通知已被阻止')
  await navigate(page, '知识库')
  await navigate(page, '孕育日历')
  expect(notifications.promptCount()).toBe(1)
  expect(notifications.displayed).toEqual([])
})

test('only due enabled unfinished reminders are delivered, and reload does not duplicate them', async ({ page, context, api }) => {
  const notifications = await captureNotifications(context, 'granted')
  api.events = [
    reminder(),
    reminder({ id: '2', title: '尚未到期', startTime: '14:00' }),
    reminder({ id: '3', title: '已完成', isCompleted: true, status: 1 }),
    reminder({ id: '4', title: '未开启提醒', reminderEnabled: false }),
    reminder({ id: '5', title: '已经过去', startTime: '10:00' }),
  ]
  await login(page)
  await expect.poll(() => notifications.displayed.map((item) => item.title)).toEqual(['A 的产检提醒'])
  const before = api.calendarRequests.length
  await page.reload()
  await expect.poll(() => api.calendarRequests.length).toBeGreaterThan(before)
  await navigate(page, '孕育日历')
  await expect(page.getByRole('status')).toHaveText('网页通知已开启')
  expect(notifications.displayed.map((item) => item.title)).toEqual(['A 的产检提醒'])
})

test('a future reminder becomes due when the browser clock reaches its reminder window', async ({ page, context, api }) => {
  const notifications = await captureNotifications(context, 'granted')
  api.events = [reminder({ startTime: '14:00' })]
  await login(page)
  await expect.poll(() => api.calendarRequests.length).toBeGreaterThan(0)
  await navigate(page, '孕育日历')
  await expect(page.getByRole('button', { name: /28.*A 的产检提醒/ })).toBeVisible()
  expect(notifications.displayed).toEqual([])
  await page.clock.setFixedTime(new Date('2026-09-28T13:30:00-07:00'))
  // Route changes remount the layout and run the real due check immediately.
  await page.reload()
  await expect.poll(() => notifications.displayed.map((item) => item.title)).toEqual(['A 的产检提醒'])
})

test('a delayed account A reminder response cannot notify after B has signed in', async ({ page, context, api }) => {
  const notifications = await captureNotifications(context, 'granted')
  api.calendarGate = deferred()
  api.eventsByAccount = { reviewA: [reminder()], reviewB: [] }
  await login(page)
  await expect.poll(() => api.calendarRequests).toContain('reviewA')
  await logout(page)
  await login(page, 'reviewB')
  api.calendarGate.release()
  await expect.poll(() => api.calendarRequests).toContain('reviewB')
  await navigate(page, '孕育日历')
  await expect(page.getByText('暂无近期事项')).toBeVisible()
  expect(notifications.displayed).toEqual([])
})

test('logout closes account A notifications before another account opens the app', async ({ page, context, api }) => {
  const notifications = await captureNotifications(context, 'granted')
  api.eventsByAccount = { reviewA: [reminder()], reviewB: [] }
  await login(page)
  await expect.poll(() => notifications.displayed.filter((item) => item.active).length).toBe(1)
  await logout(page)
  await expect.poll(() => notifications.displayed.filter((item) => item.active).length).toBe(0)
  await login(page, 'reviewB')
  await navigate(page, '孕育日历')
  await expect(page.getByText('暂无近期事项')).toBeVisible()
  expect(notifications.displayed.filter((item) => item.active)).toEqual([])
})
