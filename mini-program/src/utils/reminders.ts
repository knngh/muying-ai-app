import { localToolDate } from './tool-history'

export const REMINDER_LEADS = [0, 60, 1440, 4320, 10080] as const
export const REMINDER_LEAD_LABELS = ['准时提醒', '提前 1 小时', '提前 1 天', '提前 3 天', '提前 1 周']
export interface LocalReminder {
  id: string
  sourceKey: string
  kind: 'calendar' | 'vaccines'
  title: string
  date: string
  time: string
  leadMinutes: number
  state: 'active' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
  phoneSignature?: string
}
export interface ReminderSeed { id?: string; sourceKey?: string; kind: LocalReminder['kind']; title: string; date?: string }
export type ReminderInput = Pick<LocalReminder, 'sourceKey' | 'kind' | 'title' | 'date' | 'time' | 'leadMinutes'>
const key = (owner: string) => `beihu:reminders:v1:${owner}`
export const REMINDERS_CHANGED = 'beihu:reminders-changed'

export function eventTime(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const result = new Date(year, month - 1, day, hour, minute)
  return localToolDate(result) === date && result.getHours() === hour && result.getMinutes() === minute ? result.getTime() : NaN
}
export function reminderTime(item: Pick<LocalReminder, 'date' | 'time' | 'leadMinutes'>): number {
  return eventTime(item.date, item.time) - item.leadMinutes * 60000
}
export function reminderSignature(item: ReminderInput): string {
  return JSON.stringify([item.title, item.date, item.time, item.leadMinutes])
}
export function phoneCalendarPayload(item: LocalReminder) {
  return { title: `贝护 · ${item.title}`, startTime: Math.floor(eventTime(item.date, item.time) / 1000), allDay: false, alarm: true, alarmOffset: item.leadMinutes * 60, description: '来自贝护。改期、完成或取消后，请在手机日历同步修改或删除此事项。' }
}
export function defaultReminderDate(now = new Date()): string {
  const date = new Date(now)
  if (date.getHours() >= 9) date.setDate(date.getDate() + 1)
  return localToolDate(date)
}
function isReminder(value: unknown): value is LocalReminder {
  if (!value || typeof value !== 'object') return false
  const r = value as LocalReminder
  return typeof r.id === 'string' && typeof r.sourceKey === 'string' && typeof r.title === 'string'
    && ['calendar', 'vaccines'].includes(r.kind) && ['active', 'completed', 'cancelled'].includes(r.state)
    && REMINDER_LEADS.some(value => value === r.leadMinutes) && Number.isFinite(eventTime(r.date, r.time))
    && typeof r.createdAt === 'string' && typeof r.updatedAt === 'string'
    && (r.phoneSignature === undefined || typeof r.phoneSignature === 'string')
}
export function readReminders(owner: string): LocalReminder[] {
  const stored: unknown = uni.getStorageSync(key(owner))
  return Array.isArray(stored) ? stored.filter(isReminder).sort((a, b) => reminderTime(a) - reminderTime(b)) : []
}

export interface ReminderSummary {
  activeCount: number
  due: LocalReminder[]
  withinSevenDays: LocalReminder[]
  next: LocalReminder | null
}

/**
 * Builds the small amount of derived state that home and calendar surfaces need.
 * Closed reminders are deliberately excluded so an old appointment cannot make
 * the home page look as if there is still work to do.
 */
export function buildReminderSummary(records: LocalReminder[], now = Date.now()): ReminderSummary {
  const active = records
    .filter(item => item.state === 'active' && Number.isFinite(reminderTime(item)))
    .sort((a, b) => reminderTime(a) - reminderTime(b))
  const horizon = now + 7 * 24 * 60 * 60 * 1000
  return {
    activeCount: active.length,
    due: active.filter(item => reminderTime(item) <= now),
    withinSevenDays: active.filter(item => reminderTime(item) > now && reminderTime(item) <= horizon),
    next: active[0] || null,
  }
}

export interface ReminderPrompt {
  kind: 'due' | 'soon'
  items: LocalReminder[]
  signature: string
}

/**
 * Returns a prompt-worthy subset. We only surface reminders that are due or
 * within 24 hours, so a long-term appointment does not interrupt a normal visit.
 * The phase is part of the signature: the same reminder gets a new prompt when
 * it moves from "soon" to "due".
 */
export function buildReminderPrompt(records: LocalReminder[], now = Date.now()): ReminderPrompt | null {
  const summary = buildReminderSummary(records, now)
  const due = summary.due
  const soon = summary.withinSevenDays.filter(item => reminderTime(item) <= now + 24 * 60 * 60 * 1000)
  const kind: ReminderPrompt['kind'] = due.length ? 'due' : 'soon'
  const items = due.length ? due : soon
  if (!items.length) return null
  const signature = `${kind}|${items.map(item => `${item.id}:${item.updatedAt}`).join('|')}`
  return { kind, items, signature }
}

const promptKey = (owner: string) => `beihu:reminder-prompt:v1:${owner}`

export function readReminderPromptSignature(owner: string): string {
  const stored = uni.getStorageSync(promptKey(owner))
  return typeof stored === 'string' ? stored : ''
}

export function markReminderPromptRead(owner: string, signature: string): void {
  if (signature) uni.setStorageSync(promptKey(owner), signature)
}

function write(owner: string, records: LocalReminder[]) {
  uni.setStorageSync(key(owner), records)
  uni.$emit(REMINDERS_CHANGED)
}
export function saveReminder(owner: string, input: ReminderInput, id?: string, now = Date.now()): LocalReminder {
  if (!input.title.trim() || input.title.trim().length > 100) throw new Error('请填写 1 至 100 字的提醒名称')
  if (!REMINDER_LEADS.some(value => value === input.leadMinutes) || !Number.isFinite(reminderTime(input))) throw new Error('请选择有效日期、时间和提前量')
  if (reminderTime(input) <= now) throw new Error('提醒时间已过，请调整日期、时间或提前量')
  const all = readReminders(owner)
  const existing = all.find(item => id ? item.id === id : !!input.sourceKey && item.sourceKey === input.sourceKey)
  if (!existing && all.length >= 200) throw new Error('本机提醒已满，请先删除已结束的提醒')
  const stamp = new Date(now).toISOString()
  const record: LocalReminder = { ...existing, ...input, title: input.title.trim(), id: existing?.id || `reminder-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`, state: 'active', createdAt: existing?.createdAt || stamp, updatedAt: stamp }
  write(owner, [record, ...all.filter(item => item.id !== record.id)])
  return record
}
export function closeReminderSource(owner: string, sourceKey: string, state: 'completed' | 'cancelled'): boolean {
  const all = readReminders(owner)
  let exported = false, changed = false
  for (const item of all) if (item.sourceKey === sourceKey && item.state === 'active') {
    exported ||= !!item.phoneSignature; changed = true; item.state = state; item.updatedAt = new Date().toISOString()
  }
  if (changed) write(owner, all)
  return exported
}
export function setReminderState(owner: string, id: string, state: 'completed' | 'cancelled') {
  write(owner, readReminders(owner).map(item => item.id === id ? { ...item, state, updatedAt: new Date().toISOString() } : item))
}
export function deleteReminder(owner: string, id: string) { write(owner, readReminders(owner).filter(item => item.id !== id)) }
export function markPhoneCalendarAdded(owner: string, id: string, signature: string): void {
  write(owner, readReminders(owner).map(item => item.id === id && item.state === 'active' && reminderSignature(item) === signature ? { ...item, phoneSignature: signature } : item))
}
