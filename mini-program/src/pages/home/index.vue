<template>
  <view class="home-page">
    <view class="home-header">
      <view class="hero-topline">
        <text class="hero-eyebrow">{{ heroEyebrow }}</text>
        <text class="hero-state">{{ loginStateLabel }}</text>
      </view>
      <text class="hero-title">{{ heroTitle }}</text>
      <text class="hero-subtitle">{{ heroSubtitle }}</text>
    </view>

    <view class="home-card-list">
      <view
        v-for="item in primaryEntries"
        :key="item.url"
        class="home-card"
        :class="[`home-card--${item.tone}`, { 'home-card--primary': item.primary }]"
        @tap="navigateTo(item.url)"
      >
        <view class="home-card-head">
          <view class="home-card-icon">
            <text class="home-card-icon-text">{{ item.icon }}</text>
          </view>
          <view class="home-card-meta">
            <text class="home-card-kicker">{{ item.kicker }}</text>
            <text class="home-card-title">{{ item.title }}</text>
          </view>
          <text class="home-card-action">{{ item.action }}</text>
        </view>

        <text class="home-card-desc">{{ item.desc }}</text>

        <view v-if="item.tone === 'knowledge' && recentKnowledge.length" class="home-card-foot">
          <view class="recent-inline">
            <text class="recent-inline-label">最近阅读</text>
            <text class="recent-inline-title">{{ recentKnowledge[0].title }}</text>
          </view>
          <text class="recent-inline-action" @tap.stop="openRecentKnowledge(recentKnowledge[0].slug)">继续看</text>
        </view>

        <view v-if="item.tone !== 'knowledge'" class="home-card-foot">
          <text class="home-card-foot-label">{{ item.footLabel }}</text>
          <text class="home-card-foot-value">{{ item.footValue }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { calculatePregnancyWeekFromDueDate } from '@/utils'
import { getKnowledgeDisplayTitle } from '@/utils/knowledge-format'
import { type RecentKnowledgeItem } from '@/utils/home-helpers'

const appStore = useAppStore()
const RECENT_KNOWLEDGE_STORAGE_KEY = 'recentKnowledgeArticles'

const TAB_PAGES = new Set([
  '/pages/home/index',
  '/pages/calendar/index',
  '/pages/knowledge/index',
  '/pages/profile/index',
])

const PUBLIC_PAGES = new Set([
  '/pages/home/index',
  '/pages/calendar/index',
  '/pages/knowledge/index',
])

const sessionLoggedIn = ref(Boolean(uni.getStorageSync('token')))
const storedWeek = ref<number | null>(null)
const recentKnowledge = ref<RecentKnowledgeItem[]>([])

const syncHomeState = () => {
  uni.removeStorageSync('pendingChatDraft')
  uni.removeStorageSync('recentChatQuestions')
  sessionLoggedIn.value = Boolean(uni.getStorageSync('token'))
  const rawWeek = Number.parseInt(String(uni.getStorageSync('userPregnancyWeek') || ''), 10)
  storedWeek.value = !Number.isNaN(rawWeek) && rawWeek >= 1 && rawWeek <= 40 ? rawWeek : null

  const storedRecent = uni.getStorageSync(RECENT_KNOWLEDGE_STORAGE_KEY) as RecentKnowledgeItem[] | null
  recentKnowledge.value = Array.isArray(storedRecent)
    ? storedRecent.slice(0, 3).map(item => ({ ...item, title: getKnowledgeDisplayTitle({ title: item.title }) }))
    : []
}

syncHomeState()

const currentWeek = computed(() => {
  const userDueDate = appStore.user?.dueDate
  if (userDueDate) {
    const week = calculatePregnancyWeekFromDueDate(userDueDate)
    if (week) return week
  }
  return storedWeek.value
})

const isLoggedIn = computed(() => sessionLoggedIn.value)

const pregnancyStageLabel = computed(() => {
  const week = currentWeek.value
  if (!week) return isLoggedIn.value ? '待完善孕周' : '开启孕育之旅'
  if (week <= 12) return `孕早期 · 第 ${week} 周`
  if (week <= 27) return `孕中期 · 第 ${week} 周`
  return `孕晚期 · 第 ${week} 周`
})

const loginStateLabel = computed(() => (isLoggedIn.value ? '已守护' : '探索模式'))
const heroEyebrow = computed(() => (currentWeek.value ? `第 ${currentWeek.value} 周贴心指南` : '贝护妈妈孕育助手'))
const heroTitle = computed(() => (currentWeek.value ? '科学护航，安心陪伴每一天' : '您和宝宝的专属孕育管家'))
const heroSubtitle = computed(() => (
  isLoggedIn.value
    ? '专属孕期知识、里程碑日历与时光档案，记录您与宝宝的每一个美好瞬间。'
    : '提供专业、贴心的孕期指导，登录后即可开启您的专属孕育之旅。'
))

const primaryEntries = computed(() => [
  {
    title: '专业孕育百科',
    kicker: '科学指导',
    desc: '海量权威孕产知识，解答您的每一个孕期疑惑，让孕育之路更从容。',
    action: '去探索',
    icon: '阅',
    tone: 'knowledge',
    url: '/pages/knowledge/index',
    primary: true,
  },
  {
    title: '孕周里程碑',
    kicker: pregnancyStageLabel.value,
    desc: currentWeek.value ? `宝宝发育、妈妈变化、本周待办一目了然，不错过每个重要时刻。` : '了解孕期每周变化，登录后即可定制您的专属孕期日历。',
    action: '查看',
    icon: '期',
    tone: 'calendar',
    url: '/pages/calendar/index',
    footLabel: '当前阶段',
    footValue: currentWeek.value ? `W${currentWeek.value}` : '日历',
  },
  {
    title: '时光档案本',
    kicker: isLoggedIn.value ? '云端同步' : '守护回忆',
    desc: '珍藏孕检记录、心路历程与宝宝发育点滴，建立专属的母婴档案。',
    action: '打开',
    icon: '档',
    tone: 'archive',
    url: '/pages/pregnancy-profile/index',
    footLabel: '档案状态',
    footValue: isLoggedIn.value ? '记录中' : '待开启',
  },
])

const checkLogin = (): boolean => {
  if (!isLoggedIn.value) {
    uni.showToast({ title: '登录后可保存你的进度', icon: 'none' })
    setTimeout(() => { uni.navigateTo({ url: '/pages/login/index' }) }, 900)
    return false
  }
  return true
}

function openRecentKnowledge(slug: string) {
  uni.navigateTo({ url: `/pages/knowledge-detail/index?slug=${encodeURIComponent(slug)}` })
}

const navigateTo = (url: string) => {
  if (!PUBLIC_PAGES.has(url) && !checkLogin()) return
  if (TAB_PAGES.has(url)) { uni.switchTab({ url }); return }
  uni.navigateTo({ url })
}

onShow(() => {
  syncHomeState()
  if (sessionLoggedIn.value && !appStore.user) { void appStore.fetchUser() }
})

onShareAppMessage(() => ({ title: '贝护妈妈：科学护航，安心陪伴每一天', path: '/pages/home/index', query: '' }))
onShareTimeline(() => ({ title: '贝护妈妈：科学护航，安心陪伴每一天', query: '' }))
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  padding: 96rpx 28rpx 48rpx;
  background: linear-gradient(180deg, #f9f0f5 0%, #fff7f2 48%, #fbfaf8 100%);
  box-sizing: border-box;
}

.home-header {
  padding: 0 4rpx 30rpx;
}

.hero-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.hero-eyebrow,
.hero-state,
.home-card-action {
  font-size: 24rpx;
  font-weight: 800;
}

.hero-eyebrow {
  color: #d88188;
}

.hero-state {
  flex-shrink: 0;
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(216, 129, 136, 0.11);
  color: #d88188;
}

.hero-title {
  display: block;
  margin-top: 18rpx;
  font-size: 48rpx;
  line-height: 1.35;
  font-weight: 900;
  color: #444;
  letter-spacing: 1rpx;
}

.hero-subtitle {
  display: block;
  margin-top: 18rpx;
  font-size: 28rpx;
  line-height: 1.72;
  color: #666;
}

.home-card-list {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.home-card {
  position: relative;
  overflow: hidden;
  padding: 30rpx;
  border-radius: 30rpx;
  background: #fffcf8;
  border: 1rpx solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 18rpx 38rpx rgba(31, 42, 55, 0.02);
  box-sizing: border-box;
}

.home-card--primary {
  min-height: 292rpx;
  color: #ffffff;
  background: linear-gradient(135deg, #e8a1a6 0%, #d88188 52%, #c7656e 100%);
}

.home-card--calendar {
  background: linear-gradient(135deg, #fff2ed 0%, #ffe3d5 58%, #ffd2bc 100%);
}

.home-card--archive {
  background: linear-gradient(135deg, #f9ebf1 0%, #ebd3e0 54%, #dcb8cc 100%);
}

.home-card-head {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.home-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.9);
  flex-shrink: 0;
}

.home-card--primary .home-card-icon {
  background: rgba(255, 255, 255, 0.95);
  border: 1rpx solid rgba(255, 255, 255, 0.24);
}

.home-card--calendar .home-card-icon {
  background: rgba(229, 115, 77, 0.12);
}

.home-card--archive .home-card-icon {
  background: rgba(164, 108, 139, 0.1);
}

.home-card-icon-text {
  font-size: 26rpx;
  font-weight: 900;
  color: #444;
}

.home-card--primary .home-card-icon-text {
  color: #c7656e;
}

.home-card-meta {
  flex: 1;
  min-width: 0;
}

.home-card-kicker {
  display: block;
  font-size: 21rpx;
  font-weight: 800;
  color: #16806a;
}

.home-card--primary .home-card-kicker {
  color: rgba(255, 255, 255, 0.78);
}

.home-card--calendar .home-card-kicker {
  color: #e5734d;
}

.home-card--archive .home-card-kicker {
  color: #a46c8b;
}

.home-card-title {
  display: block;
  margin-top: 5rpx;
  font-size: 36rpx;
  line-height: 1.32;
  font-weight: 900;
  color: #444;
}

.home-card--primary .home-card-title {
  color: #ffffff;
}

.home-card-action {
  flex-shrink: 0;
  padding: 11rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.72);
  color: #16806a;
}

.home-card--primary .home-card-action {
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

.home-card-desc {
  display: block;
  margin-top: 22rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #5f6d7c;
}

.home-card--primary .home-card-desc {
  color: rgba(255, 255, 255, 0.9);
}

.home-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(31, 42, 55, 0.08);
}

.home-card--primary .home-card-foot {
  border-top-color: rgba(255, 255, 255, 0.22);
}

.home-card-foot-label,
.recent-inline-label {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #7a8592;
}

.home-card--primary .home-card-foot-label,
.home-card--primary .recent-inline-label {
  color: rgba(255, 255, 255, 0.7);
}

.home-card-foot-value,
.recent-inline-action {
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 800;
  color: #16806a;
}

.home-card--calendar .home-card-foot-value {
  color: #e5734d;
}

.home-card--archive .home-card-foot-value {
  color: #a46c8b;
}

.home-card--primary .home-card-foot-value,
.home-card--primary .recent-inline-action {
  color: #ffffff;
}

.recent-inline {
  flex: 1;
  min-width: 0;
}

.recent-inline-title {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #314050;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-card--primary .recent-inline-title {
  color: rgba(255, 255, 255, 0.92);
}
</style>
