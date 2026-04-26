import api from './request'
import type {
  ArticleListParams,
  ArticleTranslationOptions,
  AuthorityArticleTranslation, AuthorityArticleTranslationResponse, TranslationPendingError,
  AuthChangePasswordPayload,
  AuthLoginPayload,
  AuthProfileUpdatePayload,
  AuthRegisterPayload,
  AuthWechatLoginPayload,
  CalendarEventDragPayload,
  CalendarEventInput,
  CalendarEventQueryParams,
  CalendarWeekParams,
  Category, Tag, Article, CalendarEvent, User, PaginatedResponse,
  FavoriteCreatePayload,
  PaginationParams,
  ParentCategoryParams,
  PregnancyTodoProgress, PregnancyDiary, PregnancyCustomTodo, PregnancyProfile,
  PregnancyCustomTodoCreatePayload,
  PregnancyCustomTodoUpdatePayload,
  PregnancyDiaryPayload,
  PregnancyTodoProgressUpdatePayload,
  PregnancyWeekParams,
  ReadHistoryRecordPayload,
} from '../../../shared/types'
import {
  AUTHORITY_TRANSLATION_REQUEST_TIMEOUT_MS,
  buildTranslationPendingError,
  getTranslationRetryDelay,
  sleep,
} from '../../../shared/utils/translation-request'

export type {
  AuthorityArticleTranslation, AuthorityArticleTranslationResponse, TranslationPendingError,
  Category, Tag, Article, CalendarEvent, User, PaginatedResponse,
  PregnancyTodoProgress, PregnancyDiary, PregnancyCustomTodo, PregnancyProfile,
}
export { isTranslationPendingError } from '../../../shared/utils/translation-request'

// ==================== 分类 API ====================
export const categoryApi = {
  getAll: (params?: ParentCategoryParams) =>
    api.get<{ list: Category[] }>('/categories', params as Record<string, unknown>).then(res => (res as { list: Category[] }).list),
  getBySlug: (slug: string) =>
    api.get<Category>(`/categories/${slug}`),
}

// ==================== 标签 API ====================
export const tagApi = {
  getAll: () => api.get<{ list: Tag[] }>('/tags').then(res => (res as { list: Tag[] }).list),
  getArticlesByTag: (slug: string, params?: PaginationParams) =>
    api.get<{ tag: Tag; articles: PaginatedResponse<Article> }>(`/tags/${slug}/articles`, params as Record<string, unknown>)
      .then(res => (res as { tag: Tag; articles: PaginatedResponse<Article> }).articles),
}

// ==================== 文章 API ====================
export const articleApi = {
  getList: (params?: ArticleListParams) =>
    api.get<PaginatedResponse<Article>>('/articles', params as Record<string, unknown>),
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
  getTranslation: async (slug: string, options?: ArticleTranslationOptions) => {
    const maxAttempts = Math.max(1, options?.maxAttempts || 3)
    let pendingRetryAfterMs: number | undefined

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await api.get<AuthorityArticleTranslationResponse>(
        `/articles/${slug}/translation`,
        { wait: '1' },
        { timeout: AUTHORITY_TRANSLATION_REQUEST_TIMEOUT_MS },
      )
      if (response.status === 'ready' && response.translation) {
        return response.translation
      }

      pendingRetryAfterMs = response.retryAfterMs

      if (attempt < maxAttempts - 1) {
        await sleep(getTranslationRetryDelay(response.retryAfterMs, attempt))
      }
    }

    throw buildTranslationPendingError(pendingRetryAfterMs)
  },
  search: (keyword: string, params?: PaginationParams) =>
    api.get<PaginatedResponse<Article>>('/articles/search', { q: keyword, ...params } as Record<string, unknown>),
  getRelated: (id: number, limit = 5) =>
    api.get<{ list: Article[] }>(`/articles/${id}/related`, { limit }).then(res => (res as { list: Article[] }).list),
  like: (id: number) => api.post<{ liked: boolean; likeCount: number }>(`/articles/${id}/like`),
  unlike: (id: number) => api.delete<{ liked: boolean; likeCount: number }>(`/articles/${id}/like`),
  favorite: (id: number) => api.post<{ favorited: boolean; collectCount: number }>(`/articles/${id}/favorite`),
  unfavorite: (id: number) => api.delete<{ favorited: boolean; collectCount: number }>(`/articles/${id}/favorite`),
}

// ==================== 日历事件 API ====================
export const calendarApi = {
  getEvents: (params?: CalendarEventQueryParams) =>
    api.get<{ list: CalendarEvent[] }>('/calendar/events', {
      startDate: params?.startDate,
      endDate: params?.endDate,
      type: params?.eventType,
    } as Record<string, unknown>).then(res => (res as { list: CalendarEvent[] }).list),
  getWeek: (params?: CalendarWeekParams) => api.get('/calendar/week', params as Record<string, unknown>),
  getDay: (date: string) => api.get(`/calendar/day/${date}`),
  getEventTypes: () => api.get('/calendar/event-types'),
  getTodoProgress: (params?: PregnancyWeekParams) =>
    api.get<{ list: PregnancyTodoProgress[] }>('/calendar/todo-progress', params as Record<string, unknown>)
      .then(res => (res as { list: PregnancyTodoProgress[] }).list),
  updateTodoProgress: (data: PregnancyTodoProgressUpdatePayload) =>
    api.put<PregnancyTodoProgress>('/calendar/todo-progress', data),
  getDiaries: (params?: PregnancyWeekParams) =>
    api.get<{ list: PregnancyDiary[] }>('/calendar/diaries', params as Record<string, unknown>)
      .then(res => (res as { list: PregnancyDiary[] }).list),
  saveDiary: (data: PregnancyDiaryPayload) =>
    api.put<PregnancyDiary>('/calendar/diaries', data),
  deleteDiary: (week: number) =>
    api.delete<{ week: number }>(`/calendar/diaries/${week}`),
  getCustomTodos: (params?: PregnancyWeekParams) =>
    api.get<{ list: PregnancyCustomTodo[] }>('/calendar/custom-todos', params as Record<string, unknown>)
      .then(res => (res as { list: PregnancyCustomTodo[] }).list),
  createCustomTodo: (data: PregnancyCustomTodoCreatePayload) =>
    api.post<PregnancyCustomTodo>('/calendar/custom-todos', data),
  updateCustomTodo: (id: string, data: PregnancyCustomTodoUpdatePayload) =>
    api.put<PregnancyCustomTodo>(`/calendar/custom-todos/${id}`, data),
  deleteCustomTodo: (id: string) =>
    api.delete<{ id: string; week: number; todoKey: string }>(`/calendar/custom-todos/${id}`),
  createEvent: (data: CalendarEventInput) => api.post<CalendarEvent>('/calendar/events', {
    ...data,
    eventTime: data.startTime,
  }),
  updateEvent: (id: number, data: CalendarEventInput) => api.put<CalendarEvent>(`/calendar/events/${id}`, {
    ...data,
    eventTime: data.startTime,
  }),
  deleteEvent: (id: number) => api.delete(`/calendar/events/${id}`),
  completeEvent: (id: number) => api.post<CalendarEvent>(`/calendar/events/${id}/complete`),
  dragEvent: (id: number, data: CalendarEventDragPayload) => api.patch<CalendarEvent>(`/calendar/events/${id}/drag`, {
    newDate: data.newDate,
    newTime: data.newStartTime,
  }),
}

// ==================== 用户 API ====================
export const userApi = {
  getFavorites: (params?: PaginationParams) =>
    api.get('/user/favorites', params as Record<string, unknown>),
  addFavorite: (data: FavoriteCreatePayload) => api.post('/user/favorites', { articleId: data.targetId }),
  removeFavorite: (articleId: number) => api.delete(`/user/favorites/${articleId}`),
  getReadHistory: (params?: PaginationParams) =>
    api.get('/user/read-history', params as Record<string, unknown>),
  recordRead: (data: ReadHistoryRecordPayload) =>
    api.post('/user/read-history', { articleId: data.articleId, readDuration: data.duration, progress: data.progress }),
  getStats: () => api.get('/user/stats'),
  getPregnancyProfile: () => api.get<PregnancyProfile>('/user/pregnancy-profile'),
}

// ==================== 认证 API ====================
export const authApi = {
  register: (data: AuthRegisterPayload) =>
    api.post<{ user: User; token: string }>('/auth/register', data),
  login: (data: AuthLoginPayload) =>
    api.post<{ user: User; token: string }>('/auth/login', data),
  wechatLogin: (data: AuthWechatLoginPayload) =>
    api.post<{ user: User; token: string }>('/auth/wechat-login', data),
  me: () => api.get<User>('/auth/me'),
  refresh: () => api.post<{ token: string }>('/auth/refresh'),
  updateProfile: (data: AuthProfileUpdatePayload) => api.put<User>('/auth/profile', data),
  changePassword: (data: AuthChangePasswordPayload) => api.put('/auth/password', data),
  logout: () => api.post('/auth/logout'),
}
