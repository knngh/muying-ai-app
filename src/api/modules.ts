import api from './index'

// 知识库相关接口
export interface KnowledgeItem {
  id: number
  title: string
  category: string
  stage: string
  summary: string
  content?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export const knowledgeApi = {
  // 获取知识列表
  getList: (params?: { category?: string; stage?: string; keyword?: string }) =>
    api.get<{ data: KnowledgeItem[]; total: number }>('/knowledge', { params }),

  // 获取知识详情
  getDetail: (id: number) =>
    api.get<KnowledgeItem>(`/knowledge/${id}`),

  // 搜索知识
  search: (keyword: string) =>
    api.get<{ data: KnowledgeItem[] }>('/knowledge/search', { params: { keyword } }),
}

// 日历事件相关接口
export interface CalendarEvent {
  id: number
  title: string
  date: string
  type: 'checkup' | 'vaccine' | 'consultation' | 'other'
  description?: string
  reminder?: boolean
}

export const calendarApi = {
  // 获取事件列表
  getEvents: (startDate?: string, endDate?: string) =>
    api.get<{ data: CalendarEvent[] }>('/calendar/events', {
      params: { startDate, endDate },
    }),

  // 创建事件
  createEvent: (data: Omit<CalendarEvent, 'id'>) =>
    api.post<CalendarEvent>('/calendar/events', data),

  // 更新事件
  updateEvent: (id: number, data: Partial<CalendarEvent>) =>
    api.put<CalendarEvent>(`/calendar/events/${id}`, data),

  // 删除事件
  deleteEvent: (id: number) =>
    api.delete(`/calendar/events/${id}`),
}

// 用户相关接口
export interface UserProfile {
  id: string
  name: string
  avatar?: string
  phone?: string
  pregnancyWeek?: number
  dueDate?: string
  lastMenstrualPeriod?: string
}

export const userApi = {
  // 获取用户信息
  getProfile: () => api.get<UserProfile>('/user/profile'),

  // 更新用户信息
  updateProfile: (data: Partial<UserProfile>) =>
    api.put<UserProfile>('/user/profile', data),
}