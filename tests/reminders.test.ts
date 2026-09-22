import { buildReminderPrompt, buildReminderSummary, closeReminderSource, eventTime, markPhoneCalendarAdded, markReminderPromptRead, phoneCalendarPayload, readReminderPromptSignature, readReminders, reminderSignature, reminderTime, saveReminder, type ReminderInput } from '../mini-program/src/utils/reminders';
const storage = new Map<string, unknown>();
(globalThis as unknown as { uni: unknown }).uni = { getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, value), $emit: jest.fn() };
const input: ReminderInput = { sourceKey: 'vaccine:one', kind: 'vaccines', title: '乙肝疫苗第二剂预约', date: '2026-10-01', time: '09:00', leadMinutes: 1440 };
const now = eventTime('2026-09-21', '12:00');
beforeEach(() => storage.clear());
it('validates actual dates and calculates reminders across month and year boundaries', () => {
  expect(Number.isNaN(eventTime('2026-02-30', '09:00'))).toBe(true);
  expect(Number.isNaN(eventTime('2026-09-21', '24:00'))).toBe(true);
  expect(reminderTime(input)).toBe(eventTime('2026-09-30', '09:00'));
  expect(reminderTime({ ...input, date: '2027-01-01' })).toBe(eventTime('2026-12-31', '09:00'));
});
it('does not promise a reminder whose lead time has already passed', () => {
  expect(() => saveReminder('guest', { ...input, date: '2026-09-22', time: '09:00' }, undefined, now)).toThrow('提醒时间已过');
});
it('updates one linked appointment without duplicating it and isolates account storage', () => {
  const first = saveReminder('guest', input, undefined, now);
  const second = saveReminder('guest', { ...input, date: '2026-10-02' }, undefined, now);
  expect(second.id).toBe(first.id);
  expect(readReminders('guest')).toHaveLength(1);
  expect(readReminders('123')).toEqual([]);
});
it('uses seconds for phone calendar timestamps and alarm lead values', () => {
  const reminder = saveReminder('guest', input, undefined, now);
  expect(phoneCalendarPayload(reminder)).toMatchObject({ startTime: eventTime('2026-10-01', '09:00') / 1000, alarm: true, alarmOffset: 86400 });
});
it('does not mark a changed reminder as successfully exported by a late callback', () => {
  const reminder = saveReminder('guest', input, undefined, now);
  const signature = reminderSignature(reminder);
  saveReminder('guest', { ...input, date: '2026-10-02' }, reminder.id, now);
  markPhoneCalendarAdded('guest', reminder.id, signature);
  expect(readReminders('guest')[0].phoneSignature).toBeUndefined();
});
it('closes only the linked dose and preserves evidence of an external calendar copy', () => {
  const reminder = saveReminder('guest', input, undefined, now);
  saveReminder('guest', { ...input, sourceKey: 'vaccine:two' }, undefined, now);
  markPhoneCalendarAdded('guest', reminder.id, reminderSignature(reminder));
  expect(closeReminderSource('guest', input.sourceKey, 'completed')).toBe(true);
  expect(readReminders('guest').find(item => item.id === reminder.id)?.state).toBe('completed');
  expect(readReminders('guest').find(item => item.sourceKey === 'vaccine:two')?.state).toBe('active');
});
it('summarizes active reminders by due and seven-day windows', () => {
  const soon = saveReminder('guest', { ...input, sourceKey: 'soon', date: '2026-09-22', time: '09:00', leadMinutes: 0 }, undefined, now);
  const later = saveReminder('guest', { ...input, sourceKey: 'later', date: '2026-10-01', time: '09:00', leadMinutes: 0 }, undefined, now);
  const overdue = saveReminder('guest', { ...input, sourceKey: 'overdue', date: '2026-09-20', time: '09:00', leadMinutes: 0 }, undefined, now - 3 * 24 * 60 * 60 * 1000);
  const summary = buildReminderSummary([soon, later, overdue], now);
  expect(summary.activeCount).toBe(3);
  expect(summary.due.map(item => item.sourceKey)).toEqual(['overdue']);
  expect(summary.withinSevenDays.map(item => item.sourceKey)).toEqual(['soon']);
  expect(summary.next?.sourceKey).toBe('overdue');
});
it('creates a prompt for reminders due within one day and changes phase at the due time', () => {
  const soon = saveReminder('guest', { ...input, sourceKey: 'soon', date: '2026-09-22', time: '09:00', leadMinutes: 0 }, undefined, now);
  const before = buildReminderPrompt([soon], now);
  expect(before?.kind).toBe('soon');
  expect(before?.items[0].sourceKey).toBe('soon');
  const atDue = buildReminderPrompt([soon], eventTime('2026-09-22', '09:00'));
  expect(atDue?.kind).toBe('due');
  expect(atDue?.signature).not.toBe(before?.signature);
});
it('keeps prompt read state isolated by local owner', () => {
  markReminderPromptRead('guest', 'due|one');
  expect(readReminderPromptSignature('guest')).toBe('due|one');
  expect(readReminderPromptSignature('123')).toBe('');
});
