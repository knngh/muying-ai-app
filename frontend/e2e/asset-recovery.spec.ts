import { test, expect } from '@playwright/test'
import { FixtureApi, ARTICLE_TITLE } from './fixtures'

test('a stale route module reloads the destination once and restores article navigation', async ({ context, page }) => {
  const api = new FixtureApi()
  await context.route('**/*', route => api.handle(route))
  let moduleRequests = 0
  await page.route('**/assets/KnowledgeDetail-*.js', async route => {
    moduleRequests += 1
    if (moduleRequests === 1) await route.fulfill({ status: 404, contentType: 'text/html', body: '<html>Old asset removed</html>' })
    else await route.fallback()
  })
  await page.goto('/knowledge')
  await page.getByRole('link', { name: ARTICLE_TITLE, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ARTICLE_TITLE)
  expect(moduleRequests).toBe(2)
  await expect(page.getByRole('heading', { name: '页面出错了', exact: true })).toHaveCount(0)
  expect(api.unknownRequests).toEqual([])
})

test('a persistently unavailable route stops after one automatic reload', async ({ context, page }) => {
  const api = new FixtureApi()
  await context.route('**/*', route => api.handle(route))
  let moduleRequests = 0
  await page.route('**/assets/KnowledgeDetail-*.js', async route => {
    moduleRequests += 1
    await route.fulfill({ status: 404, contentType: 'text/html', body: '<html>Asset unavailable</html>' })
  })
  await page.goto('/knowledge')
  await page.getByRole('link', { name: ARTICLE_TITLE, exact: true }).click()
  await expect(page.getByRole('heading', { name: '页面出错了', exact: true })).toBeVisible()
  expect(moduleRequests).toBe(2)
  await expect(page.getByRole('button', { name: '刷新页面', exact: true })).toBeVisible()
  expect(api.unknownRequests).toEqual([])
})
