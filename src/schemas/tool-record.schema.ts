import { z } from 'zod';

const dateTime = z.string().trim().refine(value => !Number.isNaN(Date.parse(value)), '时间格式无效');
export const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式无效，请使用 YYYY-MM-DD')
  .refine(value => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, '日期格式无效');
const operationId = z.string().trim().min(8, '操作标识无效').max(100, '操作标识过长').optional();

export const toolRecordsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const expenseAnnualQuery = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
});

export const calendarSummaryQuery = z.object({
  from: dateOnly,
  to: dateOnly,
}).superRefine((value, ctx) => {
  const from = Date.parse(`${value.from}T00:00:00.000Z`)
  const to = Date.parse(`${value.to}T00:00:00.000Z`)
  if (to < from) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: '结束日期不能早于开始日期' })
  if (to - from > 31 * 86400000) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: '日期范围不能超过 32 天' })
});

export { toolAIReviewBody } from './tool-ai-review.schema';

export const contractionRecordBody = z.object({
  startedAt: dateTime,
  endedAt: dateTime,
  durationSeconds: z.coerce.number().int().min(0).max(86_400),
  intervalSeconds: z.coerce.number().int().min(0).max(86_400).nullable().optional(),
  clientOperationId: operationId,
}).superRefine((value, ctx) => {
  const elapsed = Math.round((Date.parse(value.endedAt) - Date.parse(value.startedAt)) / 1000)
  if (elapsed !== value.durationSeconds) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['durationSeconds'], message: '持续时间必须与起止时间一致' })
});

export const movementRecordBody = z.object({
  startedAt: dateTime,
  endedAt: dateTime,
  count: z.coerce.number().int().min(1).max(10_000),
  method: z.enum(['free', 'one_hour_morning', 'one_hour_midday', 'one_hour_evening']).default('free'),
  clientOperationId: operationId,
});

export const pregnancyWeightRecordBody = z.object({
  measuredAt: dateOnly,
  weightKg: z.coerce.number().finite().min(0.1).max(300),
  source: z.string().trim().min(1).max(30).default('manual'),
  clientOperationId: operationId,
});

export const diaryEntryBody = z.object({
  entryDate: dateOnly,
  mood: z.string().trim().max(20).nullable().optional(),
  content: z.string().trim().min(1, '日记内容不能为空').max(2000, '日记内容不能超过2000字'),
  clientOperationId: operationId,
});

export const expenseEntryBody = z.object({
  occurredAt: dateOnly,
  amountCents: z.coerce.number().int().min(1).max(100_000_000),
  direction: z.enum(['expense', 'refund', 'transfer']).default('expense'),
  category: z.string().trim().min(1).max(40),
  note: z.string().trim().max(200).nullable().optional(),
  clientOperationId: operationId,
});

export const careLogBody = z.object({
  kind: z.enum(['feeding', 'diaper', 'sleep']),
  recordedAt: dateTime,
  endedAt: dateTime.optional(),
  amountMl: z.coerce.number().int().min(0).max(20_000).nullable().optional(),
  side: z.string().trim().max(20).nullable().optional(),
  diaperType: z.string().trim().max(30).nullable().optional(),
  note: z.string().trim().max(200).nullable().optional(),
  clientOperationId: operationId,
});

export const babyMeasurementBody = z.object({
  measuredAt: dateOnly,
  metric: z.enum(['height', 'weight', 'head']),
  value: z.coerce.number().finite().min(0.1).max(300),
  unit: z.string().trim().min(1).max(10),
  method: z.string().trim().max(30).nullable().optional(),
  clientOperationId: operationId,
});

export const vaccinationRecordBody = z.object({
  vaccineName: z.string().trim().min(1).max(100),
  administeredAt: dateOnly,
  status: z.enum(['planned', 'scheduled', 'administered', 'unconfirmed']).default('planned'),
  doseNumber: z.coerce.number().int().min(1).max(20).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  clientOperationId: operationId,
});

export const foodTrialBody = z.object({
  foodName: z.string().trim().min(1).max(100),
  triedAt: dateOnly,
  observation: z.string().trim().max(500).nullable().optional(),
  responseStatus: z.enum(['unconfirmed', 'no-note', 'needs-review']).default('unconfirmed'),
  clientOperationId: operationId,
});

export const packingItemBody = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(30),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  isDone: z.boolean(),
  clientOperationId: operationId,
});
