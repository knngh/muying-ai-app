import type { CalendarEvent } from './models'

export interface ParentCategoryParams {
  parentId?: number
}

export interface PaginationParams {
  page?: number
  pageSize?: number
}

export interface ArticleListParams extends PaginationParams {
  category?: string
  tag?: string
  difficulty?: string
  contentType?: string
  stage?: string
  sort?: string
  keyword?: string
  source?: string
}

export interface CalendarEventQueryParams {
  startDate?: string
  endDate?: string
  eventType?: string
}

export interface CalendarWeekParams {
  date?: string
}

export type CalendarEventInput = Partial<CalendarEvent>

export interface CalendarEventDragPayload {
  newDate: string
  newStartTime?: string
  newEndTime?: string
}

export interface PregnancyWeekParams {
  week?: number
}

export interface PregnancyTodoProgressUpdatePayload {
  week: number
  todoKey: string
  completed: boolean
}

export interface PregnancyDiaryPayload {
  week: number
  content: string
}

export interface PregnancyCustomTodoCreatePayload {
  week: number
  content: string
}

export interface PregnancyCustomTodoUpdatePayload {
  content: string
}

export interface FavoriteCreatePayload {
  targetId: number
  targetType: string
}

export interface ReadHistoryRecordPayload {
  articleId: number
  duration?: number
  progress?: number
}

export interface AuthRegisterPayload {
  username: string
  password: string
  phone?: string
  email?: string
  pregnancyWeek?: string
}

export interface AuthLoginPayload {
  username: string
  password: string
}

export interface AuthWechatLoginPayload {
  code: string
  pregnancyWeek?: string
}

export interface AuthProfileUpdatePayload {
  nickname?: string
  avatar?: string
  pregnancyStatus?: number
  dueDate?: string | null
  babyBirthday?: string | null
  babyGender?: number
  caregiverRole?: number
  childNickname?: string | null
  childBirthMode?: number
  feedingMode?: number
  developmentConcerns?: string | null
  familyNotes?: string | null
}

export interface AuthChangePasswordPayload {
  oldPassword: string
  newPassword: string
}

export interface ArticleTranslationOptions {
  maxAttempts?: number
  waitForReady?: boolean
}
