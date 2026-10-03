// Run with the H5 server on 5199 and VITE_TOOL_AI_ENABLED=true.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
  const errors = []
  const requests = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://beihu.me/**', async route => {
    if (route.request().url().includes('/expense-candidates')) {
      requests.push(route.request().postDataJSON())
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: { source: 'ai', candidates: [
          { id: 'fragment_0', fragment: '奶粉 268', amountCents: 26800, direction: 'expense', category: 'feeding', date: null, status: 'review', warnings: [] },
          { id: 'fragment_1', fragment: '尿布 89', amountCents: 8900, direction: 'expense', category: 'supplies', date: null, status: 'review', warnings: [] },
        ] } }),
      })
      return
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 0, data: {} }) })
  })
  try {
    await page.goto('http://127.0.0.1:5199/#/pages/tool-detail/index?id=expenses')
    await page.locator('.expense-ledger').waitFor()
    await page.locator('.expense-ledger').evaluate(element => {
      uni.setStorageSync('token', 'synthetic-token')
      uni.setStorageSync('user', { id: 990001 })
      let component = element.__vueParentComponent
      while (component && !('reportScope' in component.setupState)) component = component.parent
      component.setupState.reportScope = '990001'
    })
    const card = page.locator('.expense-candidates')
    await card.locator('textarea').fill('奶粉 268，尿布 89')
    await card.locator('uni-checkbox').click()
    await card.locator('.candidate-submit').click()
    await page.locator('.candidate-row').nth(1).waitFor()
    assert.equal(requests.length, 1)
    assert.equal(requests[0].text, '奶粉 268，尿布 89')
    await page.locator('.candidate-row').first().locator('uni-picker').evaluate(element => element.__vueParentComponent.emit('change', { detail: { value: '2026-09-23' } }))
    await page.locator('.candidate-row').first().locator('.candidate-amount input').fill('268.50')
    await page.locator('.candidate-row').first().locator('.candidate-save').click()
    await page.waitForTimeout(200)
    assert.match(await card.innerText(), /已写入月账|已保存/)
    assert.deepEqual(errors, [])
    console.log('PASS mocked expense candidate UI: consent, exact input, multi-candidate edit, date, save, no page errors')
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
