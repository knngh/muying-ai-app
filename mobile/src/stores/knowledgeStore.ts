import { create } from 'zustand'
import { articleApi, categoryApi, tagApi } from '../api/modules'
import type { Article, Category, Tag, PaginatedResponse } from '../api/modules'

const KNOWLEDGE_CONTENT_TYPE = 'authority'
const STAGE_QUERY_MAP: Record<string, { apiStage?: string; fallbackKeyword?: string }> = {
  preparation: { apiStage: 'preparation', fallbackKeyword: '备孕 叶酸 孕前检查' },
  'first-trimester': { apiStage: 'first-trimester', fallbackKeyword: '孕早期 建档 早孕反应' },
  'second-trimester': { apiStage: 'second-trimester', fallbackKeyword: '孕中期 胎动 糖耐' },
  'third-trimester': { apiStage: 'third-trimester', fallbackKeyword: '孕晚期 待产 分娩征兆' },
  '0-6-months': { apiStage: '0-6-months', fallbackKeyword: '新生儿 喂养 夜醒 疫苗' },
  '6-12-months': { apiStage: '6-12-months', fallbackKeyword: '辅食 睡眠倒退 发育 疫苗' },
  '1-3-years': { apiStage: '1-3-years', fallbackKeyword: '语言发展 如厕 情绪 挑食' },
  '3-years-plus': { fallbackKeyword: '儿童 语言 情绪行为 睡眠 习惯 入园' },
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

function buildKnowledgeQuery(selectedStage: string | null, keyword: string) {
  const stageConfig = selectedStage ? STAGE_QUERY_MAP[selectedStage] : undefined
  const normalizedKeyword = keyword.trim()

  if (normalizedKeyword) {
    return {
      stage: stageConfig?.apiStage,
      keyword: normalizedKeyword,
    }
  }

  return {
    stage: stageConfig?.apiStage,
    keyword: stageConfig?.apiStage ? undefined : stageConfig?.fallbackKeyword,
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
      const query = buildKnowledgeQuery(state.selectedStage, state.keyword)
      const response = await articleApi.getList({
        page, pageSize: state.pageSize,
        contentType: KNOWLEDGE_CONTENT_TYPE,
        category: state.selectedCategory || undefined,
        tag: state.selectedTag || undefined,
        stage: query.stage,
        keyword: query.keyword,
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
      const query = buildKnowledgeQuery(get().selectedStage, keyword)
      const response = await articleApi.getList({
        page: 1,
        pageSize: get().pageSize,
        contentType: KNOWLEDGE_CONTENT_TYPE,
        keyword: query.keyword,
        stage: query.stage,
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
      set((state) => ({
        articles: state.articles.map((a) => (
          a.id === id
            ? {
                ...a,
                isLiked: result.liked,
                likeCount: result.liked ? a.likeCount + 1 : Math.max(a.likeCount - 1, 0),
              }
            : a
        )),
        currentArticle: state.currentArticle?.id === id
          ? {
              ...state.currentArticle,
              isLiked: result.liked,
              likeCount: result.liked
                ? state.currentArticle.likeCount + 1
                : Math.max(state.currentArticle.likeCount - 1, 0),
            }
          : state.currentArticle,
      }))
    } catch (_e) { /* ignore */ }
  },

  favoriteArticle: async (id) => {
    try {
      const result = await articleApi.favorite(id) as { favorited: boolean }
      set((state) => ({
        articles: state.articles.map((a) => (
          a.id === id
            ? {
                ...a,
                isFavorited: result.favorited,
                collectCount: result.favorited ? a.collectCount + 1 : Math.max(a.collectCount - 1, 0),
              }
            : a
        )),
        currentArticle: state.currentArticle?.id === id
          ? {
              ...state.currentArticle,
              isFavorited: result.favorited,
              collectCount: result.favorited
                ? state.currentArticle.collectCount + 1
                : Math.max(state.currentArticle.collectCount - 1, 0),
            }
          : state.currentArticle,
      }))
    } catch (_e) { /* ignore */ }
  },

  reset: () => set({ articles: [], page: 1, selectedCategory: null, selectedTag: null, selectedStage: null, keyword: '', error: null }),
}))
