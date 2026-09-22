<template>
  <view class="home-page">
    <view class="home-header">
      <view class="hero-topline"><text class="hero-eyebrow">贝护 · 每天一点记录</text><text class="hero-state">{{ loggedIn ? '已登录' : '游客使用' }}</text></view>
      <text class="hero-title">{{ period?.stage === 'postpartum' ? `宝宝第 ${period.week} 周，一起慢慢长大` : currentWeek ? `第 ${currentWeek} 周，陪你记下每一天` : '把常用工具，放在手边' }}</text>
      <text class="hero-subtitle">{{ currentWeek ? '照顾好当下，也留下值得回看的日常。' : '先开始记录，随时按自己的习惯调整首页。' }}</text>
    </view>
    <view class="home-tools-panel">
      <view class="tools-panel-head"><view><text class="tools-panel-title">我的常用</text><text class="tools-panel-subtitle">{{ customIds === null ? (period ? `${toolPeriodLabel(period)}推荐 · 可自由调整` : '已按阶段推荐，可自由调整') : `已添加 ${homeIds.length} 项 · 按你的顺序` }}</text></view><button class="text-button" @tap="editing = !editing">{{ editing ? '完成' : '管理' }}</button></view>
      <HomeToolEditor v-if="editing" :ids="homeIds" @change="updateHome" @reset="restoreHome" />
      <view v-else class="home-quick-list" :class="{ 'home-quick-list--many': homeIds.length > 5 }">
        <button v-for="tool in homeTools" :key="tool.id" class="home-quick-item" :aria-label="`打开${tool.title}`" @tap="openTool(tool.id)">
          <view class="home-quick-icon" :class="`tone-${tool.tone}`"><ToolIcon :id="tool.id" /></view>
          <text class="home-quick-title">{{ tool.title }}</text>
        </button>
        <button v-if="homeIds.length < MAX_HOME_TOOLS" class="home-quick-item home-add" @tap="openTools"><view class="home-quick-icon"><text>＋</text></view><text class="home-quick-title">添加工具</text></button>
      </view>
      <button class="all-tools-button" @tap="openTools">查看全部 15 项工具 ›</button>
    </view>
    <ReminderSummaryCard
      :summary="reminderSummary"
      :prompt="reminderPrompt"
      @open="openReminders"
      @dismiss="dismissReminderPrompt"
    />
    <view class="home-card-list">
      <view class="home-card home-card--calendar" role="button" :aria-label="period?.stage === 'postpartum' ? '打开成长记录' : '打开孕周记录'" @tap="openTool('calendar')">
        <view class="home-card-head">
          <view class="home-card-icon"><text class="home-card-icon-text">期</text></view>
          <view class="home-card-meta"><text class="home-card-kicker">{{ period ? stageLabel : '开启孕育之旅' }}</text><text class="home-card-title">{{ period?.stage === 'postpartum' ? '成长记录' : '孕周记录' }}</text></view>
          <text class="home-card-action">查看</text>
        </view>
        <text class="home-card-desc">{{ calendarDescription }}</text>
        <view class="home-card-foot"><text class="home-card-foot-label">当前阶段</text><text class="home-card-foot-value">{{ period ? toolPeriodLabel(period) : '日历' }}</text></view>
      </view>
      <view class="home-card home-card--archive" role="button" aria-label="打开时光档案" @tap="openProfile">
        <view class="home-card-head">
          <view class="home-card-icon"><text class="home-card-icon-text">档</text></view>
          <view class="home-card-meta"><text class="home-card-kicker">{{ loggedIn ? '云端同步' : '守护回忆' }}</text><text class="home-card-title">时光档案</text></view>
          <text class="home-card-action">打开</text>
        </view>
        <text class="home-card-desc">保存孕周、提醒和阶段记录，形成只属于您的孕育档案。</text>
        <view class="home-card-foot"><text class="home-card-foot-label">档案状态</text><text class="home-card-foot-value">{{ loggedIn ? '记录中' : '待开启' }}</text></view>
      </view>
    </view>
    <text class="home-note">记录与整理，从今天的小事开始。</text>
  </view>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { calculatePregnancyWeekFromDueDate } from '@/utils'
import { buildAcquisitionPath, buildAcquisitionQuery, recordAcquisitionContext } from '@/utils/acquisition'
import { getStageLabel, getToolDefinition, getToolStage, type ToolId } from '@/data/tool-catalog'
import { MAX_HOME_TOOLS, openToolPage, readHomeTools, recommendedHomeTools, resetHomeTools, saveHomeTools } from '@/utils/home-tools'
import HomeToolEditor from '@/components/tools/HomeToolEditor.vue'
import ToolIcon from '@/components/tools/ToolIcon.vue'
import ReminderSummaryCard from '@/components/reminders/ReminderSummaryCard.vue'
import { currentToolPeriod, periodTools, toolPeriodLabel } from '@/utils/tool-period'
import { trackMiniEvent } from '@/utils/analytics'
import { reportOwner } from '@/utils/report-drafts'
import { buildReminderPrompt, buildReminderSummary, markReminderPromptRead, readReminderPromptSignature, readReminders, type LocalReminder } from '@/utils/reminders'
const appStore = useAppStore()
const loggedIn = ref(false), storedWeek = ref<number | null>(null), editing = ref(false)
const customIds = ref<ToolId[] | null>(readHomeTools())
const initialReminderOwner = reportOwner()
const reminderOwner = ref(initialReminderOwner), reminders = ref<LocalReminder[]>([]), reminderPromptRead = ref(readReminderPromptSignature(initialReminderOwner))
const reminderSummary = computed(() => buildReminderSummary(reminders.value))
const reminderPrompt = computed(() => {
  const prompt = buildReminderPrompt(reminders.value)
  return prompt && prompt.signature !== reminderPromptRead.value ? prompt : null
})
const currentWeek = computed(() => {
  if (appStore.user?.babyBirthday) return null
  return appStore.user?.dueDate ? calculatePregnancyWeekFromDueDate(appStore.user.dueDate) : storedWeek.value
})
const stage = computed(() => getToolStage(currentWeek.value, appStore.user?.babyBirthday))
const stageLabel = computed(() => getStageLabel(stage.value))
const period = computed(() => currentToolPeriod(currentWeek.value, appStore.user?.babyBirthday))
const calendarDescription = computed(() => period.value
  ? `这一周可用：${periodTools(period.value).map(item => getToolDefinition(item.id).title).join('、')}。打开日历，按周查看。`
  : '了解每周常见变化，在对应孕周找到记录工具与待办。')
const homeIds = computed(() => customIds.value ?? recommendedHomeTools(stage.value, period.value))
const homeTools = computed(() => homeIds.value.map(getToolDefinition))
function updateHome(ids: ToolId[]) {
  try { saveHomeTools(ids); customIds.value = [...ids] }
  catch { uni.showToast({ title: '未能保存设置，请重试', icon: 'none' }) }
}
function restoreHome() {
  try { resetHomeTools(); customIds.value = null }
  catch { uni.showToast({ title: '未能恢复推荐，请重试', icon: 'none' }) }
}
function openTools() { uni.switchTab({ url: '/pages/tools/index' }) }
function openTool(id: ToolId) { trackMiniEvent('app_tool_open', { page: 'Home', properties: { toolId: id, stage: stage.value } }); openToolPage(id) }
function refreshReminders() {
  const nextOwner = reportOwner()
  if (nextOwner !== reminderOwner.value) {
    reminderOwner.value = nextOwner
    reminderPromptRead.value = readReminderPromptSignature(nextOwner)
  }
  reminders.value = readReminders(nextOwner)
}
function openReminders() {
  const prompt = reminderPrompt.value
  if (prompt) {
    markReminderPromptRead(reminderOwner.value, prompt.signature)
    reminderPromptRead.value = prompt.signature
  }
  uni.setStorageSync('beihu:calendar:initial-tab', 'reminders')
  uni.switchTab({ url: '/pages/calendar/index' })
}
function dismissReminderPrompt() {
  const prompt = reminderPrompt.value
  if (!prompt) return
  markReminderPromptRead(reminderOwner.value, prompt.signature)
  reminderPromptRead.value = prompt.signature
}
function openProfile() {
  const target = '/pages/pregnancy-profile/index'
  uni.navigateTo({ url: loggedIn.value ? target : `/pages/login/index?redirect=${encodeURIComponent(target)}` })
}
onLoad(options => recordAcquisitionContext(options))
onShow(() => {
  loggedIn.value = !!uni.getStorageSync('token')
  const week = Number(uni.getStorageSync('userPregnancyWeek'))
  storedWeek.value = Number.isInteger(week) && week >= 1 && week <= 40 ? week : null
  customIds.value = readHomeTools()
  refreshReminders()
  if (loggedIn.value && !appStore.user) void appStore.fetchUser()
})
onShareAppMessage(() => ({ title: '贝护 · 孕育记录与实用工具', path: buildAcquisitionPath('/pages/home/index') }))
onShareTimeline(() => ({ title: '贝护 · 孕育记录与实用工具', query: buildAcquisitionQuery() }))
</script>
<style scoped>
.home-page { min-height: 100vh; padding: 36rpx 28rpx 54rpx; background: linear-gradient(180deg, #fff4f1 0%, #fcf9f8 55%); box-sizing: border-box; }
.home-header { padding: 0 4rpx 28rpx; }
.hero-topline, .tools-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.hero-eyebrow { color: #a5525e; font-size: 24rpx; font-weight: 800; }
.hero-state { color: #756761; padding: 10rpx 16rpx; background: #fffdfb; border-radius: 16rpx; font-size: 22rpx; }
.hero-title { display: block; margin-top: 20rpx; font-size: 40rpx; font-weight: 700; color: #443c3a; line-height: 1.4; }
.hero-subtitle { display: block; margin-top: 12rpx; font-size: 26rpx; line-height: 1.6; color: #756761; }
.home-tools-panel { padding: 22rpx; border-radius: 28rpx; background: #fffcf8; box-shadow: 0 12rpx 30rpx rgba(58,48,44,.045); }
.tools-panel-title, .tools-panel-subtitle { display: block; }
.tools-panel-title { color: #443c3a; font-size: 32rpx; font-weight: 800; }
.tools-panel-subtitle { color: #766b67; font-size: 23rpx; margin-top: 6rpx; }
.text-button { padding: 20rpx 8rpx; margin: 0; min-height: 88rpx; background: transparent; color: #166c5b; font-size: 26rpx; line-height: 1.8; }
button::after { border: 0; }
.home-quick-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16rpx 8rpx; margin-top: 16rpx; }
.home-quick-list--many { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.home-quick-item { min-width: 0; width: 100%; margin: 0; padding: 12rpx 0; background: transparent; text-align: center; line-height: 1.5; }
.home-quick-icon { display: flex; justify-content: center; align-items: center; width: 76rpx; height: 76rpx; margin: 0 auto; border-radius: 24rpx; color: #166c5b; font-size: 34rpx; font-weight: 800; background: #edf5f1; }
.home-quick-title { display: block; margin-top: 12rpx; font-size: 24rpx; color: #514641; white-space: normal; }
.tone-rose { background: #fff0f1; color: #a44e5c; }
.tone-orange { background: #fff1e7; color: #a55a32; }
.tone-green { background: #edf8f2; color: #166c5b; }
.tone-lilac { background: #f5eef7; color: #785784; }
.home-add .home-quick-icon { background: transparent; border: 2rpx dashed #bed3c9; box-sizing: border-box; }
.all-tools-button { margin: 22rpx 0 0; padding: 20rpx 8rpx; background: #f4f7f3; color: #166c5b; border-radius: 16rpx; font-size: 25rpx; line-height: 1.8; }
.home-card-list { display: flex; flex-direction: column; gap: 22rpx; margin-top: 24rpx; }
.home-card { position: relative; overflow: hidden; padding: 30rpx; border-radius: 30rpx; background: #fffcf8; border: 1rpx solid rgba(255,255,255,.72); box-shadow: 0 18rpx 38rpx rgba(31,42,55,.02); box-sizing: border-box; }
.home-card--calendar { background: linear-gradient(135deg, #fff2ed 0%, #ffe3d5 58%, #ffd2bc 100%); }
.home-card--archive { background: linear-gradient(135deg, #f9ebf1 0%, #ebd3e0 54%, #dcb8cc 100%); }
.home-card-head { display: flex; align-items: center; gap: 18rpx; }
.home-card-icon { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border-radius: 20rpx; flex-shrink: 0; }
.home-card--calendar .home-card-icon { background: rgba(229,115,77,.12); }
.home-card--archive .home-card-icon { background: rgba(164,108,139,.1); }
.home-card-icon-text { font-size: 26rpx; font-weight: 900; color: #444; }
.home-card-meta { flex: 1; min-width: 0; }
.home-card-kicker { display: block; font-size: 21rpx; font-weight: 800; }
.home-card--calendar .home-card-kicker { color: #e5734d; }
.home-card--archive .home-card-kicker { color: #a46c8b; }
.home-card-title { display: block; margin-top: 5rpx; font-size: 36rpx; line-height: 1.32; font-weight: 900; color: #444; }
.home-card-action { flex-shrink: 0; padding: 11rpx 20rpx; border-radius: 999rpx; background: rgba(255,255,255,.72); color: #16806a; font-size: 24rpx; font-weight: 800; }
.home-card-desc { display: block; margin-top: 22rpx; font-size: 26rpx; line-height: 1.7; color: #5f6d7c; }
.home-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 24rpx; padding-top: 20rpx; border-top: 1rpx solid rgba(31,42,55,.08); }
.home-card-foot-label { flex-shrink: 0; font-size: 22rpx; color: #7a8592; }
.home-card-foot-value { flex-shrink: 0; font-size: 24rpx; font-weight: 800; }
.home-card--calendar .home-card-foot-value { color: #e5734d; }
.home-card--archive .home-card-foot-value { color: #a46c8b; }
.home-note { display: block; margin-top: 30rpx; text-align: center; color: #766b67; font-size: 23rpx; }
@media (max-width: 350px) { .home-quick-list { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
