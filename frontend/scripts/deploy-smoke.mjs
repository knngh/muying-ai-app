import assert from 'node:assert/strict'
import process from 'node:process'
import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'

const baseURL = process.env.WEB_SMOKE_BASE_URL
const expectedCommit = process.env.WEB_EXPECTED_COMMIT
if (!baseURL || !expectedCommit) throw new Error('Set WEB_SMOKE_BASE_URL and WEB_EXPECTED_COMMIT')
const versionResponse = await fetch(new URL('/version.json', baseURL), { cache: 'no-store' })
assert.ok(versionResponse.ok)
assert.match(versionResponse.headers.get('content-type') || '', /json/)
const version = await versionResponse.json()
assert.equal(version.commit, expectedCommit, 'Published commit differs from the expected commit')
assert.equal(version.dirty, false, 'Only a clean, committed build may be released')

const api = await fetch(new URL('/api/v1/articles?contentType=authority&pageSize=2&sort=recommended', baseURL))
assert.ok(api.ok)
assert.match(api.headers.get('content-type') || '', /json/, 'API must not fall back to SPA HTML')
const articles = await api.json()
assert.equal(articles.code, 0)
assert.equal(articles.data.pagination.pageSize, 2)
assert.ok(articles.data.list.length <= 2)
const protectedApi = await fetch(new URL('/api/v1/auth/me', baseURL))
assert.equal(protectedApi.status, 401)
assert.match(protectedApi.headers.get('cache-control') || '', /no-store/)
const sw = await fetch(new URL('/notifications-sw.js', baseURL))
assert.ok(sw.ok)
assert.match(sw.headers.get('content-type') || '', /javascript/)

// SEO 基建：robots / llms.txt / sitemap / 文章页 meta 注入
const robots = await fetch(new URL('/robots.txt', baseURL))
assert.ok(robots.ok, '/robots.txt must be served')
assert.match(await robots.text(), /Sitemap: https:\/\/hibeihu\.com\/sitemap\.xml/)
const llms = await fetch(new URL('/llms.txt', baseURL))
assert.ok(llms.ok, '/llms.txt must be served')
const llmsBody = await llms.text()
assert.match(llmsBody, /贝护妈妈/)
assert.match(llmsBody, /精选中文文章/, 'llms.txt must list curated Chinese articles')
assert.match(llmsBody, /\[.*\]\(https:\/\/hibeihu\.com\/knowledge\//, 'llms.txt must include article links')
const sitemap = await fetch(new URL('/sitemap.xml', baseURL))
assert.ok(sitemap.ok, '/sitemap.xml must be served')
assert.match(sitemap.headers.get('content-type') || '', /xml/)
const sitemapBody = await sitemap.text()
assert.match(sitemapBody, /<urlset/, 'sitemap must be valid XML urlset')
assert.ok(sitemapBody.includes('/knowledge</loc>'), 'sitemap must list /knowledge')
const firstSlug = articles.data.list[0]?.slug
if (firstSlug) {
  const article = await fetch(new URL(`/knowledge/${firstSlug}`, baseURL))
  assert.ok(article.ok, '/knowledge/:slug must return HTML')
  const html = await article.text()
  assert.match(html, /rel="canonical" href="https:\/\/hibeihu\.com\/knowledge\//, 'article page must have canonical')
  assert.match(html, /application\/ld\+json/, 'article page must have JSON-LD')
  // GEO：正文必须进 HTML（AI 爬虫不执行 JS）
  const articleBlock = html.match(/<article>[\s\S]*?<\/article>/)
  assert.ok(articleBlock, 'article page must embed <article> body block')
  assert.ok(articleBlock[0].length > 1500, 'embedded article body must be substantial (>1.5KB)')
  assert.match(articleBlock[0], /<h1>/, 'article body must have heading')
}

const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync(localChrome) ? localChrome : undefined),
})
const pageErrors = []
try {
  const page = await browser.newPage({ baseURL })
  page.on('pageerror', error => pageErrors.push(error.message))
  for (const path of ['/login', '/knowledge', '/tools/growth']) {
    const response = await page.goto(path)
    assert.ok(response.ok(), `${path}: deep link must return HTML`)
    await page.locator('#root').waitFor()
    await page.getByRole('heading').first().waitFor()
    console.log(`PASS ${path}`)
  }
  assert.deepEqual(pageErrors, [], 'No browser runtime errors')
} finally { await browser.close() }
console.log(JSON.stringify({ url: baseURL, version, apiProxy: 'ok', deepLinks: 'ok', notificationWorker: 'ok' }, null, 2))
