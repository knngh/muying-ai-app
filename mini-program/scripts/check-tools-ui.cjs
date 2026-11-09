// Run against the local H5 server with Playwright available via NODE_PATH.
// The same route matrix is useful before opening the generated mp-weixin package.
const { chromium } = require('playwright')
const { expect } = require('@playwright/test')
const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')

const baseUrl = process.env.BEIHU_H5_URL || 'http://127.0.0.1:5198'
const tools = [
  { id: 'calendar', route: 'tool-detail', title: '孕育日历', selector: '.tool-detail-page' },
  { id: 'contractions', route: 'tool-detail', title: '宫缩计时', selector: '.timer-card' },
  { id: 'movement', route: 'tool-detail', title: '胎动计数', selector: '.counter-card' },
  { id: 'weight', route: 'tool-detail', title: '孕期体重', selector: '.tool-detail-page' },
  { id: 'care', route: 'tool-detail', title: '喂养三件套', selector: '.care-tracker' },
  { id: 'growth', route: 'tool-detail', title: '宝宝生长', selector: '.tool-detail-page' },
  { id: 'packing', route: 'tool-detail', title: '待产包清单', selector: '.packing-groups' },
  { id: 'vaccines', route: 'tool-detail', title: '疫苗时间表', selector: '.tool-detail-page' },
  { id: 'foods', route: 'tool-detail', title: '辅食添加', selector: '.tool-detail-page' },
  { id: 'reports', route: 'tool-detail', title: '产检报告', selector: '.tool-detail-page' },
  { id: 'poster', route: 'tool-detail', title: '孕期海报', selector: '.tool-detail-page' },
  { id: 'diary', route: 'tool-detail', title: '孕育日记', selector: '.diary-journal' },
  { id: 'album', route: 'tool-detail', title: '成长相册', selector: '.tool-detail-page' },
  { id: 'expenses', route: 'tool-detail', title: '孕育记账', selector: '.expense-ledger' },
  { id: 'names', route: 'name-library', title: '宝宝起名', selector: '.name-page' },
]

function routeFor(tool) {
  return tool.route === 'name-library'
    ? `${baseUrl}/#/pages/name-library/index`
    : `${baseUrl}/#/pages/tool-detail/index?id=${tool.id}`
}

;(async () => {
  const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    || (existsSync(localChrome) ? localChrome : undefined)
  const browser = await chromium.launch({ executablePath, headless: true })
  const errors = []
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.route('https://beihu.me/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 0, data: {} }) }))

    await page.goto(`${baseUrl}/#/pages/tools/index`)
    await page.locator('.tool-row').first().waitFor()
    // Seed only this synthetic preference using uni-app H5's number encoding.
    // The production bundle does not expose uni.setStorageSync on window.
    await page.evaluate(() => localStorage.setItem('userPregnancyWeek', JSON.stringify({ type: 'number', data: 38 })))
    await page.reload()
    await expect(page.locator('.stage-label')).toHaveText('孕 38 周')
    await expect(page.locator('.tool-row')).toHaveCount(15)
    await expect(page.locator('.shortcut-button')).toHaveCount(5)
    await page.locator('.filter-button').filter({ hasText: '阶段推荐' }).click()
    await expect(page.locator('.tool-row')).toHaveCount(5)
    await expect(page.locator('.tool-row').filter({ hasText: '宫缩计时' })).toBeVisible()
    await page.locator('.search-input input').fill('喂奶')
    await expect(page.locator('.empty-title')).toBeVisible()
    await page.getByText('查看全部工具', { exact: true }).click()
    await expect(page.locator('.tool-row')).toHaveCount(15)
    await page.locator('.search-input input').fill('喂奶')
    await expect(page.locator('.tool-row')).toHaveCount(1)
    await page.locator('.pin-button').click()
    await expect(page.locator('.shortcut-button').last()).toHaveText('喂养三件套')
    await page.reload()
    await expect(page.locator('.shortcut-button').last()).toHaveText('喂养三件套')
    await page.getByText('管理排序', { exact: true }).click()
    await page.locator('.editor-row').last().getByText('上移', { exact: true }).click()
    await page.getByText('完成', { exact: true }).click()
    await expect(page.locator('.shortcut-button').nth(4)).toHaveText('喂养三件套')
    await page.reload()
    await expect(page.locator('.shortcut-button').nth(4)).toHaveText('喂养三件套')
    for (const width of [320, 375, 430]) {
      await page.setViewportSize({ width, height: 812 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `directory: horizontal overflow at ${width}px`)
    }
    await page.locator('.shortcut-button').filter({ hasText: '喂养三件套' }).click()
    await expect(page.locator('.care-tracker')).toBeVisible()

    for (const tool of tools) {
      // Hash-only navigation reuses onLoad state; each route needs a fresh document.
      await page.goto('about:blank')
      await page.goto(routeFor(tool), { waitUntil: 'domcontentloaded' })
      await page.locator(tool.selector).waitFor({ state: 'visible' })
      assert.ok((await page.locator('body').innerText()).includes(tool.title), `${tool.id}: missing page title`)
      assert.ok(await page.locator('.record-tabs, .name-page').count(), `${tool.id}: missing history/navigation surface`)
      for (const width of [320, 375, 430]) {
        await page.setViewportSize({ width, height: 812 })
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tool.id}: horizontal overflow at ${width}px`)
      }
    }
    assert.deepEqual(errors, [])
    console.log(`PASS tools UI: stage/search filters, shortcuts, add/reorder/reload/navigation; ${tools.length} detail routes, 320/375/430 widths, no page errors`)
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
