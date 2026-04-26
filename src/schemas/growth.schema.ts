import { z } from 'zod';
import { paginationQuery } from './common.schema';

const optionalDateString = z.string()
  .trim()
  .refine(value => !Number.isNaN(Date.parse(value)), '日期格式无效');

const nullableDateString = z.union([
  optionalDateString,
  z.literal('').transform(() => null),
  z.null(),
]);

export const growthProfileBody = z.object({
  name: z.string().trim().min(1, '宝宝昵称不能为空').max(50, '宝宝昵称不能超过50字').optional(),
  birthday: nullableDateString.optional(),
  gender: z.coerce.number().int().min(0).max(2).optional(),
  stageHint: z.string().trim().max(20, '阶段提示不能超过20字').nullable().optional(),
});

export const growthRecordsQuery = paginationQuery.extend({
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  recordType: z.string().trim().min(1).max(30).optional(),
});

export const growthRecordBody = z.object({
  recordType: z.string().trim().min(1, '记录类型不能为空').max(30, '记录类型不能超过30字'),
  note: z.string().trim().max(300, '记录内容不能超过300字').optional(),
  recordedAt: optionalDateString.optional(),
});
