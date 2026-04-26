import { create } from 'zustand'
import {
  Article,
  Category,
  Tag,
  PaginatedResponse,
  articleApi,
  categoryApi,
  tagApi,
} from '@/api/modules'

let knowledgeListRequestId = 0
const articleDetailInFlight = new Map<string, Promise<Article>>()

function mergeArticlePages(existing: Article[], incoming: Article[]) {
  const articleMap = new Map<string, Article>()

  existing.forEach((article) => {
    articleMap.set(article.slug, article)
  })

  incoming.forEach((article) => {
    const previous = articleMap.get(article.slug)
    articleMap.set(article.slug, previous ? { ...previous, ...article } : article)
  })

  return Array.from(articleMap.values())
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
  setCategory: (categorySlug: string | null) => void
  setTag: (tagSlug: string | null) => void
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
    const requestId = ++knowledgeListRequestId

    set({ loading: true, error: null })

    try {
      const response = (await articleApi.getList({
        page,
        pageSize: state.pageSize,
        category: state.selectedCategory || undefined,
        tag: state.selectedTag || undefined,
        stage: state.selectedStage || undefined,
        keyword: state.keyword || undefined,
      })) as PaginatedResponse<Article>

      if (requestId !== knowledgeListRequestId) {
        return
      }

      set({
        articles: params?.reset ? mergeArticlePages([], response.list) : mergeArticlePages(state.articles, response.list),
        total: response.pagination.total,
        page: response.pagination.page,
        loading: false,
      })
    } catch (error: unknown) {
      if (requestId !== knowledgeListRequestId) {
        return
      }

      const err = error as { message?: string }
      set({
        error: err.message || '获取文章列表失败',
        loading: false,
      })
    }
  },

  fetchCategories: async () => {
    try {
      const categories = (await categoryApi.getAll()) as Category[]
      set({ categories })
    } catch (error: unknown) {
      console.error('获取分类失败:', error)
    }
  },

  fetchTags: async () => {
    try {
      const tags = (await tagApi.getAll()) as Tag[]
      set({ tags })
    } catch (error: unknown) {
      console.error('获取标签失败:', error)
    }
  },

  fetchArticleDetail: async (slug: string) => {
    const currentArticle = get().currentArticle
    if (currentArticle?.slug === slug) {
      return
    }

    set({ loading: true, error: null })

    try {
      const inFlight = articleDetailInFlight.get(slug)
      const request = inFlight || articleApi.getBySlug(slug) as Promise<Article>
      if (!inFlight) {
        articleDetailInFlight.set(slug, request)
      }

      const article = await request
      set({ currentArticle: article, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({
        error: err.message || '获取文章详情失败',
        loading: false,
      })
    } finally {
      const inFlight = articleDetailInFlight.get(slug)
      if (inFlight) {
        articleDetailInFlight.delete(slug)
      }
    }
  },

  setCategory: (categorySlug) => {
    set({ selectedCategory: categorySlug, page: 1 })
    get().fetchArticles({ reset: true })
  },

  setTag: (tagSlug) => {
    set({ selectedTag: tagSlug, page: 1 })
    get().fetchArticles({ reset: true })
  },

  setStage: (stage) => {
    set({ selectedStage: stage, page: 1 })
    get().fetchArticles({ reset: true })
  },

  setKeyword: (keyword) => {
    set({ keyword })
  },

  search: async (keyword: string) => {
    const requestId = ++knowledgeListRequestId
    set({ keyword, page: 1, loading: true })

    try {
      const response = (await articleApi.search(keyword, {
        page: 1,
        pageSize: get().pageSize,
      })) as PaginatedResponse<Article>

      if (requestId !== knowledgeListRequestId) {
        return
      }

      set({
        articles: mergeArticlePages([], response.list),
        total: response.pagination.total,
        loading: false,
      })
    } catch (error: unknown) {
      if (requestId !== knowledgeListRequestId) {
        return
      }

      const err = error as { message?: string }
      set({
        error: err.message || '搜索失败',
        loading: false,
      })
    }
  },

  likeArticle: async (id: number) => {
    try {
      const currentArticle = get().currentArticle?.id === id
        ? get().currentArticle
        : get().articles.find((item) => item.id === id)
      const result = currentArticle?.isLiked
        ? await articleApi.unlike(id) as { liked: boolean; likeCount?: number }
        : await articleApi.like(id) as { liked: boolean; likeCount?: number }
      set((state) => ({
        articles: state.articles.map((a) =>
          a.id === id
            ? {
                ...a,
                isLiked: result.liked,
                likeCount: typeof result.likeCount === 'number'
                  ? result.likeCount
                  : (result.liked ? a.likeCount + 1 : Math.max(a.likeCount - 1, 0)),
              }
            : a
        ),
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
    } catch (error: unknown) {
      console.error('点赞失败:', error)
    }
  },

  favoriteArticle: async (id: number) => {
    try {
      const currentArticle = get().currentArticle?.id === id
        ? get().currentArticle
        : get().articles.find((item) => item.id === id)
      const result = currentArticle?.isFavorited
        ? await articleApi.unfavorite(id) as { favorited: boolean; collectCount?: number }
        : await articleApi.favorite(id) as { favorited: boolean; collectCount?: number }
      set((state) => ({
        articles: state.articles.map((a) =>
          a.id === id
            ? {
                ...a,
                isFavorited: result.favorited,
                collectCount: typeof result.collectCount === 'number'
                  ? result.collectCount
                  : (result.favorited ? a.collectCount + 1 : Math.max(a.collectCount - 1, 0)),
              }
            : a
        ),
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
    } catch (error: unknown) {
      console.error('收藏失败:', error)
    }
  },

  reset: () => {
    set({
      articles: [],
      page: 1,
      selectedCategory: null,
      selectedTag: null,
      selectedStage: null,
      keyword: '',
      error: null,
    })
  },
}))
