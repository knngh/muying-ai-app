import { z } from 'zod';

const dateTime = z.string().trim().refine(value => !Number.isNaN(Date.parse(value)), '时间格式无效');
const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式无效，请使用 YYYY-MM-DD')
  .refine(value => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), '日期格式无效');
const operationId = z.string().trim().min(8, '操作标识无效').max(100, '操作标识过长').optional();

export const toolRecordsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const contractionRecordBody = z.object({
  startedAt: dateTime,
  endedAt: dateTime,
  durationSeconds: z.coerce.number().int().min(0).max(86_400),
  intervalSeconds: z.coerce.number().int().min(0).max(86_400).nullable().optional(),
  clientOperationId: operationId,
});

export const movementRecordBody = z.object({
  startedAt: dateTime,
  endedAt: dateTime,
  count: z.coerce.number().int().min(1).max(10_000),
  method: z.string().trim().min(1).max(30).default('free'),
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
