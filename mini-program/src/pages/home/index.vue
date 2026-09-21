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

    <view class="stage-share-card">
      <view class="stage-share-copy">
        <text class="stage-share-kicker">{{ stageLabel }} · 今日入口</text>
        <text class="stage-share-title">{{ stageCardTitle }}</text>
        <text class="stage-share-desc">{{ stageCardDescription }}</text>
      </view>
      <view class="stage-share-badge"><text>{{ currentWeek ? `W${currentWeek}` : '记' }}</text></view>
    </view>

    <view class="home-tools-panel">
      <view class="tools-panel-head">
        <view>
          <text class="tools-panel-title">今日快捷工具</text>
          <text class="tools-panel-subtitle">按阶段整理，最多四项</text>
        </view>
        <text class="tools-panel-link" @tap="navigateTo('/pages/tools/index')">全部工具 ›</text>
      </view>
      <view class="home-quick-list">
        <view v-for="tool in quickTools" :key="tool.id" class="home-quick-item" :class="`home-quick-item--${tool.tone}`" @tap="openTool(tool.id)">
          <view class="home-quick-icon"><text>{{ tool.icon }}</text></view>
          <text class="home-quick-title">{{ tool.title }}</text>
          <text class="home-quick-action">{{ tool.primaryAction }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { calculatePregnancyWeekFromDueDate } from '@/utils'
import { buildAcquisitionPath, buildAcquisitionQuery, recordAcquisitionContext } from '@/utils/acquisition'
import { getKnowledgeDisplayTitle } from '@/utils/knowledge-format'
import { getStageLabel, getToolDefinition, getToolStage, type ToolId, type ToolStage } from '@/data/tool-catalog'
import type { RecentKnowledgeItem } from '@/utils/home-helpers'

const appStore = useAppStore()
const RECENT_KNOWLEDGE_STORAGE_KEY = 'recentKnowledgeArticles'

const TAB_PAGES = new Set([
  '/pages/home/index',
  '/pages/calendar/index',
  '/pages/tools/index',
  '/pages/profile/index',
])

const PUBLIC_PAGES = new Set([
  '/pages/home/index',
  '/pages/calendar/index',
  '/pages/tools/index',
  '/pages/knowledge/index',
  '/pages/name-library/index',
])

const sessionLoggedIn = ref(Boolean(uni.getStorageSync('token')))
const storedWeek = ref<number | null>(null)
const recentKnowledge = ref<RecentKnowledgeItem[]>([])

const syncHomeState = () => {
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
const heroTitle = computed(() => (currentWeek.value ? '按周整理，安心记录每一天' : '您的孕育记录与资料工具'))
const heroSubtitle = computed(() => (
  isLoggedIn.value
    ? '查看公开资料、孕周提醒与时光档案，记录您与宝宝的重要变化。'
    : '先浏览公开资料和孕周日历，登录后可保存个人记录与提醒。'
))

const toolStage = computed<ToolStage>(() => getToolStage(currentWeek.value, appStore.user?.babyBirthday))
const stageLabel = computed(() => getStageLabel(toolStage.value))
const stageCardTitle = computed(() => currentWeek.value ? `第 ${currentWeek.value} 周，先把今天记下来` : '先选一个顺手的记录入口')
const stageCardDescription = computed(() => currentWeek.value
  ? '计时、记录和分享都从真实数据开始，随时可以回到工具箱继续。'
  : '没有设置孕周也可以浏览工具；登录后保存自己的记录。')
const quickToolIds: Record<ToolStage, ToolId[]> = {
  preparing: ['calendar', 'diary', 'expenses', 'names'],
  early: ['calendar', 'diary', 'reports', 'weight'],
  middle: ['movement', 'weight', 'calendar', 'packing'],
  late: ['contractions', 'movement', 'packing', 'calendar'],
  newborn: ['care', 'diary', 'growth', 'vaccines'],
  feeding: ['care', 'foods', 'growth', 'vaccines'],
}
const quickTools = computed(() => quickToolIds[toolStage.value].map(id => getToolDefinition(id)))

const primaryEntries = computed(() => [
  {
    title: '孕育资料库',
    kicker: '公开资料',
    desc: '整理公开机构资料与同步时间，帮助您按主题查阅孕产和育儿信息。',
    action: '去查看',
    icon: '阅',
    tone: 'knowledge',
    url: '/pages/knowledge/index',
    primary: true,
  },
  {
    title: '孕周记录',
    kicker: pregnancyStageLabel.value,
    desc: currentWeek.value ? `按周查看常见变化和记录提醒，方便整理下一次产检要点。` : '了解每周常见变化，登录后可保存您的孕期日历。',
    action: '查看',
    icon: '期',
    tone: 'calendar',
    url: '/pages/calendar/index',
    footLabel: '当前阶段',
    footValue: currentWeek.value ? `W${currentWeek.value}` : '日历',
  },
  {
    title: '时光档案',
    kicker: isLoggedIn.value ? '云端同步' : '守护回忆',
    desc: '保存孕周、提醒和阶段记录，形成只属于您的孕育档案。',
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
  uni.navigateTo({ url: buildAcquisitionPath('/pages/knowledge-detail/index', { slug }) })
}

const navigateTo = (url: string) => {
  if (!PUBLIC_PAGES.has(url) && !checkLogin()) return
  if (TAB_PAGES.has(url)) { uni.switchTab({ url }); return }
  uni.navigateTo({ url: buildAcquisitionPath(url) })
}

const openTool = (id: ToolId) => {
  if (id === 'calendar') {
    uni.switchTab({ url: '/pages/calendar/index' })
    return
  }
  if (id === 'names') {
    uni.navigateTo({ url: '/pages/name-library/index' })
    return
  }
  uni.navigateTo({ url: `/pages/tool-detail/index?id=${id}` })
}

onLoad((options) => {
  recordAcquisitionContext(options)
})

onShow(() => {
  syncHomeState()
  if (sessionLoggedIn.value && !appStore.user) {
    void appStore.fetchUser()
  }
})

function buildSharePayload() {
  const query = buildAcquisitionQuery()

  return {
    title: '贝护妈妈：孕周资料与记录工具',
    path: buildAcquisitionPath('/pages/home/index'),
    query,
  }
}

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

.stage-share-card {
  display: flex;
  align-items: center;
  gap: 22rpx;
  margin-top: 22rpx;
  padding: 26rpx;
  border: 1rpx solid rgba(22, 128, 106, .13);
  border-radius: 28rpx;
  background: linear-gradient(135deg, #edf8f2, #f8f1e9);
}

.stage-share-copy { flex: 1; min-width: 0; }
.stage-share-kicker, .stage-share-title, .stage-share-desc { display: block; }
.stage-share-kicker { color: #16806a; font-size: 21rpx; font-weight: 800; }
.stage-share-title { margin-top: 8rpx; color: #43564f; font-size: 32rpx; font-weight: 900; }
.stage-share-desc { margin-top: 8rpx; color: #6e7d77; font-size: 23rpx; line-height: 1.55; }
.stage-share-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 76rpx;
  height: 76rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, .7);
  color: #16806a;
  font-size: 34rpx;
  font-weight: 900;
}

.home-tools-panel {
  margin-top: 22rpx;
  padding: 24rpx;
  border-radius: 28rpx;
  background: #fffcf8;
  box-shadow: 0 12rpx 36rpx rgba(77, 63, 56, .05);
}

.tools-panel-head { display: flex; align-items: end; justify-content: space-between; gap: 16rpx; }
.tools-panel-title, .tools-panel-subtitle { display: block; }
.tools-panel-title { color: #4a4240; font-size: 31rpx; font-weight: 900; }
.tools-panel-subtitle { margin-top: 5rpx; color: #978c87; font-size: 21rpx; }
.tools-panel-link { color: #16806a; font-size: 22rpx; font-weight: 800; }
.home-quick-list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12rpx; margin-top: 20rpx; }
.home-quick-item { min-width: 0; padding: 16rpx 8rpx; border-radius: 18rpx; text-align: center; }
.home-quick-item--rose { background: #fff0f1; color: #b65e68; }
.home-quick-item--orange { background: #fff1e7; color: #c36c43; }
.home-quick-item--green { background: #edf8f2; color: #16806a; }
.home-quick-item--lilac { background: #f5eef7; color: #8c6896; }
.home-quick-icon { display: flex; align-items: center; justify-content: center; width: 48rpx; height: 48rpx; margin: 0 auto; border-radius: 16rpx; background: rgba(255,255,255,.72); font-size: 23rpx; font-weight: 900; }
.home-quick-title { display: block; margin-top: 10rpx; overflow: hidden; color: #544a46; font-size: 21rpx; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.home-quick-action { display: block; margin-top: 5rpx; color: currentColor; font-size: 18rpx; opacity: .75; }

@media (max-width: 350px) {
  .home-quick-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
