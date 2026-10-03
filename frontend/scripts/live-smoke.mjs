import { chromium, expect } from '@playwright/test'
import fs from 'node:fs'
import crypto from 'node:crypto'
import process from 'node:process'

// Explicitly opt in: this creates synthetic records and uses one AI request.
const baseURL = process.env.WEB_SMOKE_BASE_URL
const credentialsFile = process.env.WEB_SMOKE_CREDENTIALS_FILE
const outputFile = process.env.WEB_SMOKE_RESULT_FILE
if (!baseURL || !credentialsFile || !outputFile) throw new Error('Set WEB_SMOKE_BASE_URL, WEB_SMOKE_CREDENTIALS_FILE and WEB_SMOKE_RESULT_FILE')
const existingCredentials = fs.existsSync(credentialsFile)
const credentials = existingCredentials ? JSON.parse(fs.readFileSync(credentialsFile, 'utf8')) : {
  username: `webqa_${crypto.randomBytes(5).toString('hex')}`,
  password: crypto.randomBytes(18).toString('base64url'),
  registered: false,
}
const reuse = existingCredentials && credentials.registered !== false
if (!existingCredentials) fs.writeFileSync(credentialsFile, JSON.stringify(credentials), { mode: 0o600 })
const report = { baseURL, startedAt: new Date().toISOString(), checks: [], failures: [], api: [], pageErrors: [] }
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Shanghai' })
const page = await context.newPage()
page.setDefaultTimeout(20_000)
page.on('dialog', dialog => dialog.accept())
page.on('pageerror', error => report.pageErrors.push(error.message))
page.on('response', response => {
  const url = new URL(response.url())
  if (url.pathname.startsWith('/api/')) report.api.push({ path: url.pathname, method: response.request().method(), status: response.status() })
})
const check = async (name, run) => {
  const start = Date.now()
  try { await run(); report.checks.push({ name, elapsedMs: Date.now() - start }); console.log(`PASS ${name}`) }
  catch (error) { report.failures.push({ name, message: String(error).replaceAll(credentials.password, '[redacted]') }); console.log(`FAIL ${name}`) }
}
const submit = async (path, action) => {
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === path && ['POST', 'PUT'].includes(response.request().method()), { timeout: 75_000 })
  await action()
  const response = await pending
  const body = await response.json()
  if (!response.ok() || body.code !== 0) throw new Error(`${path}: HTTP ${response.status()} ${body.message || ''}`)
  return body.data
}
try {
  await check(reuse ? '登录' : '注册并登录', async () => {
    await page.goto('/login')
    if (!reuse) await page.getByRole('button', { name: '立即注册', exact: true }).click()
    await page.getByLabel('用户名', { exact: true }).fill(credentials.username)
    await page.getByLabel('密码', { exact: true }).fill(credentials.password)
    // Session changes intentionally replace the document. Verify status and
    // destination instead of reading an already discarded response body.
    const authenticated = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/auth/${reuse ? 'login' : 'register'}` && response.request().method() === 'POST')
    await page.getByRole('button', { name: reuse ? '登录' : '注册', exact: true }).click()
    expect((await authenticated).ok()).toBe(true)
    credentials.registered = true
    fs.writeFileSync(credentialsFile, JSON.stringify(credentials), { mode: 0o600 })
    await expect(page).toHaveURL(/\/knowledge$/)
  })
  if (report.failures.length) throw new Error('登录未通过，停止写入验证')
  await check('资料保存与刷新', async () => {
    await page.goto('/profile')
    await page.getByRole('button', { name: '编辑资料', exact: true }).click()
    await page.getByLabel('昵称', { exact: true }).fill('网页验收账号')
    await page.getByRole('combobox', { name: /状态/ }).selectOption('3')
    await page.getByLabel('宝宝生日', { exact: true }).fill('2025-09-28')
    await submit('/api/v1/auth/profile', () => page.getByRole('button', { name: '保存', exact: true }).click())
    await page.reload()
    await expect(page.getByRole('heading', { name: '网页验收账号' })).toBeVisible()
  })
  await check('知识库搜索与详情', async () => {
    await page.goto('/knowledge')
    await page.getByPlaceholder('搜索知识...').fill('母乳')
    await page.getByRole('button', { name: '搜索', exact: true }).click()
    const link = page.locator('article h3 a').first()
    await expect(link).toBeVisible({ timeout: 15_000 })
    await link.click()
    await expect(page).toHaveURL(/\/knowledge\/.+/)
    await expect(page.locator('h1')).toBeVisible()
  })
  await check('生长档案与测量持久化', async () => {
    await page.goto('/tools/growth')
    await page.getByLabel('昵称', { exact: true }).fill('验收宝宝')
    await page.getByLabel('生日', { exact: true }).fill('2025-09-28')
    await page.getByRole('combobox', { name: /性别/ }).selectOption('1')
    await submit('/api/v1/growth/profile', () => page.getByRole('button', { name: '保存档案', exact: true }).click())
    await page.getByLabel('数值（kg）', { exact: true }).fill('9.6')
    await submit('/api/v1/tool-records/growth', () => page.getByRole('button', { name: '保存记录', exact: true }).click())
    await page.reload()
    await expect(page.getByLabel('生日', { exact: true })).toHaveValue('2025-09-28')
    await expect(page.getByText('9.6 kg', { exact: true }).first()).toBeVisible()
  })
  await check('疫苗登记与刷新', async () => {
    await page.goto('/tools/vaccines')
    await page.getByRole('button', { name: /乙肝疫苗/ }).first().click()
    await page.getByRole('button', { name: '登记接种', exact: true }).first().click()
    await page.getByLabel('备注（可选）').fill('网页自动验收虚构记录')
    await submit('/api/v1/tool-records/vaccinations', () => page.locator('button[type=submit]').click())
    await page.reload()
    await expect(page.getByText('网页自动验收虚构记录').first()).toBeVisible()
  })
  await check('签到状态与积分明细', async () => {
    await page.goto('/tools/checkin')
    const button = page.getByRole('button', { name: '今日签到', exact: true })
    await expect(page.getByRole('heading', { name: '每日打卡' })).toBeVisible()
    await expect(page.getByText(/再连续|已解锁全部连签奖励/)).toBeVisible()
    if (await button.isVisible()) await submit('/api/v1/checkin', () => button.click())
    await page.reload()
    await expect(page.getByRole('button', { name: /今日已签到/ })).toBeDisabled()
    await expect(page.getByRole('complementary').getByText(/签到.*积分/).first()).toBeVisible()
  })
  await check('起名与本机收藏', async () => {
    await page.goto('/tools/names')
    await page.getByRole('button', { name: '收藏 ♥', exact: true }).first().click()
    await page.reload()
    await expect(page.getByRole('button', { name: '已收藏 ♥', exact: true }).first()).toBeVisible()
  })
  await check('日历保存与提醒读回', async () => {
    await page.goto('/calendar')
    await page.getByRole('button', { name: '添加事件' }).click()
    await page.getByLabel('事件标题').fill('网页验收提醒')
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(Date.now() + 86_400_000))
    await page.getByLabel('日期', { exact: true }).fill(tomorrow)
    await page.getByRole('checkbox', { name: /提醒/ }).check()
    await submit('/api/v1/calendar/events', () => page.getByRole('button', { name: '保存', exact: true }).click())
    await page.reload()
    const event = page.getByRole('article').filter({ hasText: '网页验收提醒' }).first()
    await event.getByRole('button', { name: '编辑', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: /提醒/ })).toBeChecked()
    await expect(page.getByLabel('日期', { exact: true })).toHaveValue(tomorrow)
  })
  await check('AI真实回答与历史恢复', async () => {
    await page.goto('/chat')
    await page.getByRole('button', { name: '新对话', exact: true }).click()
    const question = '给一岁宝宝准备辅食，需要注意哪些食品卫生原则？请简要回答。'
    await page.locator('textarea').fill(question)
    const response = await submit('/api/v1/ai/chat', () => page.getByRole('button', { name: '发送', exact: true }).click())
    if (!response.message?.content || response.message.content.length < 20) throw new Error('未返回有效回答')
    report.ai = { chars: response.message.content.length, sourceCount: response.sources?.length || 0, degraded: response.degraded, provider: response.provider }
    await page.reload()
    await expect(page.getByText(question, { exact: true })).toBeVisible({ timeout: 20_000 })
  })
  await page.goto('/knowledge')
  await expect(page.locator('article h3 a').first()).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: outputFile.replace(/\.json$/, '-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: outputFile.replace(/\.json$/, '-mobile.png'), fullPage: true })
} catch (error) {
  report.failures.push({ name: '流程中断', message: String(error).replaceAll(credentials.password, '[redacted]') })
} finally {
  report.finishedAt = new Date().toISOString()
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2))
  await browser.close()
  if (report.failures.length || report.pageErrors.length) process.exitCode = 1
}
