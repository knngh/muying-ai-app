import prisma from '../config/database';
import { env } from '../config/env';
import { AppError, ErrorCodes } from '../middlewares/error.middleware';
import type { CreateWechatReminderInput } from '../schemas/wechat-reminder.schema';
import { Prisma } from '@prisma/client';

export type WechatReminderStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface WechatSubscribeConfig {
  enabled: boolean;
  configured: boolean;
  appId: string;
  appSecret: string;
  templateId: string;
  titleField: string;
  timeField: string;
  leadField: string;
  page: string;
}

export interface WechatReminderDeliveryView {
  id: string;
  clientReminderId: string;
  sourceKey: string | null;
  templateId: string;
  title: string;
  eventAt: string;
  scheduledAt: string;
  leadMinutes: number;
  status: WechatReminderStatus;
  attempts: number;
  sentAt: string | null;
}

export function getWechatSubscribeConfig(): WechatSubscribeConfig {
  const appId = env.WECHAT_APPID;
  const appSecret = env.WECHAT_APPSECRET;
  const templateId = env.WECHAT_SUBSCRIBE_TEMPLATE_ID;
  const titleField = env.WECHAT_SUBSCRIBE_TITLE_FIELD;
  const timeField = env.WECHAT_SUBSCRIBE_TIME_FIELD;
  const leadField = env.WECHAT_SUBSCRIBE_LEAD_FIELD;
  const fieldNamesValid = [titleField, timeField, leadField].every(value => /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(value));
  const fieldNamesUnique = new Set([titleField, timeField, leadField]).size === 3;

  return {
    enabled: env.WECHAT_SUBSCRIBE_ENABLED,
    configured: Boolean(appId && appSecret && templateId && fieldNamesValid && fieldNamesUnique),
    appId,
    appSecret,
    templateId,
    titleField,
    timeField,
    leadField,
    page: env.WECHAT_SUBSCRIBE_PAGE,
  };
}

function requireWechatSubscribeConfig(): WechatSubscribeConfig {
  const config = getWechatSubscribeConfig();
  if (!config.enabled || !config.configured) {
    throw new AppError('微信订阅提醒尚未配置', ErrorCodes.THIRD_PARTY_ERROR, 503);
  }
  return config;
}

function userIdBigInt(userId: string): bigint {
  try {
    return BigInt(userId);
  } catch {
    throw new AppError('用户身份无效', ErrorCodes.TOKEN_INVALID, 401);
  }
}

function parseDate(value: string, label: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new AppError(`${label}格式不正确`, ErrorCodes.PARAM_ERROR, 400);
  }
  return date;
}

function validateSchedule(input: CreateWechatReminderInput): { eventAt: Date; scheduledAt: Date } {
  const eventAt = parseDate(input.eventAt, '事项时间');
  const scheduledAt = parseDate(input.scheduledAt, '提醒时间');
  const now = Date.now();
  if (eventAt.getTime() <= now || scheduledAt.getTime() <= now) {
    throw new AppError('事项时间和提醒时间都必须在未来', ErrorCodes.PARAM_ERROR, 400);
  }
  if (scheduledAt.getTime() > eventAt.getTime()) {
    throw new AppError('提醒时间不能晚于事项时间', ErrorCodes.PARAM_ERROR, 400);
  }
  const expectedLeadMs = input.leadMinutes * 60 * 1000;
  if (Math.abs(eventAt.getTime() - scheduledAt.getTime() - expectedLeadMs) > 60 * 1000) {
    throw new AppError('提醒提前量与时间不匹配', ErrorCodes.PARAM_ERROR, 400);
  }
  return { eventAt, scheduledAt };
}

function sameSchedule(
  existing: { templateId: string; title: string; eventAt: Date; scheduledAt: Date; leadMinutes: number },
  input: { templateId: string; title: string; eventAt: Date; scheduledAt: Date; leadMinutes: number },
): boolean {
  return existing.templateId === input.templateId
    && existing.title === input.title
    && existing.eventAt.getTime() === input.eventAt.getTime()
    && existing.scheduledAt.getTime() === input.scheduledAt.getTime()
    && existing.leadMinutes === input.leadMinutes;
}

function toView(record: {
  id: bigint;
  clientReminderId: string;
  sourceKey: string | null;
  templateId: string;
  title: string;
  eventAt: Date;
  scheduledAt: Date;
  leadMinutes: number;
  status: string;
  attempts: number;
  sentAt: Date | null;
}): WechatReminderDeliveryView {
  return {
    id: record.id.toString(),
    clientReminderId: record.clientReminderId,
    sourceKey: record.sourceKey,
    templateId: record.templateId,
    title: record.title,
    eventAt: record.eventAt.toISOString(),
    scheduledAt: record.scheduledAt.toISOString(),
    leadMinutes: record.leadMinutes,
    status: record.status as WechatReminderStatus,
    attempts: record.attempts,
    sentAt: record.sentAt?.toISOString() || null,
  };
}

export async function enqueueWechatReminder(userId: string, input: CreateWechatReminderInput): Promise<WechatReminderDeliveryView> {
  const config = requireWechatSubscribeConfig();
  if (input.subscriptionResult !== 'accept') {
    throw new AppError('用户未同意微信订阅提醒', ErrorCodes.PARAM_ERROR, 400);
  }
  if (input.templateId !== config.templateId) {
    throw new AppError('订阅消息模板不匹配', ErrorCodes.PARAM_ERROR, 400);
  }
  const { eventAt, scheduledAt } = validateSchedule(input);
  const numericUserId = userIdBigInt(userId);
  const user = await prisma.user.findUnique({ where: { id: numericUserId }, select: { id: true, openid: true } });
  if (!user || !user.openid) {
    throw new AppError('当前账号暂不支持微信订阅提醒，请重新登录微信后再试', ErrorCodes.THIRD_PARTY_ERROR, 409);
  }

  const values = {
    userId: numericUserId,
    clientReminderId: input.clientReminderId,
    sourceKey: input.sourceKey || null,
    templateId: config.templateId,
    title: input.title.trim(),
    eventAt,
    scheduledAt,
    leadMinutes: input.leadMinutes,
  };
  const existing = await prisma.wechatReminderDelivery.findUnique({
    where: { userId_clientReminderId: { userId: numericUserId, clientReminderId: input.clientReminderId } },
  });

  if (existing && sameSchedule(existing, values) && (existing.status === 'sent' || existing.status === 'sending')) {
    return toView(existing);
  }

  try {
    const record = existing
      ? await prisma.wechatReminderDelivery.update({
        where: { id: existing.id },
        data: {
          sourceKey: values.sourceKey,
          templateId: values.templateId,
          title: values.title,
          eventAt: values.eventAt,
          scheduledAt: values.scheduledAt,
          leadMinutes: values.leadMinutes,
          status: 'pending',
          attempts: 0,
          lastError: null,
          sentAt: null,
        },
      })
      : await prisma.wechatReminderDelivery.create({ data: values });
    return toView(record);
  } catch (error) {
    // A concurrent first request may win the unique key. Return its row so the
    // client does not enqueue a second message or surface a spurious failure.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    const raced = await prisma.wechatReminderDelivery.findUnique({
      where: { userId_clientReminderId: { userId: numericUserId, clientReminderId: input.clientReminderId } },
    });
    if (raced) return toView(raced);
    throw error;
  }
}

export async function cancelWechatReminder(userId: string, clientReminderId: string): Promise<{ clientReminderId: string; status: WechatReminderStatus | 'missing' }> {
  const numericUserId = userIdBigInt(userId);
  const existing = await prisma.wechatReminderDelivery.findUnique({
    where: { userId_clientReminderId: { userId: numericUserId, clientReminderId } },
    select: { status: true },
  });
  if (!existing) return { clientReminderId, status: 'missing' };
  if (existing.status === 'pending' || existing.status === 'sending' || existing.status === 'failed') {
    await prisma.wechatReminderDelivery.update({
      where: { userId_clientReminderId: { userId: numericUserId, clientReminderId } },
      data: { status: 'cancelled', lastError: null },
    });
    return { clientReminderId, status: 'cancelled' };
  }
  return { clientReminderId, status: existing.status as WechatReminderStatus };
}
