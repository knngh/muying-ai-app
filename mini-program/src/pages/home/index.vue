<template>
  <view class="home-page">
    <!-- Hero Section -->
    <view class="hero-section">
      <view class="hero-content">
        <text class="hero-title">母婴AI助手</text>
        <text class="hero-subtitle">智能陪伴，科学育儿</text>
        <text class="hero-desc">为您提供专业的孕期指导和育儿建议</text>
        <view class="hero-btn" @tap="goToChat">
          <text class="hero-btn-text">开始咨询</text>
        </view>
      </view>
    </view>

    <!-- Feature Cards -->
    <view class="section">
      <view class="feature-cards">
        <view class="feature-card" @tap="goToChat">
          <view class="feature-icon feature-icon-ai">
            <text class="icon-text">AI</text>
          </view>
          <text class="feature-title">AI智能问答</text>
          <text class="feature-desc">随时随地获取专业解答</text>
        </view>
        <view class="feature-card" @tap="goToCalendar">
          <view class="feature-icon feature-icon-calendar">
            <text class="icon-text">📅</text>
          </view>
          <text class="feature-title">孕育日历</text>
          <text class="feature-desc">记录每一个重要时刻</text>
        </view>
        <view class="feature-card" @tap="goToKnowledge">
          <view class="feature-icon feature-icon-guide">
            <text class="icon-text">📖</text>
          </view>
          <text class="feature-title">科学指导</text>
          <text class="feature-desc">权威知识库随时查阅</text>
        </view>
      </view>
    </view>

    <!-- Quick Entries -->
    <view class="section">
      <text class="section-title">快速入口</text>
      <view class="quick-entries">
        <view class="quick-card" @tap="goToStage('first-trimester')">
          <view class="quick-icon quick-icon-1">
            <text class="quick-icon-text">1</text>
          </view>
          <text class="quick-label">孕早期</text>
          <text class="quick-weeks">1-12周</text>
        </view>
        <view class="quick-card" @tap="goToStage('second-trimester')">
          <view class="quick-icon quick-icon-2">
            <text class="quick-icon-text">2</text>
          </view>
          <text class="quick-label">孕中期</text>
          <text class="quick-weeks">13-27周</text>
        </view>
        <view class="quick-card" @tap="goToStage('third-trimester')">
          <view class="quick-icon quick-icon-3">
            <text class="quick-icon-text">3</text>
          </view>
          <text class="quick-label">孕晚期</text>
          <text class="quick-weeks">28-40周</text>
        </view>
        <view class="quick-card" @tap="goToCalendar">
          <view class="quick-icon quick-icon-4">
            <text class="quick-icon-text">+</text>
          </view>
          <text class="quick-label">产检日历</text>
          <text class="quick-weeks">全程记录</text>
        </view>
      </view>
    </view>

    <!-- Recommended Articles -->
    <view class="section">
      <text class="section-title">推荐阅读</text>
      <view class="article-list">
        <view
          v-for="article in articles"
          :key="article.id"
          class="article-item"
          @tap="goToArticle(article.slug)"
        >
          <view class="article-info">
            <text class="article-title">{{ article.title }}</text>
            <view class="article-meta">
              <text
                v-if="article.category"
                class="article-tag"
              >{{ article.category.name }}</text>
              <text class="article-views">{{ article.viewCount || 0 }} 阅读</text>
            </view>
          </view>
          <image
            v-if="article.coverImage"
            :src="article.coverImage"
            class="article-cover"
            mode="aspectFill"
          />
        </view>
      </view>
      <view v-if="loading" class="loading-text">
        <text>加载中...</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { articleApi } from '@/api/modules'
import type { Article } from '@/api/modules'
import { useKnowledgeStore } from '@/stores/knowledge'

const articles = ref<Article[]>([])
const loading = ref(false)

onMounted(async () => {
  await fetchArticles()
})

onShow(async () => {
  await fetchArticles()
})

async function fetchArticles() {
  loading.value = true
  try {
    const res = await articleApi.getList({ pageSize: 5 }) as { list: Article[] }
    articles.value = res.list || []
  } catch (_e) {
    console.error('获取推荐文章失败')
  } finally {
    loading.value = false
  }
}

function goToChat() {
  uni.switchTab({ url: '/pages/chat/index' })
}

function goToCalendar() {
  uni.switchTab({ url: '/pages/calendar/index' })
}

function goToKnowledge() {
  uni.switchTab({ url: '/pages/knowledge/index' })
}

function goToStage(stage: string) {
  const knowledgeStore = useKnowledgeStore()
  knowledgeStore.setStageAndNavigate(stage)
}

function goToArticle(slug: string) {
  uni.navigateTo({ url: `/pages/knowledge-detail/index?slug=${slug}` })
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

/* Hero Section */
.hero-section {
  background: linear-gradient(135deg, #ff6b9d 0%, #c44dff 100%);
  padding: 80rpx 40rpx 60rpx;
  border-radius: 0 0 40rpx 40rpx;
}

.hero-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-title {
  font-size: 48rpx;
  font-weight: bold;
  color: #ffffff;
  margin-bottom: 16rpx;
}

.hero-subtitle {
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 12rpx;
}

.hero-desc {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.75);
  margin-bottom: 40rpx;
}

.hero-btn {
  background-color: #ffffff;
  padding: 20rpx 64rpx;
  border-radius: 40rpx;
}

.hero-btn-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #ff6b9d;
}

/* Section */
.section {
  padding: 32rpx 24rpx;
}

.section-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 24rpx;
}

/* Feature Cards */
.feature-cards {
  display: flex;
  justify-content: space-between;
}

.feature-card {
  flex: 1;
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx 16rpx;
  margin: 0 8rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.feature-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}

.feature-icon-ai {
  background-color: rgba(255, 107, 157, 0.15);
}

.feature-icon-calendar {
  background-color: rgba(74, 144, 226, 0.15);
}

.feature-icon-guide {
  background-color: rgba(80, 200, 120, 0.15);
}

.icon-text {
  font-size: 32rpx;
}

.feature-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 8rpx;
}

.feature-desc {
  font-size: 22rpx;
  color: #999999;
  text-align: center;
}

/* Quick Entries */
.quick-entries {
  display: flex;
  justify-content: space-between;
}

.quick-card {
  flex: 1;
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx 12rpx;
  margin: 0 8rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.quick-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
}

.quick-icon-1 { background-color: #ffe0ec; }
.quick-icon-2 { background-color: #d4f0ff; }
.quick-icon-3 { background-color: #e0f7e0; }
.quick-icon-4 { background-color: #fff3d0; }

.quick-icon-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #666666;
}

.quick-label {
  font-size: 24rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 4rpx;
}

.quick-weeks {
  font-size: 20rpx;
  color: #999999;
}

/* Article List */
.article-list {
  background-color: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.article-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.article-item:last-child {
  border-bottom: none;
}

.article-info {
  flex: 1;
  margin-right: 20rpx;
}

.article-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333333;
  margin-bottom: 12rpx;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-meta {
  display: flex;
  align-items: center;
}

.article-tag {
  font-size: 22rpx;
  color: #ff6b9d;
  background-color: rgba(255, 107, 157, 0.1);
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  margin-right: 16rpx;
}

.article-views {
  font-size: 22rpx;
  color: #999999;
}

.article-cover {
  width: 160rpx;
  height: 120rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
}

.loading-text {
  text-align: center;
  padding: 24rpx;
  color: #999999;
  font-size: 26rpx;
}
</style>
