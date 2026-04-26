import api from './index'
import type {
  ArticleListParams,
  Article,
  AuthChangePasswordPayload,
  AuthLoginPayload,
  AuthProfileUpdatePayload,
  AuthRegisterPayload,
  CalendarEventDragPayload,
  CalendarEventInput,
  CalendarEventQueryParams,
  CalendarWeekParams,
  CalendarEvent,
  FavoriteCreatePayload,
  PaginationParams,
  ParentCategoryParams,
  ReadHistoryRecordPayload,
  Category,
  PaginatedResponse,
  PaginationMeta,
  Tag,
  User,
} from '../../../shared/types'

export type { Article, CalendarEvent, Category, PaginatedResponse, PaginationMeta, Tag, User }

// ==================== 分类 API ====================

export const categoryApi = {
  getAll: (params?: ParentCategoryParams) =>
    api.get<{ list: Category[] }>('/categories', { params }).then((res) => res.list),

  getBySlug: (slug: string) =>
    api.get<Category>(`/categories/${slug}`),
}

// ==================== 标签 API ====================

export const tagApi = {
  getAll: () => api.get<{ list: Tag[] }>('/tags').then((res) => res.list),

  getArticlesByTag: (slug: string, params?: PaginationParams) =>
    api.get<{ tag: Tag; articles: PaginatedResponse<Article> }>(`/tags/${slug}/articles`, { params }).then((res) => res.articles),
}

// ==================== 文章 API ====================

export const articleApi = {
  // 获取文章列表（分页）
  getList: (params?: ArticleListParams) => api.get<PaginatedResponse<Article>>('/articles', { params }),

  // 获取文章详情（按 slug）
  getBySlug: (slug: string) =>
    api.get<Article>(`/articles/${slug}`),

  // 搜索文章
  search: (keyword: string, params?: PaginationParams) =>
    api.get<PaginatedResponse<Article>>('/articles/search', {
      params: { q: keyword, ...params },
    }),

  // 获取相关文章
  getRelated: (id: number, limit = 5) =>
    api.get<{ list: Article[] }>(`/articles/${id}/related`, { params: { limit } }).then((res) => res.list),

  // 点赞文章
  like: (id: number) =>
    api.post<{ liked: boolean; likeCount: number }>(`/articles/${id}/like`),

  // 取消点赞
  unlike: (id: number) =>
    api.delete<{ liked: boolean; likeCount: number }>(`/articles/${id}/like`),

  // 收藏文章
  favorite: (id: number) =>
    api.post<{ favorited: boolean; collectCount: number }>(`/articles/${id}/favorite`),

  // 取消收藏
  unfavorite: (id: number) =>
    api.delete<{ favorited: boolean; collectCount: number }>(`/articles/${id}/favorite`),
}

// ==================== 日历事件 API ====================

export const calendarApi = {
  // 获取事件列表
  getEvents: (params?: CalendarEventQueryParams) => api.get<{ list: CalendarEvent[] }>('/calendar/events', {
    params: {
      startDate: params?.startDate,
      endDate: params?.endDate,
      type: params?.eventType,
    },
  }).then((res) => res.list),

  // 获取周视图
  getWeek: (params?: CalendarWeekParams) =>
    api.get('/calendar/week', { params }),

  // 获取某天事件
  getDay: (date: string) =>
    api.get('/calendar/day/' + date),

  // 获取事件类型
  getEventTypes: () =>
    api.get('/calendar/event-types'),

  // 创建事件
  createEvent: (data: Omit<CalendarEventInput, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'status'>) =>
    api.post<CalendarEvent>('/calendar/events', {
      ...data,
      eventTime: data.startTime,
    }),

  // 更新事件
  updateEvent: (id: number, data: CalendarEventInput) =>
    api.put<CalendarEvent>(`/calendar/events/${id}`, {
      ...data,
      eventTime: data.startTime,
    }),

  // 删除事件
  deleteEvent: (id: number) =>
    api.delete(`/calendar/events/${id}`),

  // 标记完成（POST，非 PUT）
  completeEvent: (id: number) =>
    api.post<CalendarEvent>(`/calendar/events/${id}/complete`),

  // 拖拽更新
  dragEvent: (id: number, data: CalendarEventDragPayload) =>
    api.patch<CalendarEvent>(`/calendar/events/${id}/drag`, {
      newDate: data.newDate,
      newTime: data.newStartTime,
    }),
}

// ==================== 用户 API ====================

export const userApi = {
  // 获取收藏列表
  getFavorites: (params?: PaginationParams) =>
    api.get('/user/favorites', { params }),

  // 添加收藏
  addFavorite: (data: FavoriteCreatePayload) =>
    api.post('/user/favorites', { articleId: data.targetId }),

  // 删除收藏
  removeFavorite: (articleId: number) =>
    api.delete(`/user/favorites/${articleId}`),

  // 获取阅读历史
  getReadHistory: (params?: PaginationParams) =>
    api.get('/user/read-history', { params }),

  // 记录阅读
  recordRead: (data: ReadHistoryRecordPayload) =>
    api.post('/user/read-history', {
      articleId: data.articleId,
      readDuration: data.duration,
      progress: data.progress,
    }),

  // 获取用户统计
  getStats: () =>
    api.get('/user/stats'),
}

// ==================== 认证 API ====================

export const authApi = {
  // 注册
  register: (data: AuthRegisterPayload) =>
    api.post<{ user: User; token: string }>('/auth/register', data),

  // 登录（支持 username / phone / email 作为用户名）
  login: (data: AuthLoginPayload) =>
    api.post<{ user: User; token: string }>('/auth/login', data),

  // 获取当前用户
  me: () =>
    api.get<User>('/auth/me'),

  // 刷新 token
  refresh: () =>
    api.post<{ token: string }>('/auth/refresh'),

  // 更新用户资料
  updateProfile: (data: AuthProfileUpdatePayload) => api.put<User>('/auth/profile', data),

  // 修改密码
  changePassword: (data: AuthChangePasswordPayload) =>
    api.put('/auth/password', data),

  // 退出登录
  logout: () =>
    api.post('/auth/logout'),
}

// ==================== 健康检查 ====================

export const healthApi = {
  check: () => api.get<{ status: string }>('/health'),
}
