import { z } from 'zod';

/** 通用分页参数（query string） */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** BigInt ID 参数 */
export const idParam = z.object({
  id: z.string().regex(/^\d+$/, 'ID 格式无效'),
});

/** slug 参数 */
export const slugParam = z.object({
  slug: z.string().min(1, 'slug 不能为空'),
});
