<template>
  <view class="detail-page">
    <!-- Loading -->
    <view v-if="loading" class="loading-box">
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="!post" class="empty-box">
      <text class="empty-text">帖子不存在</text>
    </view>

    <view v-else class="detail-content">
      <!-- Post Card -->
      <view class="post-card">
        <!-- Author Row -->
        <view class="post-author-row">
          <view class="avatar avatar-fallback">
            <text class="avatar-text">{{ post.isAnonymous ? '匿' : ((post.author?.nickname || post.author?.username || '用')[0]) }}</text>
          </view>
          <view class="author-info">
            <text class="author-name">
              {{ post.isAnonymous ? '匿名用户' : (post.author?.nickname || post.author?.username || '用户') }}
            </text>
            <text class="post-date">{{ formatDate(post.createdAt) }}</text>
          </view>
        </view>

        <!-- Title -->
        <view class="post-title-row">
          <view v-if="post.isPinned" class="pin-tag">
            <text class="pin-tag-text">置顶</text>
          </view>
          <text class="post-title">{{ post.title }}</text>
        </view>

        <!-- Full Content -->
        <text class="post-body">{{ post.content }}</text>

        <!-- Category Tag -->
        <view v-if="post.categoryName || post.category" class="category-tag">
          <text class="category-tag-text">{{ getCategoryLabel(post.categoryName || post.category || '') }}</text>
        </view>

        <!-- Stats Row -->
        <view class="stats-row">
          <view class="stat-item" @tap="onToggleLike">
            <text class="stat-icon" :class="{ 'stat-icon--liked': post.isLiked }">♥</text>
            <text class="stat-num">{{ post.likeCount || 0 }}</text>
          </view>
          <view class="stat-item">
            <text class="stat-icon">💬</text>
            <text class="stat-num">{{ post.commentCount || 0 }}</text>
          </view>
          <view class="stat-item">
            <text class="stat-icon">👁</text>
            <text class="stat-num">{{ post.viewCount || 0 }}</text>
          </view>
        </view>

        <view v-if="canDeletePost" class="post-actions">
          <view class="post-action-btn" @tap="handleDeletePost">
            <text class="post-action-text">删除帖子</text>
          </view>
        </view>
      </view>

      <!-- Divider -->
      <view class="divider" />

      <!-- Comments Section -->
      <view class="comment-section">
        <text class="section-title">评论 ({{ comments.length }})</text>

        <!-- Comment Input -->
        <view class="comment-input-box">
          <view v-if="replyTarget" class="reply-target-bar">
            <text class="reply-target-text">正在回复：{{ replyTarget.authorName }}</text>
            <text class="reply-target-cancel" @tap="clearReplyTarget">取消</text>
          </view>
          <textarea
            v-model="commentText"
            class="comment-textarea"
            :placeholder="replyTarget ? `回复 ${replyTarget.authorName}...` : '写下你的评论...'"
            :auto-height="true"
            :maxlength="500"
          />
          <view class="comment-submit-btn" @tap="submitComment">
            <text class="comment-submit-text">发表评论</text>
          </view>
        </view>

        <!-- Comment List -->
        <view v-if="commentsLoading" class="loading-box">
          <text class="loading-text">加载评论中...</text>
        </view>

        <view v-else-if="comments.length === 0" class="empty-comments">
          <text class="empty-text">暂无评论，快来发表第一条评论吧</text>
        </view>

        <view v-else class="comment-list">
          <view v-for="comment in comments" :key="comment.id" class="comment-card">
            <view class="comment-header">
              <view class="comment-avatar comment-avatar-fallback">
                <text class="comment-avatar-text">{{ (comment.author?.nickname || comment.author?.username || '用')[0] }}</text>
              </view>
              <view class="comment-author-info">
                <text class="comment-author-name">
                  {{ comment.author?.nickname || comment.author?.username || '用户' }}
                </text>
                <text class="comment-date">{{ formatDate(comment.createdAt) }}</text>
              </view>
              <view v-if="canDeleteComment(comment.authorId)" class="comment-delete-btn" @tap="handleDeleteComment(comment.id)">
                <text class="comment-delete-text">删除</text>
              </view>
            </view>
            <text class="comment-content">{{ comment.content }}</text>
            <view class="comment-actions">
              <text class="comment-action-link" @tap="setReplyTarget(comment.id, comment.id, comment.author?.nickname || comment.author?.username || '用户')">回复</text>
            </view>
            <view v-if="comment.replies?.length" class="reply-list">
              <view v-for="reply in comment.replies" :key="reply.id" class="reply-card">
                <view class="reply-head">
                  <text class="reply-author">{{ reply.author?.nickname || reply.author?.username || '用户' }}</text>
                  <text class="reply-date">{{ formatDate(reply.createdAt) }}</text>
                </view>
                <text class="reply-content">{{ reply.content }}</text>
                <view class="reply-actions">
                  <text class="comment-action-link" @tap="setReplyTarget(comment.id, reply.id, reply.author?.nickname || reply.author?.username || '用户')">回复</text>
                  <text v-if="canDeleteComment(reply.authorId)" class="comment-delete-text" @tap="handleDeleteComment(reply.id)">删除</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- Comment Pagination -->
        <view v-if="commentPagination.totalPages > 1" class="pagination">
          <view
            class="page-btn"
            :class="{ 'page-btn--disabled': commentPagination.page <= 1 }"
            @tap="changeCommentPage(commentPagination.page - 1)"
          >
            <text class="page-btn-text">上一页</text>
          </view>
          <text class="page-info">{{ commentPagination.page }} / {{ commentPagination.totalPages }}</text>
          <view
            class="page-btn"
            :class="{ 'page-btn--disabled': commentPagination.page >= commentPagination.totalPages }"
            @tap="changeCommentPage(commentPagination.page + 1)"
          >
            <text class="page-btn-text">下一页</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { communityApi } from '@/api/community'
import type { CommunityPost, CommunityComment } from '@/api/community'
import dayjs from 'dayjs'

const categories = [
  { label: '孕期生活', value: 'pregnancy-life' },
  { label: '育儿交流', value: 'parenting' },
  { label: '营养健康', value: 'nutrition' },
  { label: '分娩经验', value: 'delivery' },
  { label: '宝宝成长', value: 'baby-growth' },
]

const postId = ref(0)
const loading = ref(false)
const post = ref<CommunityPost | null>(null)
const comments = ref<CommunityComment[]>([])
const commentsLoading = ref(false)
const commentText = ref('')
const commentPagination = reactive({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
const currentUserId = ref('')
const replyTarget = ref<{ parentId: number; replyToId: number; authorName: string } | null>(null)

const getCategoryLabel = (value: string) => {
  const cat = categories.find(c => c.value === value)
  return cat ? cat.label : value
}

const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
const canDeletePost = computed(() => !!post.value && post.value.authorId === currentUserId.value)

const fetchPost = async () => {
  loading.value = true
  try {
    const res = await communityApi.getPostById(postId.value) as any
    post.value = res
  } catch (_err) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const fetchComments = async () => {
  commentsLoading.value = true
  try {
    const res = await communityApi.getComments(postId.value, {
      page: commentPagination.page,
      pageSize: commentPagination.pageSize,
    }) as any
    comments.value = res.list || []
    if (res.pagination) {
      commentPagination.total = res.pagination.total
      commentPagination.totalPages = res.pagination.totalPages
    }
  } catch (_err) {
    console.error('加载评论失败')
  } finally {
    commentsLoading.value = false
  }
}

const changeCommentPage = (page: number) => {
  if (page < 1 || page > commentPagination.totalPages) return
  commentPagination.page = page
  fetchComments()
}

const onToggleLike = async () => {
  if (!post.value) return
  try {
    if (post.value.isLiked) {
      await communityApi.unlikePost(post.value.id)
      post.value.isLiked = false
      post.value.likeCount--
    } else {
      await communityApi.likePost(post.value.id)
      post.value.isLiked = true
      post.value.likeCount++
    }
  } catch (_err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

const canDeleteComment = (authorId: string) => {
  return authorId === currentUserId.value
}

const setReplyTarget = (parentId: number, replyToId: number, authorName: string) => {
  replyTarget.value = { parentId, replyToId, authorName }
}

const clearReplyTarget = () => {
  replyTarget.value = null
}

const handleDeletePost = () => {
  if (!post.value || !canDeletePost.value) return
  uni.showModal({
    title: '删除帖子',
    content: '删除后将无法恢复，确认继续吗？',
    success: async (res) => {
      if (!res.confirm || !post.value) return
      try {
        await communityApi.deletePost(post.value.id)
        uni.showToast({ title: '删除成功', icon: 'success' })
        setTimeout(() => {
          uni.navigateBack()
        }, 500)
      } catch (_err) {
        uni.showToast({ title: '删除失败', icon: 'none' })
      }
    },
  })
}

const handleDeleteComment = (id: number) => {
  uni.showModal({
    title: '删除评论',
    content: '确认删除这条评论吗？',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await communityApi.deleteComment(id)
        comments.value = comments.value.filter(item => item.id !== id)
        if (post.value && post.value.commentCount > 0) {
          post.value.commentCount -= 1
        }
        uni.showToast({ title: '删除成功', icon: 'success' })
      } catch (_err) {
        uni.showToast({ title: '删除失败', icon: 'none' })
      }
    },
  })
}

const submitComment = async () => {
  const token = uni.getStorageSync('token')
  if (!token) {
    uni.navigateTo({ url: '/pages/login/index' })
    return
  }
  if (!commentText.value.trim()) {
    uni.showToast({ title: '请输入评论内容', icon: 'none' })
    return
  }
  try {
    await communityApi.createComment(postId.value, {
      content: commentText.value.trim(),
      parentId: replyTarget.value ? replyTarget.value.parentId : undefined,
      replyToId: replyTarget.value ? replyTarget.value.replyToId : undefined,
    })
    commentText.value = ''
    clearReplyTarget()
    uni.showToast({ title: '评论成功', icon: 'success' })
    // Refresh comments
    commentPagination.page = 1
    fetchComments()
    // Update comment count
    if (post.value) {
      post.value.commentCount++
    }
  } catch (_err) {
    uni.showToast({ title: '评论失败', icon: 'none' })
  }
}

onLoad((options) => {
  const storedUser = uni.getStorageSync('user') as { id?: string } | undefined
  currentUserId.value = storedUser?.id ? String(storedUser.id) : ''
  if (options?.id) {
    postId.value = Number(options.id)
    fetchPost()
    fetchComments()
  }
})
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 40rpx;
}

.loading-box,
.empty-box {
  display: flex;
  justify-content: center;
  padding: 100rpx 0;
}

.loading-text,
.empty-text {
  font-size: 28rpx;
  color: #999999;
}

.detail-content {
  padding: 0;
}

.post-card {
  background-color: #ffffff;
  padding: 32rpx;
  margin-bottom: 0;
}

.post-author-row {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}

.avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  margin-right: 20rpx;
  background-color: #eeeeee;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(24, 144, 255, 0.15);
}

.avatar-text {
  font-size: 30rpx;
  font-weight: bold;
  color: #1890ff;
}

.author-info {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-size: 28rpx;
  color: #333333;
  font-weight: 500;
}

.post-date {
  font-size: 24rpx;
  color: #999999;
  margin-top: 4rpx;
}

.post-title-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 20rpx;
}

.pin-tag {
  background-color: #ff4d4f;
  border-radius: 6rpx;
  padding: 2rpx 10rpx;
  flex-shrink: 0;
}

.pin-tag-text {
  font-size: 20rpx;
  color: #ffffff;
}

.post-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333333;
}

.post-body {
  font-size: 28rpx;
  color: #444444;
  line-height: 1.8;
  margin-bottom: 24rpx;
}

.category-tag {
  display: inline-flex;
  background-color: #e6f7ff;
  border-radius: 6rpx;
  padding: 4rpx 14rpx;
  margin-bottom: 20rpx;
}

.category-tag-text {
  font-size: 22rpx;
  color: #1890ff;
}

.stats-row {
  display: flex;
  gap: 32rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}

.post-actions {
  margin-top: 24rpx;
  display: flex;
  justify-content: flex-end;
}

.post-action-btn {
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  background-color: rgba(255, 77, 79, 0.08);
}

.post-action-text {
  font-size: 24rpx;
  color: #d84b4b;
  font-weight: 600;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.stat-icon {
  font-size: 28rpx;
}

.stat-icon--liked {
  color: #ff4d4f;
}

.stat-num {
  font-size: 26rpx;
  color: #999999;
}

.divider {
  height: 16rpx;
  background-color: #f5f5f5;
}

.comment-section {
  background-color: #ffffff;
  padding: 32rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 24rpx;
}

.comment-input-box {
  margin-bottom: 32rpx;
}

.reply-target-bar {
  margin-bottom: 12rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.reply-target-text {
  font-size: 24rpx;
  color: #5f6d8b;
}

.reply-target-cancel {
  font-size: 24rpx;
  color: #d84b4b;
}

.comment-textarea {
  border: 1rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  width: 100%;
  min-height: 120rpx;
  box-sizing: border-box;
  margin-bottom: 16rpx;
}

.comment-submit-btn {
  background-color: #1890ff;
  border-radius: 12rpx;
  padding: 16rpx 0;
  text-align: center;
}

.comment-submit-text {
  color: #ffffff;
  font-size: 28rpx;
}

.empty-comments {
  display: flex;
  justify-content: center;
  padding: 60rpx 0;
}

.comment-list {
  display: flex;
  flex-direction: column;
}

.comment-card {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.comment-card:last-child {
  border-bottom: none;
}

.comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.comment-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  margin-right: 16rpx;
  background-color: #eeeeee;
}

.comment-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(24, 144, 255, 0.15);
}

.comment-avatar-text {
  font-size: 24rpx;
  font-weight: bold;
  color: #1890ff;
}

.comment-author-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.comment-delete-btn {
  padding: 8rpx 12rpx;
}

.comment-delete-text {
  font-size: 22rpx;
  color: #d84b4b;
}

.comment-author-name {
  font-size: 26rpx;
  color: #333333;
  font-weight: 500;
}

.comment-date {
  font-size: 22rpx;
  color: #999999;
  margin-top: 2rpx;
}

.comment-content {
  font-size: 28rpx;
  color: #444444;
  line-height: 1.6;
  padding-left: 72rpx;
}

.comment-actions {
  margin-top: 10rpx;
  padding-left: 72rpx;
}

.comment-action-link {
  font-size: 24rpx;
  color: #4c6fd1;
}

.reply-list {
  margin-top: 16rpx;
  margin-left: 72rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  background-color: #f7f9fc;
}

.reply-card + .reply-card {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #e9edf5;
}

.reply-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.reply-author {
  font-size: 24rpx;
  font-weight: 600;
  color: #3b455a;
}

.reply-date {
  font-size: 22rpx;
  color: #99a3b5;
}

.reply-content {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: #444444;
}

.reply-actions {
  margin-top: 10rpx;
  display: flex;
  gap: 24rpx;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24rpx 0;
  gap: 24rpx;
}

.page-btn {
  background-color: #f5f5f5;
  border: 1rpx solid #d9d9d9;
  border-radius: 8rpx;
  padding: 12rpx 28rpx;
}

.page-btn--disabled {
  opacity: 0.4;
}

.page-btn-text {
  font-size: 26rpx;
  color: #333333;
}

.page-info {
  font-size: 26rpx;
  color: #666666;
}
</style>
