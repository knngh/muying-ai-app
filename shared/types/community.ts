// 共享社区相关类型

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
