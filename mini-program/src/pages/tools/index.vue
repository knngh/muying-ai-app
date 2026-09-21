<template>
  <view class="tools-page">
    <view class="tools-hero">
      <view class="hero-topline">
        <text class="hero-eyebrow">贝护 · 工具箱</text>
        <text class="hero-state">{{ stageLabel }}</text>
      </view>
      <text class="hero-title">把每天要做的事，放在顺手的位置</text>
      <text class="hero-subtitle">记录、回看、提醒和分享各自清楚；需要 AI 时，只整理成你可以核对的草稿。</text>
      <view class="hero-summary">
        <view class="hero-summary-item">
          <text class="hero-summary-value">{{ quickTools.length }}</text>
          <text class="hero-summary-label">今日快捷</text>
        </view>
        <view class="hero-summary-divider"></view>
        <view class="hero-summary-item">
          <text class="hero-summary-value">{{ localRecordCount }}</text>
          <text class="hero-summary-label">本机记录</text>
        </view>
        <view class="hero-summary-divider"></view>
        <view class="hero-summary-item">
          <text class="hero-summary-value">15</text>
          <text class="hero-summary-label">工具总数</text>
        </view>
      </view>
    </view>

    <view class="section-head">
      <view>
        <text class="section-title">今日快捷工具</text>
        <text class="section-subtitle">按当前阶段优先显示，最多四项</text>
      </view>
      <text class="section-link" @tap="scrollToAll">全部工具</text>
    </view>

    <view class="quick-grid">
      <view
        v-for="tool in quickTools"
        :key="tool.id"
        class="quick-card"
        :class="getToneClass(tool.tone)"
        @tap="openTool(tool.id)"
      >
        <view class="quick-icon"><text>{{ tool.icon }}</text></view>
        <text class="quick-kicker">{{ tool.kicker }}</text>
        <text class="quick-title">{{ tool.title }}</text>
        <text class="quick-action">{{ tool.primaryAction }} ›</text>
      </view>
    </view>

    <view v-if="recentRecords.length" class="recent-card">
      <view class="section-head section-head--compact">
        <view>
          <text class="section-title">最近记录</text>
          <text class="section-subtitle">保存在本机，登录后再决定是否同步</text>
        </view>
      </view>
      <view v-for="record in recentRecords" :key="record.id" class="recent-row" @tap="openTool(record.toolId)">
        <view class="recent-icon" :class="getToneClass(getTool(record.toolId).tone)"><text>{{ getTool(record.toolId).icon }}</text></view>
        <view class="recent-copy">
          <text class="recent-title">{{ getTool(record.toolId).title }}</text>
          <text class="recent-meta">{{ recordSummary(record) }} · {{ formatTime(record.createdAt) }}</text>
        </view>
        <text class="recent-arrow">›</text>
      </view>
    </view>

    <view id="all-tools" class="all-tools-anchor"></view>
    <view v-for="group in groupedTools" :key="group.id" class="tool-group">
      <view class="section-head section-head--group">
        <view>
          <text class="section-title">{{ group.title }}</text>
          <text class="section-subtitle">{{ group.description }}</text>
        </view>
      </view>
      <view class="tool-list">
        <view
          v-for="tool in group.tools"
          :key="tool.id"
          class="tool-row"
          :class="getToneClass(tool.tone)"
          @tap="openTool(tool.id)"
        >
          <view class="tool-row-icon"><text>{{ tool.icon }}</text></view>
          <view class="tool-row-copy">
            <view class="tool-row-title-line">
              <text class="tool-row-title">{{ tool.title }}</text>
              <text class="tool-status" :class="`tool-status--${tool.status}`">{{ statusLabel(tool.status) }}</text>
            </view>
            <text class="tool-row-kicker">{{ tool.kicker }}</text>
            <text class="tool-row-description">{{ tool.description }}</text>
          </view>
          <text class="tool-row-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="tools-footnote">
      <text class="footnote-title">记录先由你确认</text>
      <text class="footnote-text">计时、金额、日期、曲线和报表由程序计算。Jev 只从已有候选中整理，不会替你做医学判断。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { calculatePregnancyWeekFromDueDate } from '@/utils'
import {
  getStageLabel,
  getToolDefinition,
  getToolStage,
  getToneClass,
  TOOL_DEFINITIONS,
  TOOL_GROUPS,
  type ToolGroup,
  type ToolId,
  type ToolStatus,
} from '@/data/tool-catalog'
import { readToolRecords, type LocalToolRecord } from '@/utils/tool-records'

const appStore = useAppStore()
const storedWeek = ref<number | null>(null)
const records = ref<LocalToolRecord[]>([])

const syncPage = () => {
  const value = Number.parseInt(String(uni.getStorageSync('userPregnancyWeek') || ''), 10)
  storedWeek.value = Number.isFinite(value) && value >= 1 && value <= 40 ? value : null
  records.value = readToolRecords()
}

syncPage()
onShow(() => {
  syncPage()
  if (uni.getStorageSync('token') && !appStore.user) void appStore.fetchUser()
})

const currentWeek = computed(() => {
  if (appStore.user?.dueDate) return calculatePregnancyWeekFromDueDate(appStore.user.dueDate)
  return storedWeek.value
})
const stage = computed(() => getToolStage(currentWeek.value, appStore.user?.babyBirthday))
const stageLabel = computed(() => getStageLabel(stage.value))

const quickToolIds: Record<typeof stage.value, ToolId[]> = {
  preparing: ['calendar', 'diary', 'expenses', 'names'],
  early: ['calendar', 'diary', 'reports', 'weight'],
  middle: ['movement', 'weight', 'calendar', 'packing'],
  late: ['contractions', 'movement', 'packing', 'calendar'],
  newborn: ['care', 'diary', 'growth', 'vaccines'],
  feeding: ['care', 'foods', 'growth', 'vaccines'],
}

const quickTools = computed(() => quickToolIds[stage.value].map(id => getToolDefinition(id)))
const groupedTools = computed(() => TOOL_GROUPS.map(group => ({
  ...group,
  tools: TOOL_DEFINITIONS.filter(tool => tool.group === group.id),
})))
const localRecordCount = computed(() => records.value.length)
const recentRecords = computed(() => records.value.slice(0, 3))

const getTool = (id: ToolId) => getToolDefinition(id)
const statusLabel = (status: ToolStatus) => ({ ready: '已上线', preview: '预览', planned: '逐步开放' }[status])
const recordSummary = (record: LocalToolRecord) => {
  const payload = record.payload
  if (typeof payload.summary === 'string' && payload.summary) return payload.summary
  if (typeof payload.value === 'string' && payload.value) return payload.value
  if (typeof payload.amount === 'number') return `${payload.amount} 元`
  return '已保存一条记录'
}
const formatTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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

const scrollToAll = () => {
  uni.pageScrollTo({ selector: '#all-tools', duration: 260 })
}
</script>

<style scoped>
.tools-page { min-height: 100vh; padding: 42rpx 28rpx 64rpx; background: linear-gradient(180deg, #fff6f2 0%, #fcf9f8 36%, #fbfaf8 100%); box-sizing: border-box; }
.tools-hero { padding: 12rpx 4rpx 34rpx; }
.hero-topline, .section-head, .tool-row-title-line, .recent-row { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.hero-eyebrow { color: #d88188; font-size: 24rpx; font-weight: 800; }
.hero-state { padding: 10rpx 18rpx; border-radius: 999rpx; background: rgba(216, 129, 136, .12); color: #c56d77; font-size: 22rpx; font-weight: 800; }
.hero-title { display: block; margin-top: 22rpx; color: #443c3a; font-size: 46rpx; line-height: 1.35; font-weight: 900; }
.hero-subtitle { display: block; margin-top: 16rpx; color: #756b69; font-size: 26rpx; line-height: 1.7; }
.hero-summary { display: flex; align-items: center; margin-top: 28rpx; padding: 22rpx 18rpx; border-radius: 24rpx; background: rgba(255, 252, 248, .9); border: 1rpx solid rgba(216, 129, 136, .13); }
.hero-summary-item { flex: 1; text-align: center; }
.hero-summary-value { display: block; color: #16806a; font-size: 34rpx; font-weight: 900; }
.hero-summary-label { display: block; margin-top: 6rpx; color: #8a817d; font-size: 21rpx; }
.hero-summary-divider { width: 1rpx; height: 42rpx; background: #eee1dd; }
.section-head { margin: 26rpx 4rpx 16rpx; align-items: end; }
.section-head--compact { margin-top: 0; }
.section-head--group { margin-top: 34rpx; }
.section-title { display: block; color: #4a4240; font-size: 32rpx; font-weight: 900; }
.section-subtitle { display: block; margin-top: 5rpx; color: #948b88; font-size: 21rpx; line-height: 1.5; }
.section-link { color: #16806a; font-size: 23rpx; font-weight: 800; }
.quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16rpx; }
.quick-card { min-height: 190rpx; padding: 22rpx; border-radius: 26rpx; box-sizing: border-box; box-shadow: 0 12rpx 30rpx rgba(58, 48, 44, .05); }
.tool-tone--rose { background: #fff0f1; color: #b65e68; }
.tool-tone--orange { background: #fff1e7; color: #c36c43; }
.tool-tone--green { background: #edf8f2; color: #16806a; }
.tool-tone--lilac { background: #f5eef7; color: #8c6896; }
.quick-icon, .tool-row-icon, .recent-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 18rpx; font-weight: 900; }
.quick-icon { width: 54rpx; height: 54rpx; background: rgba(255, 255, 255, .68); font-size: 25rpx; }
.quick-kicker { display: block; margin-top: 18rpx; color: currentColor; opacity: .72; font-size: 20rpx; }
.quick-title { display: block; margin-top: 5rpx; color: #4c4542; font-size: 29rpx; font-weight: 900; }
.quick-action { display: block; margin-top: 12rpx; color: currentColor; font-size: 21rpx; font-weight: 800; }
.recent-card { margin-top: 28rpx; padding: 24rpx; border-radius: 28rpx; background: #fffcf8; box-shadow: 0 12rpx 30rpx rgba(58, 48, 44, .04); }
.recent-row { justify-content: flex-start; padding: 18rpx 0; border-top: 1rpx solid #f3ebe7; }
.recent-icon { width: 56rpx; height: 56rpx; font-size: 24rpx; }
.recent-copy { flex: 1; min-width: 0; }
.recent-title { display: block; color: #504744; font-size: 26rpx; font-weight: 800; }
.recent-meta { display: block; margin-top: 6rpx; overflow: hidden; color: #978d88; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }
.recent-arrow, .tool-row-arrow { color: #b5aaa5; font-size: 42rpx; line-height: 1; }
.tool-list { display: flex; flex-direction: column; gap: 12rpx; }
.tool-row { display: flex; align-items: center; gap: 18rpx; padding: 20rpx; border-radius: 24rpx; background: #fffdfb; box-shadow: 0 8rpx 22rpx rgba(58, 48, 44, .035); }
.tool-row-icon { width: 64rpx; height: 64rpx; font-size: 26rpx; }
.tool-row-copy { flex: 1; min-width: 0; }
.tool-row-title { color: #4b4441; font-size: 29rpx; font-weight: 900; }
.tool-row-kicker { display: block; margin-top: 4rpx; color: currentColor; font-size: 20rpx; opacity: .76; }
.tool-row-description { display: block; margin-top: 8rpx; color: #817874; font-size: 23rpx; line-height: 1.5; }
.tool-status { flex-shrink: 0; padding: 5rpx 10rpx; border-radius: 999rpx; font-size: 18rpx; }
.tool-status--ready { color: #16806a; background: #eaf7f1; }
.tool-status--preview { color: #a46b47; background: #fff0e6; }
.tool-status--planned { color: #8b7d77; background: #f5f0ed; }
.tools-footnote { margin-top: 34rpx; padding: 22rpx 24rpx; border-radius: 24rpx; background: #f4f8f6; }
.footnote-title, .footnote-text { display: block; }
.footnote-title { color: #16806a; font-size: 25rpx; font-weight: 800; }
.footnote-text { margin-top: 8rpx; color: #6d7e77; font-size: 22rpx; line-height: 1.6; }
.all-tools-anchor { height: 1rpx; }
</style>
