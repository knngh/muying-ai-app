import { z } from 'zod';

export const getCategoriesQuery = z.object({
  level: z.coerce.number().int().min(1).max(5).optional(),
  parentId: z.union([
    z.literal('null'),
    z.string().regex(/^\d+$/, '父分类 ID 格式无效'),
  ]).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});
