import { create } from 'zustand'
import { articleApi, categoryApi, tagApi } from '../api/modules'
import type { Article, Category, Tag, PaginatedResponse } from '../api/modules'

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
  pageSize: 10,
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
      const response = await articleApi.getList({
        page, pageSize: state.pageSize,
        contentType: KNOWLEDGE_CONTENT_TYPE,
        category: state.selectedCategory || undefined,
        tag: state.selectedTag || undefined,
        stage: state.selectedStage || undefined,
        keyword: state.keyword || undefined,
      }) as PaginatedResponse<Article>
      const nextArticles = params?.reset ? response.list : [...state.articles, ...response.list]
      set({
        articles: sortKnowledgeArticles(nextArticles),
        total: response.pagination.total,
        page: response.pagination.page,
        loading: false,
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
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

  search: async (keyword) => {
    set({ keyword, page: 1, loading: true })
    try {
      const response = await articleApi.getList({
        page: 1,
        pageSize: get().pageSize,
        contentType: KNOWLEDGE_CONTENT_TYPE,
        keyword,
        stage: get().selectedStage || undefined,
      }) as PaginatedResponse<Article>
      set({ articles: sortKnowledgeArticles(response.list), total: response.pagination.total, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '搜索失败', loading: false })
    }
  },

  likeArticle: async (id) => {
    try {
      const result = await articleApi.like(id) as { liked: boolean }
      set(state => ({ articles: state.articles.map(a => a.id === id ? { ...a, liked: result.liked } : a) }))
    } catch (_e) { /* ignore */ }
  },

  favoriteArticle: async (id) => {
    try {
      const result = await articleApi.favorite(id) as { favorited: boolean }
      set(state => ({ articles: state.articles.map(a => a.id === id ? { ...a, favorited: result.favorited } : a) }))
    } catch (_e) { /* ignore */ }
  },

  reset: () => set({ articles: [], page: 1, selectedCategory: null, selectedTag: null, selectedStage: null, keyword: '', error: null }),
}))
