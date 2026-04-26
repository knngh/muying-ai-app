import type { Article } from '../shared/types'
import {
  buildKnowledgeVariantFilterFeedback,
  buildKnowledgeVariantRecommendation,
  buildKnowledgeVariantDifference,
  buildKnowledgeRepresentativeReason,
  buildKnowledgeDedupeKeys,
  dedupeKnowledgeArticles,
  filterKnowledgeVariants,
  getKnowledgeArticlePathname,
  groupKnowledgeArticles,
  isChineseKnowledgeVariant,
  isGenericKnowledgeTitleKey,
  isKnowledgeLandingLikePath,
  normalizeKnowledgeSourceKey,
  normalizeKnowledgeTitleKey,
  sortKnowledgeVariants,
} from '../shared/utils/knowledge-dedupe'

function createArticle(overrides: Partial<Article>): Article {
  return {
    id: overrides.id || 1,
    title: overrides.title || 'Fever in pregnancy',
    slug: overrides.slug || 'fever-in-pregnancy',
    summary: overrides.summary || 'summary',
    content: overrides.content || 'content',
    categoryId: overrides.categoryId || 1,
    viewCount: overrides.viewCount || 0,
    likeCount: overrides.likeCount || 0,
    collectCount: overrides.collectCount || 0,
    status: overrides.status || 1,
    createdAt: overrides.createdAt || '2026-04-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('knowledge dedupe helpers', () => {
  test('normalizes pathname, title and source keys', () => {
    const article = createArticle({
      title: '“Fever” in Pregnancy',
      sourceOrg: ' WHO ',
      source: ' Parents ',
      sourceUrl: 'https://example.com/topics/fever/',
    })

    expect(getKnowledgeArticlePathname(article)).toBe('/topics/fever')
    expect(normalizeKnowledgeTitleKey(article)).toBe('fever in pregnancy')
    expect(normalizeKnowledgeSourceKey(article)).toBe('who parents')
  })

  test('detects generic titles and landing-like paths', () => {
    expect(isGenericKnowledgeTitleKey('pregnancy')).toBe(true)
    expect(isGenericKnowledgeTitleKey('fever in pregnancy')).toBe(false)
    expect(isKnowledgeLandingLikePath('/topics')).toBe(true)
    expect(isKnowledgeLandingLikePath('/health/fever')).toBe(false)
  })

  test('builds composite dedupe keys for non-generic titles', () => {
    const article = createArticle({
      title: 'Fever in pregnancy',
      sourceOrg: 'WHO',
      sourceUrl: 'https://example.com/fever',
      originalId: 'abc-1',
    })

    expect(buildKnowledgeDedupeKeys(article)).toContain('title:who:Fever in pregnancy'.toLowerCase())
  })

  test('dedupes equivalent articles and keeps the better one', () => {
    const older = createArticle({
      id: 1,
      slug: 'article-a',
      title: 'Fever in pregnancy',
      sourceOrg: 'WHO',
      summary: 'short',
      sourceUrl: 'https://example.com/fever',
      createdAt: '2026-04-01T00:00:00.000Z',
    })
    const newerBetter = createArticle({
      id: 2,
      slug: 'article-b',
      title: 'Fever in pregnancy',
      sourceOrg: 'WHO',
      summary: 'much longer summary content for selection',
      sourceUrl: 'https://example.com/another-fever',
      createdAt: '2026-04-02T00:00:00.000Z',
    })

    const deduped = dedupeKnowledgeArticles([older, newerBetter])

    expect(deduped).toHaveLength(1)
    expect(deduped[0].id).toBe(2)
  })

  test('groups merged variants and keeps them sorted by reading quality', () => {
    const older = createArticle({
      id: 1,
      slug: 'article-a',
      title: 'Fever in pregnancy',
      sourceOrg: 'WHO',
      summary: 'short',
      sourceUrl: 'https://example.com/fever',
      createdAt: '2026-04-01T00:00:00.000Z',
    })
    const newerBetter = createArticle({
      id: 2,
      slug: 'article-b',
      title: 'Fever in pregnancy',
      sourceOrg: 'WHO',
      summary: 'much longer summary content for selection',
      sourceUrl: 'https://example.com/another-fever',
      createdAt: '2026-04-02T00:00:00.000Z',
    })
    const newerShorter = createArticle({
      id: 3,
      slug: 'article-c',
      title: 'Fever in pregnancy',
      sourceOrg: 'WHO',
      summary: 'mid length summary',
      sourceUrl: 'https://example.com/third-fever',
      createdAt: '2026-04-03T00:00:00.000Z',
    })

    const groups = groupKnowledgeArticles([older, newerBetter, newerShorter])

    expect(groups).toHaveLength(1)
    expect(groups[0].article.id).toBe(2)
    expect(groups[0].mergedCount).toBe(2)
    expect(groups[0].variants.map((item) => item.id)).toEqual([3, 1])
    expect(buildKnowledgeRepresentativeReason(groups[0].article, groups[0].variants)).toMatchObject({
      kind: 'summary',
      badge: '摘要更完整',
    })
  })

  test('keeps singleton articles as standalone groups', () => {
    const fever = createArticle({
      id: 1,
      slug: 'fever',
      title: 'Fever in pregnancy',
      sourceOrg: 'WHO',
      sourceUrl: 'https://example.com/fever',
    })
    const jaundice = createArticle({
      id: 2,
      slug: 'jaundice',
      title: 'Newborn jaundice',
      sourceOrg: 'AAP',
      sourceUrl: 'https://example.com/jaundice',
    })

    const groups = groupKnowledgeArticles([fever, jaundice])

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ article: fever, variants: [], mergedCount: 0 })
    expect(groups[1]).toMatchObject({ article: jaundice, variants: [], mergedCount: 0 })
  })

  test('explains when representative article wins by recency', () => {
    const older = createArticle({
      id: 1,
      slug: 'article-a',
      title: 'Fever in pregnancy',
      sourceOrg: 'WHO',
      summary: 'same summary',
      sourceUrl: 'https://example.com/fever',
      createdAt: '2026-04-01T00:00:00.000Z',
    })
    const newer = createArticle({
      id: 2,
      slug: 'article-b',
      title: 'Fever in pregnancy',
      sourceOrg: 'WHO',
      summary: 'same summary',
      sourceUrl: 'https://example.com/another-fever',
      createdAt: '2026-04-02T00:00:00.000Z',
    })

    const groups = groupKnowledgeArticles([older, newer])
    const reason = buildKnowledgeRepresentativeReason(groups[0].article, groups[0].variants)

    expect(reason).toMatchObject({
      kind: 'recency',
      badge: '最近更新',
    })
  })

  test('builds badges for how a variant differs from representative article', () => {
    const representative = createArticle({
      id: 2,
      slug: 'article-b',
      title: 'Fever in pregnancy',
      sourceOrg: 'WHO',
      summary: 'much longer summary content for selection',
      sourceUrl: 'https://example.com/another-fever',
      createdAt: '2026-04-02T00:00:00.000Z',
    })
    const variant = createArticle({
      id: 1,
      slug: 'article-a',
      title: 'Fever in pregnancy',
      sourceOrg: 'WHO',
      summary: 'short',
      sourceUrl: 'https://example.com/fever',
      createdAt: '2026-04-01T00:00:00.000Z',
    })

    expect(buildKnowledgeVariantDifference(representative, variant).badges).toEqual(['摘要更短', '更新更早'])
    expect(buildKnowledgeVariantDifference(representative, representative).badges).toEqual(['补充版本'])
  })

  test('filters variants by source language and recency', () => {
    const representative = createArticle({
      id: 3,
      slug: 'article-c',
      summary: 'longest summary',
      sourceLanguage: 'en',
      sourceLocale: 'en-US',
      createdAt: '2026-04-03T00:00:00.000Z',
    })
    const zhVariant = createArticle({
      id: 1,
      slug: 'article-a',
      summary: 'short',
      sourceLanguage: 'zh',
      sourceLocale: 'zh-CN',
      createdAt: '2026-04-01T00:00:00.000Z',
    })
    const newerVariant = createArticle({
      id: 2,
      slug: 'article-b',
      summary: 'mid',
      sourceLanguage: 'en',
      sourceLocale: 'en-US',
      createdAt: '2026-04-02T00:00:00.000Z',
    })

    expect(isChineseKnowledgeVariant(zhVariant)).toBe(true)
    expect(isChineseKnowledgeVariant(createArticle({
      sourceOrg: '国家疾控局',
      sourceUrl: 'https://www.ndcpa.gov.cn/',
    }))).toBe(true)
    expect(filterKnowledgeVariants(representative, [zhVariant, newerVariant], 'zh').map((item) => item.id)).toEqual([1])
    expect(filterKnowledgeVariants(representative, [zhVariant, newerVariant], 'latest').map((item) => item.id)).toEqual([2])
  })

  test('sorts visible variants by recent update and chinese priority', () => {
    const zhVariant = createArticle({
      id: 1,
      slug: 'article-a',
      summary: 'short',
      sourceLanguage: 'zh',
      sourceLocale: 'zh-CN',
      createdAt: '2026-04-01T00:00:00.000Z',
    })
    const newerVariant = createArticle({
      id: 2,
      slug: 'article-b',
      summary: 'mid',
      sourceLanguage: 'en',
      sourceLocale: 'en-US',
      createdAt: '2026-04-04T00:00:00.000Z',
    })
    const longerVariant = createArticle({
      id: 3,
      slug: 'article-c',
      summary: 'much longer summary content',
      sourceLanguage: 'en',
      sourceLocale: 'en-US',
      createdAt: '2026-04-02T00:00:00.000Z',
    })

    expect(sortKnowledgeVariants([zhVariant, newerVariant, longerVariant], 'recent').map((item) => item.id)).toEqual([2, 3, 1])
    expect(sortKnowledgeVariants([zhVariant, newerVariant, longerVariant], 'zhFirst').map((item) => item.id)).toEqual([1, 3, 2])
  })

  test('recommends a chinese version before newer foreign variants', () => {
    const representative = createArticle({
      id: 3,
      slug: 'article-c',
      sourceLanguage: 'en',
      sourceLocale: 'en-US',
      createdAt: '2026-04-03T00:00:00.000Z',
      summary: 'longest summary',
    })
    const zhVariant = createArticle({
      id: 1,
      slug: 'article-a',
      sourceLanguage: 'zh',
      sourceLocale: 'zh-CN',
      createdAt: '2026-04-01T00:00:00.000Z',
      summary: 'short',
    })
    const newerVariant = createArticle({
      id: 2,
      slug: 'article-b',
      sourceLanguage: 'en',
      sourceLocale: 'en-US',
      createdAt: '2026-04-04T00:00:00.000Z',
      summary: 'mid',
    })

    expect(buildKnowledgeVariantRecommendation(representative, [zhVariant, newerVariant])).toMatchObject({
      article: zhVariant,
      actionLabel: '优先看中文版本',
    })
  })

  test('recommends the latest variant when no chinese alternative exists', () => {
    const representative = createArticle({
      id: 1,
      slug: 'article-a',
      sourceLanguage: 'zh',
      sourceLocale: 'zh-CN',
      createdAt: '2026-04-01T00:00:00.000Z',
      summary: 'same summary',
    })
    const newerVariant = createArticle({
      id: 2,
      slug: 'article-b',
      sourceLanguage: 'en',
      sourceLocale: 'en-US',
      createdAt: '2026-04-03T00:00:00.000Z',
      summary: 'same summary',
    })

    expect(buildKnowledgeVariantRecommendation(representative, [newerVariant])).toMatchObject({
      article: newerVariant,
      actionLabel: '切到最近版本',
    })
  })

  test('builds visible-count feedback for variant filters', () => {
    const representative = createArticle({
      id: 3,
      slug: 'article-c',
      sourceLanguage: 'en',
      sourceLocale: 'en-US',
      createdAt: '2026-04-03T00:00:00.000Z',
    })
    const zhVariant = createArticle({
      id: 1,
      slug: 'article-a',
      sourceLanguage: 'zh',
      sourceLocale: 'zh-CN',
      createdAt: '2026-04-01T00:00:00.000Z',
    })
    const newerVariant = createArticle({
      id: 2,
      slug: 'article-b',
      sourceLanguage: 'en',
      sourceLocale: 'en-US',
      createdAt: '2026-04-04T00:00:00.000Z',
    })

    expect(buildKnowledgeVariantFilterFeedback(representative, [zhVariant, newerVariant], 'all')).toMatchObject({
      label: '全部版本',
      visibleCount: 2,
      totalCount: 2,
      isFiltered: false,
    })
    expect(buildKnowledgeVariantFilterFeedback(representative, [zhVariant, newerVariant], 'zh')).toMatchObject({
      label: '仅中文源',
      visibleCount: 1,
      totalCount: 2,
      isFiltered: true,
    })
    expect(buildKnowledgeVariantFilterFeedback(representative, [zhVariant, newerVariant], 'latest')).toMatchObject({
      label: '最近版本',
      visibleCount: 1,
      totalCount: 2,
      isFiltered: true,
    })
  })
})
