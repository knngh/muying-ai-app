import { z } from 'zod';

export const addFavoriteBody = z.object({
  articleId: z.coerce.number().int().positive('文章ID无效'),
});

export const recordReadHistoryBody = z.object({
  articleId: z.coerce.number().int().positive('文章ID无效'),
  readDuration: z.coerce.number().int().min(0).optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
});
