import { summarizeCareRecords, formatCareDuration } from '../mini-program/src/utils/care-summary';
import type { LocalToolRecord } from '../mini-program/src/utils/tool-records';

const log = (payload: LocalToolRecord['payload']): LocalToolRecord => ({
  id: Math.random().toString(), toolId: 'care', recordType: 'log', syncStatus: 'local',
  createdAt: '2026-09-22T00:00:00Z', updatedAt: '2026-09-22T00:00:00Z', payload,
});
it('splits overnight sleep by the local day instead of assigning all hours to the start date', () => {
  const records = [log({ kind: 'sleep', recordedAt: '2026-09-21T23:00:00', endedAt: '2026-09-22T02:00:00' })];
  expect(summarizeCareRecords(records, '2026-09-21')).toMatchObject({ sleepCount: 1, sleepSeconds: 3600 });
  expect(summarizeCareRecords(records, '2026-09-22')).toMatchObject({ sleepCount: 1, sleepSeconds: 7200 });
});
it('does not double-count overlapping sleep or count a missing end as zero-length sleep', () => {
  const records = [
    log({ kind: 'sleep', recordedAt: '2026-09-22T01:00:00', endedAt: '2026-09-22T03:00:00' }),
    log({ kind: 'sleep', recordedAt: '2026-09-22T02:00:00', endedAt: '2026-09-22T04:00:00' }),
    log({ kind: 'sleep', recordedAt: '2026-09-22T05:00:00', endedAt: null }),
  ];
  expect(summarizeCareRecords(records, '2026-09-22')).toMatchObject({ sleepSeconds: 10800, sleepCount: 2, untimedSleepCount: 1 });
});
it('keeps unknown milk amounts separate from explicitly recorded zero and excludes invalid values', () => {
  const records = [null, 0, 120, -2, NaN].map(amount => log({ kind: 'feeding', recordedAt: '2026-09-22T08:00:00', amount }));
  records.push(log({ kind: 'feeding', recordedAt: '2026-09-21T23:59:00', amount: 90 }));
  expect(summarizeCareRecords(records, '2026-09-22')).toMatchObject({ feedingCount: 5, feedingAmountMl: 120, knownAmountCount: 2 });
});
it('ignores reversed/invalid intervals and counts diapers by local date', () => {
  const records = [
    log({ kind: 'sleep', recordedAt: 'bad', endedAt: 'bad' }),
    log({ kind: 'sleep', recordedAt: '2026-09-22T08:00:00', endedAt: '2026-09-22T07:00:00' }),
    log({ kind: 'diaper', recordedAt: '2026-09-22T09:00:00' }),
  ];
  expect(summarizeCareRecords(records, '2026-09-22')).toMatchObject({ sleepSeconds: 0, sleepCount: 0, diaperCount: 1 });
});
it('shows short recorded durations without rounding them down to zero minutes', () => {
  expect(formatCareDuration(45)).toBe('45秒');
  expect(formatCareDuration(3660)).toBe('1小时 1分钟');
});
