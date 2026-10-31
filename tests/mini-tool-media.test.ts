import { saveToolImage } from '../mini-program/src/utils/tool-media';

it('discards an image if the account changes while the file is being saved', async () => {
  const values = new Map<string, unknown>([['token', 'test'], ['user', { id: '123' }]]);
  let complete!: { success: (result: { savedFilePath: string }) => void };
  const writes = jest.fn();
  const removeSavedFile = jest.fn((options: { complete: () => void }) => options.complete());
  (globalThis as unknown as { uni: unknown }).uni = { getStorageSync: (key: string) => values.get(key), setStorageSync: writes,
    saveFile: (options: typeof complete) => { complete = options; }, removeSavedFile };
  const saving = saveToolImage('album', 'temp.png', { date: '2026-10-15' });
  values.set('user', { id: '456' });
  complete.success({ savedFilePath: 'saved.png' });
  await expect(saving).rejects.toThrow('账号已变化');
  expect(writes).not.toHaveBeenCalled();
  expect(removeSavedFile).toHaveBeenCalledTimes(1);
});
