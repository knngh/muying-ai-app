import { z } from 'zod';
import { paginationQuery } from './common.schema';

export const getArticlesQuery = paginationQuery.extend({
  category: z.string().max(80).optional(),
  tag: z.string().max(80).optional(),
  stage: z.string().max(80).optional(),
  source: z.string().max(120).optional(),
  difficulty: z.string().max(40).optional(),
  contentType: z.string().max(40).optional(),
  sort: z.enum(['latest', 'popular', 'recommended']).default('latest'),
  keyword: z.string().max(100, '关键词过长').optional(),
});

export const searchArticlesQuery = paginationQuery.extend({
  q: z.string().min(1, '请输入搜索关键词').max(100, '搜索关键词过长'),
  contentType: z.string().optional(),
});

export const relatedArticlesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});
