import path from 'path';
import vm from 'vm';
const { buildSync } = require('../mini-program/node_modules/esbuild');
const compiled = buildSync({
  entryPoints: [path.resolve(__dirname, '../mini-program/src/api/request.ts')], bundle: true, write: false,
  format: 'cjs', platform: 'node', define: { 'import.meta.env': '{}' },
  alias: { '@': path.resolve(__dirname, '../mini-program/src') },
}).outputFiles[0].text;

it.each(['request', 'uploadFile'])('ignores old-account %s success and 401 replies after a session change', async method => {
  for (const statusCode of [200, 401]) {
    const values = new Map<string, unknown>([['token', 'old-account']]);
    let callback!: { success: (response: unknown) => void };
    const module = { exports: {} as { api: { get: (url: string) => Promise<unknown>; upload: (url: string, file: string) => Promise<unknown> } } };
    const uni = {
      getStorageSync: (key: string) => values.get(key),
      removeStorageSync: jest.fn((key: string) => values.delete(key)),
      [method]: (options: typeof callback) => { callback = options; },
    };
    vm.runInNewContext(compiled, { uni, module, exports: module.exports, setTimeout });
    const api = module.exports.api;
    const request = method === 'request' ? api.get('/auth/me') : api.upload('/calendar/diaries/images', 'temp.png');
    values.set('token', 'new-account');
    callback.success({ statusCode, data: { code: 0, data: { private: 'old-user' } } });
    await expect(request).rejects.toThrow('账号已变化');
    expect(values.get('token')).toBe('new-account');
    expect(uni.removeStorageSync).not.toHaveBeenCalled();
  }
});
