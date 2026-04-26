import api from './request'

export interface CommunityPost {
  id: string
  authorId: string
  title: string
  content: string
  categoryId?: string
  categoryName?: string
  isAnonymous: boolean
  isPinned: boolean
  isFeatured: boolean
  commentCount: number
  likeCount: number
  viewCount: number
  isLiked: boolean
  tags: Array<{ id: string; name: string; slug: string }>
  author: { id: string; username: string; nickname: string | null; isVerifiedMember: boolean } | null
  createdAt: string
  updatedAt: string
}

export interface CommunityComment {
  id: string
  postId: string
  authorId: string
  content: string
  parentId: string | null
  replyToId: string | null
  author: { id: string; username: string; nickname: string | null; isVerifiedMember: boolean } | null
  replies: CommunityComment[]
  createdAt: string
}

interface PaginatedList<T> {
  list: T[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export const communityApi = {
  getPosts: (params?: { category?: string; sort?: string; tag?: string; keyword?: string; page?: number; pageSize?: number }) =>
    api.get<PaginatedList<CommunityPost>>('/community/posts', params),

  getPostById: (id: string) =>
    api.get<CommunityPost>(`/community/posts/${id}`),

  createPost: (data: { title: string; content: string; categoryId?: string; isAnonymous?: boolean; tagIds?: string[] }) =>
    api.post<CommunityPost>('/community/posts', data),

  likePost: (postId: string) =>
    api.post(`/community/posts/${postId}/like`),

  unlikePost: (postId: string) =>
    api.delete(`/community/posts/${postId}/like`),

  getComments: (postId: string, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedList<CommunityComment>>(`/community/posts/${postId}/comments`, params),

  createComment: (postId: string, data: { content: string; parentId?: string; replyToId?: string }) =>
    api.post<CommunityComment>(`/community/posts/${postId}/comments`, data),
}
