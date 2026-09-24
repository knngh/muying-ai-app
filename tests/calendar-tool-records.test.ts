import { groupCalendarToolRecordsByDate, recordsForCalendarPeriod } from '../mini-program/src/utils/calendar-tool-records'
import type { LocalToolRecord } from '../mini-program/src/utils/tool-records'
function record(id: string, toolId: LocalToolRecord['toolId'], payload: LocalToolRecord['payload']): LocalToolRecord { const createdAt = '2026-09-23T10:00:00Z'; return { id, toolId, recordType: 'entry', payload, createdAt, updatedAt: createdAt, syncStatus: 'local' } }
it('groups real pregnancy dates and excludes undated records', () => {
  const records = [record('weight', 'weight', { value: 62, measuredAt: '2026-09-23' }), record('diary', 'diary', { content: '本周记录', date: '2026-09-24' }), record('undated', 'expenses', { amount: 10 })]
  const result = recordsForCalendarPeriod(records, 'pregnancy', 25, '2027-01-06')
  expect(result.map(item => item.id)).toEqual(['diary', 'weight'])
  expect(result.map(item => item.id)).not.toContain('undated')
})
it('uses the baby birthday for postpartum weeks and never guesses without it', () => {
  const records = [record('care', 'care', { kind: 'feeding', recordedAt: '2026-09-23T09:00:00.000Z' })]
  expect(recordsForCalendarPeriod(records, 'postpartum', 2, null, '2026-09-16').map(item => item.id)).toEqual(['care'])
  expect(recordsForCalendarPeriod(records, 'postpartum', 2)).toEqual([])
})
it('keeps timestamp records on the device local calendar date', () => {
  const records = [record('care', 'care', { kind: 'feeding', recordedAt: '2026-09-23T00:30:00+08:00' })]
  expect(recordsForCalendarPeriod(records, 'postpartum', 2, null, '2026-09-16').map(item => item.date)).toEqual(['2026-09-23'])
})
it('does not map records outside the pregnancy anchor window into a clamped week', () => {
  const records = [record('after-due', 'weight', { value: 63, measuredAt: '2027-01-07' }), record('before-start', 'weight', { value: 60, measuredAt: '2026-03-01' })]
  expect(recordsForCalendarPeriod(records, 'pregnancy', 40, '2027-01-06')).toEqual([])
})
it('groups calendar records by real date with stable newest-day ordering', () => {
  const records = recordsForCalendarPeriod([
    record('one', 'weight', { measuredAt: '2026-09-23', value: 62 }),
    record('two', 'diary', { date: '2026-09-24', content: '今天' }),
    record('three', 'growth', { measuredAt: '2026-09-23', value: 6 }),
  ], 'pregnancy', 25, '2027-01-06')
  expect(groupCalendarToolRecordsByDate(records, '2026-09-24')).toMatchObject([
    { date: '2026-09-24', label: '今天', count: 1 },
    { date: '2026-09-23', label: '09月23日', count: 2 },
  ])
  expect(groupCalendarToolRecordsByDate([], '2026-09-24')).toEqual([])
})
