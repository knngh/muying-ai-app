<template>
  <view class="home-page">
    <!-- 顶部欢迎区 -->
    <view class="welcome-header">
      <view class="greeting">
        <text class="title">你好，准妈妈 👋</text>
        <text class="subtitle">今天也是充满期待的一天，宝宝正在努力长大哦。</text>
      </view>
      <image class="header-decoration" src="/static/header-decoration.png" mode="aspectFit" />
    </view>

    <!-- 宝宝出生卡片入口 -->
    <view
      v-if="birthCardEntryMode !== 'hidden'"
      class="birth-card-entry"
      :class="{ 'birth-card-entry--prompt': birthCardEntryMode === 'prompt' }"
      @tap="goBirthCard"
    >
      <view class="birth-card-entry-info">
        <view class="birth-card-entry-headline">
          <text class="birth-card-entry-title">{{ birthCardEntryTitle }}</text>
          <text v-if="birthCardEntryBadge" class="birth-card-entry-badge">{{ birthCardEntryBadge }}</text>
        </view>
        <text class="birth-card-entry-subtitle">{{ birthCardEntrySubtitle }}</text>
      </view>
      <view class="birth-card-entry-btn">
        <text class="birth-card-entry-btn-text">{{ birthCardEntryActionText }} →</text>
      </view>
    </view>

    <!-- 核心功能卡片区 -->
    <view class="cards-container">
      
      <!-- 孕育日历卡片 (主打功能) -->
      <view
        class="feature-card calendar-card"
        hover-class="feature-card--hover"
        hover-start-time="20"
        hover-stay-time="80"
        @tap="navigateTo('/pages/calendar/index')"
      >
        <view class="card-bg-circle"></view>
        <view class="card-content">
          <view class="card-info">
            <text class="card-title">孕育时间轴</text>
            <text class="card-desc">每周一次的奇妙相遇\n见证宝宝的成长奇迹</text>
            <view class="card-btn">
              <text class="btn-text">立即查看</text>
              <text class="btn-icon">→</text>
            </view>
          </view>
          <view class="card-illustration">
            <!-- 用 Emoji 代替图片作为插图，保持轻量美观 -->
            <text class="emoji-large">📅</text>
            <view class="floating-emoji e1">✨</view>
            <view class="floating-emoji e2">👶</view>
          </view>
        </view>
      </view>

      <!-- AI 问答卡片 (即将上线) -->
      <view
        class="feature-card ai-card disabled"
        hover-class="feature-card--hover"
        hover-start-time="20"
        hover-stay-time="80"
        @tap="handleAITap"
      >
        <view class="card-bg-shape"></view>
        <view class="card-content">
          <view class="card-info">
            <view class="title-row">
              <text class="card-title">AI 答疑</text>
              <view class="badge-coming-soon">即将上线</view>
            </view>
            <text class="card-desc">基于顶级专家知识库\n随时解答您的孕产疑惑</text>
            <view class="card-btn disabled-btn">
              <text class="btn-text">敬请期待</text>
            </view>
          </view>
          <view class="card-illustration">
            <text class="emoji-large">🤖</text>
            <view class="floating-emoji e1" style="animation-delay: 1s;">💡</view>
            <view class="floating-emoji e2" style="animation-delay: 2s;">🏥</view>
          </view>
        </view>
      </view>

    </view>
    
    <!-- 底部激励标语 -->
    <view class="bottom-quote">
      <text class="quote-text">"每一个新生命的到来，都是宇宙中最温柔的奇迹。"</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import dayjs from 'dayjs'
import { getBirthCardEntryMode } from '@/utils'

const appStore = useAppStore()
const user = computed(() => appStore.user)
const birthCardEntryMode = computed(() => getBirthCardEntryMode(user.value, 'home'))

const formatBirthday = (date: string) => dayjs(date).format('YYYY年MM月DD日')

const birthCardEntryTitle = computed(() => {
  if (birthCardEntryMode.value === 'recorded' && user.value?.babyBirthday) {
    return `👶 宝宝已于 ${formatBirthday(user.value.babyBirthday)} 出生`
  }

  return '🍼 宝宝已经出生了吗？'
})

const birthCardEntrySubtitle = computed(() => (
  birthCardEntryMode.value === 'recorded'
    ? '回顾这段美好的孕育旅程'
    : '补充出生日期后，会自动生成一张专属出生卡片'
))

const birthCardEntryActionText = computed(() => (
  birthCardEntryMode.value === 'recorded' ? '查看' : '去填写'
))

const birthCardEntryBadge = computed(() => (
  birthCardEntryMode.value === 'prompt' ? '待补充' : ''
))

const goBirthCard = () => {
  uni.navigateTo({ url: '/pages/birth-card/index' })
}

// tabBar 页面路径集合，用于区分导航方式
const TAB_PAGES = new Set([
  '/pages/home/index',
  '/pages/chat/index',
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
  // 时间轴页面允许未登录访问（微信公众平台审核要求）
  const PUBLIC_PAGES = new Set(['/pages/calendar/index'])
  if (!PUBLIC_PAGES.has(url) && !checkLogin()) return
  if (TAB_PAGES.has(url)) {
    uni.switchTab({ url })
  } else {
    uni.navigateTo({ url })
  }
}

const handleAITap = () => {
  uni.switchTab({ url: '/pages/chat/index' })
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background-color: #f8fafe;
  padding: 0;
  display: flex;
  flex-direction: column;
}

/* 顶部欢迎区 */
.welcome-header {
  background: linear-gradient(135deg, #fff0f5 0%, #ffe5ec 100%);
  padding: 120rpx 40rpx 60rpx;
  border-bottom-left-radius: 60rpx;
  border-bottom-right-radius: 60rpx;
  position: relative;
  overflow: hidden;
  box-shadow: 0 10rpx 30rpx rgba(255, 182, 193, 0.15);
}

.greeting {
  position: relative;
  z-index: 2;
}

.title {
  font-size: 48rpx;
  font-weight: 800;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
}

.subtitle {
  font-size: 28rpx;
  color: #666;
  line-height: 1.5;
  display: block;
  max-width: 80%;
}

.header-decoration {
  position: absolute;
  right: -40rpx;
  bottom: -40rpx;
  width: 240rpx;
  height: 240rpx;
  opacity: 0.1;
  z-index: 1;
}

/* 出生卡片入口 */
.birth-card-entry {
  margin: 0 32rpx 8rpx;
  background: linear-gradient(135deg, #fff0f6 0%, #fff7e6 100%);
  border: 2rpx solid #ffadd2;
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.birth-card-entry--prompt {
  background: linear-gradient(135deg, #fff8e8 0%, #fff0f6 100%);
  border-color: #ffc069;
  box-shadow: 0 16rpx 28rpx rgba(255, 192, 105, 0.18);
}

.birth-card-entry-info {
  flex: 1;
}

.birth-card-entry-headline {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
  flex-wrap: wrap;
}

.birth-card-entry-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.birth-card-entry-badge {
  font-size: 20rpx;
  color: #ad6800;
  background: rgba(255, 214, 102, 0.32);
  border-radius: 999rpx;
  padding: 6rpx 16rpx;
  font-weight: 600;
}

.birth-card-entry-subtitle {
  display: block;
  font-size: 24rpx;
  color: #999;
}

.birth-card-entry-btn {
  background: linear-gradient(135deg, #ff85c0, #eb2f96);
  border-radius: 32rpx;
  padding: 12rpx 28rpx;
  flex-shrink: 0;
  margin-left: 16rpx;
}

.birth-card-entry-btn-text {
  font-size: 24rpx;
  color: #fff;
  font-weight: 600;
}

/* 卡片容器 */
.cards-container {
  padding: 60rpx 40rpx;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

/* 通用功能卡片样式 */
.feature-card {
  height: 320rpx;
  border-radius: 40rpx;
  position: relative;
  overflow: hidden;
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.feature-card--hover {
  transform: scale(0.97);
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.04);
}

.card-content {
  position: relative;
  z-index: 2;
  display: flex;
  height: 100%;
  padding: 40rpx;
  box-sizing: border-box;
}

.card-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.card-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 16rpx;
  letter-spacing: 2rpx;
}

.card-desc {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.6;
  margin-bottom: auto;
}

.card-btn {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.25);
  padding: 12rpx 30rpx;
  border-radius: 40rpx;
  width: fit-content;
  backdrop-filter: blur(4px);
}

.btn-text {
  font-size: 24rpx;
  color: #fff;
  font-weight: bold;
}

.btn-icon {
  color: #fff;
  margin-left: 10rpx;
  font-size: 24rpx;
}

/* 卡片插画与动效 */
.card-illustration {
  width: 180rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.emoji-large {
  font-size: 120rpx;
  filter: drop-shadow(0 10rpx 10rpx rgba(0,0,0,0.1));
  animation: float-main 4s infinite ease-in-out;
}

.floating-emoji {
  position: absolute;
  font-size: 40rpx;
  opacity: 0.8;
}

.e1 { top: 20rpx; right: 0; animation: float-sub 3s infinite ease-in-out; }
.e2 { bottom: 20rpx; left: -20rpx; animation: float-sub 3.5s infinite ease-in-out reverse; }

@keyframes float-main {
  0% { transform: translateY(0); }
  50% { transform: translateY(-12rpx) scale(1.05); }
  100% { transform: translateY(0); }
}

@keyframes float-sub {
  0% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
  50% { transform: translateY(-20rpx) rotate(10deg); opacity: 1; }
  100% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
}

/* 孕育日历卡片 特殊样式 */
.calendar-card {
  background: linear-gradient(135deg, #ff8da1 0%, #ff6b9d 100%);
}

.calendar-card .card-bg-circle {
  position: absolute;
  top: -60rpx;
  right: -60rpx;
  width: 300rpx;
  height: 300rpx;
  background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
  border-radius: 50%;
  z-index: 1;
}

/* AI 问答卡片 特殊样式 */
.ai-card {
  background: linear-gradient(135deg, #7b9cff 0%, #5a80ff 100%);
}

.ai-card .card-bg-shape {
  position: absolute;
  bottom: -40rpx;
  left: -40rpx;
  width: 250rpx;
  height: 250rpx;
  background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%);
  transform: rotate(45deg);
  border-radius: 40rpx;
  z-index: 1;
}

.title-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.ai-card .card-title {
  margin-bottom: 0;
  margin-right: 16rpx;
}

.badge-coming-soon {
  background: linear-gradient(90deg, #ffb347, #ff7b54);
  color: white;
  font-size: 20rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-weight: bold;
  box-shadow: 0 4rpx 10rpx rgba(255, 123, 84, 0.4);
  animation: pulse-badge 2s infinite;
}

@keyframes pulse-badge {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.disabled-btn {
  background: rgba(255, 255, 255, 0.15);
}

.disabled-btn .btn-text {
  color: rgba(255, 255, 255, 0.9);
}

/* 底部标语 */
.bottom-quote {
  text-align: center;
  padding: 40rpx;
  margin-top: auto;
}

.quote-text {
  font-size: 24rpx;
  color: #a0aabf;
  font-style: italic;
  letter-spacing: 1rpx;
}
</style>
