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
