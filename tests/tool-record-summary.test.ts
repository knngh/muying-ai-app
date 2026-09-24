import { groupCalendarSummaryRecords, summarizeExpenseYear } from '../src/services/tool-record-summary.service'

describe('tool record summaries', () => {
  it('aggregates annual expenses by month and keeps transfers separate', () => {
    const result = summarizeExpenseYear([
      { occurredAt: '2026-01-03T00:00:00.000Z', amountCents: 10000, direction: 'expense' },
      { occurredAt: '2026-01-04T00:00:00.000Z', amountCents: 2000, direction: 'refund' },
      { occurredAt: '2026-03-04T00:00:00.000Z', amountCents: 50000, direction: 'transfer' },
      { occurredAt: '2027-01-01T00:00:00.000Z', amountCents: 99900, direction: 'expense' },
      { occurredAt: '2026-05-01T00:00:00.000Z', amountCents: 10, direction: 'unknown' },
    ], 2026)
    expect(result.months).toHaveLength(12)
    expect(result.months[0]).toMatchObject({ expenseCents: 10000, refundCents: 2000, netCents: 8000, entryCount: 2 })
    expect(result.months[2]).toMatchObject({ transferCents: 50000, netCents: 0, entryCount: 1 })
    expect(result).toMatchObject({ expenseCents: 10000, refundCents: 2000, transferCents: 50000, netCents: 8000, entryCount: 3 })
  })

  it('groups only dated calendar records newest day first', () => {
    expect(groupCalendarSummaryRecords([
        { id: 'a', toolId: 'weight', date: '2026-09-23', title: '62 kg' },
        { id: 'b', toolId: 'diary', date: '2026-09-24', title: '今天' },
        { id: 'c', toolId: 'growth', date: '2026-09-23', title: '身高 60 cm' },
      { id: 'bad', toolId: 'weight', date: 'bad', title: '不应出现' },
    ])).toEqual([
      { date: '2026-09-24', count: 1, records: [{ id: 'b', toolId: 'diary', date: '2026-09-24', title: '今天' }] },
      { date: '2026-09-23', count: 2, records: [
        { id: 'a', toolId: 'weight', date: '2026-09-23', title: '62 kg' },
        { id: 'c', toolId: 'growth', date: '2026-09-23', title: '身高 60 cm' },
      ] },
    ])
  })
})
