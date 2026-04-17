import { defineStore } from 'pinia'
import { articleApi } from '@/api/modules'
import type { Article, AuthorityArticleTranslation, PaginatedResponse } from '@/api/modules'
import { getAuthorityRegionPriority } from '@/utils/authority-source'

const translationInFlight = new Set<string>()

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

function sortKnowledgeArticles(list: Article[]): Article[] {
  return [...list].sort((left, right) => {
    const dateBucketDiff = getArticleDateBucket(right).localeCompare(getArticleDateBucket(left))
    if (dateBucketDiff !== 0) {
      return dateBucketDiff
    }

    const sourceDiff = getSourcePriority(left) - getSourcePriority(right)
    if (sourceDiff !== 0) {
      return sourceDiff
    }

    return getArticleTimestamp(right) - getArticleTimestamp(left)
  })
}

export const useKnowledgeStore = defineStore('knowledge', {
  state: () => ({
    articles: [] as Article[],
    currentArticle: null as Article | null,
    translationCache: {} as Record<string, AuthorityArticleTranslation>,
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
        translationInFlight.add(item.slug)
        try {
          const translation = await articleApi.getTranslation(item.slug) as AuthorityArticleTranslation
          this.cacheTranslation(item.slug, translation)
        } catch (_error) {
          this.markTranslationFailed(item.slug)
        } finally {
          translationInFlight.delete(item.slug)
        }
      }))
    },

    getCachedTranslation(slug: string) {
      return this.translationCache[slug] || null
    },

    cacheTranslation(slug: string, translation: AuthorityArticleTranslation) {
      this.translationCache = {
        ...this.translationCache,
        [slug]: translation,
      }

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
