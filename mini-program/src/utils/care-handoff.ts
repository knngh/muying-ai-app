import type { LocalToolRecord } from './tool-records'
import type { CareSession } from './care-session'
import { formatCareDuration, summarizeCareRecords } from './care-summary'
import { localToolDate } from './tool-history'

export interface CareHandoffEntry { id: string; time: string; detail: string; note: string }
const sides: Record<string, string> = { left: '左侧', right: '右侧', bottle: '奶瓶', mixed: '混合' }
const diapers: Record<string, string> = { wet: '尿湿', stool: '便便', both: '尿湿＋便便' }
const clock = (at: number) => {
  const date = new Date(at)
  return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0')
}
const label = (labels: Record<string, string>, key: unknown, fallback: string) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : fallback

/** A view of saved facts, rebuilt from the source records rather than stored as a second archive. */
export function buildCareHandoff(records: LocalToolRecord[], day: string, includeNotes = false, session: CareSession | null = null, now = Date.now()) {
  const start = new Date(day + 'T00:00:00'), end = new Date(start)
  const validDay = Number.isFinite(start.getTime()) && localToolDate(start) === day
  end.setDate(end.getDate() + 1)
  const from = start.getTime(), until = end.getTime()
  const selected = records.filter(record => {
    if (!validDay || record.toolId !== 'care' || record.recordType !== 'log') return false
    const p = record.payload, at = typeof p.recordedAt === 'string' ? Date.parse(p.recordedAt) : NaN
    if (!Number.isFinite(at)) return false
    if (p.kind === 'sleep' && p.endedAt) {
      const stop = typeof p.endedAt === 'string' ? Date.parse(p.endedAt) : NaN
      return Number.isFinite(stop) && stop > at && Math.min(stop, until) > Math.max(at, from)
    }
    return ['feeding', 'diaper', 'sleep'].includes(String(p.kind)) && at >= from && at < until
  }).sort((a, b) => Date.parse(String(a.payload.recordedAt)) - Date.parse(String(b.payload.recordedAt)))
  const entries: CareHandoffEntry[] = selected.map(record => {
    const p = record.payload, at = Date.parse(String(p.recordedAt))
    const stop = typeof p.endedAt === 'string' ? Date.parse(p.endedAt) : NaN
    let time = clock(at), detail = ''
    if (p.kind === 'feeding') {
      const knownAmount = typeof p.amount === 'number' && Number.isInteger(p.amount) && p.amount >= 0 && p.amount <= 20000
      detail = '喂奶 · ' + label(sides, p.side, '方式未记录') + ' · ' + (knownAmount ? p.amount + ' ml' : '奶量未记录')
      if (Number.isFinite(stop) && stop > at) detail += ' · ' + formatCareDuration((stop - at) / 1000)
    } else if (p.kind === 'diaper') {
      detail = '换尿布 · ' + label(diapers, p.diaperType, '类型未记录')
    } else if (Number.isFinite(stop)) {
      const clippedStart = Math.max(at, from), clippedEnd = Math.min(stop, until)
      time = clock(clippedStart) + '—' + (clippedEnd === until ? '24:00' : clock(clippedEnd))
      detail = '睡眠 · 当日 ' + formatCareDuration((clippedEnd - clippedStart) / 1000)
      if (at < from || stop > until) detail += '（跨日记录）'
    } else detail = '睡眠 · 结束时间未记录'
    const originalNote = includeNotes && typeof p.note === 'string' ? p.note.replace(/[\r\n\t]+/g, ' ').trim() : ''
    const note = originalNote.length > 60 ? originalNote.slice(0, 60) + '…' : originalNote
    return { id: record.id, time, detail, note }
  })
  const summary = summarizeCareRecords(selected, day)
  const unknownAmount = summary.feedingCount - summary.knownAmountCount
  const summaryLines = [
    '喂奶 ' + summary.feedingCount + ' 次' + (summary.knownAmountCount ? ' · 已记录奶量 ' + summary.feedingAmountMl + ' ml' : '') + (unknownAmount ? ' · ' + unknownAmount + ' 次奶量未记录' : ''),
    '换尿布 ' + summary.diaperCount + ' 次',
    '睡眠 ' + formatCareDuration(summary.sleepSeconds) + ' · ' + summary.sleepCount + ' 条含时长记录' + (summary.untimedSleepCount ? ' · 另有 ' + summary.untimedSleepCount + ' 条未记录结束时间' : ''),
  ]
  let ongoing = ''
  const started = session ? Date.parse(session.startedAt) : NaN
  if (session && validDay && day === localToolDate(new Date(now)) && Number.isFinite(started) && started <= now) {
    ongoing = (session.kind === 'feeding' ? '喂奶' : '睡眠') + '计时中 · 开始于 ' + localToolDate(new Date(started)) + ' ' + clock(started) + ' · 未计入以上合计'
  }
  const generated = '整理于 ' + localToolDate(new Date(now)) + ' ' + clock(now)
  const footer = '仅本机已保存记录，不代表全天完整情况。睡眠按当天时段计算，重叠时段合计只计一次。' + (includeNotes ? '备注为原始填写内容。' : '本单未附备注。')
  const text = [
    '贝护 · 照护交接单 · ' + day, generated, ...summaryLines,
    ...(ongoing ? [ongoing] : []), '',
    ...entries.map(entry => entry.time + ' ' + entry.detail + (entry.note ? '\n  备注：' + entry.note : '')),
    ...(!entries.length ? ['当天暂无已保存记录'] : []), '', footer,
  ].join('\n')
  return { entries, summaryLines, ongoing, generated, footer, text }
}
