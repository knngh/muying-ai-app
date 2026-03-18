import { create } from 'zustand'
import { articleApi, categoryApi, tagApi } from '../api/modules'
import type { Article, Category, Tag, PaginatedResponse } from '../api/modules'

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
        category: state.selectedCategory || undefined,
        tag: state.selectedTag || undefined,
        stage: state.selectedStage || undefined,
        keyword: state.keyword || undefined,
      }) as PaginatedResponse<Article>
      set({
        articles: params?.reset ? response.list : [...state.articles, ...response.list],
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
    try { set({ categories: await categoryApi.getAll() as Category[] }) } catch (_e) { /* ignore */ }
  },

  fetchTags: async () => {
    try { set({ tags: await tagApi.getAll() as Tag[] }) } catch (_e) { /* ignore */ }
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
      const response = await articleApi.search(keyword, { page: 1, pageSize: get().pageSize }) as PaginatedResponse<Article>
      set({ articles: response.list, total: response.pagination.total, loading: false })
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
