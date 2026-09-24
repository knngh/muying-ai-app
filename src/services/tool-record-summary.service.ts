export type ExpenseSummaryDirection = 'expense' | 'refund' | 'transfer'

export interface ExpenseSummaryInput {
  occurredAt: string | Date
  amountCents: number
  direction: string
}

export interface ExpenseSummaryMonth {
  month: string
  expenseCents: number
  refundCents: number
  transferCents: number
  netCents: number
  entryCount: number
}

export function summarizeExpenseYear(records: ExpenseSummaryInput[], year: number) {
  const yearText = String(year)
  const months: ExpenseSummaryMonth[] = Array.from({ length: 12 }, (_, index) => ({
    month: `${yearText}-${String(index + 1).padStart(2, '0')}`,
    expenseCents: 0,
    refundCents: 0,
    transferCents: 0,
    netCents: 0,
    entryCount: 0,
  }))
  for (const record of records) {
    const date = record.occurredAt instanceof Date ? record.occurredAt : new Date(record.occurredAt)
    if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() !== year) continue
    const month = months[date.getUTCMonth()]
    if (!month || !Number.isSafeInteger(record.amountCents) || record.amountCents <= 0) continue
    if (record.direction === 'expense') month.expenseCents += record.amountCents
    else if (record.direction === 'refund') month.refundCents += record.amountCents
    else if (record.direction === 'transfer') month.transferCents += record.amountCents
    else continue
    month.entryCount += 1
  }
  for (const month of months) month.netCents = month.expenseCents - month.refundCents
  const expenseCents = months.reduce((sum, month) => sum + month.expenseCents, 0)
  const refundCents = months.reduce((sum, month) => sum + month.refundCents, 0)
  const transferCents = months.reduce((sum, month) => sum + month.transferCents, 0)
  return { year, months, expenseCents, refundCents, transferCents, netCents: expenseCents - refundCents, entryCount: months.reduce((sum, month) => sum + month.entryCount, 0) }
}

export interface CalendarSummaryRecord {
  id: string
  toolId: string
  date: string
  title: string
}

export interface CalendarSummaryDay {
  date: string
  count: number
  records: CalendarSummaryRecord[]
}

export function groupCalendarSummaryRecords(records: CalendarSummaryRecord[]): CalendarSummaryDay[] {
  const groups = new Map<string, CalendarSummaryRecord[]>()
  for (const record of records) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) continue
    groups.set(record.date, [...(groups.get(record.date) || []), record])
  }
  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, dayRecords]) => {
      const sortedRecords = [...dayRecords].sort((left, right) => left.id.localeCompare(right.id))
      return { date, count: sortedRecords.length, records: sortedRecords }
    })
}
