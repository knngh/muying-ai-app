import { test, expect, login, navigate } from './fixtures'

test('knowledge results remain near the first screen and filters adapt to the viewport', async ({ page }) => {
  await page.route('**/api/v1/tags', route => route.fulfill({ json: { code: 0, data: { list:
    Array.from({ length: 12 }, (_, index) => ({ id: index + 1, slug: `topic-${index}`, name: `孕育主题 ${index + 1}` })),
  } } }))
  await page.goto('/knowledge')
  const article = page.getByRole('article').first()
  const filters = page.getByRole('complementary', { name: '知识筛选' })
  await expect(article).toBeVisible()
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const articleBox = await article.boundingBox()
    const filterBox = await filters.boundingBox()
    expect(articleBox!.y, `first result at ${width}px`).toBeLessThan(700)
    if (width >= 768) expect(articleBox!.x).toBeGreaterThan(filterBox!.x + filterBox!.width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}px`).toBe(true)
  }
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '跳到正文' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
})

test('toolbox links open the selected tool and keep the tools navigation active', async ({ page }) => {
  await login(page)
  await navigate(page, '工具')
  const menu = page.getByRole('navigation', { name: '主导航' })
  await expect(menu.getByRole('button', { name: '工具', exact: true })).toHaveAttribute('aria-current', 'page')
  for (const [title, path] of [
    ['生长曲线', 'growth'], ['疫苗接种', 'vaccines'], ['宝宝起名', 'names'], ['每日打卡', 'checkin'],
  ]) {
    await expect(page.getByRole('link', { name: `打开${title}`, exact: true })).toHaveAttribute('href', `/tools/${path}`)
  }
  await page.getByRole('link', { name: '打开生长曲线', exact: true }).click()
  await expect(page).toHaveURL(/\/tools\/growth$/)
  await expect(page.getByRole('heading', { name: '生长曲线', exact: true })).toBeVisible()
  await expect(menu.getByRole('button', { name: '工具', exact: true })).toHaveAttribute('aria-current', 'page')
  await navigate(page, '工具')
  await page.getByRole('link', { name: /查看孕育日历/ }).click()
  await expect(page).toHaveURL(/\/calendar$/)
})
