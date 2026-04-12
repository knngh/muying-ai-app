import { create } from 'zustand'
import { articleApi, categoryApi, tagApi } from '../api/modules'
import type { Article, Category, Tag, PaginatedResponse } from '../api/modules'

const KNOWLEDGE_CONTENT_TYPE = 'authority'
const STAGE_QUERY_MAP: Record<string, { apiStage?: string; fallbackKeyword?: string }> = {
  preparation: { apiStage: 'preparation', fallbackKeyword: '备孕 叶酸 孕前检查' },
  'first-trimester': { apiStage: 'first-trimester', fallbackKeyword: '孕早期 建档 早孕反应' },
  'second-trimester': { apiStage: 'second-trimester', fallbackKeyword: '孕中期 胎动 糖耐' },
  'third-trimester': { apiStage: 'third-trimester', fallbackKeyword: '孕晚期 待产 分娩征兆' },
  postpartum: { apiStage: 'postpartum', fallbackKeyword: '产后恢复 恶露 伤口 复查 喂养' },
  newborn: { apiStage: 'newborn', fallbackKeyword: '新生儿 黄疸 喂养 排便 脐带' },
  '0-6-months': { apiStage: '0-6-months', fallbackKeyword: '新生儿 喂养 夜醒 疫苗' },
  '6-12-months': { apiStage: '6-12-months', fallbackKeyword: '辅食 睡眠倒退 发育 疫苗' },
  '1-3-years': { apiStage: '1-3-years', fallbackKeyword: '语言发展 如厕 情绪 挑食' },
  '3-years-plus': { apiStage: '3-years-plus', fallbackKeyword: '儿童 语言 情绪行为 睡眠 习惯 入园' },
}
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
  if (article.sourceLanguage === 'zh' || article.sourceLocale === 'zh-CN') {
    return 0
  }

  const sourceText = [
    article.sourceOrg || '',
    article.source || '',
    article.sourceUrl || '',
    article.region || '',
  ].join(' ')

  return CHINESE_AUTHORITY_PATTERNS.some((pattern) => pattern.test(sourceText)) ? 0 : 1
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

function mergeKnowledgeArticles(existing: Article[], incoming: Article[]) {
  const articleMap = new Map<string, Article>()

  for (const article of [...existing, ...incoming]) {
    articleMap.set(article.slug, article)
  }

  return sortKnowledgeArticles(Array.from(articleMap.values()))
}

function buildKnowledgeAttempts(selectedStage: string | null, keyword: string) {
  const stageConfig = selectedStage ? STAGE_QUERY_MAP[selectedStage] : undefined
  const normalizedKeyword = keyword.trim()
  const attempts: Array<{ stage?: string; keyword?: string }> = []

  if (normalizedKeyword) {
    if (stageConfig?.apiStage) {
      attempts.push({ stage: stageConfig.apiStage, keyword: normalizedKeyword })
    }
    attempts.push({ keyword: normalizedKeyword })
  } else {
    if (stageConfig?.apiStage) {
      attempts.push({ stage: stageConfig.apiStage })
    }
    if (stageConfig?.fallbackKeyword) {
      attempts.push({ keyword: stageConfig.fallbackKeyword })
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
  total: number
  page: number
  pageSize: number
  selectedCategory: string | null
  selectedTag: string | null
  selectedStage: string | null
  keyword: string
  loading: boolean
  error: string | null
  fetchArticles: (params?: { page?: number; reset?: boolean }) => Promise<void>
  fetchCategories: () => Promise<void>
  fetchTags: () => Promise<void>
  fetchArticleDetail: (slug: string) => Promise<void>
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
  total: 0,
  page: 1,
  pageSize: MOBILE_KNOWLEDGE_PAGE_SIZE,
  selectedCategory: null,
  selectedTag: null,
  selectedStage: null,
  keyword: '',
  loading: false,
  error: null,

  fetchArticles: async (params) => {
    const state = get()
    const page = params?.page || state.page
    set({ loading: true, error: null })
    try {
      const response = await getKnowledgeArticlesWithFallback({
        page,
        pageSize: state.pageSize,
        category: state.selectedCategory || undefined,
        tag: state.selectedTag || undefined,
        selectedStage: state.selectedStage,
        keyword: state.keyword,
      })
      const nextArticles = params?.reset
        ? sortKnowledgeArticles(response.list)
        : mergeKnowledgeArticles(state.articles, response.list)
      set({
        articles: nextArticles,
        total: response.pagination.total,
        page: response.pagination.page,
        loading: false,
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (__DEV__) {
        console.warn('[KnowledgeStore] fetchArticles failed', err.message || error)
      }
      set({ error: err.message || '获取文章失败', loading: false })
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
    set({ loading: true, error: null })
    try {
      set({ currentArticle: await articleApi.getBySlug(slug) as Article, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '获取文章详情失败', loading: false })
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
  }),

  search: async (keyword) => {
    set({ keyword, page: 1, loading: true })
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
      set({ articles: sortKnowledgeArticles(response.list), total: response.pagination.total, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (__DEV__) {
        console.warn('[KnowledgeStore] search failed', err.message || error)
      }
      set({ error: err.message || '搜索失败', loading: false })
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

  reset: () => set({ articles: [], page: 1, selectedCategory: null, selectedTag: null, selectedStage: null, keyword: '', error: null }),
}))
