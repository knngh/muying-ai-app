import { readCareSession, startCareSession, writeCareSession, finishCareSession, discardCareSession } from '../mini-program/src/utils/care-session';
import { readToolRecords } from '../mini-program/src/utils/tool-records';
const storage = new Map<string, unknown>();
const store = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: jest.fn((key: string, value: unknown) => { storage.set(key, value); }),
  removeStorageSync: jest.fn((key: string) => { storage.delete(key); }),
};
(globalThis as unknown as { uni: unknown }).uni = store;
function owner(id: string) { storage.set('token', 'test-only'); storage.set('user', { id }); }
const start = Date.parse('2026-09-22T08:00:00Z');
beforeEach(() => { storage.clear(); store.setStorageSync.mockClear(); store.removeStorageSync.mockClear(); owner('123'); });
it('restores the timer kind, start and feeding details after reopening', () => {
  const session = startCareSession('123', 'feeding', start);
  writeCareSession('123', { ...session, side: 'left', amount: '90', note: '测试备注' });
  expect(readCareSession('123')).toMatchObject({ id: session.id, kind: 'feeding', startedAt: new Date(start).toISOString(), side: 'left', amount: '90' });
});
it('keeps each account timer separate and cannot finish a previous account timer', () => {
  const session = startCareSession('123', 'sleep', start);
  owner('456');
  expect(readCareSession('456')).toBeNull();
  expect(() => finishCareSession('123', session, start + 10000)).toThrow('账号');
  expect(readToolRecords()).toEqual([]);
  owner('123');
  expect(readCareSession('123')?.id).toBe(session.id);
});
it('keeps an in-progress session when record storage fails', () => {
  const session = startCareSession('123', 'sleep', start);
  store.setStorageSync.mockImplementationOnce(() => { throw new Error('full'); });
  expect(() => finishCareSession('123', session, start + 60000)).toThrow('full');
  expect(readCareSession('123')?.id).toBe(session.id);
  expect(readToolRecords()).toEqual([]);
});
it('does not create duplicate records when timer cleanup fails and finish is retried', () => {
  const session = startCareSession('123', 'sleep', start);
  store.removeStorageSync.mockImplementationOnce(() => { throw new Error('cleanup failed'); });
  const first = finishCareSession('123', session, start + 60000);
  expect(readCareSession('123')).toBeNull();
  const second = finishCareSession('123', session, start + 120000);
  expect(second.id).toBe(first.id);
  expect(readToolRecords()).toHaveLength(1);
  expect(readCareSession('123')).toBeNull();
});
it('rejects backwards clocks and stale timers without silently truncating the session', () => {
  const session = startCareSession('123', 'sleep', start);
  expect(() => finishCareSession('123', session, start - 1000)).toThrow();
  expect(() => finishCareSession('123', session, start + 86400001)).toThrow();
  expect(readToolRecords()).toEqual([]);
  expect(readCareSession('123')?.id).toBe(session.id);
  discardCareSession('123');
  expect(readCareSession('123')).toBeNull();
});
it('rejects invalid milk quantities without losing the timer', () => {
  const session = startCareSession('123', 'feeding', start);
  expect(() => finishCareSession('123', { ...session, amount: '-10' }, start + 60000)).toThrow('奶量');
  expect(readCareSession('123')?.id).toBe(session.id);
});
it('saves feeding metadata and exact start/end times into history', () => {
  const session = startCareSession('123', 'feeding', start);
  const result = finishCareSession('123', { ...session, side: 'right', amount: '80', note: '测试' }, start + 120000);
  expect(result.payload).toMatchObject({ kind: 'feeding', side: 'right', amount: 80, note: '测试', recordedAt: new Date(start).toISOString(), endedAt: new Date(start + 120000).toISOString() });
});
