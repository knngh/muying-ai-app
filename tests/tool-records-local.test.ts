import { importToolRecord, readToolRecords } from '../mini-program/src/utils/tool-records';
const storage = new Map<string, unknown>();
(globalThis as unknown as { uni: unknown }).uni = { getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, value) };
it('does not replace another tool when independent database tables use the same numeric id', () => {
  importToolRecord('weight', 'measurement', '1', { value: 61 });
  importToolRecord('diary', 'entry', '1', { content: '今天的记录' });
  importToolRecord('weight', 'measurement', '1', { value: 62 });
  expect(readToolRecords()).toHaveLength(2);
  expect(readToolRecords().find(item => item.toolId === 'diary')?.payload.content).toBe('今天的记录');
  expect(readToolRecords().find(item => item.toolId === 'weight')?.payload.value).toBe(62);
});
