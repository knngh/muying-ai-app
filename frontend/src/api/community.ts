import api from './index'

// ==================== 类型定义 ====================

export interface CommunityPost {
  id: number
  title: string
  content: string
  category?: string
  categoryId?: string
  categoryName?: string
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
  replyCount?: number
  replies?: CommunityComment[]
}

export interface CommunityReportPayload {
  targetType: 'post' | 'comment'
  targetId: number | string
  reason: 'spam' | 'abuse' | 'misinformation' | 'privacy' | 'illegal' | 'other'
  description?: string
}

export interface CommunityReportItem {
  id: string
  targetType: 'post' | 'comment'
  reason: string
  description?: string
  status: 'pending' | 'reviewed' | 'rejected'
  actionTaken: 'none' | 'hide_post' | 'delete_comment'
  decisionReason?: string
  handledByAI: boolean
  createdAt: string
  updatedAt: string
  handledAt?: string
  reporter?: {
    id: string
    username: string
    nickname?: string
  } | null
  post?: {
    id: string
    title: string
    content: string
    status: string
    deletedAt?: string | null
    author?: {
      id: string
      username: string
      nickname?: string
    } | null
  } | null
  comment?: {
    id: string
    content: string
    deletedAt?: string | null
    author?: {
      id: string
      username: string
      nickname?: string
    } | null
  } | null
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

interface PaginatedReports {
  list: CommunityReportItem[]
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
    categoryId?: string
    tags?: string[]
    isAnonymous?: boolean
  }) => api.post<CommunityPost>('/community/posts', {
    title: data.title,
    content: data.content,
    categoryId: data.categoryId ?? data.category,
    tags: data.tags,
    anonymous: data.isAnonymous,
  }),

  // 更新帖子
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
  createComment: (postId: number, data: { content: string; parentId?: number | string; replyToId?: number | string }) =>
    api.post<CommunityComment>(`/community/posts/${postId}/comments`, {
      content: data.content,
      parentId: data.parentId !== undefined ? String(data.parentId) : undefined,
      replyToId: data.replyToId !== undefined ? String(data.replyToId) : undefined,
    }),

  // 获取某条评论下的回复
  getReplies: (commentId: number, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedComments>(`/community/comments/${commentId}/replies`, { params }),

  // 删除评论
  deleteComment: (id: number) =>
    api.delete<{ deletedCount: number }>(`/community/comments/${id}`),

  // 举报帖子或评论
  createReport: (data: CommunityReportPayload) =>
    api.post<{
      id: string
      status: 'pending' | 'reviewed' | 'rejected'
      actionTaken: 'none' | 'hide_post' | 'delete_comment'
      decisionReason?: string
      handledByAI: boolean
      handledAt?: string
    }>('/community/reports', {
      targetType: data.targetType,
      targetId: String(data.targetId),
      reason: data.reason,
      description: data.description,
    }),

  getReports: (params?: {
    page?: number
    pageSize?: number
    status?: 'pending' | 'reviewed' | 'rejected'
    targetType?: 'post' | 'comment'
  }) => api.get<PaginatedReports>('/community/reports', { params }),

  handleReport: (id: string, data: {
    status: 'reviewed' | 'rejected'
    actionTaken?: 'none' | 'hide_post' | 'delete_comment'
    decisionReason?: string
  }) => api.patch<CommunityReportItem>(`/community/reports/${id}`, data),
}
