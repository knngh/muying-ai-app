import api from './index'
import type { CommunityPost, CommunityComment, PaginatedResponse } from '../../../shared/types'

export type { CommunityPost, CommunityComment }

export const communityApi = {
  getPosts: (params?: {
    page?: number; pageSize?: number;
    sort?: 'latest' | 'hot' | 'popular';
    category?: string; tag?: string; keyword?: string
  }) => api.get<PaginatedResponse<CommunityPost>>('/community/posts', { params }),

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

  updatePost: (id: number, data: { title?: string; content?: string; category?: string; categoryId?: string }) =>
    api.put<CommunityPost>(`/community/posts/${id}`, {
      title: data.title,
      content: data.content,
      categoryId: data.categoryId ?? data.category,
    }),

  deletePost: (id: number) => api.delete(`/community/posts/${id}`),
  likePost: (id: number) => api.post(`/community/posts/${id}/like`),
  unlikePost: (id: number) => api.delete(`/community/posts/${id}/like`),

  getComments: (postId: number, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<CommunityComment>>(`/community/posts/${postId}/comments`, { params }),

  createComment: (postId: number, data: { content: string; parentId?: number; replyToId?: number }) =>
    api.post<CommunityComment>(`/community/posts/${postId}/comments`, data),

  deleteComment: (id: number) => api.delete(`/community/comments/${id}`),
}
