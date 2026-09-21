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
