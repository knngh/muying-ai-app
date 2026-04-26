<template>
  <view class="detail-page">
    <SkeletonCard v-if="loadingPost" :rows="5" />

    <view v-else-if="post" class="post-detail">
      <!-- 作者信息 -->
      <view class="post-header">
        <view class="post-avatar">
          <text>{{ post.author?.nickname?.[0] || '匿' }}</text>
        </view>
        <view class="post-author-info">
          <text class="post-author-name">{{ post.isAnonymous ? '匿名用户' : (post.author?.nickname || post.author?.username || '用户') }}</text>
          <text class="post-time">{{ formatFullTime(post.createdAt) }}</text>
        </view>
      </view>

      <!-- 帖子内容 -->
      <text class="post-title">{{ post.title }}</text>
      <text class="post-content">{{ post.content }}</text>

      <view v-if="post.tags?.length" class="post-tags">
        <text v-for="tag in post.tags" :key="tag.id" class="post-tag">{{ tag.name }}</text>
      </view>

      <!-- 操作栏 -->
      <view class="post-actions">
        <view class="action-item" :class="{ liked: post.isLiked }" @tap="toggleLike">
          <text>{{ post.isLiked ? '已赞' : '赞' }} {{ post.likeCount }}</text>
        </view>
        <view class="action-item">
          <text>{{ post.commentCount }} 评论</text>
        </view>
        <view class="action-item">
          <text>{{ post.viewCount }} 浏览</text>
        </view>
      </view>

      <!-- 评论区 -->
      <view class="comments-section">
        <text class="comments-title">评论</text>

        <view v-if="!comments.length && !loadingComments" class="comments-empty">
          <text>还没有评论</text>
        </view>

        <view v-for="comment in comments" :key="comment.id" class="comment-item">
          <view class="comment-header">
            <view class="comment-avatar">
              <text>{{ comment.author?.nickname?.[0] || '用' }}</text>
            </view>
            <view class="comment-info">
              <text class="comment-author">{{ comment.author?.nickname || comment.author?.username || '用户' }}</text>
              <text class="comment-time">{{ formatFullTime(comment.createdAt) }}</text>
            </view>
          </view>
          <text class="comment-content">{{ comment.content }}</text>

          <!-- 回复 -->
          <view v-for="reply in comment.replies" :key="reply.id" class="reply-item">
            <text class="reply-author">{{ reply.author?.nickname || '用户' }}</text>
            <text class="reply-content">{{ reply.content }}</text>
          </view>

          <text class="comment-reply-btn" @tap="replyTo = comment.id">回复</text>
        </view>
      </view>
    </view>

    <!-- 评论输入 -->
    <view class="comment-bar">
      <input
        v-model="commentText"
        class="comment-input"
        :placeholder="replyTo ? '回复评论...' : '写评论...'"
        confirm-type="send"
        @confirm="submitComment"
      />
      <view class="comment-send" :class="{ active: commentText.trim() }" @tap="submitComment">
        <text>发送</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { communityApi, type CommunityPost, type CommunityComment } from '@/api/community'
import SkeletonCard from '@/components/SkeletonCard.vue'
import dayjs from 'dayjs'

const postId = ref('')
const post = ref<CommunityPost | null>(null)
const comments = ref<CommunityComment[]>([])
const loadingPost = ref(true)
const loadingComments = ref(false)
const commentText = ref('')
const replyTo = ref<string | null>(null)

function formatFullTime(dateStr: string) {
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

async function loadPost() {
  loadingPost.value = true
  try {
    post.value = await communityApi.getPostById(postId.value)
  } catch (e) {
    uni.showToast({ title: '帖子不存在', icon: 'none' })
  } finally {
    loadingPost.value = false
  }
}

async function loadComments() {
  loadingComments.value = true
  try {
    const res = await communityApi.getComments(postId.value)
    comments.value = res.list || []
  } catch (e) {
    console.error('[Community] 加载评论失败:', e)
  } finally {
    loadingComments.value = false
  }
}

async function toggleLike() {
  if (!post.value) return
  if (!uni.getStorageSync('token')) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    return
  }
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
  } catch (e: any) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' })
  }
}

async function submitComment() {
  const text = commentText.value.trim()
  if (!text) return
  if (!uni.getStorageSync('token')) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    return
  }
  try {
    await communityApi.createComment(postId.value, {
      content: text,
      parentId: replyTo.value || undefined,
    })
    commentText.value = ''
    replyTo.value = null
    uni.showToast({ title: '评论成功', icon: 'success' })
    loadComments()
  } catch (e: any) {
    uni.showToast({ title: e.message || '评论失败', icon: 'none' })
  }
}

onLoad((query) => {
  postId.value = query?.id || ''
  if (postId.value) {
    loadPost()
    loadComments()
  }
})
</script>

<style scoped>
.detail-page { min-height: 100vh; background: #fff; padding-bottom: 120rpx; }
.post-detail { padding: 24rpx; }
.post-header { display: flex; align-items: center; gap: 16rpx; margin-bottom: 24rpx; }
.post-avatar { width: 72rpx; height: 72rpx; border-radius: 50%; background: #ff6b9d; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 28rpx; font-weight: 600; }
.post-author-info { flex: 1; }
.post-author-name { display: block; font-size: 28rpx; font-weight: 600; color: #333; }
.post-time { display: block; font-size: 22rpx; color: #bbb; margin-top: 4rpx; }
.post-title { display: block; font-size: 34rpx; font-weight: 700; color: #333; margin-bottom: 20rpx; line-height: 1.4; }
.post-content { display: block; font-size: 28rpx; color: #555; line-height: 1.8; white-space: pre-wrap; }
.post-tags { display: flex; gap: 8rpx; margin-top: 20rpx; flex-wrap: wrap; }
.post-tag { font-size: 22rpx; color: #1890ff; background: #e6f7ff; padding: 4rpx 12rpx; border-radius: 8rpx; }
.post-actions { display: flex; gap: 32rpx; padding: 24rpx 0; border-top: 1rpx solid #f0f0f0; border-bottom: 1rpx solid #f0f0f0; margin-top: 24rpx; }
.action-item { font-size: 26rpx; color: #666; }
.action-item.liked { color: #ff6b9d; }
.comments-section { margin-top: 24rpx; }
.comments-title { display: block; font-size: 30rpx; font-weight: 700; color: #333; margin-bottom: 20rpx; }
.comments-empty { text-align: center; padding: 40rpx; color: #bbb; font-size: 26rpx; }
.comment-item { padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.comment-header { display: flex; align-items: center; gap: 12rpx; margin-bottom: 12rpx; }
.comment-avatar { width: 48rpx; height: 48rpx; border-radius: 50%; background: #e8f4fd; display: flex; align-items: center; justify-content: center; color: #1890ff; font-size: 20rpx; }
.comment-info { flex: 1; }
.comment-author { font-size: 24rpx; font-weight: 600; color: #333; }
.comment-time { font-size: 20rpx; color: #bbb; margin-left: 12rpx; }
.comment-content { display: block; font-size: 26rpx; color: #555; line-height: 1.6; }
.reply-item { margin-top: 12rpx; padding: 12rpx 16rpx; background: #f5f7fa; border-radius: 12rpx; }
.reply-author { font-size: 22rpx; color: #1890ff; font-weight: 600; }
.reply-content { font-size: 24rpx; color: #666; margin-top: 4rpx; }
.comment-reply-btn { display: inline-block; margin-top: 8rpx; font-size: 22rpx; color: #1890ff; }
.comment-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 12rpx; padding: 16rpx 24rpx; background: #fff; border-top: 1rpx solid #f0f0f0; align-items: center; }
.comment-input { flex: 1; background: #f5f7fa; border-radius: 32rpx; padding: 16rpx 24rpx; font-size: 28rpx; }
.comment-send { padding: 12rpx 28rpx; border-radius: 24rpx; background: #e8e8e8; color: #999; font-size: 28rpx; }
.comment-send.active { background: #ff6b9d; color: #fff; }
</style>
