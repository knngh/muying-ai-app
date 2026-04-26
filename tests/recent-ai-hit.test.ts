import type { RecentAIHitArticle } from '../shared/types'
import {
  buildRecentAIHitArticle,
  isValidRecentAIHitTimestamp,
  mergeRecentAIHitArticles,
  sanitizeRecentAIHitArticles,
} from '../shared/utils/recent-ai-hit'

describe('recent ai hit helpers', () => {
  test('builds a recent ai hit article with metadata', () => {
    const item = buildRecentAIHitArticle({
      slug: 'pregnancy-fever',
      articleId: 12,
      title: 'Pregnancy Fever Guidance',
      summary: 'Keep hydrated and seek care if symptoms worsen.',
      sourceOrg: 'WHO',
      createdAt: '2026-04-01T00:00:00.000Z',
    }, {
      qaId: 'qa_1',
      trigger: 'hit_card',
    })

    expect(item.slug).toBe('pregnancy-fever')
    expect(item.articleId).toBe(12)
    expect(item.qaId).toBe('qa_1')
    expect(item.trigger).toBe('hit_card')
    expect(item.lastHitAt).toBeTruthy()
  })

  test('validates timestamp retention and future skew', () => {
    const now = Date.parse('2026-04-23T12:00:00.000Z')

    expect(isValidRecentAIHitTimestamp('2026-04-22T12:00:00.000Z', now)).toBe(true)
    expect(isValidRecentAIHitTimestamp('2026-03-01T12:00:00.000Z', now)).toBe(false)
    expect(isValidRecentAIHitTimestamp('2026-04-24T20:00:00.000Z', now)).toBe(false)
  })

  test('sanitizes, deduplicates and sorts recent ai hit articles', () => {
    const now = Date.parse('2026-04-23T12:00:00.000Z')
    const items: RecentAIHitArticle[] = [
      {
        slug: ' fever-guide ',
        articleId: 3,
        title: ' Fever Guide ',
        summary: ' Keep calm ',
        createdAt: '2026-04-01T00:00:00.000Z',
        lastHitAt: '2026-04-23T09:00:00.000Z',
      },
      {
        slug: 'fever-guide',
        articleId: 3,
        title: 'Fever Guide',
        summary: 'Updated summary',
        createdAt: '2026-04-01T00:00:00.000Z',
        lastHitAt: '2026-04-23T10:00:00.000Z',
      },
      {
        slug: 'old-item',
        articleId: 4,
        title: 'Old Item',
        summary: 'Expired',
        createdAt: '2026-04-01T00:00:00.000Z',
        lastHitAt: '2026-03-01T00:00:00.000Z',
      },
    ]

    const sanitized = sanitizeRecentAIHitArticles(items, now)

    expect(sanitized).toHaveLength(1)
    expect(sanitized[0]).toMatchObject({
      slug: 'fever-guide',
      title: 'Fever Guide',
      summary: 'Updated summary',
    })
  })

  test('merges the newest recent hit to the front', () => {
    const existing: RecentAIHitArticle[] = [
      {
        slug: 'older',
        articleId: 1,
        title: 'Older Article',
        summary: 'Older summary',
        createdAt: '2026-04-01T00:00:00.000Z',
        lastHitAt: '2026-04-23T09:00:00.000Z',
      },
    ]
    const next: RecentAIHitArticle = {
      slug: 'newer',
      articleId: 2,
      title: 'Newer Article',
      summary: 'Newer summary',
      createdAt: '2026-04-01T00:00:00.000Z',
      lastHitAt: '2026-04-23T10:00:00.000Z',
    }

    const merged = mergeRecentAIHitArticles(existing, next)

    expect(merged[0].slug).toBe('newer')
    expect(merged[1].slug).toBe('older')
  })
})
