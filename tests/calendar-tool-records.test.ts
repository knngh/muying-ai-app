import { recordsForCalendarPeriod } from '../mini-program/src/utils/calendar-tool-records'
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
