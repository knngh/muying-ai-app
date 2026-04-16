import api from './index'
import type {
  Category, Tag, Article, CalendarEvent, User, PaginatedResponse,
  PregnancyTodoProgress, PregnancyDiary, PregnancyCustomTodo, PregnancyProfile,
  StandardSchedulePlan, StandardScheduleGenerateResult,
} from '../../../shared/types'

export type { Category, Tag, Article, CalendarEvent, User, PaginatedResponse }
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

function mapCalendarEventPayload(data: Partial<CalendarEvent>) {
  return {
    ...data,
    eventTime: data.startTime,
    reminderMinutes: data.reminderEnabled === false ? 0 : data.reminderMinutes ?? 30,
    status: data.isCompleted !== undefined ? (data.isCompleted ? 1 : 0) : undefined,
  }
}

export const categoryApi = {
  getAll: (params?: { parentId?: number }) => api.get<{ list: Category[] }>('/categories', { params }).then(res => (res as { list: Category[] }).list),
  getBySlug: (slug: string) => api.get<Category>(`/categories/${slug}`),
}

export const tagApi = {
  getAll: () => api.get<{ list: Tag[] }>('/tags').then(res => (res as { list: Tag[] }).list),
  getArticlesByTag: (slug: string, params?: { page?: number; pageSize?: number }) =>
    api.get<{ tag: Tag; articles: PaginatedResponse<Article> }>(`/tags/${slug}/articles`, { params }).then(res => (res as { tag: Tag; articles: PaginatedResponse<Article> }).articles),
}

export const articleApi = {
  getList: (params?: {
    page?: number; pageSize?: number; category?: string; tag?: string;
    difficulty?: string; contentType?: string; stage?: string; sort?: string; keyword?: string
  }) => api.get<PaginatedResponse<Article>>('/articles', { params }),
  getBySlug: (slug: string) => api.get<Article>(`/articles/${slug}`),
  getTranslation: (slug: string) => api.get<AuthorityArticleTranslation>(`/articles/${slug}/translation`),
  search: (keyword: string, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<Article>>('/articles/search', { params: { q: keyword, ...params } }),
  getRelated: (id: number, limit = 5) =>
    api.get<{ list: Article[] }>(`/articles/${id}/related`, { params: { limit } }).then(res => (res as { list: Article[] }).list),
  like: (id: number) => api.post<{ liked: boolean }>(`/articles/${id}/like`),
  unlike: (id: number) => api.delete<{ liked: boolean }>(`/articles/${id}/like`),
  favorite: (id: number) => api.post<{ favorited: boolean }>(`/articles/${id}/favorite`),
  unfavorite: (id: number) => api.delete<{ favorited: boolean }>(`/articles/${id}/favorite`),
}

export const calendarApi = {
  getEvents: (params?: { startDate?: string; endDate?: string; eventType?: string }) =>
    api.get<{ list: CalendarEvent[] }>('/calendar/events', {
      params: {
        startDate: params?.startDate,
        endDate: params?.endDate,
        type: params?.eventType,
      },
    }).then(res => (res as { list: CalendarEvent[] }).list.map(normalizeCalendarEvent)),
  getWeek: (params?: { date?: string }) => api.get('/calendar/week', { params }),
  getDay: (date: string) => api.get(`/calendar/day/${date}`),
  getEventTypes: () => api.get('/calendar/event-types'),
  getTodoProgress: (params?: { week?: number }) =>
    api.get<{ list: PregnancyTodoProgress[] }>('/calendar/todo-progress', { params })
      .then(res => (res as { list: PregnancyTodoProgress[] }).list),
  updateTodoProgress: (data: { week: number; todoKey: string; completed: boolean }) =>
    api.put<PregnancyTodoProgress>('/calendar/todo-progress', data),
  getDiaries: (params?: { week?: number }) =>
    api.get<{ list: PregnancyDiary[] }>('/calendar/diaries', { params })
      .then(res => (res as { list: PregnancyDiary[] }).list),
  saveDiary: (data: { week: number; content: string }) =>
    api.put<PregnancyDiary>('/calendar/diaries', data),
  deleteDiary: (week: number) => api.delete<{ week: number }>(`/calendar/diaries/${week}`),
  getCustomTodos: (params?: { week?: number }) =>
    api.get<{ list: PregnancyCustomTodo[] }>('/calendar/custom-todos', { params })
      .then(res => (res as { list: PregnancyCustomTodo[] }).list),
  getStandardSchedule: () =>
    api.get<StandardSchedulePlan>('/calendar/standard-schedule'),
  generateStandardSchedule: () =>
    api.post<StandardScheduleGenerateResult>('/calendar/standard-schedule/generate'),
  createCustomTodo: (data: { week: number; content: string }) =>
    api.post<PregnancyCustomTodo>('/calendar/custom-todos', data),
  updateCustomTodo: (id: string, data: { content: string }) =>
    api.put<PregnancyCustomTodo>(`/calendar/custom-todos/${id}`, data),
  deleteCustomTodo: (id: string) =>
    api.delete<{ id: string; week: number; todoKey: string }>(`/calendar/custom-todos/${id}`),
  createEvent: (data: Partial<CalendarEvent>) =>
    api.post<CalendarEvent>('/calendar/events', mapCalendarEventPayload(data)).then(normalizeCalendarEvent),
  updateEvent: (id: number, data: Partial<CalendarEvent>) =>
    api.put<CalendarEvent>(`/calendar/events/${id}`, mapCalendarEventPayload(data)).then(normalizeCalendarEvent),
  deleteEvent: (id: number) => api.delete(`/calendar/events/${id}`),
  completeEvent: (id: number) =>
    api.post<CalendarEvent>(`/calendar/events/${id}/complete`).then(normalizeCalendarEvent),
  dragEvent: (id: number, data: { newDate: string; newStartTime?: string }) =>
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
  getFavorites: (params?: { page?: number; pageSize?: number }) => api.get('/user/favorites', { params }),
  addFavorite: (data: { targetId: number; targetType: string }) => api.post('/user/favorites', { articleId: data.targetId }),
  removeFavorite: (articleId: number) => api.delete(`/user/favorites/${articleId}`),
  getReadHistory: (params?: { page?: number; pageSize?: number }) => api.get('/user/read-history', { params }),
  recordRead: (data: { articleId: number; duration?: number; progress?: number }) => api.post('/user/read-history', {
    articleId: data.articleId,
    readDuration: data.duration,
    progress: data.progress,
  }),
  getStats: () => api.get('/user/stats'),
  getPregnancyProfile: () => api.get<PregnancyProfile>('/user/pregnancy-profile'),
}

export const authApi = {
  register: (data: { username: string; password: string; phone?: string; email?: string }) =>
    api.post<{ user: User; token: string }>('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', data),
  me: () => api.get<User>('/auth/me'),
  refresh: () => api.post<{ token: string }>('/auth/refresh'),
  updateProfile: (data: {
    nickname?: string; avatar?: string; pregnancyStatus?: number;
    dueDate?: string | null; babyBirthday?: string | null; babyGender?: number;
    caregiverRole?: number; childNickname?: string | null; childBirthMode?: number;
    feedingMode?: number; developmentConcerns?: string | null; familyNotes?: string | null;
  }) => api.put<User>('/auth/profile', data),
  changePassword: (data: { oldPassword: string; newPassword: string }) => api.put('/auth/password', data),
  logout: () => api.post('/auth/logout'),
}
