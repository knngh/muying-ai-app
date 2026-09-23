import type { LocalToolRecord, ToolRecordPayload } from './tool-records'

export const DIARY_MOODS = ['开心', '平稳', '疲惫', '期待']
function dateValue(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + 'T12:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}
export function shiftDiaryDate(value: string, days: number): string | null {
  const date = dateValue(value)
  if (!date || !Number.isInteger(days)) return null
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function diaryWeek(value: string) {
  const date = dateValue(value)
  if (!date) return null
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  const start = date.toISOString().slice(0, 10)
  const days = Array.from({ length: 7 }, (_, index) => shiftDiaryDate(start, index)!)
  return { start, end: days[6], days }
}
export function summarizeDiaryWeek(records: LocalToolRecord[], value: string) {
  const week = diaryWeek(value), ungroupedRecords: LocalToolRecord[] = []
  const entries: Array<{ record: LocalToolRecord; date: string; mood: string; preview: string }> = []
  for (const record of records) {
    if (record.toolId !== 'diary') continue
    const p = record.payload
    if (record.recordType !== 'entry' || !dateValue(p.date) || typeof p.content !== 'string' || !p.content.trim()) { ungroupedRecords.push(record); continue }
    const date = p.date as string
    if (!week || date < week.start || date > week.end) continue
    const content = p.content.trim(), mood = typeof p.mood === 'string' ? p.mood.trim() : ''
    entries.push({ record, date, mood, preview: content.length > 120 ? content.slice(0, 120) + '…' : content })
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.record.createdAt.localeCompare(b.record.createdAt))
  const days = (week?.days || []).map(date => ({ date, count: entries.filter(item => item.date === date).length }))
  const recordedDays = days.filter(day => day.count > 0).length
  const counts = new Map<string, number>()
  entries.forEach(item => { if (item.mood) counts.set(item.mood, (counts.get(item.mood) || 0) + 1) })
  const moods = Array.from(counts, ([label, count]) => ({ label, count }))
  const unmarkedMoodCount = entries.filter(item => !item.mood).length
  const summary = entries.length ? '这一周，在 ' + recordedDays + ' 天留下 ' + entries.length + ' 篇日记。' : '这一周还没有已归组的日记，想写的时候就留下一点。'
  return { week, entries, days, recordedDays, moods, unmarkedMoodCount, summary, ungroupedRecords }
}
export function diaryPayload(date: string, mood: string, content: string, today: string): ToolRecordPayload {
  if (!dateValue(date) || date > today) throw new Error('请选择实际记录日期，不能晚于今天')
  const text = content.trim()
  if (!text) throw new Error('先写下一点内容')
  if (text.length > 800) throw new Error('每篇日记最多 800 字，请分篇保存')
  if (mood && !DIARY_MOODS.includes(mood)) throw new Error('请重新选择心情，也可以留空')
  return { date, mood: mood || null, content: text, summary: (mood ? mood + ' · ' : '') + text.replace(/\s+/g, ' ').slice(0, 18) }
}
