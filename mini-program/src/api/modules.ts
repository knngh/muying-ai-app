import api from './request'
import type {
  Category, Tag, Article, CalendarEvent, User, PaginatedResponse,
  PregnancyTodoProgress, PregnancyDiary, PregnancyCustomTodo, PregnancyProfile,
} from '../../../shared/types'

export type {
  Category, Tag, Article, CalendarEvent, User, PaginatedResponse,
  PregnancyTodoProgress, PregnancyDiary, PregnancyCustomTodo, PregnancyProfile,
}

export interface AuthorityArticleTranslation {
  slug: string
  sourceUpdatedAt?: string
  translatedTitle: string
  translatedSummary: string
  translatedContent: string
  translationNotice: string
  updatedAt: string
  model?: string
  provider?: string
  isSourceChinese?: boolean
}

export interface AuthorityArticleTranslationResponse {
  status: 'ready' | 'processing'
  retryAfterMs?: number
  translation?: AuthorityArticleTranslation
}

export type TranslationPendingError = Error & {
  translationPending: true
  retryAfterMs?: number
}

const AUTHORITY_TRANSLATION_REQUEST_TIMEOUT_MS = 45000

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function buildTranslationPendingError(retryAfterMs?: number): TranslationPendingError {
  const error = new Error('中文辅助阅读正在准备中，请稍后查看') as TranslationPendingError
  error.translationPending = true
  error.retryAfterMs = retryAfterMs
  return error
}

export function isTranslationPendingError(error: unknown): error is TranslationPendingError {
  return Boolean(error && typeof error === 'object' && 'translationPending' in error)
}

// ==================== 分类 API ====================
export const categoryApi = {
  getAll: (params?: { parentId?: number }) =>
    api.get<{ list: Category[] }>('/categories', params as Record<string, unknown>).then(res => (res as { list: Category[] }).list),
  getBySlug: (slug: string) =>
    api.get<Category>(`/categories/${slug}`),
}

// ==================== 标签 API ====================
export const tagApi = {
  getAll: () => api.get<{ list: Tag[] }>('/tags').then(res => (res as { list: Tag[] }).list),
  getArticlesByTag: (slug: string, params?: { page?: number; pageSize?: number }) =>
    api.get<{ tag: Tag; articles: PaginatedResponse<Article> }>(`/tags/${slug}/articles`, params as Record<string, unknown>)
      .then(res => (res as { tag: Tag; articles: PaginatedResponse<Article> }).articles),
}

// ==================== 文章 API ====================
export const articleApi = {
  getList: (params?: {
    page?: number; pageSize?: number; category?: string; tag?: string;
    difficulty?: string; contentType?: string; stage?: string; sort?: string; keyword?: string; source?: string
  }) => api.get<PaginatedResponse<Article>>('/articles', params as Record<string, unknown>),
  getBySlug: (slug: string) => api.get<Article>(`/articles/${slug}`),
  getTranslationStatus: (slug: string) => api.get<AuthorityArticleTranslationResponse>(
    `/articles/${slug}/translation`,
    undefined,
    { timeout: 12000 },
  ),
  kickoffTranslation: async (slug: string) => {
    const response = await api.get<AuthorityArticleTranslationResponse>(
      `/articles/${slug}/translation`,
      undefined,
      { timeout: 12000 },
    )
    return response.status === 'ready' ? (response.translation || null) : null
  },
  getTranslation: async (slug: string, options?: { maxAttempts?: number }) => {
    const maxAttempts = Math.max(1, options?.maxAttempts || 3)

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await api.get<AuthorityArticleTranslationResponse>(
        `/articles/${slug}/translation`,
        { wait: '1' },
        { timeout: AUTHORITY_TRANSLATION_REQUEST_TIMEOUT_MS },
      )
      if (response.status === 'ready' && response.translation) {
        return response.translation
      }

      if (attempt < maxAttempts - 1) {
        const baseDelay = response.retryAfterMs || 2000
        await sleep(Math.min(baseDelay * Math.pow(1.5, attempt), 10000))
      }
    }

    throw buildTranslationPendingError()
  },
  search: (keyword: string, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<Article>>('/articles/search', { q: keyword, ...params } as Record<string, unknown>),
  getRelated: (id: number, limit = 5) =>
    api.get<{ list: Article[] }>(`/articles/${id}/related`, { limit }).then(res => (res as { list: Article[] }).list),
  like: (id: number) => api.post<{ liked: boolean }>(`/articles/${id}/like`),
  unlike: (id: number) => api.delete<{ liked: boolean }>(`/articles/${id}/like`),
  favorite: (id: number) => api.post<{ favorited: boolean }>(`/articles/${id}/favorite`),
  unfavorite: (id: number) => api.delete<{ favorited: boolean }>(`/articles/${id}/favorite`),
}

// ==================== 日历事件 API ====================
export const calendarApi = {
  getEvents: (params?: { startDate?: string; endDate?: string; eventType?: string }) =>
    api.get<{ list: CalendarEvent[] }>('/calendar/events', {
      startDate: params?.startDate,
      endDate: params?.endDate,
      type: params?.eventType,
    } as Record<string, unknown>).then(res => (res as { list: CalendarEvent[] }).list),
  getWeek: (params?: { date?: string }) => api.get('/calendar/week', params as Record<string, unknown>),
  getDay: (date: string) => api.get(`/calendar/day/${date}`),
  getEventTypes: () => api.get('/calendar/event-types'),
  getTodoProgress: (params?: { week?: number }) =>
    api.get<{ list: PregnancyTodoProgress[] }>('/calendar/todo-progress', params as Record<string, unknown>)
      .then(res => (res as { list: PregnancyTodoProgress[] }).list),
  updateTodoProgress: (data: { week: number; todoKey: string; completed: boolean }) =>
    api.put<PregnancyTodoProgress>('/calendar/todo-progress', data),
  getDiaries: (params?: { week?: number }) =>
    api.get<{ list: PregnancyDiary[] }>('/calendar/diaries', params as Record<string, unknown>)
      .then(res => (res as { list: PregnancyDiary[] }).list),
  saveDiary: (data: { week: number; content: string }) =>
    api.put<PregnancyDiary>('/calendar/diaries', data),
  deleteDiary: (week: number) =>
    api.delete<{ week: number }>(`/calendar/diaries/${week}`),
  getCustomTodos: (params?: { week?: number }) =>
    api.get<{ list: PregnancyCustomTodo[] }>('/calendar/custom-todos', params as Record<string, unknown>)
      .then(res => (res as { list: PregnancyCustomTodo[] }).list),
  createCustomTodo: (data: { week: number; content: string }) =>
    api.post<PregnancyCustomTodo>('/calendar/custom-todos', data),
  updateCustomTodo: (id: string, data: { content: string }) =>
    api.put<PregnancyCustomTodo>(`/calendar/custom-todos/${id}`, data),
  deleteCustomTodo: (id: string) =>
    api.delete<{ id: string; week: number; todoKey: string }>(`/calendar/custom-todos/${id}`),
  createEvent: (data: Partial<CalendarEvent>) => api.post<CalendarEvent>('/calendar/events', {
    ...data,
    eventTime: data.startTime,
  }),
  updateEvent: (id: number, data: Partial<CalendarEvent>) => api.put<CalendarEvent>(`/calendar/events/${id}`, {
    ...data,
    eventTime: data.startTime,
  }),
  deleteEvent: (id: number) => api.delete(`/calendar/events/${id}`),
  completeEvent: (id: number) => api.post<CalendarEvent>(`/calendar/events/${id}/complete`),
  dragEvent: (id: number, data: { newDate: string; newStartTime?: string }) => api.patch<CalendarEvent>(`/calendar/events/${id}/drag`, {
    newDate: data.newDate,
    newTime: data.newStartTime,
  }),
}

// ==================== 用户 API ====================
export const userApi = {
  getFavorites: (params?: { page?: number; pageSize?: number }) =>
    api.get('/user/favorites', params as Record<string, unknown>),
  addFavorite: (data: { targetId: number; targetType: string }) => api.post('/user/favorites', { articleId: data.targetId }),
  removeFavorite: (articleId: number) => api.delete(`/user/favorites/${articleId}`),
  getReadHistory: (params?: { page?: number; pageSize?: number }) =>
    api.get('/user/read-history', params as Record<string, unknown>),
  recordRead: (data: { articleId: number; duration?: number; progress?: number }) =>
    api.post('/user/read-history', { articleId: data.articleId, readDuration: data.duration, progress: data.progress }),
  getStats: () => api.get('/user/stats'),
  getPregnancyProfile: () => api.get<PregnancyProfile>('/user/pregnancy-profile'),
}

// ==================== 认证 API ====================
export const authApi = {
  register: (data: { username: string; password: string; pregnancyWeek?: string }) =>
    api.post<{ user: User; token: string }>('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', data),
  wechatLogin: (data: { code: string; pregnancyWeek?: string }) =>
    api.post<{ user: User; token: string }>('/auth/wechat-login', data),
  me: () => api.get<User>('/auth/me'),
  refresh: () => api.post<{ token: string }>('/auth/refresh'),
  updateProfile: (data: {
    nickname?: string; avatar?: string; pregnancyStatus?: number;
    dueDate?: string | null; babyBirthday?: string | null; babyGender?: number
  }) => api.put<User>('/auth/profile', data),
  changePassword: (data: { oldPassword: string; newPassword: string }) => api.put('/auth/password', data),
  logout: () => api.post('/auth/logout'),
}
