export function v4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

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

const DAY_IN_MS = 24 * 60 * 60 * 1000
const FULL_TERM_WEEKS = 40

function normalizeDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
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
