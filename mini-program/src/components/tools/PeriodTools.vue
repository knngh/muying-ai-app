<template>
  <view v-if="suggestions.length" class="period-tools">
    <view class="period-tools-head">
      <view><text class="period-tools-kicker">{{ toolPeriodLabel(period) }}</text><text class="period-tools-title">这周用得上</text></view>
      <button class="period-all" @tap="openAll">全部工具 ›</button>
    </view>
    <button v-for="item in suggestions" :key="item.id" class="period-tool" :aria-label="`打开${item.tool.title}`" @tap="emit('open', item.id)">
      <view class="period-icon" :class="`tone-${item.tool.tone}`"><ToolIcon :id="item.id" /></view>
      <view class="period-copy"><text class="period-name">{{ item.tool.title }}</text><text class="period-reason">{{ item.reason }}</text></view>
      <text class="period-arrow">›</text>
    </button>
    <text class="period-note">按浏览周数展示工具，记录按实际日期保存。</text>
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { getToolDefinition, type ToolId } from '@/data/tool-catalog'
import { periodTools, toolPeriodLabel, type ToolPeriod } from '@/utils/tool-period'
import ToolIcon from './ToolIcon.vue'
const props = defineProps<{ period: ToolPeriod }>()
const emit = defineEmits<{ open: [id: ToolId] }>()
const suggestions = computed(() => periodTools(props.period).map(item => ({ ...item, tool: getToolDefinition(item.id) })))
function openAll() { uni.switchTab({ url: '/pages/tools/index' }) }
</script>
<style scoped>
.period-tools { padding: 24rpx; margin-bottom: 24rpx; border-radius: 24rpx; background: #fffcf8; border: 1rpx solid #e9e8de; }
.period-tools-head { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; margin-bottom: 8rpx; }
.period-tools-kicker { display: block; color: #166c5b; font-size: 22rpx; }
.period-tools-title { display: block; color: #443c3a; margin-top: 8rpx; font-size: 32rpx; font-weight: 700; }
.period-all { margin: 0; padding: 20rpx 0 20rpx 16rpx; min-height: 88rpx; font-size: 24rpx; line-height: 1.8; color: #166c5b; background: transparent; flex-shrink: 0; }
button::after { border: 0; }
.period-tool { display: flex; align-items: center; gap: 20rpx; width: 100%; padding: 22rpx 0; margin: 0; border-radius: 0; border-bottom: 1rpx solid #eee7e1; background: transparent; text-align: left; line-height: 1.5; }
.period-icon { display: flex; justify-content: center; align-items: center; width: 72rpx; height: 72rpx; border-radius: 20rpx; flex-shrink: 0; }
.tone-rose { background: #fff0f1; }.tone-orange { background: #fff1e7; }.tone-green { background: #edf8f2; }.tone-lilac { background: #f5eef7; }
.period-copy { flex: 1; min-width: 0; }.period-name { display: block; color: #443c3a; font-size: 28rpx; font-weight: 600; }
.period-reason { display: block; margin-top: 6rpx; color: #766b67; font-size: 24rpx; }
.period-arrow { color: #928179; font-size: 32rpx; }.period-note { display: block; margin-top: 18rpx; color: #766b67; font-size: 22rpx; line-height: 1.6; }
</style>
