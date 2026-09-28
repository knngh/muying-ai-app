import { readFile } from 'node:fs/promises'
import { test, expect, login, logout, navigate } from './fixtures'

test('name favorites stay with account A across reloads and an A to B to A account switch', async ({ page }) => {
  await login(page)
  await page.goto('/tools/names')
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: '李知夏' }) })
  await card.getByRole('button', { name: '收藏 ♥', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: '收藏（1）', exact: true }).click()
  await expect(card.getByRole('button', { name: '已收藏 ♥', exact: true })).toBeVisible()

  await logout(page)
  await login(page, 'reviewB')
  await page.goto('/tools/names')
  await page.getByRole('button', { name: /^收藏（/ }).click()
  await expect(page.getByText('还没有收藏的名字，在名字卡上点「收藏 ♥」保存心仪选项。')).toBeVisible()
  await expect(page.getByRole('heading', { name: '李知夏' })).toHaveCount(0)

  await logout(page)
  await login(page, 'reviewA')
  await page.goto('/tools/names')
  await page.getByRole('button', { name: '收藏（1）', exact: true }).click()
  await expect(card.getByRole('button', { name: '已收藏 ♥', exact: true })).toBeVisible()
})

test('successful check-in refreshes points history on the same page and prevents a second check-in', async ({ page, api }) => {
  await login(page)
  await page.goto('/tools/checkin')
  await expect(page.getByText('暂无积分记录，从今天开始签到吧')).toBeVisible()
  await page.getByRole('button', { name: '今日签到', exact: true }).click()
  await expect(page.getByText('签到成功 +5 积分', { exact: true })).toBeVisible()
  const pointsPanel = page.getByRole('complementary')
  await expect(pointsPanel.getByText('每日签到奖励', { exact: true })).toBeVisible()
  await expect(pointsPanel.getByText('+5', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '今日已签到 ✓', exact: true })).toBeDisabled()
  expect(api.checkinWrites).toBe(1)
})

test('check-in displays the backend currentStreak and the remaining days to the next reward', async ({ page, api }) => {
  api.checkedIn = true
  await login(page)
  await page.goto('/tools/checkin')
  await expect(page.getByText('再连续 2 天可额外得 +10 积分', { exact: true })).toBeVisible()
  // Assert the visible statistic beside its label, independent of CSS module names.
  const streakStatistic = page.getByText('连续打卡 · 天', { exact: true }).locator('..')
  await expect(streakStatistic).toHaveText('1连续打卡 · 天')
})

test('failed check-in does not award points and can be retried on the same page', async ({ page, api }) => {
  api.failCheckin = true
  await login(page)
  await page.goto('/tools/checkin')
  await page.getByRole('button', { name: '今日签到', exact: true }).click()
  await expect(page.getByText('签到暂时不可用，请重试', { exact: true })).toBeVisible()
  await expect(page.getByText('签到成功 +5 积分', { exact: true })).toHaveCount(0)
  await expect(page.getByText('每日签到奖励', { exact: true })).toHaveCount(0)
  api.failCheckin = false
  await page.getByRole('button', { name: '今日签到', exact: true }).click()
  await expect(page.getByText('每日签到奖励', { exact: true })).toBeVisible()
  expect(api.checkinWrites).toBe(2)
})

test('calendar export downloads an importable file for the selected event', async ({ page }) => {
  await login(page)
  await navigate(page, '孕育日历')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出到系统日历', exact: true }).first().click()
  const download = await downloaded
  expect(download.suggestedFilename()).toMatch(/\.ics$/)
  const filePath = await download.path()
  expect(filePath).not.toBeNull()
  const contents = await readFile(filePath!, 'utf8')
  expect(contents).toContain('BEGIN:VCALENDAR\r\n')
  expect(contents).toContain('DTSTART;VALUE=DATE:20260928\r\n')
  expect(contents).toContain('SUMMARY:产检预约\r\n')
  expect(contents).toContain('TRIGGER:-PT30M\r\n')
})
