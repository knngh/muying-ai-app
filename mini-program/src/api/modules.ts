import api from './request'
import type {
  Category, Tag, Article, CalendarEvent, User, PaginatedResponse,
} from '../../../shared/types'

export type { Category, Tag, Article, CalendarEvent, User, PaginatedResponse }

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
    api.get<PaginatedResponse<Article>>(`/tags/${slug}/articles`, params as Record<string, unknown>),
}

// ==================== 文章 API ====================
export const articleApi = {
  getList: (params?: {
    page?: number; pageSize?: number; category?: string; tag?: string;
    difficulty?: string; contentType?: string; stage?: string; sort?: string; keyword?: string
  }) => api.get<PaginatedResponse<Article>>('/articles', params as Record<string, unknown>),
  getBySlug: (slug: string) => api.get<Article>(`/articles/${slug}`),
  search: (keyword: string, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<Article>>('/articles/search', { q: keyword, ...params } as Record<string, unknown>),
  getRelated: (id: number, limit = 5) =>
    api.get<Article[]>(`/articles/${id}/related`, { limit }),
  like: (id: number) => api.post<{ liked: boolean }>(`/articles/${id}/like`),
  unlike: (id: number) => api.delete<{ liked: boolean }>(`/articles/${id}/like`),
  favorite: (id: number) => api.post<{ favorited: boolean }>(`/articles/${id}/favorite`),
  unfavorite: (id: number) => api.delete<{ favorited: boolean }>(`/articles/${id}/favorite`),
}

// ==================== 日历事件 API ====================
export const calendarApi = {
  getEvents: (params?: { startDate?: string; endDate?: string; eventType?: string }) =>
    api.get<{ list: CalendarEvent[] }>('/calendar/events', params as Record<string, unknown>).then(res => (res as { list: CalendarEvent[] }).list),
  getWeek: (params?: { date?: string }) => api.get('/calendar/week', params as Record<string, unknown>),
  getDay: (date: string) => api.get(`/calendar/day/${date}`),
  getEventTypes: () => api.get('/calendar/event-types'),
  createEvent: (data: Partial<CalendarEvent>) => api.post<CalendarEvent>('/calendar/events', data),
  updateEvent: (id: number, data: Partial<CalendarEvent>) => api.put<CalendarEvent>(`/calendar/events/${id}`, data),
  deleteEvent: (id: number) => api.delete(`/calendar/events/${id}`),
  completeEvent: (id: number) => api.post<CalendarEvent>(`/calendar/events/${id}/complete`),
  dragEvent: (id: number, data: { newDate: string }) => api.patch<CalendarEvent>(`/calendar/events/${id}/drag`, data),
}

// ==================== 用户 API ====================
export const userApi = {
  getFavorites: (params?: { page?: number; pageSize?: number }) =>
    api.get('/user/favorites', params as Record<string, unknown>),
  addFavorite: (data: { targetId: number; targetType: string }) => api.post('/user/favorites', data),
  removeFavorite: (articleId: number) => api.delete(`/user/favorites/${articleId}`),
  getReadHistory: (params?: { page?: number; pageSize?: number }) =>
    api.get('/user/read-history', params as Record<string, unknown>),
  recordRead: (data: { articleId: number; duration?: number; progress?: number }) =>
    api.post('/user/read-history', data),
  getStats: () => api.get('/user/stats'),
}

// ==================== 认证 API ====================
export const authApi = {
  register: (data: { username: string; password: string; phone?: string; email?: string; pregnancyWeek?: string }) =>
    api.post<{ user: User; token: string }>('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', data),
  wechatLogin: (data: { code: string; pregnancyWeek?: string }) =>
    api.post<{ user: User; token: string }>('/auth/wechat-login', data),
  me: () => api.get<User>('/auth/me'),
  refresh: () => api.post<{ token: string }>('/auth/refresh'),
  updateProfile: (data: {
    nickname?: string; phone?: string; email?: string; avatar?: string; pregnancyStatus?: number;
    dueDate?: string; babyBirthday?: string; babyGender?: number
  }) => api.put<User>('/auth/profile', data),
  changePassword: (data: { oldPassword: string; newPassword: string }) => api.put('/auth/password', data),
  logout: () => api.post('/auth/logout'),
}
