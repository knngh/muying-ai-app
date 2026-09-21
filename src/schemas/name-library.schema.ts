import { z } from 'zod';

export const getNamesQuery = z.object({
  surname: z.string().trim().regex(/^[\p{Script=Han}]{0,4}$/u, '请填写 1–4 个汉字的姓氏，也可留空').optional(),
  gender: z.enum(['boy', 'girl', 'neutral', 'all']).default('all'),
  nameLength: z.coerce.number().int().min(1).max(2).default(2),
  avoid: z.string().trim().max(30).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type GetNamesQuery = z.infer<typeof getNamesQuery>;
