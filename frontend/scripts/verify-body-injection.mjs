// 本地验证：文章页正文注入 + React 接管无运行时错误
// 用法：node scripts/verify-body-injection.mjs [baseURL]（默认 http://127.0.0.1:8787）
import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'

const baseURL = process.argv[2] || 'http://127.0.0.1:8787'
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync(localChrome) ? localChrome : undefined),
})
const page = await browser.newPage({ baseURL })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const resp = await page.goto('/knowledge/authority-acog-1d0xzj')
console.log('HTTP', resp.status())
await page.locator('#root').waitFor()
await page.waitForTimeout(2500) // 等 SPA 接管清空注入内容并渲染
const h1 = await page.locator('h1').count()
const injectedArticle = await page.locator('#root > article').count() // React 接管后应为 0
const bodyText = (await page.locator('body').innerText()).slice(0, 80).replace(/\n/g, ' ')
console.log('h1:', h1, '| injected article left:', injectedArticle)
console.log('body:', bodyText)
console.log('pageerrors:', JSON.stringify(errors))
await browser.close()
if (errors.length > 0) process.exit(1)
console.log('OK')
