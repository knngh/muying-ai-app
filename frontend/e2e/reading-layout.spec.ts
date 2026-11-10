import { test, expect, ARTICLE_TITLE } from './fixtures'

test('verified reading layout displays headings and a working outline on mobile and desktop', async ({ page, api }) => {
  api.readingLayout = { verified: true, html: '<h2>辅食添加原则</h2><p>孩子满6月龄后，逐步添加多样化食物。</p><h2>日常观察</h2><p>继续记录宝宝的进食情况。</p>' }
  await page.goto('/knowledge')
  await page.getByRole('link', { name: ARTICLE_TITLE, exact: true }).click()
  const content = page.locator('.article-content')
  await expect(content.getByRole('heading', { name: '辅食添加原则' })).toBeVisible()
  await expect(content.getByText('孩子满6月龄后，逐步添加多样化食物。')).toBeVisible()
  const outline = page.getByRole('button', { name: /章节.*日常观察/ })
  await expect(outline).not.toBeVisible()
  await page.getByText('正文目录', { exact: true }).click()
  await expect(outline).toBeVisible()
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await page.locator('article').boundingBox())!.width).toBeLessThanOrEqual(880)
  }
  await outline.click()
  await expect(content.getByRole('heading', { name: '日常观察' })).toBeInViewport()
})
