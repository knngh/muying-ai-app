import { AppError, ErrorCodes } from '../middlewares/error.middleware';

// Fixed public destination: never include a name, record id, or other personal data.
const QR_INPUT = { scene: 'beihu_poster', page: 'pages/home/index', check_path: true, env_version: 'release', width: 280 };
type PosterCode = { bytes: Buffer; mimeType: 'image/png' | 'image/jpeg' };
let cached: (PosterCode & { expires: number }) | undefined;
let pending: Promise<PosterCode> | undefined;
let retryAt = 0;
const unavailable = () => new AppError('小程序码暂不可用，请稍后重试', ErrorCodes.THIRD_PARTY_ERROR, 503);
async function loadCode(): Promise<PosterCode> {
  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_APPSECRET || process.env.WECHAT_APP_SECRET;
  if (!appid || !secret) throw unavailable();
  const response = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credential', appid, secret }), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw unavailable();
  const token = await response.json() as { access_token?: unknown };
  if (typeof token.access_token !== 'string' || !token.access_token) throw unavailable();
  const code = await fetch(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token.access_token)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(QR_INPUT), signal: AbortSignal.timeout(8000),
  });
  if (!code.ok) throw unavailable();
  const bytes = Buffer.from(await code.arrayBuffer());
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if ((!isPng && !isJpeg) || bytes.length > 1024 * 1024) throw unavailable();
  cached = { bytes, mimeType: isPng ? 'image/png' : 'image/jpeg', expires: Date.now() + 60 * 60 * 1000 };
  return cached;
}
export async function getPosterCode(): Promise<PosterCode> {
  if (cached && cached.expires > Date.now()) return cached;
  if (Date.now() < retryAt) throw unavailable();
  if (!pending) pending = loadCode().catch(() => { retryAt = Date.now() + 60_000; throw unavailable(); }).finally(() => { pending = undefined; });
  return pending;
}
