import api from './request'
import type { CommunityPost, CommunityComment, CommunityReportPayload, PaginatedResponse } from '../../../shared/types'

export type { CommunityPost, CommunityComment, CommunityReportPayload }

export const communityApi = {
  getPosts: (params?: {
    page?: number; pageSize?: number;
    sort?: 'latest' | 'hot' | 'popular';
    category?: string; tag?: string; keyword?: string
  }) => api.get<PaginatedResponse<CommunityPost>>('/community/posts', params as Record<string, unknown>),

  getPostById: (id: number) => api.get<CommunityPost>(`/community/posts/${id}`),

  createPost: (data: {
    title: string; content: string; category?: string;
    categoryId?: string; tags?: string[]; isAnonymous?: boolean
  }) => api.post<CommunityPost>('/community/posts', {
    title: data.title,
    content: data.content,
    categoryId: data.categoryId ?? data.category,
    tags: data.tags,
    anonymous: data.isAnonymous,
  }),

  updatePost: (id: number, data: {
    title?: string
    content?: string
    category?: string
    categoryId?: string
    isAnonymous?: boolean
  }) =>
    api.put<CommunityPost>(`/community/posts/${id}`, {
      title: data.title,
      content: data.content,
      categoryId: data.categoryId ?? data.category,
      anonymous: data.isAnonymous,
    }),

  deletePost: (id: number) => api.delete(`/community/posts/${id}`),

  likePost: (id: number) => api.post(`/community/posts/${id}/like`),
  unlikePost: (id: number) => api.delete(`/community/posts/${id}/like`),

  getComments: (postId: number, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<CommunityComment>>(`/community/posts/${postId}/comments`, params as Record<string, unknown>),

  createComment: (postId: number, data: { content: string; parentId?: number | string; replyToId?: number | string }) =>
    api.post<CommunityComment>(`/community/posts/${postId}/comments`, {
      content: data.content,
      parentId: data.parentId !== undefined ? String(data.parentId) : undefined,
      replyToId: data.replyToId !== undefined ? String(data.replyToId) : undefined,
    }),

  getReplies: (commentId: number, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<CommunityComment>>(`/community/comments/${commentId}/replies`, params as Record<string, unknown>),

  deleteComment: (id: number) => api.delete<{ deletedCount: number }>(`/community/comments/${id}`),

  createReport: (data: CommunityReportPayload) =>
    api.post<{
      id: string
      status: 'pending' | 'reviewed' | 'rejected'
      actionTaken: 'none' | 'hide_post' | 'delete_comment'
      decisionReason?: string | null
      handledByAI: boolean
      handledAt?: string | null
      createdAt: string
    }>('/community/reports', {
      targetType: data.targetType,
      targetId: String(data.targetId),
      reason: data.reason,
      description: data.description,
    }),
}
