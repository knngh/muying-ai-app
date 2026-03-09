/** 日历单日内容（权威来源+审核） */
export interface CalendarDayItem {
  date: string
  title: string
  summary: string
  tip?: string
  source?: string
  stage?: 'pregnancy' | '0-6m' | '6-12m' | '1-3y'
}

/** 用户阶段：孕期周数 或 宝宝出生日 */
export interface UserStage {
  mode: 'pregnancy' | 'baby'
  pregnancyWeeks?: number
  babyBirthday?: string
  babyMonths?: number
}

/** 问答消息 */
export interface QAMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: { name: string; url?: string }[]
  disclaimer?: boolean
  timestamp: number
}

/** 场景化推荐 */
export interface RecommendProduct {
  id: string
  title: string
  subtitle: string
  price: string
  originalPrice?: string
  image: string
  scene: string
  reason: string
  link?: string
  cpsId?: string
}

/** 推荐场景 */
export type RecommendScene = 'pregnancy' | 'newborn' | 'feeding' | 'weaning' | 'sleep' | 'growth' | 'vaccine' | 'daily'
