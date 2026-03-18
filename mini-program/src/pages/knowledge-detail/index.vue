<template>
  <view class="detail-page">
    <!-- Loading -->
    <view v-if="loading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>

    <!-- Error -->
    <view v-else-if="error" class="error-state">
      <text class="error-text">{{ error }}</text>
      <view class="retry-btn" @tap="retryLoad">
        <text class="retry-btn-text">重试</text>
      </view>
    </view>

    <!-- Article Content -->
    <view v-else-if="article" class="article-detail">
      <!-- Cover Image -->
      <image
        v-if="article.coverImage"
        :src="article.coverImage"
        class="cover-image"
        mode="aspectFill"
      />

      <!-- Title -->
      <view class="article-header">
        <text class="article-title">{{ article.title }}</text>

        <!-- Tags -->
        <view class="tags-row">
          <text v-if="article.category" class="tag tag-category">
            {{ article.category.name }}
          </text>
          <text v-if="article.stage" class="tag tag-stage">
            {{ stageLabel(article.stage) }}
          </text>
          <text
            v-for="tag in (article.tags || [])"
            :key="tag.id"
            class="tag tag-normal"
          >
            {{ tag.name }}
          </text>
        </view>

        <!-- Meta -->
        <view class="meta-row">
          <text v-if="article.author" class="meta-item">作者：{{ article.author }}</text>
          <text class="meta-item">{{ formatDate(article.publishedAt || article.createdAt) }}</text>
          <text class="meta-item">{{ article.viewCount || 0 }} 次阅读</text>
        </view>
      </view>

      <!-- Summary -->
      <view v-if="article.summary" class="summary-box">
        <text class="summary-label">摘要</text>
        <text class="summary-text">{{ article.summary }}</text>
      </view>

      <!-- Content -->
      <view class="article-content">
        <rich-text :nodes="article.content" class="content-text" />
      </view>

      <!-- Action Buttons -->
      <view class="action-bar">
        <view class="action-btn" @tap="handleLike">
          <text class="action-icon">👍</text>
          <text class="action-label">{{ article.likeCount || 0 }}</text>
        </view>
        <view class="action-btn" @tap="handleFavorite">
          <text class="action-icon">⭐</text>
          <text class="action-label">{{ article.collectCount || 0 }}</text>
        </view>
        <view class="action-btn" @tap="handleShare">
          <text class="action-icon">🔗</text>
          <text class="action-label">分享</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useKnowledgeStore } from '@/stores/knowledge'

const knowledgeStore = useKnowledgeStore()

let currentSlug = ''

const article = computed(() => knowledgeStore.currentArticle)
const loading = computed(() => knowledgeStore.loading)
const error = computed(() => knowledgeStore.error)

const stageMap: Record<string, string> = {
  'preparation': '备孕期',
  'first-trimester': '孕早期 (1-12周)',
  'second-trimester': '孕中期 (13-27周)',
  'third-trimester': '孕晚期 (28-40周)',
  '0-6-months': '0-6月',
  '6-12-months': '6-12月',
  '1-3-years': '1-3岁',
}

onLoad((options) => {
  if (options?.slug) {
    currentSlug = options.slug
    knowledgeStore.fetchArticleDetail(options.slug)
  }
})

function stageLabel(stage: string): string {
  return stageMap[stage] || stage
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function handleLike() {
  if (!article.value) return
  knowledgeStore.likeArticle(article.value.id)
  uni.showToast({ title: '已点赞', icon: 'success' })
}

function handleFavorite() {
  if (!article.value) return
  knowledgeStore.favoriteArticle(article.value.id)
  uni.showToast({ title: '已收藏', icon: 'success' })
}

function handleShare() {
  // #ifdef MP-WEIXIN
  uni.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline'],
  })
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '分享功能仅支持微信小程序', icon: 'none' })
  // #endif
}

function retryLoad() {
  if (currentSlug) {
    knowledgeStore.fetchArticleDetail(currentSlug)
  }
}
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background-color: #ffffff;
}

/* Loading & Error */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 40rpx;
}

.loading-text {
  font-size: 28rpx;
  color: #999999;
}

.error-text {
  font-size: 28rpx;
  color: #ff4444;
  margin-bottom: 32rpx;
}

.retry-btn {
  padding: 16rpx 48rpx;
  background-color: #ff6b9d;
  border-radius: 32rpx;
}

.retry-btn-text {
  font-size: 28rpx;
  color: #ffffff;
}

/* Cover Image */
.cover-image {
  width: 100%;
  height: 400rpx;
}

/* Header */
.article-header {
  padding: 32rpx 32rpx 0;
}

.article-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #222222;
  line-height: 1.4;
  margin-bottom: 20rpx;
}

/* Tags */
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.tag {
  font-size: 22rpx;
  padding: 6rpx 18rpx;
  border-radius: 16rpx;
}

.tag-category {
  background-color: rgba(255, 107, 157, 0.1);
  color: #ff6b9d;
}

.tag-stage {
  background-color: rgba(74, 144, 226, 0.1);
  color: #4a90e2;
}

.tag-normal {
  background-color: #f5f5f5;
  color: #666666;
}

/* Meta */
.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.meta-item {
  font-size: 24rpx;
  color: #999999;
}

/* Summary */
.summary-box {
  margin: 24rpx 32rpx;
  padding: 24rpx;
  background-color: #f9f9f9;
  border-radius: 16rpx;
  border-left: 6rpx solid #ff6b9d;
}

.summary-label {
  font-size: 24rpx;
  font-weight: 600;
  color: #ff6b9d;
  margin-bottom: 12rpx;
  display: block;
}

.summary-text {
  font-size: 26rpx;
  color: #666666;
  line-height: 1.7;
}

/* Content */
.article-content {
  padding: 24rpx 32rpx;
}

.content-text {
  font-size: 30rpx;
  color: #333333;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Action Bar */
.action-bar {
  display: flex;
  justify-content: space-around;
  padding: 32rpx 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #f0f0f0;
  background-color: #ffffff;
  position: sticky;
  bottom: 0;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 40rpx;
}

.action-icon {
  font-size: 40rpx;
  margin-bottom: 8rpx;
}

.action-label {
  font-size: 22rpx;
  color: #666666;
}
</style>
