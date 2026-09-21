<template>
  <view class="tools-page">
    <view class="tools-heading"><text class="page-title">全部工具</text><text class="stage-label">{{ stageLabel }}</text></view>
    <text class="page-subtitle">找到要用的工具，添加到首页更顺手。</text>
    <view class="search-box">
      <text class="search-label">搜索</text>
      <input v-model="query" class="search-input" placeholder="试试喂奶、胎动、报告…" confirm-type="search" maxlength="60" aria-label="搜索工具名称或用途" />
      <button v-if="query" class="text-button" @tap="query = ''">清除</button>
    </view>
    <view class="home-summary">
      <view class="summary-head"><text class="summary-title">首页工具 · {{ homeIds.length }}/{{ MAX_HOME_TOOLS }}</text><button class="text-button" @tap="editing = !editing">{{ editing ? '完成' : '管理排序' }}</button></view>
      <text v-if="!editing" class="summary-hint">{{ homeIds.length ? homeIds.map(id => getToolDefinition(id).title).join(' · ') : '点击下方“添加首页”选择常用工具' }}</text>
      <HomeToolEditor v-if="editing" :ids="homeIds" :stage="stage" @change="updateHome" />
    </view>
    <scroll-view class="filter-scroll" scroll-x>
      <view class="filter-list">
        <button v-for="group in filters" :key="group.id" class="filter-button" :class="{ active: selectedGroup === group.id }" @tap="selectedGroup = group.id">{{ group.title }}</button>
      </view>
    </scroll-view>
    <text v-if="query.trim()" class="results-label">找到 {{ results.length }} 项工具</text>
    <view v-if="!results.length" class="empty-card"><text class="empty-title">没有找到匹配工具</text><text class="summary-hint">试试更短的名称，或切回“全部”。</text><button class="text-button" @tap="query = ''; selectedGroup = 'all'">查看全部工具</button></view>
    <view v-for="group in visibleGroups" :key="group.id" class="tool-group">
      <text class="group-title">{{ group.title }} <text class="group-count">{{ group.tools.length }}</text></text>
      <view class="tool-list">
        <view v-for="tool in group.tools" :key="tool.id" class="tool-row">
          <button class="open-tool" :aria-label="`打开${tool.title}`" @tap="openTool(tool.id)">
            <view class="tool-icon" :class="getToneClass(tool.tone)"><text>{{ tool.icon }}</text></view>
            <view class="tool-copy"><text class="tool-title">{{ tool.title }}</text><text class="tool-description">{{ tool.description }}</text><text v-if="tool.status !== 'ready'" class="tool-status">基础版 · 持续完善</text></view>
            <text class="tool-arrow">›</text>
          </button>
          <button class="pin-button" :class="{ pinned: homeIds.includes(tool.id) }" :aria-label="`${homeIds.includes(tool.id) ? '从首页移除' : '添加到首页'}${tool.title}`" @tap="toggleHome(tool.id)">{{ homeIds.includes(tool.id) ? '已添加 ✓' : '添加首页' }}</button>
        </view>
      </view>
    </view>
    <text class="tools-note">工具仅作记录与整理，医疗安排请遵医嘱。</text>
  </view>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { calculatePregnancyWeekFromDueDate } from '@/utils'
import { getStageLabel, getToolDefinition, getToolStage, getToneClass, TOOL_GROUPS, type ToolGroup, type ToolId } from '@/data/tool-catalog'
import { findTools, MAX_HOME_TOOLS, openToolPage, readHomeTools, recommendedHomeTools, saveHomeTools } from '@/utils/home-tools'
import HomeToolEditor from '@/components/tools/HomeToolEditor.vue'
import { trackMiniEvent } from '@/utils/analytics'
const appStore = useAppStore()
const storedWeek = ref<number | null>(null), query = ref(''), editing = ref(false)
const selectedGroup = ref<ToolGroup | 'all'>('all'), customIds = ref<ToolId[] | null>(readHomeTools())
const currentWeek = computed(() => appStore.user?.dueDate ? calculatePregnancyWeekFromDueDate(appStore.user.dueDate) : storedWeek.value)
const stage = computed(() => getToolStage(currentWeek.value, appStore.user?.babyBirthday))
const stageLabel = computed(() => getStageLabel(stage.value))
const homeIds = computed(() => customIds.value ?? recommendedHomeTools(stage.value))
const filters: { id: ToolGroup | 'all'; title: string }[] = [{ id: 'all', title: '全部' }, ...TOOL_GROUPS]
const results = computed(() => findTools(query.value, selectedGroup.value))
const visibleGroups = computed(() => TOOL_GROUPS.map(group => ({ ...group, tools: results.value.filter(tool => tool.group === group.id) })).filter(group => group.tools.length))
function updateHome(ids: ToolId[]) {
  try { saveHomeTools(ids); customIds.value = [...ids] }
  catch { uni.showToast({ title: '未能保存设置，请重试', icon: 'none' }) }
}
function toggleHome(id: ToolId) {
  const exists = homeIds.value.includes(id)
  if (!exists && homeIds.value.length >= MAX_HOME_TOOLS) { editing.value = true; uni.showToast({ title: '首页已满，可先移除一项', icon: 'none' }); uni.pageScrollTo({ scrollTop: 0, duration: 200 }); return }
  updateHome(exists ? homeIds.value.filter(item => item !== id) : [...homeIds.value, id])
}
function openTool(id: ToolId) { trackMiniEvent('app_tool_open', { page: 'Tools', properties: { toolId: id, stage: stage.value } }); openToolPage(id) }
onShow(() => {
  const week = Number(uni.getStorageSync('userPregnancyWeek'))
  storedWeek.value = Number.isInteger(week) && week >= 1 && week <= 40 ? week : null
  customIds.value = readHomeTools()
  if (uni.getStorageSync('token') && !appStore.user) void appStore.fetchUser()
})
</script>
<style scoped>
.tools-page { min-height: 100vh; padding: 32rpx 28rpx 64rpx; background: #fcf9f8; box-sizing: border-box; }
.tools-heading, .summary-head { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; }
.page-title { color: #443c3a; font-size: 44rpx; font-weight: 900; }
.stage-label { color: #9d535e; background: #fff0f1; padding: 10rpx 16rpx; border-radius: 16rpx; font-size: 23rpx; }
.page-subtitle { display: block; margin-top: 12rpx; color: #766b67; font-size: 26rpx; }
.search-box { display: flex; align-items: center; gap: 18rpx; min-height: 96rpx; margin-top: 26rpx; padding: 0 22rpx; border: 1rpx solid #e4ddd7; border-radius: 20rpx; background: #fffdfb; }
.search-label { color: #166c5b; font-size: 25rpx; font-weight: 700; }
.search-input { flex: 1; min-width: 0; font-size: 27rpx; color: #443c3a; height: 88rpx; }
.text-button { margin: 0; padding: 20rpx 8rpx; min-height: 88rpx; font-size: 25rpx; line-height: 1.8; color: #166c5b; background: transparent; flex-shrink: 0; }
button::after { border: 0; }
.home-summary { margin-top: 22rpx; padding: 10rpx 22rpx 22rpx; border-radius: 24rpx; background: #edf5f1; }
.summary-title { color: #34584d; font-size: 28rpx; font-weight: 800; }
.summary-hint { display: block; color: #5f6e67; font-size: 24rpx; line-height: 1.65; }
.filter-scroll { margin: 26rpx 0 12rpx; white-space: nowrap; }
.filter-list { display: flex; width: max-content; gap: 12rpx; }
.filter-button { margin: 0; padding: 20rpx 22rpx; min-height: 88rpx; border-radius: 18rpx; color: #766b67; background: #f2ede9; font-size: 25rpx; line-height: 1.8; }
.filter-button.active { color: #fff; background: #16806a; }
.group-title { display: block; padding: 22rpx 4rpx 16rpx; color: #514641; font-size: 30rpx; font-weight: 800; }
.group-count, .results-label { color: #786e68; font-size: 24rpx; font-weight: 400; margin-left: 8rpx; }
.tool-list { background: #fffdfb; border-radius: 24rpx; padding: 0 18rpx; box-shadow: 0 8rpx 22rpx rgba(58,48,44,.035); }
.tool-row { display: flex; align-items: center; gap: 6rpx; border-bottom: 1rpx solid #eee7e1; }
.tool-row:last-child { border-bottom: 0; }
.open-tool { flex: 1; min-width: 0; display: flex; align-items: center; gap: 16rpx; margin: 0; padding: 24rpx 0; background: transparent; text-align: left; line-height: 1.5; }
.tool-icon { flex-shrink: 0; width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; font-size: 27rpx; font-weight: 800; }
.tool-tone--rose { background: #fff0f1; color: #a44e5c; }
.tool-tone--orange { background: #fff1e7; color: #a55a32; }
.tool-tone--green { background: #edf8f2; color: #166c5b; }
.tool-tone--lilac { background: #f5eef7; color: #785784; }
.tool-copy { flex: 1; min-width: 0; }
.tool-title { display: block; color: #443c3a; font-size: 28rpx; font-weight: 800; }
.tool-description { display: block; color: #786e68; font-size: 23rpx; margin-top: 6rpx; }
.tool-status { display: block; color: #876549; font-size: 20rpx; margin-top: 6rpx; }
.tool-arrow { color: #968780; font-size: 32rpx; }
.pin-button { width: 130rpx; padding: 22rpx 8rpx; margin: 0; min-height: 88rpx; border-radius: 16rpx; background: #edf5f1; color: #166c5b; font-size: 23rpx; line-height: 1.8; flex-shrink: 0; }
.pin-button.pinned { color: #74685f; background: #f6f1ed; }
.empty-card { padding: 44rpx 24rpx; text-align: center; background: #fffdfb; border-radius: 24rpx; }
.empty-title { display: block; font-size: 30rpx; color: #514641; margin-bottom: 16rpx; }
.tools-note { display: block; margin-top: 30rpx; color: #786e68; text-align: center; font-size: 23rpx; }
</style>
