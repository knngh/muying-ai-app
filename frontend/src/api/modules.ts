import api from './index'

// ==================== 类型定义 ====================

export interface Category {
  id: number
  name: string
  slug: string
  description?: string
  icon?: string
  parentId?: number
  sortOrder: number
  articleCount: number
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: number
  name: string
  slug: string
  articleCount: number
  createdAt: string
}

export interface Article {
  id: number
  title: string
  slug: string
  summary: string
  content: string
  coverImage?: string
  categoryId: number
  category?: Category
  tags?: Tag[]
  author?: string
  viewCount: number
  likeCount: number
  collectCount: number
  stage?: string
  difficulty?: string
  contentType?: string
  isVerified?: boolean
  disclaimer?: string
  status: number
  publishedAt?: string
  createdAt: string
  updatedAt: string
  // 用户交互状态（需登录）
  isLiked?: boolean
  isFavorited?: boolean
}

export interface CalendarEvent {
  id: number
  userId: string
  title: string
  description?: string
  eventDate: string
  startTime?: string
  endTime?: string
  eventType: 'checkup' | 'vaccine' | 'reminder' | 'exercise' | 'diet' | 'other'
  isCompleted: boolean
  isAllDay?: boolean
  location?: string
  reminderEnabled: boolean
  reminderMinutes?: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  username: string
  nickname?: string
  avatar?: string
  phone?: string
  email?: string
  gender?: string
  birthday?: string
  pregnancyStatus?: string
  dueDate?: string
  babyBirthday?: string
  babyGender?: string
  createdAt: string
}

// ==================== 分页响应（匹配后端 paginatedResponse 格式） ====================

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  list: T[]
  pagination: PaginationMeta
}

// ==================== 分类 API ====================

export const categoryApi = {
  getAll: (params?: { parentId?: number }) =>
    api.get<Category[]>('/categories', { params }),

  getBySlug: (slug: string) =>
    api.get<Category>(`/categories/${slug}`),
}

// ==================== 标签 API ====================

export const tagApi = {
  getAll: () => api.get<Tag[]>('/tags'),

  getArticlesByTag: (slug: string, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<Article>>(`/tags/${slug}/articles`, { params }),
}

// ==================== 文章 API ====================

export const articleApi = {
  // 获取文章列表（分页）
  getList: (params?: {
    page?: number
    pageSize?: number
    category?: string
    tag?: string
    difficulty?: string
    contentType?: string
    stage?: string
    sort?: string
    keyword?: string
  }) => api.get<PaginatedResponse<Article>>('/articles', { params }),

  // 获取文章详情（按 slug）
  getBySlug: (slug: string) =>
    api.get<Article>(`/articles/${slug}`),

  // 搜索文章
  search: (keyword: string, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<Article>>('/articles/search', {
      params: { keyword, ...params },
    }),

  // 获取相关文章
  getRelated: (id: number, limit = 5) =>
    api.get<Article[]>(`/articles/${id}/related`, { params: { limit } }),

  // 点赞文章
  like: (id: number) =>
    api.post<{ likeCount: number }>(`/articles/${id}/like`),

  // 取消点赞
  unlike: (id: number) =>
    api.delete<{ likeCount: number }>(`/articles/${id}/like`),

  // 收藏文章
  favorite: (id: number) =>
    api.post<{ collectCount: number }>(`/articles/${id}/favorite`),

  // 取消收藏
  unfavorite: (id: number) =>
    api.delete<{ collectCount: number }>(`/articles/${id}/favorite`),
}

// ==================== 日历事件 API ====================

export const calendarApi = {
  // 获取事件列表
  getEvents: (params?: {
    startDate?: string
    endDate?: string
    eventType?: string
  }) => api.get<CalendarEvent[]>('/calendar/events', { params }),

  // 获取周视图
  getWeek: (params?: { date?: string }) =>
    api.get('/calendar/week', { params }),

  // 获取某天事件
  getDay: (date: string) =>
    api.get('/calendar/day/' + date),

  // 获取事件类型
  getEventTypes: () =>
    api.get('/calendar/event-types'),

  // 创建事件
  createEvent: (data: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'status'>) =>
    api.post<CalendarEvent>('/calendar/events', data),

  // 更新事件
  updateEvent: (id: number, data: Partial<CalendarEvent>) =>
    api.put<CalendarEvent>(`/calendar/events/${id}`, data),

  // 删除事件
  deleteEvent: (id: number) =>
    api.delete(`/calendar/events/${id}`),

  // 标记完成（POST，非 PUT）
  completeEvent: (id: number) =>
    api.post<CalendarEvent>(`/calendar/events/${id}/complete`),

  // 拖拽更新
  dragEvent: (id: number, data: { newDate: string; newStartTime?: string; newEndTime?: string }) =>
    api.patch<CalendarEvent>(`/calendar/events/${id}/drag`, data),
}

// ==================== 用户 API ====================

export const userApi = {
  // 获取收藏列表
  getFavorites: (params?: { page?: number; pageSize?: number }) =>
    api.get('/user/favorites', { params }),

  // 添加收藏
  addFavorite: (data: { targetId: number; targetType: string }) =>
    api.post('/user/favorites', data),

  // 删除收藏
  removeFavorite: (articleId: number) =>
    api.delete(`/user/favorites/${articleId}`),

  // 获取阅读历史
  getReadHistory: (params?: { page?: number; pageSize?: number }) =>
    api.get('/user/read-history', { params }),

  // 记录阅读
  recordRead: (data: { articleId: number; duration?: number; progress?: number }) =>
    api.post('/user/read-history', data),

  // 获取用户统计
  getStats: () =>
    api.get('/user/stats'),
}

// ==================== 认证 API ====================

export const authApi = {
  // 注册
  register: (data: { username: string; password: string; phone?: string; email?: string }) =>
    api.post<{ user: User; token: string }>('/auth/register', data),

  // 登录（支持 username / phone / email 作为用户名）
  login: (data: { username: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', data),

  // 获取当前用户
  me: () =>
    api.get<User>('/auth/me'),

  // 刷新 token
  refresh: () =>
    api.post<{ token: string }>('/auth/refresh'),

  // 更新用户资料
  updateProfile: (data: {
    nickname?: string
    avatar?: string
    pregnancyStatus?: string
    dueDate?: string
    babyBirthday?: string
    babyGender?: string
  }) => api.put<User>('/auth/profile', data),

  // 修改密码
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    api.put('/auth/password', data),

  // 退出登录
  logout: () =>
    api.post('/auth/logout'),
}

// ==================== 健康检查 ====================

export const healthApi = {
  check: () => api.get<{ status: string }>('/health'),
}
