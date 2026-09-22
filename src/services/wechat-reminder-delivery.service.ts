import axios from 'axios';
import prisma from '../config/database';
import { env } from '../config/env';
import { getWechatSubscribeConfig } from './wechat-reminder.service';

const ACCESS_TOKEN_SAFETY_WINDOW_MS = 60 * 1000;
const SENDING_LEASE_MS = 15 * 60 * 1000;
const MAX_TITLE_LENGTH = 20;

interface WechatAccessTokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  errcode?: unknown;
}

interface WechatSendResponse {
  errcode?: unknown;
}

interface DeliveryRecord {
  id: bigint;
  user: { openid: string | null };
  templateId: string;
  title: string;
  eventAt: Date;
  leadMinutes: number;
  attempts: number;
}

let accessTokenCache: { value: string; expiresAt: number } | null = null;

class WechatDeliveryError extends Error {
  constructor(public readonly code: number | null, public readonly retryable: boolean) {
    super('微信订阅消息接口调用失败');
    this.name = 'WechatDeliveryError';
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function responseErrorCode(value: unknown): number | null {
  const code = asObject(value).errcode;
  return typeof code === 'number' && Number.isInteger(code) ? code : null;
}

function isRetryableCode(code: number | null): boolean {
  // Consent, template and recipient errors will not improve by retrying.
  return code === null || ![40003, 41030, 43101, 47003, 47004].includes(code);
}

function truncate(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join('');
}

function formatEventTime(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  // Reminder times are created from the user's China-local picker. Format the
  // absolute instant explicitly as China time instead of relying on the
  // worker host's timezone (containers commonly run in UTC).
  const local = new Date(value.getTime() + 8 * 60 * 60 * 1000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

function formatLeadMinutes(minutes: number): string {
  if (minutes <= 0) return '准时提醒';
  if (minutes % (24 * 60) === 0) return `提前${minutes / (24 * 60)}天`;
  if (minutes % 60 === 0) return `提前${minutes / 60}小时`;
  return `提前${minutes}分钟`;
}

function clearAccessTokenCache(): void {
  accessTokenCache = null;
}

async function getAccessToken(): Promise<string> {
  const config = getWechatSubscribeConfig();
  const now = Date.now();
  if (accessTokenCache && accessTokenCache.expiresAt > now + ACCESS_TOKEN_SAFETY_WINDOW_MS) {
    return accessTokenCache.value;
  }

  try {
    const response = await axios.get<WechatAccessTokenResponse>('https://api.weixin.qq.com/cgi-bin/token', {
      params: { grant_type: 'client_credential', appid: config.appId, secret: config.appSecret },
      timeout: 10000,
    });
    const body = asObject(response.data);
    const token = body.access_token;
    const expiresIn = body.expires_in;
    const code = responseErrorCode(response.data);
    if (typeof token !== 'string' || !token || (code !== null && code !== 0)) {
      throw new WechatDeliveryError(code, isRetryableCode(code));
    }
    const ttlSeconds = typeof expiresIn === 'number' && Number.isFinite(expiresIn) ? expiresIn : 7200;
    accessTokenCache = { value: token, expiresAt: now + Math.max(60, ttlSeconds) * 1000 };
    return token;
  } catch (error) {
    if (error instanceof WechatDeliveryError) throw error;
    throw new WechatDeliveryError(null, true);
  }
}

async function sendWechatReminder(record: DeliveryRecord): Promise<void> {
  const config = getWechatSubscribeConfig();
  if (!record.user.openid) throw new WechatDeliveryError(40003, false);
  if (record.templateId !== config.templateId) throw new WechatDeliveryError(47003, false);

  let token = await getAccessToken();
  const data: Record<string, { value: string }> = {
    [config.titleField]: { value: truncate(record.title, MAX_TITLE_LENGTH) },
    [config.timeField]: { value: formatEventTime(record.eventAt) },
    [config.leadField]: { value: truncate(formatLeadMinutes(record.leadMinutes), MAX_TITLE_LENGTH) },
  };
  const payload = {
    touser: record.user.openid,
    template_id: config.templateId,
    page: config.page,
    miniprogram_state: env.isProd ? 'formal' : 'developer',
    lang: 'zh_CN',
    data,
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await axios.post<WechatSendResponse>(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(token)}`,
        payload,
        { timeout: 10000 },
      );
      const code = responseErrorCode(response.data);
      if (code === null || code === 0) return;
      if (code === 40001 && attempt === 0) {
        clearAccessTokenCache();
        token = await getAccessToken();
        continue;
      }
      throw new WechatDeliveryError(code, isRetryableCode(code));
    } catch (error) {
      if (error instanceof WechatDeliveryError) throw error;
      throw new WechatDeliveryError(null, true);
    }
  }
}

function deliveryErrorMessage(error: unknown): string {
  if (error instanceof WechatDeliveryError && error.code !== null) {
    return `微信接口错误 ${error.code}`;
  }
  return '微信接口请求失败';
}

export interface WechatReminderWorkerResult {
  skipped: boolean;
  scanned: number;
  sent: number;
  retried: number;
  failed: number;
  recovered: number;
}

export async function processDueWechatReminders(now = new Date(), limit = 50): Promise<WechatReminderWorkerResult> {
  const config = getWechatSubscribeConfig();
  if (!config.enabled || !config.configured) {
    return { skipped: true, scanned: 0, sent: 0, retried: 0, failed: 0, recovered: 0 };
  }

  const stale = await prisma.wechatReminderDelivery.updateMany({
    where: { status: 'sending', updatedAt: { lt: new Date(now.getTime() - SENDING_LEASE_MS) } },
    data: { status: 'pending', lastError: '发送任务超时，已重新排队' },
  });
  const records = await prisma.wechatReminderDelivery.findMany({
    where: { status: 'pending', scheduledAt: { lte: now } },
    include: { user: { select: { openid: true } } },
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    take: Math.max(1, Math.min(100, limit)),
  }) as unknown as DeliveryRecord[];

  let sent = 0;
  let retried = 0;
  let failed = 0;
  for (const record of records) {
    const lease = await prisma.wechatReminderDelivery.updateMany({
      where: { id: record.id, status: 'pending' },
      data: { status: 'sending', attempts: { increment: 1 } },
    });
    if (lease.count !== 1) continue;
    const attempts = record.attempts + 1;
    try {
      await sendWechatReminder(record);
      const sentUpdate = await prisma.wechatReminderDelivery.updateMany({
        where: { id: record.id, status: 'sending' },
        data: { status: 'sent', sentAt: new Date(), lastError: null },
      });
      if (sentUpdate.count === 1) sent += 1;
    } catch (error) {
      const retryable = error instanceof WechatDeliveryError ? error.retryable : true;
      const shouldRetry = retryable && attempts < env.WECHAT_REMINDER_MAX_ATTEMPTS;
      await prisma.wechatReminderDelivery.updateMany({
        where: { id: record.id, status: 'sending' },
        data: {
          status: shouldRetry ? 'pending' : 'failed',
          lastError: deliveryErrorMessage(error),
        },
      });
      if (shouldRetry) retried += 1;
      else failed += 1;
    }
  }

  return { skipped: false, scanned: records.length, sent, retried, failed, recovered: stale.count };
}

export function resetWechatReminderDeliveryRuntimeForTests(): void {
  clearAccessTokenCache();
}
