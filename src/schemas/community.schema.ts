import { z } from 'zod';
import { paginationQuery, idParam } from './common.schema';

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

export const updatePostBody = createPostBody.partial().refine(
  (value) => value.title !== undefined || value.content !== undefined || value.categoryId !== undefined || value.tags !== undefined || value.anonymous !== undefined,
  { message: '至少提供一个更新字段' }
);

export const createCommentBody = z.object({
  content: z.string().min(1, '评论内容不能为空').max(1000, '评论过长'),
  parentId: z.string().regex(/^\d+$/).optional(),
  replyToId: z.string().regex(/^\d+$/).optional(),
});

export const createReportBody = z.object({
  targetType: z.enum(['post', 'comment']),
  targetId: z.string().regex(/^\d+$/, '目标 ID 格式无效'),
  reason: z.enum(['spam', 'abuse', 'misinformation', 'privacy', 'illegal', 'other']),
  description: z.string().max(500, '补充说明最多 500 字').optional(),
});

export const postIdParam = idParam;
export const commentIdParam = idParam;
export const postCommentsParam = z.object({
  postId: z.string().regex(/^\d+$/, '帖子 ID 格式无效'),
});
