import { trackMiniEvent } from './analytics'

// UUID v4 生成
const DAY_IN_MS = 24 * 60 * 60 * 1000
const FULL_TERM_WEEKS = 40
const BIRTH_CARD_PROMPT_LEAD_DAYS = 14
const PREGNANCY_STATUS_MAP: Record<string, number> = {
  preparing: 1,
  pregnant: 2,
  postpartum: 3,
}
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function decodeBase64UrlAscii(input: string): string | null {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  let buffer = 0
  let bits = 0
  let output = ''

  for (const char of normalized) {
    if (char === '=') break
    const value = BASE64_ALPHABET.indexOf(char)
    if (value < 0) return null
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      output += String.fromCharCode((buffer >> bits) & 0xff)
    }
  }

  return output
}

export function isStoredAuthTokenUsable(value: unknown, nowMs = Date.now()): boolean {
  const token = typeof value === 'string' ? value.trim() : ''
  if (!token) return false

  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return false

  try {
    const payloadText = decodeBase64UrlAscii(parts[1])
    if (!payloadText) return false
    const payload = JSON.parse(payloadText) as { exp?: number | string }
    const exp = typeof payload.exp === 'number' ? payload.exp : Number.parseInt(String(payload.exp || ''), 10)
    if (!Number.isFinite(exp)) return false

    return exp * 1000 > nowMs + 30 * 1000
  } catch {
    return false
  }
}

export function v4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 日期格式化
export function formatDate(date: Date | string, format = 'YYYY-MM-DD'): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

function normalizeDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseWeek(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10)
  if (Number.isNaN(raw) || raw < 1 || raw > FULL_TERM_WEEKS) {
    return null
  }
  return raw
}

// 计算孕周
export function calculatePregnancyWeek(lastMenstrualPeriod: Date | string): number {
  const lmp = new Date(lastMenstrualPeriod)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - lmp.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7)
}

// 计算预产期
export function calculateDueDate(lastMenstrualPeriod: Date | string): Date {
  const lmp = new Date(lastMenstrualPeriod)
  const dueDate = new Date(lmp)
  dueDate.setDate(dueDate.getDate() + 280)
  return dueDate
}

// 从预产期反推末次月经日期（-280天）
export function calculatePregnancyStartFromDueDate(dueDate: Date | string): Date {
  const dd = new Date(dueDate)
  const start = new Date(dd)
  start.setDate(start.getDate() - 280)
  return start
}

export function calculateDueDateFromPregnancyWeek(value: unknown, baseDate = new Date()): Date | null {
  const week = parseWeek(value)
  if (!week) return null

  const today = normalizeDate(baseDate)
  const dueDate = new Date(today.getTime() + (FULL_TERM_WEEKS - week) * 7 * DAY_IN_MS)
  return normalizeDate(dueDate)
}

export function calculatePregnancyWeekFromDueDate(dueDate: Date | string, baseDate = new Date()): number | null {
  const due = normalizeDate(new Date(dueDate))
  if (Number.isNaN(due.getTime())) return null

  const today = normalizeDate(baseDate)
  const remainingDays = Math.max(0, (due.getTime() - today.getTime()) / DAY_IN_MS)
  const remainingWeeks = Math.ceil(remainingDays / 7)
  const week = FULL_TERM_WEEKS - remainingWeeks

  if (week < 1) return 1
  if (week > FULL_TERM_WEEKS) return FULL_TERM_WEEKS
  return week
}

export function syncPregnancyWeekStorage(dueDate?: Date | string | null, fallbackWeek?: unknown): number | null {
  const weekFromDueDate = dueDate ? calculatePregnancyWeekFromDueDate(dueDate) : null
  const resolvedWeek = weekFromDueDate ?? parseWeek(fallbackWeek)

  if (resolvedWeek) {
    uni.setStorageSync('userPregnancyWeek', String(resolvedWeek))
    return resolvedWeek
  }

  uni.removeStorageSync('userPregnancyWeek')
  return null
}

export function clearLocalSession(): void {
  uni.removeStorageSync('token')
  uni.removeStorageSync('user')
  uni.removeStorageSync('userPregnancyWeek')
  uni.removeStorageSync('pendingChatDraft')
  uni.removeStorageSync('recentChatQuestions')
}

function normalizePregnancyStatus(value: unknown): number | undefined {
  if (typeof value === 'number' && value >= 1 && value <= 3) return value

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined

    const numericValue = Number.parseInt(trimmed, 10)
    if (!Number.isNaN(numericValue) && numericValue >= 1 && numericValue <= 3) {
      return numericValue
    }

    return PREGNANCY_STATUS_MAP[trimmed.toLowerCase()]
  }

  return undefined
}
