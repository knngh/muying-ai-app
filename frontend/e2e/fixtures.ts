import { test as base, expect, type Page, type Route } from '@playwright/test'

export const TODAY = '2026-09-28'
export const PRIVATE_MESSAGE = '仅属于 A 账号的孕期健康记录'
export const ARTICLE_TITLE = '孕早期叶酸补充与膳食指南'
const user = (account: string) => ({ id: account === 'reviewA' ? '1' : '2', username: account, nickname: account, createdAt: `${TODAY}T00:00:00.000Z` })
const conversation = {
  id: 'conversation-A', title: 'A 账号私密对话',
  messages: [{ id: 'message-A', role: 'user', content: PRIVATE_MESSAGE, createdAt: `${TODAY}T00:00:00.000Z` }],
  createdAt: `${TODAY}T00:00:00.000Z`, updatedAt: `${TODAY}T00:00:00.000Z`,
}
const olderConversation = {
  id: 'conversation-older', title: '较早的一次对话',
  messages: [{ id: 'message-older', role: 'user', content: '较早的育儿问题记录', createdAt: '2026-09-27T00:00:00.000Z' }],
  createdAt: '2026-09-27T00:00:00.000Z', updatedAt: '2026-09-27T00:00:00.000Z',
}
const article = {
  id: 1, slug: 'folic-acid', title: ARTICLE_TITLE,
  summary: '备孕及孕早期如何补充叶酸、搭配膳食，并在有疑问时咨询医生。',
  content: '<p>备孕及孕早期的叶酸补充与均衡膳食建议。</p>',
  coverImage: null, contentType: 'authority', sourceOrg: '国家卫生健康委员会',
  source: 'NHC', sourceUrl: 'https://example.invalid/folic-acid', sourceLanguage: 'zh',
  category: { id: 1, name: '孕期营养', slug: 'nutrition' }, stage: 'first-trimester',
  targetStages: ['first-trimester'], tags: [], likeCount: 0, collectCount: 0, viewCount: 0,
  createdAt: `${TODAY}T00:00:00.000Z`, publishedAt: `${TODAY}T00:00:00.000Z`,
}

export type SavedEvent = {
  id: string; userId: string; title: string; description?: string;
  eventDate: string; eventType: string; reminderMinutes: number | null;
  reminderEnabled: boolean; isCompleted: boolean; status: number;
  startTime?: string;
}

export function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

export class FixtureApi {
  meRequests = 0
  refreshRequests = 0
  failLogin = false
  expireAccountA = false
  failRefresh = false
  failCalendarSave = false
  failArticles = false
  failCheckin = false
  checkedIn = false
  checkinWrites = 0
  historyGate?: ReturnType<typeof deferred>
  refreshGate?: ReturnType<typeof deferred>
  calendarGate?: ReturnType<typeof deferred>
  calendarRequests: string[] = []
  eventsByAccount?: Record<string, SavedEvent[]>
  calendarWrites: Array<Record<string, unknown>> = []
  articleQueries: URLSearchParams[] = []
  unknownRequests: string[] = []
  historyAccounts: string[] = []
  profileAccounts: string[] = []
  events: SavedEvent[] = [{
    id: '1', userId: '1', title: '产检预约', eventDate: `${TODAY}T00:00:00.000Z`,
    eventType: 'checkup', reminderMinutes: 30, reminderEnabled: true, isCompleted: false, status: 0,
  }]

  async handle(route: Route) {
    const request = route.request()
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/v1/')) {
      // Only static files from the local preview server can leave the route handler.
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') await route.continue()
      else { this.unknownRequests.push(`External: ${request.url()}`); await route.abort() }
      return
    }
    const endpoint = url.pathname.slice('/api/v1'.length)
    const account = request.headers().authorization?.includes('reviewB') ? 'reviewB' : 'reviewA'
    const reply = async (data: unknown, status = 200, message = 'success') => {
      // A page navigation can cancel a deliberately deferred response.
      await route.fulfill({ status, json: status === 200 ? { code: 0, data } : { code: status, message } }).catch(() => {})
    }
    if (endpoint === '/auth/login') {
      if (this.failLogin) return reply(null, 401, '用户名或密码错误')
      const name = request.postDataJSON().username as string
      return reply({ token: `fixture-${name}`, user: user(name) })
    }
    if (endpoint === '/auth/logout') return reply(null)
    if (endpoint === '/auth/me') {
      this.meRequests += 1
      this.profileAccounts.push(account)
      await new Promise((resolve) => setTimeout(resolve, 40))
      if (account === 'reviewA' && this.expireAccountA) return reply(null, 401, '会话已过期')
      return reply(user(account))
    }
    if (endpoint === '/auth/refresh') {
      this.refreshRequests += 1
      await this.refreshGate?.promise
      return this.failRefresh ? reply(null, 401, '会话已过期') : reply({ token: `fixture-${account}-refreshed` })
    }
    if (endpoint === '/ai/conversations') {
      this.historyAccounts.push(account)
      if (account === 'reviewA') await this.historyGate?.promise
      // ai.controller.getConversations uses paginatedResponse; list rows have
      // metadata and empty messages, and the latest session is ordered first.
      const list = account === 'reviewA' ? [conversation, olderConversation].map((session) => ({
        ...session, messages: [], messageCount: session.messages.length, summary: '', lastMessagePreview: '',
      })) : []
      return reply({ list, pagination: { page: 1, pageSize: 20, total: list.length, totalPages: list.length ? 1 : 0 } })
    }
    if (endpoint === '/ai/conversations/conversation-A') return reply(conversation)
    if (endpoint === '/ai/conversations/conversation-older') return reply(olderConversation)
    if (endpoint === '/categories') return reply({ list: [article.category] })
    if (endpoint === '/tags') return reply({ list: [] })
    if (endpoint === '/articles' || endpoint === '/articles/search') {
      this.articleQueries.push(url.searchParams)
      if (this.failArticles) return reply(null, 500, '知识库暂时不可用，请重试')
      const search = url.searchParams.get('q') || url.searchParams.get('keyword')
      const scoped = url.searchParams.get('stage') === 'first-trimester' && url.searchParams.get('category') === 'nutrition'
      const list = search && !scoped ? [{ ...article, id: 2, slug: 'unscoped', title: '不符合筛选的其他文章' }] : [article]
      return reply({ list, pagination: { page: 1, pageSize: 10, total: list.length, totalPages: 1 } })
    }
    if (endpoint === '/growth/profile') return reply({ id: '1', userId: '1', name: '测试宝宝', birthday: '2025-09-28T00:00:00.000Z', gender: 1, stageHint: null })
    if (endpoint === '/tool-records/growth') return reply([])
    if (endpoint === '/names') return reply({
      version: 'test', disclosure: '测试数据',
      list: [{ id: 'name-1', givenName: '知夏', fullName: '李知夏', gender: 'girl', pinyin: 'zhī xià', meaning: '知书明理，夏日温暖', source: '测试参考资料', contentOrigin: 'ai_assisted' }],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    })
    if (endpoint === '/checkin/status') return reply({
      checkedInToday: this.checkedIn,
      // The real status controller returns currentStreak, unlike the POST result's streakCount.
      currentStreak: this.checkedIn ? 1 : 0, consecutiveDays: this.checkedIn ? 1 : 0,
      streakDates: this.checkedIn ? [TODAY] : [], totalDays: this.checkedIn ? 1 : 0,
      totalPoints: this.checkedIn ? 5 : 0, monthlyCheckins: this.checkedIn ? [TODAY] : [],
      nextBonusAt: 3, nextBonusPoints: 10,
    })
    if (endpoint === '/checkin' && request.method() === 'POST') {
      this.checkinWrites += 1
      if (this.failCheckin) return reply(null, 500, '签到暂时不可用，请重试')
      const alreadyCheckedIn = this.checkedIn
      this.checkedIn = true
      return reply({
        checkinDate: TODAY, streakCount: 1, consecutiveDays: 1, streakDates: [TODAY],
        totalDays: 1, checkedInToday: true, pointsAwarded: alreadyCheckedIn ? 0 : 5,
        pointsEarned: alreadyCheckedIn ? 0 : 5, totalPoints: 5,
        nextBonusAt: 3, nextBonusPoints: 10, alreadyCheckedIn,
      })
    }
    if (endpoint === '/checkin/points-log') return reply({
      list: this.checkedIn ? [{ id: 'points-1', points: 5, balance: 5, source: 'checkin', sourceId: 'checkin-1', description: '每日签到奖励', createdAt: `${TODAY}T12:00:00.000Z` }] : [],
      pagination: { page: 1, pageSize: 20, total: this.checkedIn ? 1 : 0, totalPages: this.checkedIn ? 1 : 0 },
    })
    if (endpoint === '/calendar/events') {
      if (request.method() === 'GET') {
        this.calendarRequests.push(account)
        const events = this.eventsByAccount?.[account] ?? this.events
        if (account === 'reviewA') await this.calendarGate?.promise
        return reply({ list: events })
      }
      const input = request.postDataJSON() as Record<string, unknown>
      this.calendarWrites.push(input)
      if (this.failCalendarSave) return reply(null, 500, '日历保存失败，请重试')
      const event = this.serializeEvent(input, String(this.events.length + 1))
      this.events.push(event)
      return reply(event)
    }
    const eventMatch = endpoint.match(/^\/calendar\/events\/(\d+)$/)
    if (eventMatch && request.method() === 'PUT') {
      const input = request.postDataJSON() as Record<string, unknown>
      this.calendarWrites.push(input)
      if (this.failCalendarSave) return reply(null, 500, '日历保存失败，请重试')
      const event = this.serializeEvent(input, eventMatch[1])
      this.events = this.events.map((item) => item.id === event.id ? event : item)
      return reply(event)
    }
    this.unknownRequests.push(`${request.method()} ${endpoint}`)
    return reply(null, 501, `未定义的测试接口 ${endpoint}`)
  }

  private serializeEvent(input: Record<string, unknown>, id: string): SavedEvent {
    const reminderMinutes = typeof input.reminderMinutes === 'number' ? input.reminderMinutes : null
    return {
      id, userId: '1', title: String(input.title), description: String(input.description || ''),
      eventDate: `${String(input.eventDate).slice(0, 10)}T00:00:00.000Z`,
      eventType: String(input.eventType), reminderMinutes,
      reminderEnabled: (reminderMinutes ?? 0) > 0, isCompleted: false, status: 0,
    }
  }
}

export const test = base.extend<{ api: FixtureApi }>({
  api: [async ({ context, page }, use) => {
    const api = new FixtureApi()
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await context.route('**/*', (route) => api.handle(route))
    await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-07:00'))
    page.on('dialog', (dialog) => dialog.accept())
    await use(api)
    api.historyGate?.release()
    api.refreshGate?.release()
    api.calendarGate?.release()
    expect(api.unknownRequests, 'All API calls must have an explicit local fixture').toEqual([])
    expect(pageErrors, 'The app must not emit unhandled runtime errors').toEqual([])
  }, { auto: true }],
})

export { expect }

export async function login(page: Page, account = 'reviewA') {
  if (!page.url().endsWith('/login')) await page.goto('/login')
  await page.getByLabel('用户名', { exact: true }).fill(account)
  await page.getByLabel('密码', { exact: true }).fill('fixture-password-123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/knowledge$/)
}

export async function navigate(page: Page, name: string) {
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: new RegExp(name) }).click()
}

export async function logout(page: Page) {
  await navigate(page, '我的')
  await page.getByRole('button', { name: '退出登录' }).click()
  await expect(page).toHaveURL(/\/login$/)
}
