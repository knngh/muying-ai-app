import { diaryWeek, diaryPayload, summarizeDiaryWeek } from '../mini-program/src/utils/diary-week';
import type { LocalToolRecord } from '../mini-program/src/utils/tool-records';
import { selectReviewRecords } from '../mini-program/src/utils/tool-review';

function entry(id: string, payload: LocalToolRecord['payload']): LocalToolRecord {
  return { id, toolId: 'diary', recordType: 'entry', createdAt: '2026-09-23T08:00:00Z', updatedAt: '2026-09-23T08:00:00Z', syncStatus: 'local', payload };
}
it('uses Monday through Sunday across years, leap days and daylight-saving dates', () => {
  expect(diaryWeek('2027-01-01')).toMatchObject({ start: '2026-12-28', end: '2027-01-03' });
  expect(diaryWeek('2027-01-03')?.start).toBe('2026-12-28');
  expect(diaryWeek('2027-01-04')?.start).toBe('2027-01-04');
  expect(diaryWeek('2024-02-29')?.days).toEqual(['2024-02-26', '2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02', '2024-03-03']);
  expect(diaryWeek('2026-03-08')?.days).toHaveLength(7);
  expect(diaryWeek('2026-02-30')).toBeNull();
});
it('keeps multiple entries on one date, counts recorded days once and never infers a missing mood', () => {
  const records = [entry('sun', { date: '2026-09-27', mood: '期待', content: '周日记录' }), entry('second', { date: '2026-09-21', mood: null, content: '第二篇' }), entry('first', { date: '2026-09-21', mood: '开心', content: '第一篇' }), entry('outside', { date: '2026-09-28', mood: '疲惫', content: '下周' })];
  records[2].createdAt = '2026-09-23T07:00:00Z';
  const result = summarizeDiaryWeek(records, '2026-09-23');
  expect(result.entries.map(item => item.record.id)).toEqual(['first', 'second', 'sun']);
  expect(result.recordedDays).toBe(2);
  expect(result.unmarkedMoodCount).toBe(1);
  expect(result.moods).toEqual([{ label: '开心', count: 1 }, { label: '期待', count: 1 }]);
  expect(result.days.map(item => item.count)).toEqual([2, 0, 0, 0, 0, 0, 1]);
  expect(result.summary).toContain('2 天留下 3 篇日记');
});
it('preserves full original text, marks truncated previews, and keeps ungroupable records discoverable', () => {
  const text = '原'.repeat(200) + '\n结尾';
  const records = [entry('long', { date: '2026-09-23', content: text }), entry('missing', { content: '不猜测日期' }), entry('bad', { date: '2026-02-30', content: '旧日期' }), entry('empty', { date: '2026-09-23', content: '  ' }), { ...entry('weekly', { week: 28, content: '旧周记' }), recordType: 'week' }, { ...entry('weight', { date: '2026-09-23', content: '其他工具' }), toolId: 'weight' as const }];
  const result = summarizeDiaryWeek(records, '2026-09-23');
  expect(result.entries).toHaveLength(1);
  expect(result.entries[0].preview.endsWith('…')).toBe(true);
  expect(result.entries[0].record.payload.content).toBe(text);
  expect(result.ungroupedRecords.map(item => item.id)).toEqual(['missing', 'bad', 'empty', 'weekly']);
});
it('recomputes the week after moving, changing, or deleting the original diary', () => {
  const record = entry('source', { date: '2026-09-23', mood: '疲惫', content: '原文' });
  expect(summarizeDiaryWeek([record], '2026-09-23').moods).toEqual([{ label: '疲惫', count: 1 }]);
  record.payload.mood = '平稳'; record.payload.content = '修改后的原文';
  expect(summarizeDiaryWeek([record], '2026-09-23').entries[0].preview).toBe('修改后的原文');
  record.payload.date = '2026-09-28';
  expect(summarizeDiaryWeek([record], '2026-09-23').entries).toEqual([]);
  expect(summarizeDiaryWeek([], '2026-09-23').summary).toContain('还没有');
});
it('validates daily writing and optional moods without quietly truncating or accepting future dates', () => {
  expect(diaryPayload('2026-09-23', '', '  今天\n很好  ', '2026-09-23')).toMatchObject({ date: '2026-09-23', mood: null, content: '今天\n很好' });
  expect(() => diaryPayload('2026-09-24', '开心', '未来', '2026-09-23')).toThrow('日期');
  expect(() => diaryPayload('2026-02-30', '开心', '不存在', '2026-09-23')).toThrow('日期');
  expect(() => diaryPayload('2026-09-23', '', ' ', '2026-09-23')).toThrow('内容');
  expect(() => diaryPayload('2026-09-23', '猜测', '文字', '2026-09-23')).toThrow('心情');
  expect(() => diaryPayload('2026-09-23', '', '字'.repeat(801), '2026-09-23')).toThrow('800');
});
it('prepares only available weekly source IDs, caps at 20 and retains requested selection order', () => {
  const inputs = Array.from({ length: 25 }, (_, i) => ({ id: String(i), date: '2026-09-23', content: '原文', updatedAt: '' }));
  const ids = ['missing', '0', '0', ...inputs.map(item => item.id)];
  expect(selectReviewRecords(inputs, ids)).toEqual({ ids: inputs.slice(0, 20).map(item => item.id), total: 25 });
  expect(selectReviewRecords(inputs, ['missing'])).toEqual({ ids: [], total: 0 });
  expect(selectReviewRecords(inputs, ['5', '2'])).toEqual({ ids: ['5', '2'], total: 2 });
});
