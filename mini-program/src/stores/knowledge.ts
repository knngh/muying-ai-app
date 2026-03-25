import { defineStore } from 'pinia'
import { articleApi, categoryApi, tagApi } from '@/api/modules'
import type { Article, Category, Tag, PaginatedResponse } from '@/api/modules'

export const useKnowledgeStore = defineStore('knowledge', {
  state: () => ({
    articles: [] as Article[],
    categories: [] as Category[],
    tags: [] as Tag[],
    currentArticle: null as Article | null,
    total: 0,
    page: 1,
    pageSize: 10,
    selectedCategory: null as string | null,
    selectedTag: null as string | null,
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
          category: this.selectedCategory || undefined,
          tag: this.selectedTag || undefined,
          stage: this.selectedStage || undefined,
          keyword: this.keyword || undefined,
        }) as PaginatedResponse<Article>

        this.articles = params?.reset ? response.list : [...this.articles, ...response.list]
        this.total = response.pagination.total
        this.page = response.pagination.page
      } catch (error: unknown) {
        const err = error as { message?: string }
        this.error = err.message || '获取文章列表失败'
      } finally {
        this.loading = false
      }
    },

    async fetchCategories() {
      try {
        this.categories = await categoryApi.getAll() as Category[]
      } catch (_error) {
        console.error('获取分类失败:', _error)
      }
    },

    async fetchTags() {
      try {
        this.tags = await tagApi.getAll() as Tag[]
      } catch (_error) {
        console.error('获取标签失败:', _error)
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

    setCategory(categorySlug: string | null) {
      this.selectedCategory = categorySlug
      this.page = 1
      this.fetchArticles({ reset: true })
    },

    setTag(tagSlug: string | null) {
      this.selectedTag = tagSlug
      this.page = 1
      this.fetchArticles({ reset: true })
    },

    setStage(stage: string | null) {
      this.selectedStage = stage
      this.page = 1
      this.fetchArticles({ reset: true })
    },

    setStageAndNavigate(stage: string) {
      this.selectedStage = stage
      this.page = 1
      uni.switchTab({ url: '/pages/knowledge/index' })
    },

    setKeyword(keyword: string) {
      this.keyword = keyword
    },

    async search(keyword: string) {
      this.keyword = keyword
      this.page = 1
      this.loading = true
      try {
        const response = await articleApi.search(keyword, {
          page: 1,
          pageSize: this.pageSize,
        }) as PaginatedResponse<Article>
        this.articles = response.list
        this.total = response.pagination.total
      } catch (error: unknown) {
        const err = error as { message?: string }
        this.error = err.message || '搜索失败'
      } finally {
        this.loading = false
      }
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
      this.selectedCategory = null
      this.selectedTag = null
      this.selectedStage = null
      this.keyword = ''
      this.error = null
    },
  },
})
