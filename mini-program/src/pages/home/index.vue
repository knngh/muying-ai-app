<template>
  <view class="home-page">
    <view class="welcome-header">
      <view class="greeting">
        <text class="title">你好，准妈妈</text>
        <text class="subtitle">本期先上线孕育时间轴、权威知识库和孕期档案，持续补充更适合审核上线的实用功能。</text>
      </view>
      <image class="header-decoration" src="/static/header-decoration.png" mode="aspectFit" />
    </view>

    <view class="cards-container">
      <view
        class="feature-card calendar-card"
        hover-class="feature-card--hover"
        hover-start-time="20"
        hover-stay-time="80"
        @tap="navigateTo('/pages/calendar/index')"
      >
        <view class="card-content">
          <view class="card-info">
            <text class="card-title">孕育时间轴</text>
            <text class="card-desc">查看不同阶段的护理提醒与关键节点。</text>
            <view class="card-btn">
              <text class="btn-text">去看看</text>
              <text class="btn-icon">→</text>
            </view>
          </view>
          <view class="card-illustration">
            <text class="emoji-large">📅</text>
          </view>
        </view>
      </view>

      <view
        class="feature-card knowledge-card"
        hover-class="feature-card--hover"
        hover-start-time="20"
        hover-stay-time="80"
        @tap="navigateTo('/pages/knowledge/index')"
      >
        <view class="card-content">
          <view class="card-info">
            <view class="title-row">
              <text class="card-title">权威知识库</text>
              <view class="badge-primary">推荐</view>
            </view>
            <text class="card-desc">优先查看中国政府网、WHO、CDC、AAP、ACOG、NHS 等权威资料。</text>
            <view class="card-btn">
              <text class="btn-text">立即进入</text>
              <text class="btn-icon">→</text>
            </view>
          </view>
          <view class="card-illustration">
            <text class="emoji-large">📚</text>
          </view>
        </view>
      </view>

      <view
        class="feature-card archive-card"
        hover-class="feature-card--hover"
        hover-start-time="20"
        hover-stay-time="80"
        @tap="navigateTo('/pages/pregnancy-profile/index')"
      >
        <view class="card-content">
          <view class="card-info">
            <view class="title-row">
              <text class="card-title">孕期档案</text>
              <view class="badge-primary">新模块</view>
            </view>
            <text class="card-desc">集中查看当前孕周、关键产检节点和本周记录，替代零散查找。</text>
            <view class="card-btn">
              <text class="btn-text">查看档案</text>
              <text class="btn-icon">→</text>
            </view>
          </view>
          <view class="card-illustration">
            <text class="emoji-large">🗂️</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'

const TAB_PAGES = new Set([
  '/pages/home/index',
  '/pages/knowledge/index',
  '/pages/profile/index',
])

const checkLogin = (): boolean => {
  const token = uni.getStorageSync('token')
  if (!token) {
    uni.showToast({ title: '请先登录或注册', icon: 'none' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' })
    }, 1000)
    return false
  }
  return true
}

const navigateTo = (url: string) => {
  const PUBLIC_PAGES = new Set(['/pages/home/index', '/pages/calendar/index', '/pages/knowledge/index'])
  if (!PUBLIC_PAGES.has(url) && !checkLogin()) return
  if (TAB_PAGES.has(url)) {
    uni.switchTab({ url })
  } else {
    uni.navigateTo({ url })
  }
}

function buildSharePayload() {
  return {
    title: '贝护妈妈：孕育时间轴、权威知识库和孕期档案',
    path: '/pages/home/index',
    query: '',
  }
}

onShareAppMessage(() => buildSharePayload())

onShareTimeline(() => ({
  title: '贝护妈妈：孕育时间轴、权威知识库和孕期档案',
  query: '',
}))
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #fffaf6 0%, #f7f9fc 100%);
}

.welcome-header {
  position: relative;
  overflow: hidden;
  padding: 120rpx 40rpx 56rpx;
  background: linear-gradient(135deg, #fff0f5 0%, #ffe6d9 100%);
  border-bottom-left-radius: 60rpx;
  border-bottom-right-radius: 60rpx;
}

.greeting {
  position: relative;
  z-index: 1;
}

.title {
  display: block;
  margin-bottom: 16rpx;
  font-size: 48rpx;
  font-weight: 800;
  color: #24303d;
}

.subtitle {
  display: block;
  max-width: 84%;
  font-size: 28rpx;
  line-height: 1.6;
  color: #5d6b7b;
}

.header-decoration {
  position: absolute;
  right: -40rpx;
  bottom: -40rpx;
  width: 240rpx;
  height: 240rpx;
  opacity: 0.12;
}

.cards-container {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
  padding: 40rpx 32rpx 48rpx;
}

.feature-card {
  overflow: hidden;
  border-radius: 36rpx;
  box-shadow: 0 16rpx 40rpx rgba(31, 42, 55, 0.08);
}

.feature-card--hover {
  transform: scale(0.98);
}

.knowledge-card {
  background: linear-gradient(135deg, #1f8f74 0%, #157a63 100%);
}

.archive-card {
  background: linear-gradient(135deg, #356c98 0%, #24557d 100%);
}

.calendar-card {
  background: linear-gradient(135deg, #f58b62 0%, #f36f45 100%);
}

.card-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 240rpx;
  padding: 36rpx;
}

.card-info {
  flex: 1;
  padding-right: 24rpx;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 14rpx;
}

.card-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #fff;
}

.card-desc {
  display: block;
  margin-bottom: 28rpx;
  font-size: 25rpx;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.88);
}

.badge-primary {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 700;
}

.badge-primary {
  background: rgba(255, 255, 255, 0.18);
  color: #fff7cf;
}

.card-btn {
  display: inline-flex;
  align-items: center;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.2);
}

.btn-text,
.btn-icon {
  font-size: 24rpx;
  color: #fff;
  font-weight: 600;
}

.btn-icon {
  margin-left: 10rpx;
}

.card-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 140rpx;
}

.emoji-large {
  font-size: 92rpx;
}
</style>
