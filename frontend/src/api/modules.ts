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
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: number
  name: string
  slug: string
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
  favoriteCount: number
  stage?: string
  isPublished: boolean
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id: number
  userId: string
  title: string
  description?: string
  eventDate: string
  eventType: 'checkup' | 'vaccine' | 'reminder' | 'other'
  isCompleted: boolean
  reminderEnabled: boolean
  reminderTime?: string
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  phone?: string
  pregnancyWeek?: number
  dueDate?: string
  lastMenstrualPeriod?: string
  createdAt: string
}

// ==================== 分页响应 ====================

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ==================== 分类 API ====================

export const categoryApi = {
  // 获取所有分类
  getAll: () => api.get<Category[]>('/categories'),
  
  // 获取分类详情
  getById: (id: number) => api.get<Category>(`/categories/${id}`),
  
  // 获取子分类
  getChildren: (parentId: number) => 
    api.get<Category[]>(`/categories/${parentId}/children`),
}

// ==================== 标签 API ====================

export const tagApi = {
  // 获取所有标签
  getAll: () => api.get<Tag[]>('/tags'),
  
  // 获取热门标签
  getPopular: (limit = 10) => 
    api.get<Tag[]>('/tags/popular', { params: { limit } }),
}

// ==================== 文章 API ====================

export const articleApi = {
  // 获取文章列表（分页）
  getList: (params?: {
    page?: number
    pageSize?: number
    categoryId?: number
    tagId?: number
    stage?: string
    keyword?: string
  }) => api.get<PaginatedResponse<Article>>('/articles', { params }),

  // 获取文章详情
  getById: (id: number) => api.get<Article>(`/articles/${id}`),

  // 获取推荐文章
  getRecommended: (limit = 5) => 
    api.get<Article[]>('/articles/recommended', { params: { limit } }),

  // 搜索文章
  search: (keyword: string, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<Article>>('/articles/search', { 
      params: { keyword, ...params } 
    }),

  // 点赞文章
  like: (id: number) => api.post<{ likeCount: number }>(`/articles/${id}/like`),

  // 收藏文章
  favorite: (id: number) => 
    api.post<{ favoriteCount: number }>(`/articles/${id}/favorite`),

  // 取消收藏
  unfavorite: (id: number) => 
    api.delete<{ favoriteCount: number }>(`/articles/${id}/favorite`),
}

// ==================== 日历事件 API ====================

export const calendarApi = {
  // 获取事件列表
  getEvents: (params?: { 
    startDate?: string
    endDate?: string
    eventType?: string 
  }) => api.get<CalendarEvent[]>('/calendar/events', { params }),

  // 获取事件详情
  getEvent: (id: number) => api.get<CalendarEvent>(`/calendar/events/${id}`),

  // 创建事件
  createEvent: (data: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) =>
    api.post<CalendarEvent>('/calendar/events', data),

  // 更新事件
  updateEvent: (id: number, data: Partial<CalendarEvent>) =>
    api.put<CalendarEvent>(`/calendar/events/${id}`, data),

  // 删除事件
  deleteEvent: (id: number) => api.delete(`/calendar/events/${id}`),

  // 标记完成
  completeEvent: (id: number) =>
    api.put<CalendarEvent>(`/calendar/events/${id}/complete`),

  // 获取近期提醒
  getUpcoming: (days = 7) =>
    api.get<CalendarEvent[]>('/calendar/events/upcoming', { params: { days } }),
}

// ==================== 用户 API ====================

export const userApi = {
  // 获取用户信息
  getProfile: () => api.get<User>('/users/profile'),

  // 更新用户信息
  updateProfile: (data: Partial<User>) =>
    api.put<User>('/users/profile', data),

  // 更新孕期信息
  updatePregnancy: (data: {
    lastMenstrualPeriod?: string
    dueDate?: string
  }) => api.put<User>('/users/profile/pregnancy', data),
}

// ==================== 认证 API ====================

export const authApi = {
  // 注册
  register: (data: { email: string; password: string; name?: string }) =>
    api.post<{ token: string; user: User }>('/auth/register', data),

  // 登录
  login: (data: { email: string; password: string }) =>
    api.post<{ token: string; user: User }>('/auth/login', data),

  // 获取当前用户
  me: () => api.get<User>('/auth/me'),

  // 退出登录
  logout: () => api.post('/auth/logout'),
}

// ==================== 健康检查 ====================

export const healthApi = {
  check: () => api.get<{ status: string }>('/health'),
}