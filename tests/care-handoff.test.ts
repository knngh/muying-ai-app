import { buildCareHandoff } from '../mini-program/src/utils/care-handoff';
import type { LocalToolRecord } from '../mini-program/src/utils/tool-records';
import type { CareSession } from '../mini-program/src/utils/care-session';

const day = '2026-09-23';
const now = new Date(day + 'T12:00:00').getTime();
function log(id: string, payload: LocalToolRecord['payload']): LocalToolRecord {
  return { id, toolId: 'care', recordType: 'log', payload, createdAt: day, updatedAt: day, syncStatus: 'local' };
}
it('orders the day chronologically, distinguishes unknown milk from zero, and requires opt-in for notes', () => {
  const records = [
    log('late', { kind: 'diaper', recordedAt: day + 'T09:00:00', diaperType: 'wet', note: '仅家人可见\n换好了' }),
    log('unknown', { kind: 'feeding', recordedAt: day + 'T08:00:00', side: 'left', amount: null }),
    log('zero', { kind: 'feeding', recordedAt: day + 'T07:00:00', amount: 0 }),
    log('bottle', { kind: 'feeding', recordedAt: day + 'T06:00:00', amount: 120 }),
    log('yesterday', { kind: 'feeding', recordedAt: '2026-09-22T23:59:00', amount: 90 }),
  ];
  const result = buildCareHandoff(records, day, false, null, now);
  expect(result.entries.map(entry => entry.id)).toEqual(['bottle', 'zero', 'unknown', 'late']);
  expect(result.summaryLines[0]).toBe('喂奶 3 次 · 已记录奶量 120 ml · 1 次奶量未记录');
  expect(result.entries[1].detail).toContain('0 ml');
  expect(result.entries[2].detail).toContain('奶量未记录');
  expect(result.text).not.toContain('仅家人可见');
  expect(buildCareHandoff(records, day, true, null, now).text).toContain('备注：仅家人可见 换好了');
  expect(result.text).toContain('整理于 2026-09-23 12:00');
  expect(result.text).toContain('不代表全天完整情况');
});
it('clips overnight sleep, unions overlaps in the total, and identifies untimed legacy records', () => {
  const records = [
    log('overnight', { kind: 'sleep', recordedAt: '2026-09-22T23:00:00', endedAt: day + 'T02:00:00' }),
    log('overlap', { kind: 'sleep', recordedAt: day + 'T01:00:00', endedAt: day + 'T03:00:00' }),
    log('legacy', { kind: 'sleep', recordedAt: day + 'T05:00:00', endedAt: null }),
    log('reverse', { kind: 'sleep', recordedAt: day + 'T07:00:00', endedAt: day + 'T06:00:00' }),
  ];
  const result = buildCareHandoff(records, day, false, null, now);
  expect(result.entries).toHaveLength(3);
  expect(result.entries[0]).toMatchObject({ time: '00:00—02:00', detail: '睡眠 · 当日 2小时（跨日记录）' });
  expect(result.summaryLines[2]).toBe('睡眠 3小时 · 2 条含时长记录 · 另有 1 条未记录结束时间');
  expect(result.entries[2].detail).toBe('睡眠 · 结束时间未记录');
  expect(buildCareHandoff(records, '2026-09-22', false, null, now).entries[0].time).toBe('23:00—24:00');
});
it('keeps an active timer separate without copying any unsaved fields or including it on an earlier day', () => {
  const session: CareSession = { id: 'active', kind: 'sleep', startedAt: day + 'T11:00:00', side: 'left', amount: '150', note: '私密未保存' };
  const result = buildCareHandoff([], day, true, session, now);
  expect(result.ongoing).toBe('睡眠计时中 · 开始于 2026-09-23 11:00 · 未计入以上合计');
  expect(result.summaryLines[2]).toContain('睡眠 0秒');
  expect(result.entries).toHaveLength(0);
  expect(result.text).not.toMatch(/150|私密未保存|左侧/);
  expect(buildCareHandoff([], '2026-09-22', true, session, now).ongoing).toBe('');
  expect(buildCareHandoff([], day, false, { ...session, startedAt: day + 'T13:00:00' }, now).ongoing).toBe('');
});
it('rebuilds after edits/deletions and excludes unrelated tools and invalid dates', () => {
  const original = log('feed', { kind: 'feeding', recordedAt: day + 'T08:00:00', amount: 100 });
  expect(buildCareHandoff([original], day, false, null, now).summaryLines[0]).toContain('100 ml');
  original.payload.amount = 80;
  expect(buildCareHandoff([original], day, false, null, now).summaryLines[0]).toContain('80 ml');
  expect(buildCareHandoff([], day, false, null, now).text).toContain('当天暂无已保存记录');
  const invalid = [
    { ...original, toolId: 'diary' as const }, { ...original, recordType: 'other' },
    log('bad', { kind: 'feeding', recordedAt: 'bad' }),
    log('bad-end', { kind: 'sleep', recordedAt: day + 'T08:00:00', endedAt: 'bad' }),
  ];
  expect(buildCareHandoff(invalid, day, false, null, now).entries).toEqual([]);
  expect(buildCareHandoff([original], '2026-02-30', false, null, now).entries).toEqual([]);
});
