import { readReportDrafts, writeReportDraft, forgetReportDraft, type ReportDraft } from '../mini-program/src/utils/report-drafts';
const storage = new Map<string, unknown>();
(globalThis as unknown as { uni: unknown }).uni = {
  getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, value),
};
const draft: ReportDraft = { id: 'report-test', name: '报告草稿', reportDate: '2026-09-21', note: '', imagePath: 'saved.png', createdAt: new Date().toISOString() };
beforeEach(() => storage.clear());
it('isolates anonymous and different-account report drafts', () => {
  writeReportDraft('guest', draft);
  expect(readReportDrafts('7')).toEqual([]);
  writeReportDraft('7', { ...draft, name: '账号 7 的报告' });
  expect(readReportDrafts('8')).toEqual([]);
  expect(readReportDrafts('guest')[0].name).toBe('报告草稿');
  forgetReportDraft('7', draft.id);
  expect(readReportDrafts('guest')).toHaveLength(1);
});
it('reuses a draft id for upload retries instead of duplicating local entries', () => {
  writeReportDraft('7', draft);
  writeReportDraft('7', draft);
  expect(readReportDrafts('7')).toHaveLength(1);
});
