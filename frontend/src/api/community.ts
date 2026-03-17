import api from './index'

// ==================== 类型定义 ====================

export interface CommunityPost {
  id: number
  title: string
  content: string
  category?: string
  authorId: string
  author?: {
    id: string
    username: string
    nickname?: string
    avatar?: string
  }
  isAnonymous: boolean
  isPinned: boolean
  isFeatured: boolean
  viewCount: number
  likeCount: number
  commentCount: number
  status: string
  tags?: Array<{ id: number; name: string }>
  createdAt: string
  updatedAt: string
  isLiked?: boolean
}

export interface CommunityComment {
  id: number
  postId: number
  authorId: string
  author?: {
    id: string
    username: string
    nickname?: string
    avatar?: string
  }
  content: string
  parentId?: number
  replyToId?: number
  likeCount: number
  status: string
  createdAt: string
  replies?: CommunityComment[]
}

interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface PaginatedPosts {
  list: CommunityPost[]
  pagination: PaginationMeta
}

interface PaginatedComments {
  list: CommunityComment[]
  pagination: PaginationMeta
}

// ==================== 社区 API ====================

export const communityApi = {
  // 获取帖子列表
  getPosts: (params?: {
    page?: number
    pageSize?: number
    sort?: 'latest' | 'popular' | 'hot'
    category?: string
    tag?: string
    keyword?: string
  }) => api.get<PaginatedPosts>('/community/posts', { params }),

  // 获取帖子详情
  getPostById: (id: number) =>
    api.get<CommunityPost>(`/community/posts/${id}`),

  // 创建帖子
  createPost: (data: {
    title: string
    content: string
    category?: string
    tags?: string[]
    isAnonymous?: boolean
  }) => api.post<CommunityPost>('/community/posts', data),

  // 更新帖子
  updatePost: (id: number, data: { title?: string; content?: string; category?: string }) =>
    api.put<CommunityPost>(`/community/posts/${id}`, data),

  // 删除帖子
  deletePost: (id: number) =>
    api.delete(`/community/posts/${id}`),

  // 点赞帖子
  likePost: (id: number) =>
    api.post(`/community/posts/${id}/like`),

  // 取消点赞
  unlikePost: (id: number) =>
    api.delete(`/community/posts/${id}/like`),

  // 获取评论列表
  getComments: (postId: number, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedComments>(`/community/posts/${postId}/comments`, { params }),

  // 创建评论
  createComment: (postId: number, data: { content: string; parentId?: number; replyToId?: number }) =>
    api.post<CommunityComment>(`/community/posts/${postId}/comments`, data),

  // 删除评论
  deleteComment: (id: number) =>
    api.delete(`/community/comments/${id}`),
}
