<template>
  <view class="pregnancy-archive-page">
    <view v-if="initializing" class="loading-shell">
      <text class="loading-title">正在整理孕期档案</text>
      <text class="loading-subtitle">同步你的孕周、关键节点和本周记录。</text>
    </view>

    <template v-else>
      <view v-if="loadError" class="empty-card">
        <text class="empty-title">孕期档案暂时不可用</text>
        <text class="empty-subtitle">{{ loadError }}</text>
        <view class="empty-action" hover-class="empty-action--hover" @tap="initializePage">
          <text class="empty-action-text">重新加载</text>
        </view>
      </view>

      <view v-else-if="!isPregnancyReady" class="empty-card">
        <text class="empty-title">先补充预产期，再生成你的孕期档案</text>
        <text class="empty-subtitle">档案页会围绕当前孕周、关键产检节点和本周记录形成一个集中入口。</text>
        <view class="empty-action" hover-class="empty-action--hover" @tap="openProfile">
          <text class="empty-action-text">去完善资料</text>
        </view>
      </view>

      <template v-else>
        <view class="hero-card">
          <view class="hero-top">
            <view class="hero-copy">
              <text class="hero-eyebrow">孕期档案</text>
              <text class="hero-title">{{ phaseSummary.title }}</text>
              <text class="hero-subtitle">{{ phaseSummary.subtitle }}</text>
            </view>
            <view class="hero-badge">
              <text class="hero-badge-text">{{ phaseSummary.label }}</text>
            </view>
          </view>

          <view class="hero-tags">
            <view v-for="tag in heroTags" :key="tag" class="hero-tag">
              <text class="hero-tag-text">{{ tag }}</text>
            </view>
          </view>

          <view class="hero-stats">
            <view class="hero-stat">
              <text class="hero-stat-value">{{ currentWeekText }}</text>
              <text class="hero-stat-label">当前孕周</text>
            </view>
            <view class="hero-divider"></view>
            <view class="hero-stat">
              <text class="hero-stat-value">{{ dueDateText }}</text>
              <text class="hero-stat-label">预产期</text>
            </view>
            <view class="hero-divider"></view>
            <view class="hero-stat">
              <text class="hero-stat-value">{{ daysUntilDueText }}</text>
              <text class="hero-stat-label">距离预产期</text>
            </view>
          </view>

          <view class="progress-panel">
            <view class="progress-head">
              <text class="progress-title">孕期进度</text>
              <text class="progress-value">{{ progressPercent }}%</text>
            </view>
            <view class="progress-track">
              <view class="progress-fill" :style="{ width: `${progressPercent}%` }"></view>
            </view>
          </view>
        </view>

        <view class="section-card spotlight-card">
          <view class="section-header">
            <text class="section-title">本阶段重点</text>
          </view>
          <text class="spotlight-title">{{ phaseSummary.focusTitle }}</text>
          <text class="spotlight-text">{{ phaseSummary.focusText }}</text>
          <text class="spotlight-note">{{ weeklySummaryText }}</text>
        </view>

        <view class="section-card">
          <view class="section-header">
            <text class="section-title">本周快照</text>
            <text v-if="loadingSnapshot" class="section-meta">同步中...</text>
          </view>

          <view class="snapshot-grid">
            <view class="snapshot-item">
              <text class="snapshot-value">{{ completedTodoCount }}/{{ totalTodoCount }}</text>
              <text class="snapshot-label">待办完成</text>
            </view>
            <view class="snapshot-item">
              <text class="snapshot-value">{{ hasWeeklyDiary ? '已记录' : '未记录' }}</text>
              <text class="snapshot-label">本周记录</text>
            </view>
            <view class="snapshot-item">
              <text class="snapshot-value">{{ customTodoCount }}</text>
              <text class="snapshot-label">自定义待办</text>
            </view>
          </view>

          <view class="snapshot-banner">
            <text class="snapshot-banner-text">{{ nextMilestoneText }}</text>
          </view>
        </view>

        <view class="section-card">
          <view class="section-header">
            <text class="section-title">关键节点时间轴</text>
            <text class="section-meta">按孕周整理</text>
          </view>

          <view class="milestone-list">
            <view
              v-for="item in milestoneList"
              :key="item.title"
              class="milestone-item"
              :class="`milestone-item--${item.status}`"
            >
              <view class="milestone-rail">
                <view class="milestone-dot" :class="`milestone-dot--${item.status}`"></view>
                <view class="milestone-line"></view>
              </view>
              <view class="milestone-content">
                <view class="milestone-head">
                  <text class="milestone-title">{{ item.title }}</text>
                  <text class="milestone-chip" :class="`milestone-chip--${item.status}`">{{ item.statusText }}</text>
                </view>
                <text class="milestone-meta">{{ item.windowText }} · {{ item.anchorDateText }}</text>
                <text class="milestone-desc">{{ item.description }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="section-card">
          <view class="section-header">
            <text class="section-title">我的记录</text>
            <text class="section-meta">来自孕育时间轴</text>
          </view>

          <view v-if="hasWeeklyDiary" class="diary-card">
            <text class="diary-date">{{ weeklyDiaryDate }}</text>
            <text class="diary-content">{{ weeklyDiaryPreview }}</text>
          </view>
          <view v-else class="diary-empty">
            <text class="diary-empty-title">这周还没有留下记录</text>
            <text class="diary-empty-text">可以把本周感受、产检结果或重点提醒先记进时间轴。</text>
          </view>

          <view class="action-row">
            <view class="action-button action-button--primary" hover-class="action-button--hover" @tap="openCalendar">
              <text class="action-button-text action-button-text--primary">去写本周记录</text>
            </view>
            <view class="action-button" hover-class="action-button--hover" @tap="openProfile">
              <text class="action-button-text">编辑资料</text>
            </view>
          </view>
        </view>
      </template>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import weekGuideData from '../calendar/mockData.json'
import { userApi, type PregnancyProfile } from '@/api/modules'
import { useAppStore } from '@/stores/app'

const PROFILE_AUTO_OPEN_EDIT_KEY = 'profileAutoOpenEdit'
const PROFILE_CACHE_VERSION = 1
const PROFILE_CACHE_TTL_MS = 30 * 60 * 1000
const appStore = useAppStore()
const initializing = ref(true)
const loadingSnapshot = ref(false)
const profileData = ref<PregnancyProfile | null>(null)
const loadError = ref('')

const fallbackPhase = {
  label: '孕期未完善',
  title: '先完善孕期资料',
  subtitle: '补充预产期后，这里会自动生成当前孕周、关键节点和阶段重点。',
  focusTitle: '当前还不能生成孕期档案',
  focusText: '先去完善预产期和孕期状态，档案页会再自动同步当前阶段。',
}
const fallbackSnapshot = {
  completedTodoCount: 0,
  customTodoCount: 0,
  hasWeeklyDiary: false,
  weeklyDiaryDate: null,
  weeklyDiaryPreview: null,
}
const fallbackNextMilestoneText = '补充预产期后，这里会自动生成关键孕期节点。'

type LoosePregnancyProfile = Partial<PregnancyProfile> & {
  phase?: Partial<PregnancyProfile['phase']> | null
  snapshot?: Partial<PregnancyProfile['snapshot']> | null
  milestones?: PregnancyProfile['milestones'] | null
  heroTags?: string[] | null
}

type PregnancyProfileCachePayload = {
  version: number
  savedAt: number
  userId: string
  data: LoosePregnancyProfile
}

function normalizeProfilePayload(value: LoosePregnancyProfile | null | undefined): PregnancyProfile | null {
  if (!value || typeof value !== 'object') return null

  return {
    isPregnancyReady: Boolean(value.isPregnancyReady),
    currentWeek: typeof value.currentWeek === 'number' ? value.currentWeek : null,
    dueDate: typeof value.dueDate === 'string' ? value.dueDate : null,
    daysUntilDue: typeof value.daysUntilDue === 'number' ? value.daysUntilDue : null,
    progressPercent: typeof value.progressPercent === 'number' ? value.progressPercent : 0,
    heroTags: Array.isArray(value.heroTags) ? value.heroTags.filter((item): item is string => typeof item === 'string') : [],
    phase: {
      ...fallbackPhase,
      ...(value.phase || {}),
    },
    snapshot: {
      ...fallbackSnapshot,
      ...(value.snapshot || {}),
    },
    milestones: Array.isArray(value.milestones) ? value.milestones : [],
    nextMilestoneText: typeof value.nextMilestoneText === 'string' ? value.nextMilestoneText : fallbackNextMilestoneText,
  }
}

function resolveProfileCacheKey() {
  const storedUser = appStore.user || uni.getStorageSync('user')
  const userId = storedUser?.id ? String(storedUser.id) : ''
  return userId ? `pregnancyProfileCache:${userId}` : ''
}

function readProfileCache(): PregnancyProfile | null {
  const cacheKey = resolveProfileCacheKey()
  if (!cacheKey) return null

  const cachedValue = uni.getStorageSync(cacheKey) as PregnancyProfileCachePayload | undefined
  if (!cachedValue || typeof cachedValue !== 'object') return null
  if (cachedValue.version !== PROFILE_CACHE_VERSION) return null
  if (!cachedValue.savedAt || Date.now() - cachedValue.savedAt > PROFILE_CACHE_TTL_MS) return null

  return normalizeProfilePayload(cachedValue.data)
}

function writeProfileCache(value: PregnancyProfile) {
  const cacheKey = resolveProfileCacheKey()
  const storedUser = appStore.user || uni.getStorageSync('user')
  const userId = storedUser?.id ? String(storedUser.id) : ''
  if (!cacheKey || !userId) return

  uni.setStorageSync(cacheKey, {
    version: PROFILE_CACHE_VERSION,
    savedAt: Date.now(),
    userId,
    data: value,
  } satisfies PregnancyProfileCachePayload)
}

const isPregnancyReady = computed(() => profileData.value?.isPregnancyReady ?? false)
const currentWeek = computed(() => profileData.value?.currentWeek ?? null)
const phaseSummary = computed(() => profileData.value?.phase ?? fallbackPhase)
const currentWeekText = computed(() => (currentWeek.value ? `第 ${currentWeek.value} 周` : '未设置'))
const dueDateText = computed(() => profileData.value?.dueDate || '未设置')
const daysUntilDueText = computed(() => {
  const value = profileData.value?.daysUntilDue
  return value === null || value === undefined ? '未设置' : `${value} 天`
})
const progressPercent = computed(() => profileData.value?.progressPercent ?? 0)
const heroTags = computed(() => profileData.value?.heroTags || [])
const snapshot = computed(() => profileData.value?.snapshot ?? fallbackSnapshot)

const currentWeekGuide = computed(() => {
  const week = currentWeek.value
  if (!week) return null
  return (weekGuideData as Array<any>).find(item => item.week === week) || null
})

const weeklySummaryText = computed(() => currentWeekGuide.value?.summary || phaseSummary.value.focusText)
const completedTodoCount = computed(() => snapshot.value.completedTodoCount ?? 0)
const customTodoCount = computed(() => snapshot.value.customTodoCount ?? 0)
const totalTodoCount = computed(() => (currentWeekGuide.value?.content?.todo?.length || 0) + customTodoCount.value)
const hasWeeklyDiary = computed(() => snapshot.value.hasWeeklyDiary ?? false)
const weeklyDiaryDate = computed(() => snapshot.value.weeklyDiaryDate || '')
const weeklyDiaryPreview = computed(() => snapshot.value.weeklyDiaryPreview || '')
const milestoneList = computed(() => profileData.value?.milestones || [])
const nextMilestoneText = computed(() => profileData.value?.nextMilestoneText || fallbackNextMilestoneText)

async function initializePage() {
  loadError.value = ''

  const token = uni.getStorageSync('token')
  if (!token) {
    initializing.value = true
    uni.showToast({ title: '请先登录后查看孕期档案', icon: 'none' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' })
    }, 900)
    initializing.value = false
    return
  }

  const cachedProfile = readProfileCache()
  if (cachedProfile) {
    profileData.value = cachedProfile
    initializing.value = false
  } else {
    initializing.value = true
  }

  loadingSnapshot.value = true
  try {
    await appStore.fetchUser()
    const result = await userApi.getPregnancyProfile()
    const normalizedProfile = normalizeProfilePayload(result)
    if (!normalizedProfile) {
      throw new Error('孕期档案数据格式异常，请稍后再试')
    }
    profileData.value = normalizedProfile
    writeProfileCache(normalizedProfile)
  } catch (error: any) {
    console.error('[PregnancyProfile] 加载孕期档案快照失败:', error)
    if (!profileData.value) {
      profileData.value = null
      loadError.value = error?.message || '加载孕期档案失败，请稍后再试'
    }
  } finally {
    loadingSnapshot.value = false
    initializing.value = false
  }
}

function openProfile() {
  uni.setStorageSync(PROFILE_AUTO_OPEN_EDIT_KEY, '1')
  uni.switchTab({ url: '/pages/profile/index' })
}

function openCalendar() {
  uni.navigateTo({ url: '/pages/calendar/index' })
}

function buildSharePayload() {
  const title = isPregnancyReady.value
    ? `贝护妈妈孕期档案：${phaseSummary.value.title}`
    : '贝护妈妈孕期档案：查看孕周、关键节点和本周记录'

  return {
    title,
    path: '/pages/pregnancy-profile/index',
    query: '',
  }
}

onShow(() => {
  void initializePage()
})

onShareAppMessage(() => buildSharePayload())

onShareTimeline(() => {
  const payload = buildSharePayload()
  return {
    title: payload.title,
    query: payload.query,
  }
})
</script>

<style scoped>
.pregnancy-archive-page {
  min-height: 100vh;
  padding: 32rpx 24rpx 48rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 216, 188, 0.42), transparent 28%),
    linear-gradient(180deg, #fff7f1 0%, #fffdf9 48%, #f7fafc 100%);
  box-sizing: border-box;
}

.loading-shell,
.empty-card,
.section-card,
.hero-card {
  border-radius: 32rpx;
  box-shadow: 0 18rpx 40rpx rgba(39, 48, 60, 0.08);
}

.loading-shell,
.empty-card {
  margin-top: 120rpx;
  padding: 56rpx 40rpx;
  background: rgba(255, 255, 255, 0.92);
  text-align: center;
}

.loading-title,
.empty-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #24303d;
}

.loading-subtitle,
.empty-subtitle {
  display: block;
  margin-top: 18rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #657383;
}

.empty-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 36rpx;
  padding: 18rpx 32rpx;
  border-radius: 999rpx;
  background: #f37e56;
}

.empty-action--hover,
.action-button--hover {
  opacity: 0.88;
}

.empty-action-text,
.action-button-text--primary {
  font-size: 26rpx;
  font-weight: 700;
  color: #fff;
}

.hero-card {
  overflow: hidden;
  padding: 36rpx;
  background: linear-gradient(135deg, #fff0e7 0%, #ffd9c8 58%, #fff8f3 100%);
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.hero-copy {
  flex: 1;
}

.hero-eyebrow {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: #ba6a45;
}

.hero-title {
  display: block;
  margin-top: 16rpx;
  font-size: 52rpx;
  line-height: 1.12;
  font-weight: 800;
  color: #2d2823;
}

.hero-subtitle {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #6d6258;
}

.hero-badge {
  flex-shrink: 0;
  padding: 12rpx 22rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.86);
}

.hero-badge-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #cf6f48;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 28rpx;
}

.hero-tag {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.7);
}

.hero-tag-text {
  font-size: 22rpx;
  color: #7a5d4a;
}

.hero-stats {
  display: flex;
  align-items: stretch;
  gap: 20rpx;
  margin-top: 30rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.66);
}

.hero-stat {
  flex: 1;
  min-width: 0;
}

.hero-stat-value {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #2f2a26;
}

.hero-stat-label {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #7c7067;
}

.hero-divider {
  width: 2rpx;
  background: rgba(137, 113, 95, 0.16);
}

.progress-panel {
  margin-top: 28rpx;
}

.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.progress-title,
.progress-value {
  font-size: 24rpx;
  font-weight: 700;
  color: #7b5f4d;
}

.progress-track {
  overflow: hidden;
  height: 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.66);
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #f5875c 0%, #ec6d4b 100%);
}

.section-card {
  margin-top: 24rpx;
  padding: 30rpx;
  background: rgba(255, 255, 255, 0.94);
}

.spotlight-card {
  background: linear-gradient(135deg, #fff8ef 0%, #fffdfb 100%);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #283442;
}

.section-meta {
  font-size: 22rpx;
  color: #8b95a1;
}

.spotlight-title {
  display: block;
  margin-top: 20rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #ce6b45;
}

.spotlight-text,
.spotlight-note,
.milestone-desc,
.diary-content,
.diary-empty-text {
  display: block;
  margin-top: 16rpx;
  font-size: 25rpx;
  line-height: 1.8;
  color: #61707f;
}

.spotlight-note {
  padding-top: 16rpx;
  border-top: 2rpx solid rgba(227, 205, 188, 0.5);
  color: #7d6b5f;
}

.snapshot-grid {
  display: flex;
  gap: 18rpx;
  margin-top: 24rpx;
}

.snapshot-item {
  flex: 1;
  padding: 24rpx 20rpx;
  border-radius: 24rpx;
  background: #fff8f4;
}

.snapshot-value {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
  color: #2a3340;
}

.snapshot-label {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #7c8793;
}

.snapshot-banner {
  margin-top: 22rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #eef6fb 0%, #f7fbff 100%);
}

.snapshot-banner-text {
  font-size: 24rpx;
  line-height: 1.7;
  color: #51697d;
}

.milestone-list {
  margin-top: 24rpx;
}

.milestone-item {
  display: flex;
  gap: 18rpx;
}

.milestone-item + .milestone-item {
  margin-top: 18rpx;
}

.milestone-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.milestone-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  margin-top: 8rpx;
}

.milestone-dot--done {
  background: #1f8f74;
}

.milestone-dot--active {
  background: #f37e56;
}

.milestone-dot--upcoming {
  background: #ccd4dc;
}

.milestone-line {
  flex: 1;
  width: 4rpx;
  margin-top: 10rpx;
  background: rgba(207, 215, 223, 0.7);
}

.milestone-content {
  flex: 1;
  padding: 24rpx;
  border-radius: 24rpx;
  background: #fbfcfd;
}

.milestone-item--active .milestone-content {
  background: #fff6f1;
}

.milestone-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.milestone-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #2c3440;
}

.milestone-chip {
  flex-shrink: 0;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 700;
}

.milestone-chip--done {
  background: rgba(31, 143, 116, 0.12);
  color: #1f8f74;
}

.milestone-chip--active {
  background: rgba(243, 126, 86, 0.16);
  color: #d46640;
}

.milestone-chip--upcoming {
  background: rgba(138, 149, 160, 0.12);
  color: #7f8a95;
}

.milestone-meta,
.diary-date {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #97a0a9;
}

.diary-card,
.diary-empty {
  margin-top: 22rpx;
  padding: 26rpx;
  border-radius: 24rpx;
  background: #fff8f3;
}

.diary-empty-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #364150;
}

.action-row {
  display: flex;
  gap: 18rpx;
  margin-top: 24rpx;
}

.action-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 18rpx;
  border-radius: 999rpx;
  border: 2rpx solid rgba(215, 221, 228, 0.9);
  background: #fff;
}

.action-button--primary {
  background: #ef7a54;
  border-color: #ef7a54;
}

.action-button-text {
  font-size: 25rpx;
  font-weight: 700;
  color: #4f6172;
}
</style>
