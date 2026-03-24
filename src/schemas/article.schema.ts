import { z } from 'zod';
import { paginationQuery } from './common.schema';

export const getArticlesQuery = paginationQuery.extend({
  category: z.string().optional(),
  tag: z.string().optional(),
  stage: z.string().optional(),
  difficulty: z.string().optional(),
  contentType: z.string().optional(),
  sort: z.enum(['latest', 'popular', 'recommended']).default('latest'),
});

export const searchArticlesQuery = paginationQuery.extend({
  q: z.string().min(1, '请输入搜索关键词').max(100, '搜索关键词过长'),
});
