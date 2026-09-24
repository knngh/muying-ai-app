import type { ExpenseEntryRecord } from '../api/modules'
import type { LocalToolRecord, ToolRecordPayload } from './tool-records'

export const EXPENSE_CATEGORIES = [
  { value: 'checkup', label: '产检' }, { value: 'supplies', label: '待产包' },
  { value: 'feeding', label: '奶粉/喂养' }, { value: 'vaccine', label: '疫苗' }, { value: 'other', label: '其他/未分类' },
]
export const EXPENSE_DIRECTIONS = [{ value: 'expense', label: '支出' }, { value: 'refund', label: '退款' }, { value: 'transfer', label: '转账' }] as const
export type ExpenseDirection = typeof EXPENSE_DIRECTIONS[number]['value']
export interface LedgerEntry { record: LocalToolRecord; cents: number; direction: ExpenseDirection; category: string; date: string }

function normalizeCandidateSource(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
}

export function expenseCandidateAlreadySaved(records: LocalToolRecord[], sourceText: string, candidateId: string): boolean {
  const normalizedSource = normalizeCandidateSource(sourceText)
  if (!normalizedSource) return false
  const stableId = `${normalizedSource}\u0000${candidateId}`
  return records.some(record => {
    if (record.toolId !== 'expenses' || record.recordType !== 'entry') return false
    const candidateSource = normalizeCandidateSource(record.payload.sourceCandidateText)
    const sourceId = typeof record.payload.sourceCandidateId === 'string' ? record.payload.sourceCandidateId : ''
    return sourceId === stableId || (candidateSource === normalizedSource && sourceId.endsWith(`:${candidateId}`))
  })
}

export function parseExpenseCents(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim()
  if (text.length > 32 || !/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000 ? cents : null
}
export function formatExpenseCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) return '—'
  const absolute = Math.abs(cents)
  return (cents < 0 ? '-' : '') + String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + String(absolute % 100).padStart(2, '0')
}
export function isExpenseDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function expenseDirection(record: LocalToolRecord): ExpenseDirection | null {
  const value = record.payload.direction
  if (value === 'expense' || value === 'refund' || value === 'transfer') return value
  // The old local form only wrote expenses; old cloud imports discarded direction, so do not guess.
  return value === undefined && record.syncStatus === 'local' && !record.payload.serverId ? 'expense' : null
}
export function expenseDirectionLabel(record: LocalToolRecord): string {
  return EXPENSE_DIRECTIONS.find(item => item.value === expenseDirection(record))?.label || '类型待核对'
}
export function expenseCategoryLabel(value: unknown): string {
  return EXPENSE_CATEGORIES.find(item => item.value === value)?.label || (typeof value === 'string' && value.trim() ? value.trim().slice(0, 40) : '未分类')
}
export function expenseEntry(record: LocalToolRecord): LedgerEntry | null {
  if (record.toolId !== 'expenses' || record.recordType !== 'entry') return null
  const p = record.payload, cents = parseExpenseCents(p.amount), direction = expenseDirection(record)
  if (cents === null || !direction || !isExpenseDate(p.date)) return null
  const category = EXPENSE_CATEGORIES.find(item => item.value === p.category)?.value || 'other'
  return { record, cents, direction, category, date: p.date }
}
export function summarizeExpenseMonth(records: LocalToolRecord[], month: string) {
  const entries: LedgerEntry[] = [], excludedRecords: LocalToolRecord[] = []
  let expenseCents = 0, refundCents = 0, transferCents = 0
  for (const record of records) {
    if (record.toolId !== 'expenses' || record.recordType !== 'entry') continue
    const item = expenseEntry(record)
    if (!item) { excludedRecords.push(record); continue }
    if (!isExpenseDate(month + '-01') || item.date.slice(0, 7) !== month) continue
    entries.push(item)
    if (item.direction === 'expense') expenseCents += item.cents
    else if (item.direction === 'refund') refundCents += item.cents
    else transferCents += item.cents
  }
  entries.sort((a, b) => b.date.localeCompare(a.date) || b.record.createdAt.localeCompare(a.record.createdAt))
  const categories = EXPENSE_CATEGORIES.map(category => {
    const group = entries.filter(item => item.direction === 'expense' && item.category === category.value)
    const cents = group.reduce((sum, item) => sum + item.cents, 0)
    return { id: category.value, label: category.label, cents, count: group.length, percent: expenseCents ? Math.round(cents / expenseCents * 1000) / 10 : 0 }
  }).filter(category => category.count > 0).sort((a, b) => b.cents - a.cents)
  return { entries, excludedRecords, expenseCents, refundCents, transferCents, netCents: expenseCents - refundCents, categories }
}
export function expenseApiInput(record: LocalToolRecord) {
  const entry = expenseEntry(record), p = record.payload
  if (!entry || typeof p.category !== 'string' || !p.category.trim()) return null
  return {
    occurredAt: entry.date, amountCents: entry.cents, direction: entry.direction, category: p.category,
    note: typeof p.note === 'string' ? p.note : null, clientOperationId: record.id,
  }
}
export function expenseFromRemote(item: ExpenseEntryRecord): ToolRecordPayload {
  return { amount: item.amountCents / 100, direction: item.direction, category: item.category, note: item.note, date: item.occurredAt }
}
