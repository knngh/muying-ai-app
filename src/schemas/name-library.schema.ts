import { z } from 'zod';
import { NAME_LIBRARY } from '../data/name-library';
import { NAME_EVALUATION_PREFERENCES } from '../data/name-evaluation';

export const getNamesQuery = z.object({
  surname: z.string().trim().regex(/^[\p{Script=Han}]{0,4}$/u, '请填写 1–4 个汉字的姓氏，也可留空').optional(),
  gender: z.enum(['boy', 'girl', 'neutral', 'all']).default('all'),
  nameLength: z.coerce.number().int().min(1).max(2).default(2),
  avoid: z.string().trim().max(30).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type GetNamesQuery = z.infer<typeof getNamesQuery>;

const candidateIds = new Set(NAME_LIBRARY.map(item => item.id));

export const evaluateNamesBody = z.object({
  surname: z.string().trim().regex(/^[\p{Script=Han}]{0,4}$/u, '姓氏最多 4 个汉字'),
  candidateIds: z.array(z.string().max(80).refine(id => candidateIds.has(id), '候选名不在当前名字库中'))
    .min(1).max(5).refine(ids => new Set(ids).size === ids.length, '候选名不能重复'),
  preferences: z.array(z.enum(NAME_EVALUATION_PREFERENCES)).min(1).max(3)
    .refine(items => new Set(items).size === items.length, '风格不能重复'),
  consent: z.literal(true),
}).strict();
