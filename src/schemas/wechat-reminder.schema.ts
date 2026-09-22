import { z } from 'zod';

const clientReminderId = z.string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9:_-]+$/, '本机提醒 ID 格式不正确');

const isoDateTime = z.string().datetime({ offset: true });

export const createWechatReminderBody = z.object({
  clientReminderId,
  sourceKey: z.string().trim().max(200).regex(/^[A-Za-z0-9:_./-]*$/, '来源标识格式不正确').optional(),
  templateId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(100),
  eventAt: isoDateTime,
  scheduledAt: isoDateTime,
  leadMinutes: z.number().int().min(0).max(10080),
  subscriptionResult: z.enum(['accept', 'reject', 'ban', 'filter']),
});

export const wechatReminderClientIdParam = z.object({
  clientReminderId,
});

export type CreateWechatReminderInput = z.infer<typeof createWechatReminderBody>;
