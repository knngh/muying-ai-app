import type { LocalToolRecord } from './tool-records'
import { localToolDate } from './tool-history'

export type CareKind = 'feeding' | 'diaper' | 'sleep'
export interface CareSummary {
  feedingCount: number
  feedingAmountMl: number
  knownAmountCount: number
  diaperCount: number
  sleepCount: number
  untimedSleepCount: number
  sleepSeconds: number
}

export function summarizeCareRecords(records: LocalToolRecord[], day = localToolDate()): CareSummary {
  const summary: CareSummary = { feedingCount: 0, feedingAmountMl: 0, knownAmountCount: 0, diaperCount: 0, sleepCount: 0, untimedSleepCount: 0, sleepSeconds: 0 }
  const start = new Date(`${day}T00:00:00`)
  if (!Number.isFinite(start.getTime()) || localToolDate(start) !== day) return summary
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const intervals: Array<[number, number]> = []
  for (const record of records) {
    if (record.toolId !== 'care' || record.recordType !== 'log') continue
    const p = record.payload
    const at = typeof p.recordedAt === 'string' ? Date.parse(p.recordedAt) : NaN
    if (!Number.isFinite(at)) continue
    const onDay = at >= start.getTime() && at < end.getTime()
    if (p.kind === 'sleep') {
      if (!p.endedAt) { if (onDay) summary.untimedSleepCount += 1; continue }
      const until = typeof p.endedAt === 'string' ? Date.parse(p.endedAt) : NaN
      if (!Number.isFinite(until) || until <= at) continue
      const clippedStart = Math.max(at, start.getTime()), clippedEnd = Math.min(until, end.getTime())
      if (clippedEnd > clippedStart) { intervals.push([clippedStart, clippedEnd]); summary.sleepCount += 1 }
    } else if (onDay && p.kind === 'feeding') {
      summary.feedingCount += 1
      if (typeof p.amount === 'number' && Number.isInteger(p.amount) && p.amount >= 0 && p.amount <= 20000) {
        summary.feedingAmountMl += p.amount; summary.knownAmountCount += 1
      }
    } else if (onDay && p.kind === 'diaper') summary.diaperCount += 1
  }
  // Count the union of saved sleep intervals so overlapping entries cannot inflate the total.
  let coveredUntil = start.getTime()
  for (const [from, until] of intervals.sort((a, b) => a[0] - b[0])) {
    summary.sleepSeconds += Math.max(0, until - Math.max(from, coveredUntil)) / 1000
    coveredUntil = Math.max(coveredUntil, until)
  }
  summary.sleepSeconds = Math.floor(summary.sleepSeconds)
  return summary
}

export function formatCareDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const hours = Math.floor(safe / 3600), minutes = Math.floor((safe % 3600) / 60)
  if (hours) return `${hours}小时${minutes ? ` ${minutes}分钟` : ''}`
  return minutes ? `${minutes}分钟` : `${safe}秒`
}
