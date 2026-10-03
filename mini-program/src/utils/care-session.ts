import { reportOwner } from './report-drafts'
import { readToolRecords, saveToolRecord, type LocalToolRecord, type ToolRecordPayload } from './tool-records'
import type { CareKind } from './care-summary'

export interface CareSession {
  id: string
  kind: 'feeding' | 'sleep'
  startedAt: string
  side: string
  amount: string
  note: string
}
const key = (owner: string) => `beihu:care-timer:v1:${owner}`
function assertOwner(owner: string) { if (reportOwner() !== owner) throw new Error('账号已变化，请重新打开工具') }
export function readCareSession(owner: string): CareSession | null {
  const value = uni.getStorageSync(key(owner)) as Partial<CareSession> | null
  if (!value || !['feeding', 'sleep'].includes(String(value.kind)) || typeof value.startedAt !== 'string' || !Number.isFinite(Date.parse(value.startedAt))) return null
  const id = typeof value.id === 'string' ? value.id : `care-${value.startedAt}`
  if (reportOwner() === owner && readToolRecords().some(record => record.toolId === 'care' && record.payload.sessionId === id)) return null
  return {
    id,
    kind: value.kind as CareSession['kind'], startedAt: value.startedAt,
    side: typeof value.side === 'string' ? value.side : '',
    amount: typeof value.amount === 'string' ? value.amount : '',
    note: typeof value.note === 'string' ? value.note : '',
  }
}
export function writeCareSession(owner: string, session: CareSession): void {
  assertOwner(owner)
  uni.setStorageSync(key(owner), session)
}
export function startCareSession(owner: string, kind: CareSession['kind'], now = Date.now()): CareSession {
  assertOwner(owner)
  if (readCareSession(owner)) throw new Error('请先结束当前计时')
  const session: CareSession = { id: `care-${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`, kind, startedAt: new Date(now).toISOString(), side: '', amount: '', note: '' }
  writeCareSession(owner, session)
  return session
}
export function discardCareSession(owner: string): void { assertOwner(owner); uni.removeStorageSync(key(owner)) }
export function carePayload(kind: CareKind, recordedAt: string, endedAt: string | null, fields: { amount: string; side: string; diaperType?: string; note: string }, now = Date.now()): ToolRecordPayload {
  const start = Date.parse(recordedAt), end = endedAt ? Date.parse(endedAt) : null
  if (!Number.isFinite(start) || start > now) throw new Error('请选择有效的记录时间，不能晚于现在')
  if (end !== null && (!Number.isFinite(end) || end <= start || end > now)) throw new Error('结束时间应晚于开始时间，且不能晚于现在')
  if (end !== null && end - start > 86400000) throw new Error('计时已超过 24 小时，请取消计时后按实际时间补记')
  const amount = kind === 'feeding' && fields.amount.trim() ? Number(fields.amount) : null
  if (amount !== null && (!Number.isInteger(amount) || amount < 0 || amount > 20000)) throw new Error('请输入有效的整数奶量')
  return { kind, recordedAt, endedAt, amount, side: kind === 'feeding' ? fields.side || null : null, diaperType: kind === 'diaper' ? fields.diaperType || null : null, note: fields.note.trim() || null }
}
export function finishCareSession(owner: string, session: CareSession, now = Date.now()): LocalToolRecord {
  assertOwner(owner)
  // Saving and clearing use two storage writes. Reuse the saved result if cleanup previously failed.
  const existing = readToolRecords().find(record => record.toolId === 'care' && record.payload.sessionId === session.id)
  if (existing) { try { discardCareSession(owner) } catch { /* retry on next open */ }; return existing }
  if (readCareSession(owner)?.id !== session.id) throw new Error('计时已变化，请重新打开工具')
  const payload = carePayload(session.kind, session.startedAt, new Date(now).toISOString(), session, now)
  const record = saveToolRecord('care', 'log', { ...payload, sessionId: session.id })
  try { discardCareSession(owner) } catch { /* The completed record prevents duplicate saves. */ }
  return record
}
