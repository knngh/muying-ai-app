import type { ToolId } from '@/data/tool-catalog'
import type { LocalToolRecord } from './tool-records'
import { historyTitle, localToolDate } from './tool-history'
import { calculatePregnancyWeekFromDueDate } from './index'

export type CalendarRecordStage = 'pregnancy' | 'postpartum'
export interface CalendarToolRecord { id: string; toolId: ToolId; title: string; date: string; record: LocalToolRecord }
const DATE_KEYS = ['date', 'measuredAt', 'recordedAt', 'startedAt', 'startAt', 'appointmentDate'] as const
function dateKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? localToolDate(parsed) : null
}
export function toolRecordDate(record: LocalToolRecord): string | null {
  for (const key of DATE_KEYS) { const date = dateKey(record.payload[key]); if (date) return date }
  return null
}
function validDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) ? date : null
}
export function recordsForCalendarPeriod(records: LocalToolRecord[], stage: CalendarRecordStage, week: number, dueDate?: string | null, babyBirthday?: string | null): CalendarToolRecord[] {
  if (!Number.isInteger(week) || week < 1 || (stage === 'pregnancy' ? week > 40 : week > 156)) return []
  const due = validDate(dueDate), birthday = validDate(babyBirthday)
  if ((stage === 'pregnancy' && !due) || (stage === 'postpartum' && !birthday)) return []
  return records
    .filter(record => record.toolId !== 'calendar' && record.toolId !== 'poster' && record.toolId !== 'names')
    .map(record => ({ record, date: toolRecordDate(record) }))
    .filter((item): item is { record: LocalToolRecord; date: string } => Boolean(item.date))
    .filter(item => {
      const date = validDate(item.date)
      if (!date) return false
      if (stage === 'pregnancy' && due) {
        const pregnancyStart = new Date(due.getTime() - 280 * 86400000)
        return date >= pregnancyStart && date <= due && calculatePregnancyWeekFromDueDate(due, date) === week
      }
      if (stage === 'postpartum' && birthday) return date >= birthday && Math.floor((date.getTime() - birthday.getTime()) / (7 * 86400000)) + 1 === week
      return false
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.record.createdAt.localeCompare(a.record.createdAt))
    .slice(0, 20)
    .map(item => ({ id: item.record.id, toolId: item.record.toolId, title: historyTitle(item.record), date: item.date, record: item.record }))
}
