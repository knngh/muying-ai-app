// 共享数据模型类型

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
  gender?: number | string
  birthday?: string
  pregnancyStatus?: number | string
  dueDate?: string
  babyBirthday?: string
  babyGender?: number | string
  createdAt: string
}

export interface PregnancyTodoProgress {
  week: number
  todoKey: string
  completed: boolean
  completedAt?: string
}

export interface PregnancyDiary {
  week: number
  content: string
  date: string
  createdAt?: string
  updatedAt?: string
}

export interface PregnancyCustomTodo {
  id: string
  week: number
  content: string
  createdAt?: string
  updatedAt?: string
}

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
