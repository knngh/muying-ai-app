import api from './index'
import type {
  ArticleListParams,
  ArticleTranslationOptions,
  AuthorityArticleTranslation, AuthorityArticleTranslationResponse, TranslationPendingError,
  AuthChangePasswordPayload,
  AuthLoginPayload,
  AuthProfileUpdatePayload,
  AuthRegisterPayload,
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
  StandardSchedulePlan, StandardScheduleGenerateResult,
} from '../../../shared/types'
import {
  AUTHORITY_TRANSLATION_REQUEST_TIMEOUT_MS,
  buildTranslationPendingError,
  getTranslationRetryDelay,
  sleep,
} from '../../../shared/utils/translation-request'

export type {
  AuthorityArticleTranslation,
  AuthorityArticleTranslationResponse,
  TranslationPendingError,
  Category,
  Tag,
  Article,
  CalendarEvent,
  User,
  PaginatedResponse,
}
export type {
  PregnancyTodoProgress,
  PregnancyDiary,
  PregnancyCustomTodo,
  PregnancyProfile,
  StandardSchedulePlan,
  StandardScheduleGenerateResult,
}
export type { PaginationMeta } from '../../../shared/types'

export interface CheckinStatus {
  checkedInToday: boolean
  currentStreak: number
  totalPoints: number
  monthlyCheckins: string[]
  nextBonusAt: number | null
  nextBonusPoints: number | null
}

export interface CheckinResult {
  checkinDate: string
  streakCount: number
  pointsAwarded: number
  totalPoints: number
  nextBonusAt: number | null
  nextBonusPoints: number | null
}

export { isTranslationPendingError } from '../../../shared/utils/translation-request'

function normalizeCalendarEvent(event: CalendarEvent | Record<string, unknown>) {
  const raw = event as Record<string, unknown>

  return {
    ...raw,
    id: Number(raw.id),
    userId: String(raw.userId ?? ''),
    eventDate: String(raw.eventDate ?? '').slice(0, 10),
    startTime: raw.startTime ? String(raw.startTime).slice(0, 5) : undefined,
    endTime: raw.endTime ? String(raw.endTime).slice(0, 5) : undefined,
    isCompleted: Boolean(raw.isCompleted),
    isAllDay: Boolean(raw.isAllDay),
    reminderEnabled: Boolean(raw.reminderEnabled),
    reminderMinutes: raw.reminderMinutes !== undefined ? Number(raw.reminderMinutes) : undefined,
    status: String(raw.status ?? ''),
  } as CalendarEvent
}

function mapCalendarEventPayload(data: CalendarEventInput) {
  return {
    ...data,
    eventTime: data.startTime,
    reminderMinutes: data.reminderEnabled === false ? 0 : data.reminderMinutes ?? 30,
    status: data.isCompleted !== undefined ? (data.isCompleted ? 1 : 0) : undefined,
  }
}

export const categoryApi = {
  getAll: (params?: ParentCategoryParams) => api.get<{ list: Category[] }>('/categories', { params }).then(res => (res as { list: Category[] }).list),
  getBySlug: (slug: string) => api.get<Category>(`/categories/${slug}`),
}

export const tagApi = {
  getAll: () => api.get<{ list: Tag[] }>('/tags').then(res => (res as { list: Tag[] }).list),
  getArticlesByTag: (slug: string, params?: PaginationParams) =>
    api.get<{ tag: Tag; articles: PaginatedResponse<Article> }>(`/tags/${slug}/articles`, { params }).then(res => (res as { tag: Tag; articles: PaginatedResponse<Article> }).articles),
}

export const articleApi = {
  getList: (params?: ArticleListParams) => api.get<PaginatedResponse<Article>>('/articles', { params }),
  getBySlug: (slug: string) => api.get<Article>(`/articles/${slug}`),
  getTranslationStatus: (slug: string) => api.get<AuthorityArticleTranslationResponse>(
    `/articles/${slug}/translation`,
    { timeout: AUTHORITY_TRANSLATION_REQUEST_TIMEOUT_MS },
  ),
  kickoffTranslation: async (slug: string) => {
    const response = await api.get<AuthorityArticleTranslationResponse>(
      `/articles/${slug}/translation`,
      { timeout: AUTHORITY_TRANSLATION_REQUEST_TIMEOUT_MS },
    )
    return response.status === 'ready' ? (response.translation || null) : null
  },
  getTranslation: async (slug: string, options?: ArticleTranslationOptions) => {
    const maxAttempts = Math.max(1, options?.maxAttempts || 3)
    const waitForReady = options?.waitForReady ?? true
    let pendingRetryAfterMs: number | undefined

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await api.get<AuthorityArticleTranslationResponse>(`/articles/${slug}/translation`, {
        params: waitForReady ? { wait: '1' } : undefined,
        timeout: AUTHORITY_TRANSLATION_REQUEST_TIMEOUT_MS,
      })
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
    api.get<PaginatedResponse<Article>>('/articles/search', { params: { q: keyword, ...params } }),
  getRelated: (id: number, limit = 5) =>
    api.get<{ list: Article[] }>(`/articles/${id}/related`, { params: { limit } }).then(res => (res as { list: Article[] }).list),
  like: (id: number) => api.post<{ liked: boolean; likeCount: number }>(`/articles/${id}/like`),
  unlike: (id: number) => api.delete<{ liked: boolean; likeCount: number }>(`/articles/${id}/like`),
  favorite: (id: number) => api.post<{ favorited: boolean; collectCount: number }>(`/articles/${id}/favorite`),
  unfavorite: (id: number) => api.delete<{ favorited: boolean; collectCount: number }>(`/articles/${id}/favorite`),
}

export const calendarApi = {
  getEvents: (params?: CalendarEventQueryParams) =>
    api.get<{ list: CalendarEvent[] }>('/calendar/events', {
      params: {
        startDate: params?.startDate,
        endDate: params?.endDate,
        type: params?.eventType,
      },
    }).then(res => (res as { list: CalendarEvent[] }).list.map(normalizeCalendarEvent)),
  getWeek: (params?: CalendarWeekParams) => api.get('/calendar/week', { params }),
  getDay: (date: string) => api.get(`/calendar/day/${date}`),
  getEventTypes: () => api.get('/calendar/event-types'),
  getTodoProgress: (params?: PregnancyWeekParams) =>
    api.get<{ list: PregnancyTodoProgress[] }>('/calendar/todo-progress', { params })
      .then(res => (res as { list: PregnancyTodoProgress[] }).list),
  updateTodoProgress: (data: PregnancyTodoProgressUpdatePayload) =>
    api.put<PregnancyTodoProgress>('/calendar/todo-progress', data),
  getDiaries: (params?: PregnancyWeekParams) =>
    api.get<{ list: PregnancyDiary[] }>('/calendar/diaries', { params })
      .then(res => (res as { list: PregnancyDiary[] }).list),
  saveDiary: (data: PregnancyDiaryPayload) =>
    api.put<PregnancyDiary>('/calendar/diaries', data),
  deleteDiary: (week: number) => api.delete<{ week: number }>(`/calendar/diaries/${week}`),
  getCustomTodos: (params?: PregnancyWeekParams) =>
    api.get<{ list: PregnancyCustomTodo[] }>('/calendar/custom-todos', { params })
      .then(res => (res as { list: PregnancyCustomTodo[] }).list),
  getStandardSchedule: () =>
    api.get<StandardSchedulePlan>('/calendar/standard-schedule'),
  generateStandardSchedule: () =>
    api.post<StandardScheduleGenerateResult>('/calendar/standard-schedule/generate'),
  createCustomTodo: (data: PregnancyCustomTodoCreatePayload) =>
    api.post<PregnancyCustomTodo>('/calendar/custom-todos', data),
  updateCustomTodo: (id: string, data: PregnancyCustomTodoUpdatePayload) =>
    api.put<PregnancyCustomTodo>(`/calendar/custom-todos/${id}`, data),
  deleteCustomTodo: (id: string) =>
    api.delete<{ id: string; week: number; todoKey: string }>(`/calendar/custom-todos/${id}`),
  createEvent: (data: CalendarEventInput) =>
    api.post<CalendarEvent>('/calendar/events', mapCalendarEventPayload(data)).then(normalizeCalendarEvent),
  updateEvent: (id: number, data: CalendarEventInput) =>
    api.put<CalendarEvent>(`/calendar/events/${id}`, mapCalendarEventPayload(data)).then(normalizeCalendarEvent),
  deleteEvent: (id: number) => api.delete(`/calendar/events/${id}`),
  completeEvent: (id: number) =>
    api.post<CalendarEvent>(`/calendar/events/${id}/complete`).then(normalizeCalendarEvent),
  dragEvent: (id: number, data: CalendarEventDragPayload) =>
    api.patch<CalendarEvent>(`/calendar/events/${id}/drag`, {
      newDate: data.newDate,
      newTime: data.newStartTime,
    }).then(normalizeCalendarEvent),
}

export const checkinApi = {
  getStatus: () => api.get<CheckinStatus>('/checkin/status'),
  checkin: () => api.post<CheckinResult>('/checkin'),
}

export const userApi = {
  getFavorites: (params?: PaginationParams) => api.get('/user/favorites', { params }),
  addFavorite: (data: FavoriteCreatePayload) => api.post('/user/favorites', { articleId: data.targetId }),
  removeFavorite: (articleId: number) => api.delete(`/user/favorites/${articleId}`),
  getReadHistory: (params?: PaginationParams) => api.get('/user/read-history', { params }),
  recordRead: (data: ReadHistoryRecordPayload) => api.post('/user/read-history', {
    articleId: data.articleId,
    readDuration: data.duration,
    progress: data.progress,
  }),
  getStats: () => api.get('/user/stats'),
  getPregnancyProfile: () => api.get<PregnancyProfile>('/user/pregnancy-profile'),
}

export const authApi = {
  register: (data: AuthRegisterPayload) =>
    api.post<{ user: User; token: string }>('/auth/register', data),
  login: (data: AuthLoginPayload) =>
    api.post<{ user: User; token: string }>('/auth/login', data),
  me: () => api.get<User>('/auth/me'),
  refresh: () => api.post<{ token: string }>('/auth/refresh'),
  updateProfile: (data: AuthProfileUpdatePayload) => api.put<User>('/auth/profile', data),
  changePassword: (data: AuthChangePasswordPayload) => api.put('/auth/password', data),
  logout: () => api.post('/auth/logout'),
}
