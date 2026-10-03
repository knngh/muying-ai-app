import { importToolRecord, readToolRecords, saveToolRecord } from '../mini-program/src/utils/tool-records';
const storage = new Map<string, unknown>();
(globalThis as unknown as { uni: unknown }).uni = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: unknown) => storage.set(key, value),
};
function useOwner(owner: 'guest' | '123' | '456') {
  if (owner === 'guest') {
    storage.delete('token'); storage.delete('user');
    return;
  }
  storage.set('token', `token-${owner}`); storage.set('user', { id: owner });
}
beforeEach(() => { storage.clear(); useOwner('guest'); });
it('does not replace another tool when independent database tables use the same numeric id', () => {
  importToolRecord('weight', 'measurement', '1', { value: 61 });
  importToolRecord('diary', 'entry', '1', { content: '今天的记录' });
  importToolRecord('weight', 'measurement', '1', { value: 62 });
  expect(readToolRecords()).toHaveLength(2);
  expect(readToolRecords().find(item => item.toolId === 'diary')?.payload.content).toBe('今天的记录');
  expect(readToolRecords().find(item => item.toolId === 'weight')?.payload.value).toBe(62);
});
it('keeps legacy records in the guest namespace and isolates account records', () => {
  storage.set('beihu:tool-records:v1', [{
    id: 'legacy-1', toolId: 'weight', recordType: 'measurement', createdAt: '2026-09-21T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z', syncStatus: 'local', payload: { value: 61 },
  }]);
  expect(readToolRecords().map(item => item.id)).toEqual(['legacy-1']);
  useOwner('123');
  expect(readToolRecords()).toEqual([]);
  saveToolRecord('weight', 'measurement', { value: 62 });
  expect(readToolRecords().map(item => item.payload.value)).toEqual([62]);
  useOwner('456');
  expect(readToolRecords()).toEqual([]);
  useOwner('guest');
  expect(readToolRecords().map(item => item.payload.value)).toEqual([61]);
});
