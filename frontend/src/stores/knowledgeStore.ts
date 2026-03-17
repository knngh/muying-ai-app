import { create } from 'zustand'
import { 
  Article, 
  Category, 
  Tag, 
  articleApi, 
  categoryApi, 
  tagApi 
} from '@/api/modules'

interface KnowledgeState {
  // 数据
  articles: Article[]
  categories: Category[]
  tags: Tag[]
  currentArticle: Article | null
  
  // 分页
  total: number
  page: number
  pageSize: number
  
  // 筛选条件
  selectedCategory: number | null
  selectedTag: number | null
  selectedStage: string | null
  keyword: string
  
  // 状态
  loading: boolean
  error: string | null
  
  // 操作
  fetchArticles: (params?: { page?: number; reset?: boolean }) => Promise<void>
  fetchCategories: () => Promise<void>
  fetchTags: () => Promise<void>
  fetchArticleDetail: (id: number) => Promise<void>
  setCategory: (categoryId: number | null) => void
  setTag: (tagId: number | null) => void
  setStage: (stage: string | null) => void
  setKeyword: (keyword: string) => void
  search: (keyword: string) => Promise<void>
  likeArticle: (id: number) => Promise<void>
  favoriteArticle: (id: number) => Promise<void>
  reset: () => void
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  // 初始状态
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

  // 获取文章列表
  fetchArticles: async (params) => {
    const state = get()
    const page = params?.page || state.page
    
    set({ loading: true, error: null })
    
    try {
      const response = await articleApi.getList({
        page,
        pageSize: state.pageSize,
        categoryId: state.selectedCategory || undefined,
        tagId: state.selectedTag || undefined,
        stage: state.selectedStage || undefined,
        keyword: state.keyword || undefined,
      }) as PaginatedResponse<Article>
      
      set({
        articles: params?.reset ? response.data : [...state.articles, ...response.data],
        total: response.total,
        page: response.page,
        loading: false,
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ 
        error: err.message || '获取文章列表失败', 
        loading: false 
      })
    }
  },

  // 获取分类列表
  fetchCategories: async () => {
    try {
      const categories = await categoryApi.getAll() as Category[]
      set({ categories })
    } catch (error: unknown) {
      console.error('获取分类失败:', error)
    }
  },

  // 获取标签列表
  fetchTags: async () => {
    try {
      const tags = await tagApi.getAll() as Tag[]
      set({ tags })
    } catch (error: unknown) {
      console.error('获取标签失败:', error)
    }
  },

  // 获取文章详情
  fetchArticleDetail: async (id: number) => {
    set({ loading: true, error: null })
    
    try {
      const article = await articleApi.getById(id) as Article
      set({ currentArticle: article, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ 
        error: err.message || '获取文章详情失败', 
        loading: false 
      })
    }
  },

  // 设置分类筛选
  setCategory: (categoryId) => {
    set({ selectedCategory: categoryId, page: 1 })
    get().fetchArticles({ reset: true })
  },

  // 设置标签筛选
  setTag: (tagId) => {
    set({ selectedTag: tagId, page: 1 })
    get().fetchArticles({ reset: true })
  },

  // 设置阶段筛选
  setStage: (stage) => {
    set({ selectedStage: stage, page: 1 })
    get().fetchArticles({ reset: true })
  },

  // 设置搜索关键词
  setKeyword: (keyword) => {
    set({ keyword })
  },

  // 搜索
  search: async (keyword: string) => {
    set({ keyword, page: 1, loading: true })
    
    try {
      const response = await articleApi.search(keyword, { 
        page: 1, 
        pageSize: get().pageSize 
      }) as PaginatedResponse<Article>
      
      set({
        articles: response.data,
        total: response.total,
        loading: false,
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ 
        error: err.message || '搜索失败', 
        loading: false 
      })
    }
  },

  // 点赞文章
  likeArticle: async (id: number) => {
    try {
      const result = await articleApi.like(id) as { likeCount: number }
      const articles = get().articles.map(a => 
        a.id === id ? { ...a, likeCount: result.likeCount } : a
      )
      set({ articles })
    } catch (error: unknown) {
      console.error('点赞失败:', error)
    }
  },

  // 收藏文章
  favoriteArticle: async (id: number) => {
    try {
      const result = await articleApi.favorite(id) as { favoriteCount: number }
      const articles = get().articles.map(a => 
        a.id === id ? { ...a, favoriteCount: result.favoriteCount } : a
      )
      set({ articles })
    } catch (error: unknown) {
      console.error('收藏失败:', error)
    }
  },

  // 重置
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

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}