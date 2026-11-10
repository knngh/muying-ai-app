import { test, expect, login, navigate } from './fixtures'

const advice = `# 喂养观察建议

这是一段用于验证阅读排版的测试回答，不能作为医疗建议。**请记录观察结果**，并咨询医生。
第二行应自然换行显示。

## 可以记录的项目

1. 记录喂养时间。
2. 记录尿布变化。
   - 保留原始记录。

> 如果出现危险信号，请立即就医。

| 项目 | 说明 |
| --- | --- |
| 测试记录 | ${'abcdefghijklmnop'.repeat(12)} |

[参考资料](https://example.org/guide)

\`\`\`text
${'long-code-'.repeat(30)}
\`\`\``

for (const width of [320, 375, 768, 1440]) {
  test(`AI 回答在 ${width}px 保留阅读层次且长表格不撑开页面`, async ({ page, api }) => {
    await page.setViewportSize({ width, height: 1000 })
    api.chatMessages = [{
      id: 'assistant-layout', role: 'assistant', content: advice, createdAt: '2026-09-28T12:00:00Z',
      isEmergency: true, riskLevel: 'red', sourceReliability: 'authoritative', route: 'emergency',
      structuredAnswer: {
        conclusion: '请记录观察结果', reasons: [],
        actions: ['记录喂养时间。', '记录尿布变化。', '补充建议：带上既往病历。', '保留全部第四条建议。'],
        whenToSeekCare: ['如有呼吸困难，请立即就医。'],
      },
      sources: [
        { title: '一条很长的参考来源标题'.repeat(8), url: 'https://example.org/guide', source: '测试来源', sourceType: 'authority', relevance: 1 },
        { title: '不安全的来源链接', url: 'javascript:alert(1)', source: '测试来源', relevance: 1 },
      ],
    }]
    await login(page)
    await navigate(page, 'AI问答')
    const answer = page.getByRole('article').filter({ hasText: '喂养观察建议' })
    await expect(answer).toBeVisible()
    await expect(answer.getByRole('heading', { name: '喂养观察建议' })).toBeVisible()
    await expect(answer.getByText('保留全部第四条建议。', { exact: true })).toBeVisible()
    await expect(answer.getByText('如有呼吸困难，请立即就医。', { exact: true })).toBeVisible()
    await expect(answer.getByText('紧急规则', { exact: true })).toBeVisible()
    await expect(answer.getByText('命中权威来源 1 条', { exact: true })).toBeVisible()
    await expect(answer.getByText('记录喂养时间。', { exact: true })).toHaveCount(1)
    await expect(answer.getByRole('link', { name: '参考资料', exact: true })).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(answer.getByRole('link', { name: '不安全的来源链接' })).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: '输入问题' })).toBeVisible()
    const metrics = await answer.evaluate((element) => {
      const paragraph = element.querySelector('p')!
      const list = element.querySelector('ol')!
      const table = element.querySelector('table')!
      return {
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
        paragraphMargin: parseFloat(getComputedStyle(paragraph).marginBottom),
        lineHeight: parseFloat(getComputedStyle(paragraph).lineHeight),
        listStyle: getComputedStyle(list).listStyleType,
        tableScroll: getComputedStyle(table.parentElement!).overflowX,
      }
    })
    expect(metrics.pageOverflow).toBe(false)
    expect(metrics.paragraphMargin).toBeGreaterThanOrEqual(12)
    expect(metrics.lineHeight).toBeGreaterThanOrEqual(26)
    expect(metrics.listStyle).toBe('decimal')
    expect(metrics.tableScroll).toBe('auto')
  })
}
