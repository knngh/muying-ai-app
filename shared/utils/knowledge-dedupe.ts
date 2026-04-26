import type { Article } from '../types'
import { isChineseKnowledgeSource } from './knowledge-source'

export interface KnowledgeArticleGroup {
  article: Article
  variants: Article[]
  mergedCount: number
}

export interface KnowledgeRepresentativeReason {
  kind: 'summary' | 'recency' | 'priority' | 'default'
  badge: string
  description: string
}

export interface KnowledgeVariantDifference {
  badges: string[]
}

export type KnowledgeVariantFilterMode = 'all' | 'zh' | 'latest'
export type KnowledgeVariantSortMode = 'recommended' | 'recent' | 'zhFirst'

export interface KnowledgeVariantRecommendation {
  article: Article
  actionLabel: string
  description: string
}

export interface KnowledgeVariantFilterFeedback {
  label: string
  description: string
  visibleCount: number
  totalCount: number
  isFiltered: boolean
}

export function getKnowledgeArticlePathname(article: Pick<Article, 'sourceUrl'>): string {
  const url = article.sourceUrl || ''
  if (!url) {
    return ''
  }

  try {
    return new URL(url).pathname.toLowerCase().replace(/\/+$/u, '') || '/'
  } catch {
    return ''
  }
}

export function isKnowledgeLandingLikePath(pathname: string): boolean {
  if (!pathname) {
    return false
  }

  return [
    /^\/$/,
    /^\/topics(?:\/[^/]+)?$/,
    /^\/parents$/,
    /^\/pregnancy$/,
    /^\/breastfeeding$/,
    /^\/contraception$/,
    /^\/child-development$/,
    /^\/conditions(?:\/[^/]+)?$/,
    /^\/english\/(?:ages-stages|health-issues|healthy-living|safety-prevention|family-life)$/,
  ].some((pattern) => pattern.test(pathname))
}

export function normalizeKnowledgeSourceKey(article: Pick<Article, 'sourceOrg' | 'source'>): string {
  return `${article.sourceOrg || ''} ${article.source || ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeKnowledgeTitleKey(article: Pick<Article, 'title'>): string {
  return (article.title || '')
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/[，。；：、]/g, ' ')
    .replace(/[|()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isGenericKnowledgeTitleKey(titleKey: string): boolean {
  if (!titleKey) {
    return true
  }

  const genericTitleKeys = new Set([
    'nutrition',
    'pregnancy',
    'breastfeeding',
    'immunization',
    'vaccines',
    'contraception',
    'child development',
    'parents',
    'participants',
  ])

  return titleKey.length < 8 || genericTitleKeys.has(titleKey)
}

export function buildKnowledgeDedupeKeys(article: Pick<Article, 'slug' | 'sourceUrl' | 'originalId' | 'title' | 'sourceOrg' | 'source'>): string[] {
  const keys = [
    article.slug,
    article.sourceUrl,
    article.originalId ? String(article.originalId) : '',
  ].filter(Boolean) as string[]

  const titleKey = normalizeKnowledgeTitleKey(article)
  const sourceKey = normalizeKnowledgeSourceKey(article)
  if (titleKey && sourceKey && !isGenericKnowledgeTitleKey(titleKey)) {
    keys.push(`title:${sourceKey}:${titleKey}`)
  }

  return Array.from(new Set(keys))
}

export function getKnowledgeArticleTimestamp(article: Pick<Article, 'publishedAt' | 'createdAt'>): number {
  const value = article.publishedAt || article.createdAt
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export function getKnowledgeArticleSummaryLength(article: Pick<Article, 'summary'>): number {
  return (article.summary || '').trim().length
}

export function isChineseKnowledgeVariant(
  article: Pick<Article, 'sourceLanguage' | 'sourceLocale' | 'region' | 'sourceOrg' | 'source' | 'sourceUrl'>,
): boolean {
  return isChineseKnowledgeSource(article)
}

function compareKnowledgeArticles(
  left: Article,
  right: Article,
  getSourcePriority?: (article: Article) => number,
): number {
  const leftSummaryLength = getKnowledgeArticleSummaryLength(left)
  const rightSummaryLength = getKnowledgeArticleSummaryLength(right)
  if (leftSummaryLength !== rightSummaryLength) {
    return rightSummaryLength - leftSummaryLength
  }

  const timestampDiff = getKnowledgeArticleTimestamp(right) - getKnowledgeArticleTimestamp(left)
  if (timestampDiff !== 0) {
    return timestampDiff
  }

  if (getSourcePriority) {
    const sourcePriorityDiff = getSourcePriority(left) - getSourcePriority(right)
    if (sourcePriorityDiff !== 0) {
      return sourcePriorityDiff
    }
  }

  return 0
}

export function pickBetterKnowledgeArticle(
  left: Article,
  right: Article,
  getSourcePriority?: (article: Article) => number,
): Article {
  return compareKnowledgeArticles(left, right, getSourcePriority) > 0 ? right : left
}

export function buildKnowledgeRepresentativeReason(
  article: Article,
  variants: Article[],
  getSourcePriority?: (article: Article) => number,
): KnowledgeRepresentativeReason | null {
  if (variants.length === 0) {
    return null
  }

  const articleSummaryLength = getKnowledgeArticleSummaryLength(article)
  const maxVariantSummaryLength = Math.max(...variants.map((item) => getKnowledgeArticleSummaryLength(item)))
  if (articleSummaryLength > maxVariantSummaryLength) {
    return {
      kind: 'summary',
      badge: '摘要更完整',
      description: '已优先展示摘要更完整的版本，便于先读重点。',
    }
  }

  const articleTimestamp = getKnowledgeArticleTimestamp(article)
  const maxVariantTimestamp = Math.max(...variants.map((item) => getKnowledgeArticleTimestamp(item)))
  if (articleTimestamp > maxVariantTimestamp) {
    return {
      kind: 'recency',
      badge: '最近更新',
      description: '已优先展示最近更新的版本，降低读到旧信息的概率。',
    }
  }

  if (getSourcePriority) {
    const articlePriority = getSourcePriority(article)
    const bestVariantPriority = Math.min(...variants.map((item) => getSourcePriority(item)))
    if (articlePriority < bestVariantPriority) {
      return {
        kind: 'priority',
        badge: '来源优先',
        description: '已优先展示来源优先级更高的版本，方便先看更稳定的公开口径。',
      }
    }
  }

  return {
    kind: 'default',
    badge: '当前代表版本',
    description: '已优先展示当前代表版本，可展开查看其他同源版本。',
  }
}

export function buildKnowledgeVariantDifference(
  representative: Article,
  variant: Article,
  getSourcePriority?: (article: Article) => number,
): KnowledgeVariantDifference {
  const badges: string[] = []
  const representativeSummaryLength = getKnowledgeArticleSummaryLength(representative)
  const variantSummaryLength = getKnowledgeArticleSummaryLength(variant)
  const representativeTimestamp = getKnowledgeArticleTimestamp(representative)
  const variantTimestamp = getKnowledgeArticleTimestamp(variant)

  if (variantSummaryLength < representativeSummaryLength) {
    badges.push('摘要更短')
  }

  if (variantTimestamp > 0 && representativeTimestamp > 0 && variantTimestamp < representativeTimestamp) {
    badges.push('更新更早')
  }

  if (getSourcePriority) {
    const representativePriority = getSourcePriority(representative)
    const variantPriority = getSourcePriority(variant)
    if (variantPriority > representativePriority) {
      badges.push('来源次优先')
    }
  }

  if (badges.length === 0) {
    badges.push('补充版本')
  }

  return { badges }
}

export function buildKnowledgeVariantRecommendation(
  representative: Article,
  variants: Article[],
): KnowledgeVariantRecommendation | null {
  if (variants.length === 0) {
    return null
  }

  const chineseVariants = variants
    .filter((variant) => isChineseKnowledgeVariant(variant))
    .map((article, index) => ({ article, index }))
    .sort((left, right) => (
      compareKnowledgeArticles(left.article, right.article)
      || left.index - right.index
    ))

  if (!isChineseKnowledgeVariant(representative) && chineseVariants[0]?.article) {
    return {
      article: chineseVariants[0].article,
      actionLabel: '优先看中文版本',
      description: '如果想先快速读懂，可直接切到中文源版本。',
    }
  }

  const representativeTimestamp = getKnowledgeArticleTimestamp(representative)
  const newerVariants = variants
    .filter((variant) => getKnowledgeArticleTimestamp(variant) > representativeTimestamp)
    .map((article, index) => ({ article, index }))
    .sort((left, right) => (
      getKnowledgeArticleTimestamp(right.article) - getKnowledgeArticleTimestamp(left.article)
      || compareKnowledgeArticles(left.article, right.article)
      || left.index - right.index
    ))

  if (newerVariants[0]?.article) {
    return {
      article: newerVariants[0].article,
      actionLabel: '切到最近版本',
      description: '如果更关注时效，可直接切到最近更新的版本。',
    }
  }

  return null
}

export function filterKnowledgeVariants(
  representative: Article,
  variants: Article[],
  mode: KnowledgeVariantFilterMode,
): Article[] {
  if (mode === 'all') {
    return variants
  }

  if (mode === 'zh') {
    return variants.filter((variant) => isChineseKnowledgeVariant(variant))
  }

  const rankedByRecency = variants
    .map((article, index) => ({ article, index }))
    .sort((left, right) => (
      getKnowledgeArticleTimestamp(right.article) - getKnowledgeArticleTimestamp(left.article)
      || compareKnowledgeArticles(left.article, right.article)
      || left.index - right.index
    ))

  const latestVariant = rankedByRecency[0]?.article
  if (!latestVariant) {
    return []
  }

  if (getKnowledgeArticleTimestamp(latestVariant) > getKnowledgeArticleTimestamp(representative)) {
    return [latestVariant]
  }

  return [latestVariant]
}

export function sortKnowledgeVariants(
  variants: Article[],
  mode: KnowledgeVariantSortMode,
  getSourcePriority?: (article: Article) => number,
): Article[] {
  return variants
    .map((article, index) => ({ article, index }))
    .sort((left, right) => {
      if (mode === 'recent') {
        return (
          getKnowledgeArticleTimestamp(right.article) - getKnowledgeArticleTimestamp(left.article)
          || compareKnowledgeArticles(left.article, right.article, getSourcePriority)
          || left.index - right.index
        )
      }

      if (mode === 'zhFirst') {
        return (
          Number(isChineseKnowledgeVariant(right.article)) - Number(isChineseKnowledgeVariant(left.article))
          || compareKnowledgeArticles(left.article, right.article, getSourcePriority)
          || left.index - right.index
        )
      }

      return compareKnowledgeArticles(left.article, right.article, getSourcePriority) || left.index - right.index
    })
    .map(({ article }) => article)
}

export function buildKnowledgeVariantFilterFeedback(
  representative: Article,
  variants: Article[],
  mode: KnowledgeVariantFilterMode,
): KnowledgeVariantFilterFeedback | null {
  if (variants.length === 0) {
    return null
  }

  const visibleCount = filterKnowledgeVariants(representative, variants, mode).length
  const totalCount = variants.length

  if (mode === 'zh') {
    return {
      label: '仅中文源',
      description: visibleCount > 0
        ? `当前保留 ${visibleCount} / ${totalCount} 个中文源版本。`
        : `当前没有中文源版本，可切回全部版本继续查看。`,
      visibleCount,
      totalCount,
      isFiltered: true,
    }
  }

  if (mode === 'latest') {
    return {
      label: '最近版本',
      description: `当前保留 ${visibleCount} / ${totalCount} 个最近版本结果。`,
      visibleCount,
      totalCount,
      isFiltered: true,
    }
  }

  return {
    label: '全部版本',
    description: `当前展示 ${visibleCount} / ${totalCount} 个同源版本。`,
    visibleCount,
    totalCount,
    isFiltered: false,
  }
}

export function groupKnowledgeArticles(
  list: Article[],
  getSourcePriority?: (article: Article) => number,
): KnowledgeArticleGroup[] {
  const keyToGroupId = new Map<string, number>()
  const groups = new Map<number, {
    articles: Article[]
    keys: Set<string>
    firstIndex: number
  }>()
  let nextGroupId = 0

  list.forEach((article, index) => {
    const keys = buildKnowledgeDedupeKeys(article)
    const matchedGroupIds = Array.from(new Set(
      keys
        .map((key) => keyToGroupId.get(key))
        .filter((groupId): groupId is number => groupId !== undefined),
    ))
    const targetGroupId = matchedGroupIds
      .slice()
      .sort((left, right) => {
        const leftIndex = groups.get(left)?.firstIndex ?? Number.MAX_SAFE_INTEGER
        const rightIndex = groups.get(right)?.firstIndex ?? Number.MAX_SAFE_INTEGER
        return leftIndex - rightIndex || left - right
      })[0]

    if (targetGroupId === undefined) {
      const groupId = nextGroupId
      nextGroupId += 1
      groups.set(groupId, {
        articles: [article],
        keys: new Set(keys),
        firstIndex: index,
      })
      keys.forEach((key) => keyToGroupId.set(key, groupId))
      return
    }

    const targetGroup = groups.get(targetGroupId)
    if (!targetGroup) {
      return
    }

    targetGroup.articles.push(article)
    targetGroup.firstIndex = Math.min(targetGroup.firstIndex, index)
    keys.forEach((key) => targetGroup.keys.add(key))

    matchedGroupIds
      .filter((groupId) => groupId !== targetGroupId)
      .forEach((groupId) => {
        const group = groups.get(groupId)
        if (!group) {
          return
        }

        targetGroup.articles.push(...group.articles)
        group.keys.forEach((key) => targetGroup.keys.add(key))
        targetGroup.firstIndex = Math.min(targetGroup.firstIndex, group.firstIndex)
        groups.delete(groupId)
      })

    targetGroup.keys.forEach((key) => keyToGroupId.set(key, targetGroupId))
  })

  return Array.from(groups.values())
    .sort((left, right) => left.firstIndex - right.firstIndex)
    .map((group) => {
      const rankedArticles = group.articles
        .map((article, index) => ({ article, index }))
        .sort((left, right) => (
          compareKnowledgeArticles(left.article, right.article, getSourcePriority)
          || left.index - right.index
        ))
      const article = rankedArticles[0]?.article

      if (!article) {
        return null
      }

      return {
        article,
        variants: rankedArticles.slice(1).map((item) => item.article),
        mergedCount: Math.max(rankedArticles.length - 1, 0),
      }
    })
    .filter((group): group is KnowledgeArticleGroup => Boolean(group))
}

export function dedupeKnowledgeArticles(
  list: Article[],
  getSourcePriority?: (article: Article) => number,
): Article[] {
  return groupKnowledgeArticles(list, getSourcePriority).map((group) => group.article)
}
