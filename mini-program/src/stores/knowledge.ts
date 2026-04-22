import { defineStore } from 'pinia'
import { articleApi } from '@/api/modules'
import { isTranslationPendingError } from '@/api/modules'
import type { Article, AuthorityArticleTranslation, PaginatedResponse } from '@/api/modules'
import { getAuthorityRegionPriority } from '@/utils/authority-source'

const TRANSLATION_CACHE_STORAGE_KEY = 'knowledgeTranslationCache'
const RECENT_AI_HIT_ARTICLES_KEY = 'knowledgeRecentAiHitArticles'
const MAX_PERSISTED_TRANSLATIONS = 12
const RECENT_AI_HIT_ARTICLE_LIMIT = 6
const RECENT_AI_HIT_RETENTION_DAYS = 14
const RECENT_AI_HIT_MAX_FUTURE_SKEW_MS = 6 * 60 * 60 * 1000
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

export interface RecentAIHitArticle {
  slug: string
  articleId: number
  title: string
  summary: string
  source?: string
  sourceOrg?: string
  sourceLanguage?: 'zh' | 'en'
  sourceLocale?: string
  topic?: string
  stage?: string
  publishedAt?: string
  sourceUpdatedAt?: string
  createdAt: string
  lastHitAt: string
  qaId?: string
  trigger?: 'hit_card' | 'knowledge_action'
  matchReason?: 'entry_meta' | 'source_url' | 'source_title' | 'source_keyword'
  originEntrySource?: string
  originReportId?: string
}

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
  const keys = [
    article.slug,
    article.sourceUrl,
    article.originalId ? String(article.originalId) : '',
  ].filter(Boolean) as string[]

  // Title + source dedup for non-generic titles (matches backend logic)
  const titleKey = normalizeKnowledgeTitleKey(article)
  const sourceKey = normalizeKnowledgeSourceKey(article)
  if (titleKey && sourceKey && !isGenericKnowledgeTitleKey(titleKey)) {
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
    const sourceDiff = getSourcePriority(left) - getSourcePriority(right)
    if (sourceDiff !== 0) {
      return sourceDiff
    }

    const qualityDiff = getKnowledgeArticleQualityScore(right) - getKnowledgeArticleQualityScore(left)
    if (qualityDiff !== 0) {
      return qualityDiff
    }

    const dateBucketDiff = getArticleDateBucket(right).localeCompare(getArticleDateBucket(left))
    if (dateBucketDiff !== 0) {
      return dateBucketDiff
    }

    return getArticleTimestamp(right) - getArticleTimestamp(left)
  })
}

function toRecentAIHitArticle(
  article: Article | RecentAIHitArticle,
  input?: {
    qaId?: string
    trigger?: 'hit_card' | 'knowledge_action'
    matchReason?: 'entry_meta' | 'source_url' | 'source_title' | 'source_keyword'
    originEntrySource?: string
    originReportId?: string
  },
): RecentAIHitArticle {
  return {
    slug: article.slug,
    articleId: 'articleId' in article ? article.articleId : article.id,
    title: article.title,
    summary: article.summary,
    source: article.source,
    sourceOrg: article.sourceOrg,
    sourceLanguage: article.sourceLanguage,
    sourceLocale: article.sourceLocale,
    topic: article.topic,
    stage: article.stage,
    publishedAt: article.publishedAt,
    sourceUpdatedAt: article.sourceUpdatedAt,
    createdAt: article.createdAt,
    lastHitAt: new Date().toISOString(),
    qaId: input?.qaId,
    trigger: input?.trigger,
    matchReason: input?.matchReason,
    originEntrySource: input?.originEntrySource,
    originReportId: input?.originReportId,
  }
}

function isValidRecentAIHitTimestamp(value?: string, now = Date.now()) {
  if (!value) return false

  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return false

  const maxAgeMs = RECENT_AI_HIT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  if (timestamp < now - maxAgeMs) return false
  if (timestamp > now + RECENT_AI_HIT_MAX_FUTURE_SKEW_MS) return false
  return true
}

function sanitizeRecentAIHitArticles(items: RecentAIHitArticle[], now = Date.now()) {
  const deduped = new Map<string, RecentAIHitArticle>()

  items.forEach((item) => {
    const slug = item.slug?.trim()
    const title = item.title?.replace(/\s+/g, ' ').trim()
    if (!slug || !title || title.length < 4 || !Number.isFinite(item.articleId) || item.articleId <= 0) {
      return
    }

    if (!isValidRecentAIHitTimestamp(item.lastHitAt, now)) {
      return
    }

    const nextItem: RecentAIHitArticle = {
      ...item,
      slug,
      title,
      summary: item.summary?.replace(/\s+/g, ' ').trim() || '',
      source: item.source?.replace(/\s+/g, ' ').trim() || undefined,
      sourceOrg: item.sourceOrg?.replace(/\s+/g, ' ').trim() || undefined,
      topic: item.topic?.replace(/\s+/g, ' ').trim() || undefined,
    }

    const existing = deduped.get(slug)
    if (!existing || nextItem.lastHitAt > existing.lastHitAt) {
      deduped.set(slug, nextItem)
    }
  })

  return Array.from(deduped.values())
    .sort((left, right) => right.lastHitAt.localeCompare(left.lastHitAt))
    .slice(0, RECENT_AI_HIT_ARTICLE_LIMIT)
}

export const useKnowledgeStore = defineStore('knowledge', {
  state: () => ({
    articles: [] as Article[],
    currentArticle: null as Article | null,
    translationCache: persistedTranslations.cache,
    translationCacheOrder: persistedTranslations.order,
    translationFailed: {} as Record<string, boolean>,
    recentAiHitArticles: [] as RecentAIHitArticle[],
    recentAiHitArticlesLoaded: false,
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

        if (params?.reset) {
          this.articles = sortKnowledgeArticles(response.list)
        } else {
          // Append pages: only dedupe by slug, skip full re-sort
          const existingSlugs = new Set(this.articles.map((a) => a.slug))
          const newItems = response.list.filter((a) => !existingSlugs.has(a.slug))
          this.articles = [...this.articles, ...newItems]
        }
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
        if (!isTranslationPendingError(error)) {
          this.markTranslationFailed(slug)
        }
        throw error
      } finally {
        if (translationInFlight.get(slug) === request) {
          translationInFlight.delete(slug)
        }
      }
    },

    async warmupTranslation(slug: string) {
      if (this.translationCache[slug]) {
        return this.translationCache[slug]
      }

      try {
        const translation = await articleApi.kickoffTranslation(slug)
        if (translation) {
          this.cacheTranslation(slug, translation)
          return translation
        }
      } catch (error) {
        if (!isTranslationPendingError(error)) {
          this.markTranslationFailed(slug)
        }
      }

      return null
    },

    async prefetchTranslations(candidates: Article[], limit = 3) {
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
        await this.warmupTranslation(item.slug)
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

    hydrateRecentAiHitArticles() {
      if (this.recentAiHitArticlesLoaded) {
        return
      }

      try {
        const stored = uni.getStorageSync(RECENT_AI_HIT_ARTICLES_KEY) as RecentAIHitArticle[] | null
        const nextList = sanitizeRecentAIHitArticles(Array.isArray(stored) ? stored : [])
        this.recentAiHitArticles = nextList
        this.recentAiHitArticlesLoaded = true
        uni.setStorageSync(RECENT_AI_HIT_ARTICLES_KEY, nextList)
      } catch {
        this.recentAiHitArticles = []
        this.recentAiHitArticlesLoaded = true
      }
    },

    recordAiHitArticle(article: Article | RecentAIHitArticle, input?: {
      qaId?: string
      trigger?: 'hit_card' | 'knowledge_action'
      matchReason?: 'entry_meta' | 'source_url' | 'source_title' | 'source_keyword'
      originEntrySource?: string
      originReportId?: string
    }) {
      const nextHit = toRecentAIHitArticle(article, input)
      const nextList = sanitizeRecentAIHitArticles([
        nextHit,
        ...this.recentAiHitArticles.filter(item => item.slug !== nextHit.slug),
      ])

      this.recentAiHitArticles = nextList
      this.recentAiHitArticlesLoaded = true

      try {
        uni.setStorageSync(RECENT_AI_HIT_ARTICLES_KEY, nextList)
      } catch {
        // 本地缓存失败不影响主流程。
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

    async applyFilters(filters: {
      keyword?: string
      source?: string
      stage?: string | null
    }) {
      this.keyword = filters.keyword?.trim() || ''
      this.selectedSource = filters.source || 'all'
      this.selectedStage = filters.stage || null
      this.page = 1
      await this.fetchArticles({ page: 1, reset: true })
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
