import { z } from 'zod';
import { paginationQuery } from './common.schema';

export const getPostsQuery = paginationQuery.extend({
  category: z.string().regex(/^\d+$/).optional(),
  tag: z.string().regex(/^\d+$/).optional(),
  keyword: z.string().max(100).optional(),
  sort: z.enum(['latest', 'popular', 'hot']).default('latest'),
});

export const createPostBody = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: z.string().min(1, '内容不能为空').max(10000, '内容过长'),
  categoryId: z.string().regex(/^\d+$/).optional(),
  tags: z.array(z.string().regex(/^\d+$/)).max(5).optional(),
  anonymous: z.boolean().optional(),
});

export const createCommentBody = z.object({
  content: z.string().min(1, '评论内容不能为空').max(1000, '评论过长'),
  parentId: z.string().regex(/^\d+$/).optional(),
  replyToId: z.string().regex(/^\d+$/).optional(),
});
