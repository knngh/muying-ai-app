import crypto from 'crypto';
import fs from 'fs';

interface CosStorageConfig {
  enabled: boolean;
  publicBaseUrl: string;
  endpoint: string;
  bucket: string;
  region: string;
  secretId: string;
  secretKey: string;
  sessionToken: string;
  uploadPrefix: string;
}

interface CosDomainParts {
  bucket: string;
  region: string;
}

const DEFAULT_COS_UPLOAD_PREFIX = 'diary';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, '');
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/gu, '');
}

function parseCosDomain(value: string): CosDomainParts | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    const matched = parsed.hostname.match(/^(.+)\.cos\.([a-z0-9-]+)\.myqcloud\.com$/i);
    if (!matched?.[1] || !matched?.[2]) {
      return null;
    }

    return {
      bucket: matched[1],
      region: matched[2],
    };
  } catch {
    return null;
  }
}

function getCosStorageConfig(): CosStorageConfig {
  const publicBaseUrl = trimTrailingSlash(process.env.COS_PUBLIC_BASE_URL || '');
  const domainParts = parseCosDomain(publicBaseUrl);
  const bucket = process.env.COS_BUCKET || domainParts?.bucket || '';
  const region = process.env.COS_REGION || domainParts?.region || '';
  const endpoint = trimTrailingSlash(
    process.env.COS_ENDPOINT || (bucket && region ? `https://${bucket}.cos.${region}.myqcloud.com` : publicBaseUrl),
  );

  return {
    enabled: process.env.UPLOAD_STORAGE_DRIVER === 'cos' || process.env.COS_STORAGE_ENABLED === 'true',
    publicBaseUrl,
    endpoint,
    bucket,
    region,
    secretId: process.env.COS_SECRET_ID || process.env.TENCENT_COS_SECRET_ID || '',
    secretKey: process.env.COS_SECRET_KEY || process.env.TENCENT_COS_SECRET_KEY || '',
    sessionToken: process.env.COS_SESSION_TOKEN || process.env.TENCENT_COS_SESSION_TOKEN || '',
    uploadPrefix: trimSlashes(process.env.COS_UPLOAD_PREFIX || DEFAULT_COS_UPLOAD_PREFIX),
  };
}

function assertCosStorageConfig(config = getCosStorageConfig()): CosStorageConfig {
  const missing = [
    !config.publicBaseUrl && 'COS_PUBLIC_BASE_URL',
    !config.endpoint && 'COS_ENDPOINT',
    !config.bucket && 'COS_BUCKET',
    !config.region && 'COS_REGION',
    !config.secretId && 'COS_SECRET_ID',
    !config.secretKey && 'COS_SECRET_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`COS 上传配置缺失: ${missing.join(', ')}`);
  }

  return config;
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/gu, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeCosPath(key: string): string {
  return `/${key.split('/').map(encodeRfc3986).join('/')}`;
}

function hmacSha1Hex(key: string | Buffer, value: string): string {
  return crypto.createHmac('sha1', key).update(value).digest('hex');
}

function sha1Hex(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function buildCosAuthorization(input: {
  method: 'PUT' | 'DELETE';
  key: string;
  headers: Record<string, string>;
  secretId: string;
  secretKey: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now};${now + 600}`;
  const normalizedHeaders = Object.entries(input.headers)
    .map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/gu, ' ')] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  const headerList = normalizedHeaders.map(([name]) => name).join(';');
  const headerString = normalizedHeaders
    .map(([name, value]) => `${encodeRfc3986(name)}=${encodeRfc3986(value)}`)
    .join('&');
  const httpString = [
    input.method.toLowerCase(),
    encodeCosPath(input.key),
    '',
    headerString,
    '',
  ].join('\n');
  const stringToSign = [
    'sha1',
    keyTime,
    sha1Hex(httpString),
    '',
  ].join('\n');
  const signKey = hmacSha1Hex(input.secretKey, keyTime);
  const signature = hmacSha1Hex(signKey, stringToSign);

  return [
    'q-sign-algorithm=sha1',
    `q-ak=${input.secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${headerList}`,
    'q-url-param-list=',
    `q-signature=${signature}`,
  ].join('&');
}

function buildDiaryObjectKey(filename: string, now = new Date()): string {
  const config = getCosStorageConfig();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return [config.uploadPrefix, year, month, filename].filter(Boolean).join('/');
}

export function isCosStorageEnabled(): boolean {
  return getCosStorageConfig().enabled;
}

export function getCosPublicBaseUrl(): string {
  return getCosStorageConfig().publicBaseUrl;
}

export function buildCosPublicUrl(key: string): string {
  const config = assertCosStorageConfig();
  return `${config.publicBaseUrl}/${key.split('/').map(encodeRfc3986).join('/')}`;
}

export function resolveCosObjectKeyFromPublicUrl(url: string): string | null {
  const config = getCosStorageConfig();
  if (!config.publicBaseUrl) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const base = new URL(config.publicBaseUrl);
    if (parsed.origin !== base.origin) {
      return null;
    }

    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ''));
    if (!key || !key.startsWith(`${config.uploadPrefix}/`)) {
      return null;
    }

    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:jpg|jpeg|png|gif|webp)$/iu.test(key)) {
      return null;
    }

    return key;
  } catch {
    return null;
  }
}

export async function uploadFileToCos(file: Express.Multer.File): Promise<{ url: string; key: string }> {
  const config = assertCosStorageConfig();
  const key = buildDiaryObjectKey(file.filename);
  const body = await fs.promises.readFile(file.path);
  const headers = {
    host: new URL(config.endpoint).host,
    'content-type': file.mimetype,
    ...(config.sessionToken ? { 'x-cos-security-token': config.sessionToken } : {}),
  };
  const authorization = buildCosAuthorization({
    method: 'PUT',
    key,
    headers,
    secretId: config.secretId,
    secretKey: config.secretKey,
  });

  const response = await fetch(`${config.endpoint}${encodeCosPath(key)}`, {
    method: 'PUT',
    headers: {
      ...headers,
      authorization,
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`COS 上传失败: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
  }

  await fs.promises.unlink(file.path).catch(() => undefined);
  return {
    url: buildCosPublicUrl(key),
    key,
  };
}

export async function deleteCosObject(key: string): Promise<void> {
  const config = assertCosStorageConfig();
  const headers = {
    host: new URL(config.endpoint).host,
    ...(config.sessionToken ? { 'x-cos-security-token': config.sessionToken } : {}),
  };
  const authorization = buildCosAuthorization({
    method: 'DELETE',
    key,
    headers,
    secretId: config.secretId,
    secretKey: config.secretKey,
  });

  const response = await fetch(`${config.endpoint}${encodeCosPath(key)}`, {
    method: 'DELETE',
    headers: {
      ...headers,
      authorization,
    },
  });

  if (!response.ok && response.status !== 404) {
    const detail = await response.text().catch(() => '');
    throw new Error(`COS 删除失败: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
  }
}

export const __cosStorageTestUtils = {
  buildCosAuthorization,
  parseCosDomain,
};
