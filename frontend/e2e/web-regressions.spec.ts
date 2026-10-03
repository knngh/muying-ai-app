import { test, expect, login, logout, navigate, deferred, TODAY, PRIVATE_MESSAGE, ARTICLE_TITLE } from './fixtures'

test('reload restores the latest conversation from the paginated history API and loads its messages', async ({ page }) => {
  await login(page)
  await navigate(page, 'AI问答')
  await expect(page).toHaveURL(/\/chat$/)
  await page.reload()
  await expect(page.getByRole('button', { name: /A 账号私密对话/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /较早的一次对话/ })).toBeVisible()
  await expect(page.getByText(PRIVATE_MESSAGE, { exact: true })).toBeVisible()
  await expect(page.getByText('较早的育儿问题记录', { exact: true })).toHaveCount(0)
})

test('switching accounts removes the previous account conversation and loads the new history', async ({ page, api }) => {
  await login(page)
  await navigate(page, 'AI问答')
  await expect(page.getByText(PRIVATE_MESSAGE, { exact: true })).toBeVisible()
  await logout(page)
  await login(page, 'reviewB')
  await navigate(page, 'AI问答')
  await expect(page.getByText('还没有历史对话', { exact: true })).toBeVisible()
  await expect(page.getByText(PRIVATE_MESSAGE, { exact: true })).toHaveCount(0)
  expect(api.historyAccounts).toContain('reviewB')
})

test('a delayed account A history response cannot populate account B chat', async ({ page, api }) => {
  api.historyGate = deferred()
  await login(page)
  await navigate(page, 'AI问答')
  await expect.poll(() => api.historyAccounts).toContain('reviewA')
  await logout(page)
  await login(page, 'reviewB')
  api.historyGate.release()
  await navigate(page, 'AI问答')
  await expect(page.getByText('还没有历史对话', { exact: true })).toBeVisible()
  await expect(page.getByText(PRIVATE_MESSAGE, { exact: true })).toHaveCount(0)
})

test('profile loading settles without repeatedly requesting auth/me', async ({ page, api }) => {
  await login(page)
  await navigate(page, '我的')
  await expect(page.getByRole('heading', { name: 'reviewA' })).toBeVisible()
  await expect.poll(() => api.meRequests).toBeGreaterThan(0)
  // Observe several 40 ms fixture round-trips: a render/request feedback loop must remain absent.
  await page.waitForTimeout(600)
  expect(api.meRequests).toBeLessThanOrEqual(2)
})

test('login 401 remains on the form with a visible error and preserves the entered username', async ({ page, api }) => {
  api.failLogin = true
  await page.goto('/login')
  await page.getByLabel('用户名', { exact: true }).fill('reviewA')
  await page.getByLabel('密码', { exact: true }).fill('incorrect-password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByText(/登录失败|用户名或密码错误/)).toBeVisible()
  await expect(page.getByLabel('用户名', { exact: true })).toHaveValue('reviewA')
  await expect(page).toHaveURL(/\/login$/)
  expect(api.refreshRequests).toBe(0)
})

test('failed session refresh returns to login and clears private history before the next login', async ({ page, api }) => {
  await login(page)
  await navigate(page, 'AI问答')
  await expect(page.getByText(PRIVATE_MESSAGE, { exact: true })).toBeVisible()
  api.expireAccountA = true
  api.failRefresh = true
  await navigate(page, '我的')
  await expect(page).toHaveURL(/\/login$/)
  expect(api.refreshRequests).toBe(1)
  await login(page, 'reviewB')
  await navigate(page, 'AI问答')
  await expect(page.getByText('还没有历史对话', { exact: true })).toBeVisible()
  await expect(page.getByText(PRIVATE_MESSAGE, { exact: true })).toHaveCount(0)
})

for (const failedRefresh of [false, true]) {
  test(`a delayed ${failedRefresh ? 'failed' : 'successful'} A refresh does not replace or clear B session`, async ({ page, api }) => {
    await login(page)
    api.expireAccountA = true
    api.failRefresh = failedRefresh
    api.refreshGate = deferred()
    await navigate(page, '我的')
    await expect.poll(() => api.refreshRequests).toBe(1)
    await page.getByRole('button', { name: '退出登录' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await login(page, 'reviewB')
    api.refreshGate.release()
    await navigate(page, '我的')
    await expect(page.getByRole('heading', { name: 'reviewB' })).toBeVisible()
    await expect.poll(() => api.profileAccounts.at(-1)).toBe('reviewB')
    // Allow the released old response to settle before checking the new account remains authenticated.
    await page.waitForTimeout(200)
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByRole('heading', { name: 'reviewB' })).toBeVisible()
  })
}

test('ISO calendar dates appear in their month cell and refill a date input without timezone shifts', async ({ page }) => {
  await login(page)
  await navigate(page, '孕育日历')
  const dayCell = page.getByRole('button', { name: /28.*产检预约/ })
  await expect(dayCell).toBeVisible()
  await page.getByRole('button', { name: '编辑', exact: true }).first().click()
  await expect(page.getByLabel('日期', { exact: true })).toHaveValue(TODAY)
  await expect(page.getByRole('checkbox', { name: /提醒/ })).toBeChecked()
})

test('enabling and disabling calendar reminders persists reminderMinutes through a reload', async ({ page, api }) => {
  await login(page)
  await navigate(page, '孕育日历')
  await page.getByRole('button', { name: '添加事件' }).click()
  await page.getByLabel('事件标题').fill('提醒测试')
  await page.getByRole('checkbox', { name: /提醒/ }).check()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('heading', { name: '新建事件' })).toHaveCount(0)
  expect(api.calendarWrites.at(-1)).toMatchObject({ title: '提醒测试', eventDate: TODAY, reminderMinutes: 1440 })
  await page.reload()
  const savedEvent = page.getByRole('article').filter({ has: page.getByText('提醒测试', { exact: true }) })
  await savedEvent.getByRole('button', { name: '编辑', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /提醒/ })).toBeChecked()
  await page.getByRole('checkbox', { name: /提醒/ }).uncheck()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('heading', { name: '编辑事件' })).toHaveCount(0)
  expect(api.calendarWrites.at(-1)?.reminderMinutes ?? 0).toBe(0)
  await page.reload()
  await savedEvent.getByRole('button', { name: '编辑', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /提醒/ })).not.toBeChecked()
})

test('calendar save failure keeps all draft fields and lets the user retry', async ({ page, api }) => {
  api.failCalendarSave = true
  await login(page)
  await navigate(page, '孕育日历')
  await page.getByRole('button', { name: '添加事件' }).click()
  await page.getByLabel('事件标题').fill('保留输入测试')
  await page.getByRole('textbox', { name: '描述', exact: true }).fill('失败后仍然保留的说明')
  await page.getByLabel('日期', { exact: true }).fill('2026-09-30')
  await page.getByRole('checkbox', { name: /提醒/ }).check()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('heading', { name: '新建事件' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: /保存失败|创建事件失败/ }).first()).toBeVisible()
  await expect(page.getByLabel('事件标题')).toHaveValue('保留输入测试')
  await expect(page.getByRole('textbox', { name: '描述', exact: true })).toHaveValue('失败后仍然保留的说明')
  await expect(page.getByLabel('日期', { exact: true })).toHaveValue('2026-09-30')
  await expect(page.getByRole('checkbox', { name: /提醒/ })).toBeChecked()
  api.failCalendarSave = false
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('heading', { name: '新建事件' })).toHaveCount(0)
  expect(api.events.filter((event) => event.title === '保留输入测试')).toHaveLength(1)
  await page.reload()
  await expect(page.getByRole('article').filter({ hasText: '保留输入测试' })).toBeVisible()
})

test('growth profile fills an ISO birthday into the native date field', async ({ page }) => {
  await login(page)
  await page.goto('/tools/growth')
  await expect(page.getByLabel('生日', { exact: true })).toHaveValue('2025-09-28')
})

test('an article without a cover uses the available desktop width and fits mobile', async ({ page }) => {
  await page.goto('/knowledge')
  const heading = page.getByRole('heading', { name: ARTICLE_TITLE })
  const card = page.getByRole('article').filter({ has: heading })
  await expect(heading).toBeVisible()
  const cardBox = await card.boundingBox()
  const textBox = await heading.boundingBox()
  expect(cardBox).not.toBeNull()
  expect(textBox).not.toBeNull()
  expect(textBox!.width / cardBox!.width).toBeGreaterThan(0.75)
  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('knowledge search retains selected stage and category in its results', async ({ page, api }) => {
  await page.goto('/knowledge')
  await page.getByRole('combobox', { name: '分类', exact: true }).selectOption('nutrition')
  await page.getByRole('combobox', { name: '阶段', exact: true }).selectOption('first-trimester')
  await page.getByPlaceholder('搜索知识...').fill('叶酸')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect.poll(() => api.articleQueries.some((query) => query.get('q') === '叶酸' || query.get('keyword') === '叶酸')).toBe(true)
  const query = api.articleQueries.at(-1)!
  expect(query.get('stage')).toBe('first-trimester')
  expect(query.get('category')).toBe('nutrition')
  await expect(page.getByRole('heading', { name: ARTICLE_TITLE })).toBeVisible()
  await expect(page.getByRole('heading', { name: '不符合筛选的其他文章' })).toHaveCount(0)
})

test('knowledge failures are visible and retry restores the selected search', async ({ page, api }) => {
  await page.goto('/knowledge')
  await page.getByRole('combobox', { name: '分类', exact: true }).selectOption('nutrition')
  await page.getByRole('combobox', { name: '阶段', exact: true }).selectOption('first-trimester')
  api.failArticles = true
  await page.getByPlaceholder('搜索知识...').fill('叶酸')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  api.failArticles = false
  await page.getByRole('button', { name: /重试|重新加载/ }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: ARTICLE_TITLE })).toBeVisible()
  const query = api.articleQueries.at(-1)!
  expect(query.get('q') || query.get('keyword')).toBe('叶酸')
  expect(query.get('stage')).toBe('first-trimester')
  expect(query.get('category')).toBe('nutrition')
})
