import { defineStore } from 'pinia'
import { articleApi } from '@/api/modules'
import type { Article, AuthorityArticleTranslation, PaginatedResponse } from '@/api/modules'
import { getAuthorityRegionPriority } from '@/utils/authority-source'

const TRANSLATION_CACHE_STORAGE_KEY = 'knowledgeTranslationCache'
const MAX_PERSISTED_TRANSLATIONS = 12
const translationInFlight = new Map<string, Promise<AuthorityArticleTranslation>>()

function loadPersistedTranslations() {
  const stored = uni.getStorageSync(TRANSLATION_CACHE_STORAGE_KEY) as Array<{ slug: string; translation: AuthorityArticleTranslation }> | null
  if (!Array.isArray(stored)) {
    return {
      cache: {} as Record<string, AuthorityArticleTranslation>,
      order: [] as string[],
    }
  }

  const cache: Record<string, AuthorityArticleTranslation> = {}
  const order: string[] = []
  stored.forEach((item) => {
    if (!item?.slug || !item?.translation) {
      return
    }
    cache[item.slug] = item.translation
    order.push(item.slug)
  })

  return { cache, order }
}

const persistedTranslations = loadPersistedTranslations()

function getArticleTimestamp(article: Article): number {
  const value = article.publishedAt || article.createdAt
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function getArticleDateBucket(article: Article): string {
  const value = article.publishedAt || article.createdAt
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toISOString().slice(0, 10)
}

function getSourcePriority(article: Article): number {
  return getAuthorityRegionPriority(article)
}

function getKnowledgeArticlePathname(article: Article): string {
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

function isKnowledgeLandingLikePath(pathname: string): boolean {
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
  ].some(pattern => pattern.test(pathname))
}

function normalizeKnowledgeSourceKey(article: Article): string {
  return `${article.sourceOrg || ''} ${article.source || ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeKnowledgeTitleKey(article: Article): string {
  return (article.title || '')
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/[，。；：、]/g, ' ')
    .replace(/[|()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildKnowledgeDedupeKeys(article: Article): string[] {
  const keys = [article.slug].filter(Boolean)
  const sourceKey = normalizeKnowledgeSourceKey(article)
  const titleKey = normalizeKnowledgeTitleKey(article)

  if (sourceKey && titleKey && titleKey.length >= 8) {
    keys.push(`title:${sourceKey}:${titleKey}`)
  }

  return Array.from(new Set(keys))
}

function isGenericKnowledgeTitleKey(titleKey: string): boolean {
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

function getKnowledgeArticleQualityScore(article: Article): number {
  const titleKey = normalizeKnowledgeTitleKey(article)
  const sourceKey = normalizeKnowledgeSourceKey(article)
  const pathname = getKnowledgeArticlePathname(article)
  const summaryLength = (article.summary || '').trim().length

  let score = 0

  if (summaryLength >= 80) score += 4
  else if (summaryLength >= 40) score += 2

  if (article.audience) score += 2
  if (article.topic && article.topic !== 'general') score += 2
  if (article.topic && article.topic !== 'policy') score += 1
  if (titleKey.length >= 12 && titleKey.length <= 120) score += 1
  if (!isKnowledgeLandingLikePath(pathname)) score += 2

  if (article.topic === 'policy') score -= 5
  if (isGenericKnowledgeTitleKey(titleKey)) score -= 4
  if (sourceKey && titleKey === sourceKey) score -= 8
  if (isKnowledgeLandingLikePath(pathname)) score -= 3

  return score
}

function pickBetterKnowledgeArticle(left: Article, right: Article): Article {
  const leftSummaryLength = (left.summary || '').trim().length
  const rightSummaryLength = (right.summary || '').trim().length
  if (leftSummaryLength !== rightSummaryLength) {
    return rightSummaryLength > leftSummaryLength ? right : left
  }

  const timestampDiff = getArticleTimestamp(right) - getArticleTimestamp(left)
  if (timestampDiff !== 0) {
    return timestampDiff > 0 ? right : left
  }

  const sourcePriorityDiff = getSourcePriority(left) - getSourcePriority(right)
  if (sourcePriorityDiff !== 0) {
    return sourcePriorityDiff < 0 ? left : right
  }

  return left
}

function dedupeKnowledgeArticles(list: Article[]): Article[] {
  const deduped = new Map<string, Article>()

  list.forEach((article) => {
    const keys = buildKnowledgeDedupeKeys(article)
    const existing = keys
      .map(key => deduped.get(key))
      .find((item): item is Article => Boolean(item))

    if (!existing) {
      keys.forEach(key => deduped.set(key, article))
      return
    }

    const selected = pickBetterKnowledgeArticle(existing, article)
    keys.forEach(key => deduped.set(key, selected))
  })

  return Array.from(new Map(
    Array.from(deduped.values()).map(article => [article.slug, article]),
  ).values())
}

function sortKnowledgeArticles(list: Article[]): Article[] {
  return [...dedupeKnowledgeArticles(list)].sort((left, right) => {
    const qualityDiff = getKnowledgeArticleQualityScore(right) - getKnowledgeArticleQualityScore(left)
    if (qualityDiff !== 0) {
      return qualityDiff
    }

    const sourceDiff = getSourcePriority(left) - getSourcePriority(right)
    if (sourceDiff !== 0) {
      return sourceDiff
    }

    const dateBucketDiff = getArticleDateBucket(right).localeCompare(getArticleDateBucket(left))
    if (dateBucketDiff !== 0) {
      return dateBucketDiff
    }

    return getArticleTimestamp(right) - getArticleTimestamp(left)
  })
}

export const useKnowledgeStore = defineStore('knowledge', {
  state: () => ({
    articles: [] as Article[],
    currentArticle: null as Article | null,
    translationCache: persistedTranslations.cache,
    translationCacheOrder: persistedTranslations.order,
    translationFailed: {} as Record<string, boolean>,
    total: 0,
    page: 1,
    pageSize: 10,
    selectedSource: 'all',
    selectedStage: null as string | null,
    keyword: '',
    loading: false,
    error: null as string | null,
  }),

  actions: {
    persistTranslationCache() {
      const entries = this.translationCacheOrder
        .filter(slug => this.translationCache[slug])
        .slice(0, MAX_PERSISTED_TRANSLATIONS)
        .map(slug => ({
          slug,
          translation: this.translationCache[slug],
        }))

      uni.setStorageSync(TRANSLATION_CACHE_STORAGE_KEY, entries)
    },

    async fetchArticles(params?: { page?: number; reset?: boolean }) {
      const page = params?.page || this.page
      this.loading = true
      this.error = null

      try {
        const response = await articleApi.getList({
          page,
          pageSize: this.pageSize,
          source: this.selectedSource === 'all' ? undefined : this.selectedSource,
          stage: this.selectedStage || undefined,
          difficulty: 'authoritative',
          contentType: 'authority',
          keyword: this.keyword || undefined,
        }) as PaginatedResponse<Article>

        const nextArticles = params?.reset ? response.list : [...this.articles, ...response.list]
        this.articles = sortKnowledgeArticles(nextArticles)
        this.total = response.pagination.total
        this.page = response.pagination.page
      } catch (error: unknown) {
        const err = error as { message?: string }
        this.error = err.message || '获取文章列表失败'
      } finally {
        this.loading = false
      }
    },

    async fetchArticleDetail(slug: string) {
      this.loading = true
      this.error = null
      try {
        this.currentArticle = await articleApi.getBySlug(slug) as Article
      } catch (error: unknown) {
        const err = error as { message?: string }
        this.error = err.message || '获取文章详情失败'
      } finally {
        this.loading = false
      }
    },

    async fetchTranslation(slug: string) {
      const cachedTranslation = this.translationCache[slug]
      if (cachedTranslation) {
        return cachedTranslation
      }

      const inFlightRequest = translationInFlight.get(slug)
      if (inFlightRequest) {
        return inFlightRequest
      }

      const request = (articleApi.getTranslation(slug) as Promise<AuthorityArticleTranslation>)
      translationInFlight.set(slug, request)

      try {
        const translation = await request
        this.cacheTranslation(slug, translation)
        return translation
      } catch (error) {
        this.markTranslationFailed(slug)
        throw error
      } finally {
        if (translationInFlight.get(slug) === request) {
          translationInFlight.delete(slug)
        }
      }
    },

    async prefetchTranslations(candidates: Article[], limit = 6) {
      const queue = candidates
        .filter((item) => item.contentType === 'authority')
        .filter((item) => item.sourceLanguage !== 'zh' && item.sourceLocale !== 'zh-CN')
        .filter((item) => !this.translationCache[item.slug] && !this.translationFailed[item.slug])
        .filter((item) => !translationInFlight.has(item.slug))
        .slice(0, limit)

      if (queue.length === 0) {
        return
      }

      await Promise.all(queue.map(async (item) => {
        try {
          await this.fetchTranslation(item.slug)
        } catch (_error) {
          return
        }
      }))
    },

    getCachedTranslation(slug: string) {
      return this.translationCache[slug] || null
    },

    cacheTranslation(slug: string, translation: AuthorityArticleTranslation) {
      const nextOrder = [slug, ...this.translationCacheOrder.filter(item => item !== slug)].slice(0, MAX_PERSISTED_TRANSLATIONS)
      this.translationCache = {
        ...this.translationCache,
        [slug]: translation,
      }
      this.translationCacheOrder = nextOrder
      this.persistTranslationCache()

      if (this.translationFailed[slug]) {
        const { [slug]: _ignored, ...rest } = this.translationFailed
        this.translationFailed = rest
      }
    },

    markTranslationFailed(slug: string) {
      this.translationFailed = {
        ...this.translationFailed,
        [slug]: true,
      }
    },

    setSource(source: string) {
      this.selectedSource = source
      this.page = 1
      this.fetchArticles({ reset: true })
    },

    setStage(stage: string | null) {
      this.selectedStage = stage
      this.page = 1
      this.fetchArticles({ reset: true })
    },

    setKeyword(keyword: string) {
      this.keyword = keyword
    },

    async search(keyword: string) {
      this.keyword = keyword
      this.page = 1
      await this.fetchArticles({ page: 1, reset: true })
    },

    async likeArticle(id: number) {
      try {
        const result = await articleApi.like(id) as { liked: boolean }
        this.articles = this.articles.map(a =>
          a.id === id ? { ...a, isLiked: result.liked, likeCount: a.likeCount + (result.liked ? 1 : 0) } : a
        )
      } catch (_error) {
        console.error('点赞失败:', _error)
      }
    },

    async favoriteArticle(id: number) {
      try {
        const result = await articleApi.favorite(id) as { favorited: boolean }
        this.articles = this.articles.map(a =>
          a.id === id ? { ...a, isFavorited: result.favorited } : a
        )
      } catch (_error) {
        console.error('收藏失败:', _error)
      }
    },

    reset() {
      this.articles = []
      this.page = 1
      this.selectedSource = 'all'
      this.selectedStage = null
      this.keyword = ''
      this.error = null
    },
  },
})
