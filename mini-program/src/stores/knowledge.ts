import { defineStore } from 'pinia'
import { articleApi } from '@/api/modules'
import { isTranslationPendingError } from '@/api/modules'
import type { Article, AuthorityArticleTranslation, PaginatedResponse } from '@/api/modules'
import type { RecentAIHitArticle } from '../../../shared/types'
import { buildTranslationPendingError } from '../../../shared/utils/translation-request'
import { sanitizeTranslationText } from '../../../shared/utils/article-translation'
import {
  buildRecentAIHitArticle,
  mergeRecentAIHitArticles,
  sanitizeRecentAIHitArticles,
} from '../../../shared/utils/recent-ai-hit'
import {
  dedupeKnowledgeArticles,
  getKnowledgeArticlePathname,
  getKnowledgeArticleTimestamp,
  isChineseKnowledgeVariant,
  isGenericKnowledgeTitleKey,
  isKnowledgeLandingLikePath,
  normalizeKnowledgeSourceKey,
  normalizeKnowledgeTitleKey,
} from '../../../shared/utils/knowledge-dedupe'
import { getAuthorityRegionPriority } from '@/utils/authority-source'

const TRANSLATION_CACHE_STORAGE_KEY = 'knowledgeTranslationCache'
const RECENT_AI_HIT_ARTICLES_KEY = 'knowledgeRecentAiHitArticles'
const MAX_PERSISTED_TRANSLATIONS = 12
let knowledgeListRequestId = 0
const translationInFlight = new Map<string, Promise<AuthorityArticleTranslation>>()
const articleDetailInFlight = new Map<string, Promise<Article>>()
const TRANSLATION_NAVIGATION_PATTERNS = [
  /turn (?:on|off) (?:more accessible mode|animations)/i,
  /skip ribbon commands/i,
  /skip to main content/i,
  /log in\s*\|\s*register/i,
  /find a pediatrician/i,
  /ages\s*&?\s*stages/i,
  /healthy living/i,
  /safety\s*&?\s*prevention/i,
  /family life/i,
  /health issues/i,
  /tips\s*&?\s*tools/i,
  /healthy children\s*>/i,
  /page content/i,
  /年龄与阶段/u,
  /健康生活/u,
  /安全与预防/u,
  /家庭生活/u,
  /健康问题/u,
  /提示与工具/u,
  /查找儿科医生/u,
  /关于\s*(?:AAP|美国儿科学会)/iu,
]

function isLikelySlowTranslationError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof (error as { message?: unknown })?.message === 'string'
      ? String((error as { message: string }).message)
      : ''

  return /timeout|timed out|超时|request:fail|abort/i.test(message)
}

function normalizeTranslationCacheText(input: string | null | undefined): string {
  return (input || '').replace(/\s+/g, ' ').trim()
}

function isLikelyNavigationCachedTranslation(translation: AuthorityArticleTranslation): boolean {
  const text = normalizeTranslationCacheText([
    translation.translatedTitle,
    translation.translatedSummary,
    translation.translatedContent,
  ].filter(Boolean).join(' '))

  if (!text) {
    return true
  }

  const navigationHitCount = TRANSLATION_NAVIGATION_PATTERNS.reduce((total, pattern) => (
    total + (pattern.test(text) ? 1 : 0)
  ), 0)

  if (navigationHitCount >= 8) {
    return true
  }

  const lower = text.toLowerCase()
  const pageContentIndex = lower.lastIndexOf('page content')
  if (navigationHitCount >= 5 && pageContentIndex >= 0 && pageContentIndex >= lower.length - 320) {
    return true
  }

  const chineseNavHitCount = (text.match(/(年龄与阶段|健康生活|安全与预防|家庭生活|健康问题|提示与工具|新闻|查找儿科医生)/gu) || []).length
  return chineseNavHitCount >= 5 && text.length < 2200
}

function normalizeCachedTranslation(translation: AuthorityArticleTranslation | null | undefined): AuthorityArticleTranslation | null {
  if (!translation) {
    return null
  }

  const normalized: AuthorityArticleTranslation = {
    ...translation,
    translatedTitle: sanitizeTranslationText(translation.translatedTitle, 'title'),
    translatedSummary: sanitizeTranslationText(translation.translatedSummary, 'summary'),
    translatedContent: sanitizeTranslationText(translation.translatedContent, 'content'),
  }

  if (!normalized.translatedContent || isLikelyNavigationCachedTranslation(normalized)) {
    return null
  }

  return normalized
}

function hasTranslationNormalizationChanges(
  original: AuthorityArticleTranslation,
  normalized: AuthorityArticleTranslation,
): boolean {
  return original.translatedTitle !== normalized.translatedTitle
    || original.translatedSummary !== normalized.translatedSummary
    || original.translatedContent !== normalized.translatedContent
}

function isTranslationSourceVersionMismatch(
  translation: AuthorityArticleTranslation,
  expectedSourceUpdatedAt?: string,
): boolean {
  return Boolean(
    expectedSourceUpdatedAt
      && translation.sourceUpdatedAt
      && translation.sourceUpdatedAt !== expectedSourceUpdatedAt,
  )
}

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
  let removedInvalidCache = false
  stored.forEach((item) => {
    if (!item?.slug || !item?.translation) {
      removedInvalidCache = true
      return
    }
    const normalized = normalizeCachedTranslation(item.translation)
    if (!normalized) {
      removedInvalidCache = true
      return
    }
    cache[item.slug] = normalized
    order.push(item.slug)
  })

  if (removedInvalidCache) {
    uni.setStorageSync(
      TRANSLATION_CACHE_STORAGE_KEY,
      order.map(slug => ({ slug, translation: cache[slug] })),
    )
  }

  return { cache, order }
}

const persistedTranslations = loadPersistedTranslations()

export type { RecentAIHitArticle } from '../../../shared/types'

function getArticleTimestamp(article: Article): number {
  return getKnowledgeArticleTimestamp(article)
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

function sortKnowledgeArticles(list: Article[]): Article[] {
  return [...dedupeKnowledgeArticles(list, getSourcePriority)].sort((left, right) => {
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
      const requestId = ++knowledgeListRequestId
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

        if (requestId !== knowledgeListRequestId) {
          return
        }

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
        if (requestId !== knowledgeListRequestId) {
          return
        }

        const err = error as { message?: string }
        this.error = err.message || '获取文章列表失败'
      } finally {
        if (requestId === knowledgeListRequestId) {
          this.loading = false
        }
      }
    },

    async fetchArticleDetail(slug: string): Promise<Article | null> {
      if (this.currentArticle?.slug === slug && (this.currentArticle.content || this.currentArticle.summary)) {
        return this.currentArticle
      }

      this.loading = true
      this.error = null
      if (this.currentArticle?.slug !== slug) {
        this.currentArticle = null
      }

      try {
        const inFlight = articleDetailInFlight.get(slug)
        const request = inFlight || articleApi.getBySlug(slug) as Promise<Article>
        if (!inFlight) {
          articleDetailInFlight.set(slug, request)
        }

        this.currentArticle = await request
        return this.currentArticle
      } catch (error: unknown) {
        const err = error as { message?: string }
        this.error = err.message || '获取文章详情失败'
        this.currentArticle = null
        return null
      } finally {
        articleDetailInFlight.delete(slug)
        this.loading = false
      }
    },

    async fetchTranslation(slug: string) {
      const cachedTranslation = this.getCachedTranslation(slug)
      if (cachedTranslation) {
        return cachedTranslation
      }

      const inFlightRequest = translationInFlight.get(slug)
      if (inFlightRequest) {
        return inFlightRequest
      }

      const request = articleApi.getTranslation(slug, {
        maxAttempts: 1,
        waitForReady: true,
      }) as Promise<AuthorityArticleTranslation>
      translationInFlight.set(slug, request)

      try {
        const translation = await request
        const normalized = this.cacheTranslation(slug, translation)
        if (!normalized) {
          this.markTranslationFailed(slug)
          throw new Error('翻译内容暂不可用')
        }
        return normalized
      } catch (error) {
        if (isTranslationPendingError(error)) {
          throw error
        }

        if (isLikelySlowTranslationError(error)) {
          throw buildTranslationPendingError(5000, 'MiniMax 正在生成中文阅读版，请稍后自动刷新')
        }

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
      const cachedTranslation = this.getCachedTranslation(slug)
      if (cachedTranslation) {
        return cachedTranslation
      }

      try {
        const translation = await articleApi.kickoffTranslation(slug)
        if (translation) {
          return this.cacheTranslation(slug, translation)
        }
      } catch (error) {
        if (!isTranslationPendingError(error) && !isLikelySlowTranslationError(error)) {
          this.markTranslationFailed(slug)
        }
      }

      return null
    },

    async prefetchTranslations(candidates: Article[], limit = 3) {
      const queue = candidates
        .filter((item) => item.contentType === 'authority')
        .filter((item) => !isChineseKnowledgeVariant(item))
        .filter((item) => !this.getCachedTranslation(item.slug, item.sourceUpdatedAt || item.publishedAt || item.createdAt) && !this.translationFailed[item.slug])
        .filter((item) => !translationInFlight.has(item.slug))
        .slice(0, limit)

      if (queue.length === 0) {
        return
      }

      await Promise.all(queue.map(async (item) => {
        await this.warmupTranslation(item.slug)
      }))
    },

    getCachedTranslation(slug: string, expectedSourceUpdatedAt?: string) {
      const cachedTranslation = normalizeCachedTranslation(this.translationCache[slug])
      if (!cachedTranslation || isTranslationSourceVersionMismatch(cachedTranslation, expectedSourceUpdatedAt)) {
        if (this.translationCache[slug]) {
          this.evictCachedTranslation(slug)
        }
        return null
      }

      if (hasTranslationNormalizationChanges(this.translationCache[slug], cachedTranslation)) {
        this.translationCache = {
          ...this.translationCache,
          [slug]: cachedTranslation,
        }
        this.persistTranslationCache()
      }

      return cachedTranslation
    },

    cacheTranslation(slug: string, translation: AuthorityArticleTranslation) {
      const normalized = normalizeCachedTranslation(translation)
      if (!normalized) {
        this.evictCachedTranslation(slug)
        return null
      }

      const nextOrder = [slug, ...this.translationCacheOrder.filter(item => item !== slug)].slice(0, MAX_PERSISTED_TRANSLATIONS)
      this.translationCache = {
        ...this.translationCache,
        [slug]: normalized,
      }
      this.translationCacheOrder = nextOrder
      this.persistTranslationCache()

      if (this.translationFailed[slug]) {
        const rest = { ...this.translationFailed }
        delete rest[slug]
        this.translationFailed = rest
      }

      return normalized
    },

    evictCachedTranslation(slug: string) {
      if (!this.translationCache[slug]) {
        return
      }

      const rest = { ...this.translationCache }
      delete rest[slug]
      this.translationCache = rest
      this.translationCacheOrder = this.translationCacheOrder.filter(item => item !== slug)
      this.persistTranslationCache()
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
      const nextHit = buildRecentAIHitArticle({
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
      }, input)
      const nextList = mergeRecentAIHitArticles(this.recentAiHitArticles, nextHit)

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
        const current = this.currentArticle?.id === id
          ? this.currentArticle
          : this.articles.find((a) => a.id === id)
        const result = current?.isLiked
          ? await articleApi.unlike(id) as { liked: boolean; likeCount?: number }
          : await articleApi.like(id) as { liked: boolean; likeCount?: number }
        const nextLikeCount = (a: Article) =>
          typeof result.likeCount === 'number'
            ? result.likeCount
            : (result.liked ? a.likeCount + 1 : Math.max(a.likeCount - 1, 0))
        this.articles = this.articles.map(a =>
          a.id === id ? { ...a, isLiked: result.liked, likeCount: nextLikeCount(a) } : a
        )
        if (this.currentArticle?.id === id) {
          this.currentArticle = {
            ...this.currentArticle,
            isLiked: result.liked,
            likeCount: nextLikeCount(this.currentArticle),
          }
        }
      } catch (_error) {
        console.error('点赞失败:', _error)
      }
    },

    async favoriteArticle(id: number) {
      try {
        const current = this.currentArticle?.id === id
          ? this.currentArticle
          : this.articles.find((a) => a.id === id)
        const result = current?.isFavorited
          ? await articleApi.unfavorite(id) as { favorited: boolean; collectCount?: number }
          : await articleApi.favorite(id) as { favorited: boolean; collectCount?: number }
        const nextCollectCount = (a: Article) =>
          typeof result.collectCount === 'number'
            ? result.collectCount
            : (result.favorited ? a.collectCount + 1 : Math.max(a.collectCount - 1, 0))
        this.articles = this.articles.map(a =>
          a.id === id ? { ...a, isFavorited: result.favorited, collectCount: nextCollectCount(a) } : a
        )
        if (this.currentArticle?.id === id) {
          this.currentArticle = {
            ...this.currentArticle,
            isFavorited: result.favorited,
            collectCount: nextCollectCount(this.currentArticle),
          }
        }
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
