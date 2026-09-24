// Run against the local H5 server with Playwright available via NODE_PATH.
// The same route matrix is useful before opening the generated mp-weixin package.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')

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
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const errors = []
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.route('https://beihu.me/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 0, data: {} }) }))

    for (const tool of tools) {
      await page.goto(routeFor(tool), { waitUntil: 'domcontentloaded' })
      await page.locator(tool.selector).waitFor({ state: 'visible' })
      assert.match(await page.locator('body').innerText(), new RegExp(tool.title))
      assert.ok(await page.locator('.record-tabs, .name-page').count(), `${tool.id}: missing history/navigation surface`)
      for (const width of [320, 375, 430]) {
        await page.setViewportSize({ width, height: 812 })
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tool.id}: horizontal overflow at ${width}px`)
      }
    }
    assert.deepEqual(errors, [])
    console.log(`PASS tools UI: ${tools.length} routes, title/entry/history surfaces, 320/375/430 widths, no page errors`)
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
