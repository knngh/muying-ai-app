import type { getPosterCode as GetCode } from '../src/services/poster-code.service';
const originalFetch = global.fetch;
const originalAppId = process.env.WECHAT_APPID, originalSecret = process.env.WECHAT_APPSECRET;
let getPosterCode: typeof GetCode;
beforeEach(() => {
  process.env.WECHAT_APPID = 'test-app-id'; process.env.WECHAT_APPSECRET = 'test-secret';
  jest.isolateModules(() => { getPosterCode = require('../src/services/poster-code.service').getPosterCode; });
});
afterAll(() => {
  global.fetch = originalFetch;
  if (originalAppId === undefined) delete process.env.WECHAT_APPID; else process.env.WECHAT_APPID = originalAppId;
  if (originalSecret === undefined) delete process.env.WECHAT_APPSECRET; else process.env.WECHAT_APPSECRET = originalSecret;
});
it('coalesces requests and caches only a fixed public-destination code', async () => {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const mock = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token' })))
    .mockResolvedValueOnce(new Response(bytes));
  global.fetch = mock;
  const [a, b] = await Promise.all([getPosterCode(), getPosterCode()]);
  expect(a.bytes).toEqual(bytes); expect(b.mimeType).toBe('image/png');
  await getPosterCode(); expect(mock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(mock.mock.calls[1][1].body)).toEqual({ scene: 'beihu_poster', page: 'pages/home/index', check_path: true, env_version: 'release', width: 280 });
});
it('rejects provider JSON errors instead of exporting them as an image and backs off', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 40001, errmsg: 'provider-details' })));
  await expect(getPosterCode()).rejects.toMatchObject({ statusCode: 503, message: '小程序码暂不可用，请稍后重试' });
  await expect(getPosterCode()).rejects.toMatchObject({ statusCode: 503 });
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
it('supports JPEG codes returned by WeChat', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token' })))
    .mockResolvedValueOnce(new Response(Buffer.from([255,216,255,0])));
  expect((await getPosterCode()).mimeType).toBe('image/jpeg');
});
