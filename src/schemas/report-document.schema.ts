import { z } from 'zod';

const id = z.string().regex(/^[1-9]\d{0,18}$/, '记录标识无效')
  .refine(value => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n, '记录标识无效');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式无效')
  .refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, '日期不存在');

export const reportParams = z.object({ id });
export const reportFieldParams = reportParams.extend({ fieldId: id });
export const reportListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(20),
  beforeId: id.optional(),
});
export const reportDocumentBody = z.object({
  reportDate: date,
  name: z.string().trim().min(1, '请填写报告名称').max(100),
  note: z.string().trim().max(500).nullable().optional(),
  clientOperationId: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/, '操作标识无效'),
}).strict();

// Public input is always manual. OCR provenance and confidence belong to a future server-side pipeline.
export const reportFieldBody = z.object({
  pageNumber: z.literal(1).default(1),
  fieldKey: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(100),
  candidateValue: z.string().trim().min(1, '请填写原文').max(500),
}).strict();
export const confirmReportFieldBody = z.object({
  normalizedValue: z.string().trim().min(1, '请核对填写内容').max(500),
  version: z.number().int().positive(),
}).strict();
