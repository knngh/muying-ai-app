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
  readingTime?: number
  readableTextLength?: number
  readableTextUnit?: '字' | '词'
  stage?: string
  difficulty?: string
  contentType?: string
  isVerified?: boolean
  disclaimer?: string
  source?: string
  sourceOrg?: string
  sourceClass?: 'official' | 'medical_platform' | 'dataset' | 'unknown'
  sourceUrl?: string
  sourceLanguage?: 'zh' | 'en'
  sourceLocale?: string
  sourceUpdatedAt?: string
  lastSyncedAt?: string
  audience?: string
  topic?: string
  region?: string
  originalId?: string
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

export type StandardScheduleItemStatus = 'scheduled' | 'completed' | 'due' | 'upcoming' | 'overdue'

export interface StandardScheduleItem {
  key: string
  title: string
  description: string
  eventType: 'checkup' | 'vaccine' | 'reminder'
  eventDate: string
  dateLabel: string
  sourceLabel: string
  status: StandardScheduleItemStatus
  statusLabel: string
  isGenerated: boolean
  eventId?: number
}

export interface StandardSchedulePlan {
  available: boolean
  lifecycleKey: string
  title: string
  subtitle: string
  summary: string
  generatedCount: number
  pendingCount: number
  items: StandardScheduleItem[]
}

export interface StandardScheduleGenerateResult {
  createdCount: number
  createdEventIds: number[]
  plan: StandardSchedulePlan
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
  dueDate?: string | null
  babyBirthday?: string | null
  babyGender?: number | string
  caregiverRole?: number | string
  childNickname?: string
  childBirthMode?: number | string
  feedingMode?: number | string
  developmentConcerns?: string
  familyNotes?: string
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

export interface PregnancyProfilePhase {
  label: string
  title: string
  subtitle: string
  focusTitle: string
  focusText: string
}

export interface PregnancyProfileSnapshot {
  completedTodoCount: number
  customTodoCount: number
  hasWeeklyDiary: boolean
  weeklyDiaryDate?: string | null
  weeklyDiaryPreview?: string | null
}

export interface PregnancyProfileMilestone {
  title: string
  startWeek: number
  endWeek: number
  anchorWeek: number
  description: string
  status: 'done' | 'active' | 'upcoming'
  statusText: string
  windowText: string
  anchorDateText: string
}

export interface PregnancyProfile {
  isPregnancyReady: boolean
  currentWeek: number | null
  dueDate: string | null
  daysUntilDue: number | null
  progressPercent: number
  heroTags: string[]
  phase: PregnancyProfilePhase
  snapshot: PregnancyProfileSnapshot
  milestones: PregnancyProfileMilestone[]
  nextMilestoneText: string
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

export interface AuthorityArticleTranslationResponse {
  status: 'ready' | 'processing'
  retryAfterMs?: number
  translation?: AuthorityArticleTranslation
}

export type TranslationPendingError = Error & {
  translationPending: true
  retryAfterMs?: number
}

export interface RecentAIHitArticle {
  slug: string
  articleId: number
  title: string
  summary: string
  source?: string
  sourceOrg?: string
  sourceLanguage?: 'zh' | 'en'
  sourceLocale?: string
  topic?: string
  stage?: string
  publishedAt?: string
  sourceUpdatedAt?: string
  createdAt: string
  lastHitAt: string
  qaId?: string
  trigger?: 'hit_card' | 'knowledge_action'
  matchReason?: 'entry_meta' | 'source_url' | 'source_title' | 'source_keyword'
  originEntrySource?: string
  originReportId?: string
}
