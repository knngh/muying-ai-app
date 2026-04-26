import { create } from 'zustand'
import type { ApiError } from '../api'
import { articleApi, categoryApi, tagApi } from '../api/modules'
import type { Article, Category, Tag, PaginatedResponse } from '../api/modules'
import type { RecentAIHitArticle } from '../../../shared/types'
import {
  buildRecentAIHitArticle,
  mergeRecentAIHitArticles,
  sanitizeRecentAIHitArticles,
} from '../../../shared/utils/recent-ai-hit'
import {
  dedupeKnowledgeArticles,
  getKnowledgeArticleTimestamp,
} from '../../../shared/utils/knowledge-dedupe'
import { storage } from '../utils/storage'
import {
  getKnowledgeFallbackKeyword,
  getKnowledgeStagePriorityMap,
  getKnowledgeStageQuery,
} from '../utils/knowledgeStage'

const KNOWLEDGE_CONTENT_TYPE = 'authority'
const CHINESE_AUTHORITY_PATTERNS = [
  /中国政府网/u,
  /中国政府网政策解读/u,
  /gov\.cn/i,
  /国家卫生健康委员会/u,
  /国家卫健委/u,
  /中国疾控/u,
  /中国疾病预防控制中心/u,
  /chinacdc/i,
]
const MOBILE_KNOWLEDGE_PAGE_SIZE = 6
const RECENT_AI_HIT_ARTICLES_KEY = 'knowledge_recent_ai_hit_articles'
let knowledgeListRequestId = 0
const articleDetailInFlight = new Map<string, Promise<Article>>()

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
  if (article.sourceLanguage === 'zh' || article.sourceLocale === 'zh-CN') {
    return 0
  }

  if (article.sourceLanguage?.startsWith('en') || article.sourceLocale?.startsWith('en')) {
    return 1
  }

  const sourceText = [
    article.sourceOrg || '',
    article.source || '',
    article.sourceUrl || '',
    article.region || '',
  ].join(' ')

  if (CHINESE_AUTHORITY_PATTERNS.some((pattern) => pattern.test(sourceText))) {
    return 0
  }

  return 2
}

function sortKnowledgeArticles(list: Article[], selectedStage: string | null = null): Article[] {
  const stagePriority = getKnowledgeStagePriorityMap(selectedStage)

  return [...dedupeKnowledgeArticles(list, getSourcePriority)].sort((left, right) => {
    const leftPriority = stagePriority.get(left.stage || '') ?? Number.MAX_SAFE_INTEGER
    const rightPriority = stagePriority.get(right.stage || '') ?? Number.MAX_SAFE_INTEGER
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }

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

function mergeKnowledgeArticles(existing: Article[], incoming: Article[], selectedStage: string | null = null) {
  const articleMap = new Map<string, Article>()

  for (const article of [...existing, ...incoming]) {
    articleMap.set(article.slug, article)
  }

  return sortKnowledgeArticles(Array.from(articleMap.values()), selectedStage)
}

function buildKnowledgeAttempts(selectedStage: string | null, keyword: string) {
  const stageQuery = getKnowledgeStageQuery(selectedStage)
  const fallbackKeyword = getKnowledgeFallbackKeyword(selectedStage)
  const normalizedKeyword = keyword.trim()
  const attempts: Array<{ stage?: string; keyword?: string }> = []

  if (normalizedKeyword) {
    if (stageQuery) {
      attempts.push({ stage: stageQuery, keyword: normalizedKeyword })
    }
    attempts.push({ keyword: normalizedKeyword })
  } else {
    if (stageQuery) {
      attempts.push({ stage: stageQuery })
    }
    if (stageQuery && fallbackKeyword) {
      attempts.push({ stage: stageQuery, keyword: fallbackKeyword })
    }
    if (fallbackKeyword) {
      attempts.push({ keyword: fallbackKeyword })
    }
    attempts.push({})
  }

  const seen = new Set<string>()
  return attempts.filter((attempt) => {
    const key = `${attempt.stage || ''}::${attempt.keyword || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function getKnowledgeArticlesWithFallback(params: {
  page: number
  pageSize: number
  category?: string
  tag?: string
  selectedStage: string | null
  keyword: string
}) {
  const attempts = buildKnowledgeAttempts(params.selectedStage, params.keyword)
  let lastResponse: PaginatedResponse<Article> | null = null

  for (const attempt of attempts) {
    const response = await articleApi.getList({
      page: params.page,
      pageSize: params.pageSize,
      contentType: KNOWLEDGE_CONTENT_TYPE,
      category: params.category,
      tag: params.tag,
      stage: attempt.stage,
      keyword: attempt.keyword,
    }) as PaginatedResponse<Article>

    lastResponse = response

    if ((response.list || []).length > 0) {
      return response
    }
  }

  return lastResponse || {
    list: [],
    pagination: {
      total: 0,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: 0,
    },
  }
}

interface KnowledgeState {
  articles: Article[]
  categories: Category[]
  tags: Tag[]
  currentArticle: Article | null
  recentAiHitArticles: RecentAIHitArticle[]
  recentAiHitArticlesLoaded: boolean
  total: number
  page: number
  pageSize: number
  selectedCategory: string | null
  selectedTag: string | null
  selectedStage: string | null
  keyword: string
  loading: boolean
  error: string | null
  errorDetail: ApiError | null
  fetchArticles: (params?: { page?: number; reset?: boolean }) => Promise<void>
  fetchCategories: () => Promise<void>
  fetchTags: () => Promise<void>
  fetchArticleDetail: (slug: string) => Promise<void>
  hydrateRecentAiHitArticles: () => Promise<void>
  recordAiHitArticle: (article: Article, input?: {
    qaId?: string
    trigger?: 'hit_card' | 'knowledge_action'
    matchReason?: 'entry_meta' | 'source_url' | 'source_title' | 'source_keyword'
    originEntrySource?: string
    originReportId?: string
  }) => Promise<void>
  setCategory: (slug: string | null) => void
  setTag: (slug: string | null) => void
  setStage: (stage: string | null) => void
  setKeyword: (keyword: string) => void
  initializeFilters: (stage?: string | null) => void
  search: (keyword: string) => Promise<void>
  likeArticle: (id: number) => Promise<void>
  favoriteArticle: (id: number) => Promise<void>
  reset: () => void
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  articles: [],
  categories: [],
  tags: [],
  currentArticle: null,
  recentAiHitArticles: [],
  recentAiHitArticlesLoaded: false,
  total: 0,
  page: 1,
  pageSize: MOBILE_KNOWLEDGE_PAGE_SIZE,
  selectedCategory: null,
  selectedTag: null,
  selectedStage: null,
  keyword: '',
  loading: false,
  error: null,
  errorDetail: null,

  fetchArticles: async (params) => {
    const state = get()
    const page = params?.page || state.page
    const requestId = ++knowledgeListRequestId
    set({ loading: true, error: null, errorDetail: null })
    try {
      const response = await getKnowledgeArticlesWithFallback({
        page,
        pageSize: state.pageSize,
        category: state.selectedCategory || undefined,
        tag: state.selectedTag || undefined,
        selectedStage: state.selectedStage,
        keyword: state.keyword,
      })
      if (requestId !== knowledgeListRequestId) {
        return
      }

      const nextArticles = params?.reset
        ? sortKnowledgeArticles(response.list, state.selectedStage)
        : mergeKnowledgeArticles(state.articles, response.list, state.selectedStage)
      set({
        articles: nextArticles,
        total: response.pagination.total,
        page: response.pagination.page,
        loading: false,
        error: null,
        errorDetail: null,
      })
    } catch (error: unknown) {
      if (requestId !== knowledgeListRequestId) {
        return
      }

      const err = error as ApiError
      if (__DEV__) {
        console.warn('[KnowledgeStore] fetchArticles failed', err.message || error)
      }
      set({ error: err.message || '获取文章失败', errorDetail: err, loading: false })
    }
  },

  fetchCategories: async () => {
    try {
      const categories = await categoryApi.getAll()
      set({ categories })
    } catch {
      set({ categories: [] })
    }
  },

  fetchTags: async () => {
    try {
      const tags = await tagApi.getAll()
      set({ tags })
    } catch {
      set({ tags: [] })
    }
  },

  fetchArticleDetail: async (slug) => {
    const currentArticle = get().currentArticle
    if (currentArticle?.slug === slug) {
      return
    }

    set({ loading: true, error: null, errorDetail: null })
    try {
      const inFlight = articleDetailInFlight.get(slug)
      const request = inFlight || articleApi.getBySlug(slug) as Promise<Article>
      if (!inFlight) {
        articleDetailInFlight.set(slug, request)
      }

      set({
        currentArticle: await request,
        loading: false,
        error: null,
        errorDetail: null,
      })
    } catch (error: unknown) {
      const err = error as ApiError
      set({ error: err.message || '获取文章详情失败', errorDetail: err, loading: false })
    } finally {
      articleDetailInFlight.delete(slug)
    }
  },

  hydrateRecentAiHitArticles: async () => {
    if (get().recentAiHitArticlesLoaded) {
      return
    }

    try {
      const cached = await storage.get<RecentAIHitArticle[]>(RECENT_AI_HIT_ARTICLES_KEY)
      const nextList = sanitizeRecentAIHitArticles(Array.isArray(cached) ? cached : [])
      set({
        recentAiHitArticles: nextList,
        recentAiHitArticlesLoaded: true,
      })
      await storage.set(RECENT_AI_HIT_ARTICLES_KEY, nextList)
    } catch {
      set({ recentAiHitArticles: [], recentAiHitArticlesLoaded: true })
    }
  },

  recordAiHitArticle: async (article, input) => {
    const nextHit = buildRecentAIHitArticle({
      slug: article.slug,
      articleId: article.id,
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
    const nextList = mergeRecentAIHitArticles(get().recentAiHitArticles, nextHit)
    set({
      recentAiHitArticles: nextList,
      recentAiHitArticlesLoaded: true,
    })

    try {
      await storage.set(RECENT_AI_HIT_ARTICLES_KEY, nextList)
    } catch {
      // Ignore persistence failure.
    }
  },

  setCategory: (slug) => { set({ selectedCategory: slug, page: 1 }); get().fetchArticles({ reset: true }) },
  setTag: (slug) => { set({ selectedTag: slug, page: 1 }); get().fetchArticles({ reset: true }) },
  setStage: (stage) => { set({ selectedStage: stage, page: 1 }); get().fetchArticles({ reset: true }) },
  setKeyword: (keyword) => set({ keyword }),
  initializeFilters: (stage = null) => set({
    articles: [],
    page: 1,
    selectedCategory: null,
    selectedTag: null,
    selectedStage: stage,
    keyword: '',
    error: null,
    errorDetail: null,
  }),

  search: async (keyword) => {
    const requestId = ++knowledgeListRequestId
    set({ keyword, page: 1, loading: true, error: null, errorDetail: null })
    try {
      const state = get()
      const response = await getKnowledgeArticlesWithFallback({
        page: 1,
        pageSize: state.pageSize,
        category: state.selectedCategory || undefined,
        tag: state.selectedTag || undefined,
        selectedStage: state.selectedStage,
        keyword,
      })
      if (requestId !== knowledgeListRequestId) {
        return
      }

      set({
        articles: sortKnowledgeArticles(response.list, state.selectedStage),
        total: response.pagination.total,
        loading: false,
        error: null,
        errorDetail: null,
      })
    } catch (error: unknown) {
      if (requestId !== knowledgeListRequestId) {
        return
      }

      const err = error as ApiError
      if (__DEV__) {
        console.warn('[KnowledgeStore] search failed', err.message || error)
      }
      set({ error: err.message || '搜索失败', errorDetail: err, loading: false })
    }
  },

  likeArticle: async (id) => {
    try {
      const currentArticle = get().currentArticle?.id === id
        ? get().currentArticle
        : get().articles.find((item) => item.id === id)
      const result = currentArticle?.isLiked
        ? await articleApi.unlike(id) as { liked: boolean; likeCount?: number }
        : await articleApi.like(id) as { liked: boolean; likeCount?: number }
      set((state) => ({
        articles: state.articles.map((a) => (
          a.id === id
            ? {
                ...a,
                isLiked: result.liked,
                likeCount: typeof result.likeCount === 'number'
                  ? result.likeCount
                  : (result.liked ? a.likeCount + 1 : Math.max(a.likeCount - 1, 0)),
              }
            : a
        )),
        currentArticle: state.currentArticle?.id === id
          ? {
              ...state.currentArticle,
              isLiked: result.liked,
              likeCount: typeof result.likeCount === 'number'
                ? result.likeCount
                : (result.liked
                  ? state.currentArticle.likeCount + 1
                  : Math.max(state.currentArticle.likeCount - 1, 0)),
            }
          : state.currentArticle,
      }))
    } catch (_e) { /* ignore */ }
  },

  favoriteArticle: async (id) => {
    try {
      const currentArticle = get().currentArticle?.id === id
        ? get().currentArticle
        : get().articles.find((item) => item.id === id)
      const result = currentArticle?.isFavorited
        ? await articleApi.unfavorite(id) as { favorited: boolean; collectCount?: number }
        : await articleApi.favorite(id) as { favorited: boolean; collectCount?: number }
      set((state) => ({
        articles: state.articles.map((a) => (
          a.id === id
            ? {
                ...a,
                isFavorited: result.favorited,
                collectCount: typeof result.collectCount === 'number'
                  ? result.collectCount
                  : (result.favorited ? a.collectCount + 1 : Math.max(a.collectCount - 1, 0)),
              }
            : a
        )),
        currentArticle: state.currentArticle?.id === id
          ? {
              ...state.currentArticle,
              isFavorited: result.favorited,
              collectCount: typeof result.collectCount === 'number'
                ? result.collectCount
                : (result.favorited
                  ? state.currentArticle.collectCount + 1
                  : Math.max(state.currentArticle.collectCount - 1, 0)),
            }
          : state.currentArticle,
      }))
    } catch (_e) { /* ignore */ }
  },

  reset: () => set({
    articles: [],
    currentArticle: null,
    page: 1,
    selectedCategory: null,
    selectedTag: null,
    selectedStage: null,
    keyword: '',
    error: null,
    errorDetail: null,
  }),
}))
