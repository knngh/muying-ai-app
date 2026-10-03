<template>
  <view v-if="summary.activeCount" class="reminder-summary-card" @tap="$emit('open')">
    <view class="reminder-summary-main">
      <view class="reminder-summary-icon" :class="{ 'reminder-summary-icon--urgent': prompt?.kind === 'due' }">
        <text>{{ prompt?.kind === 'due' ? '！' : '⏰' }}</text>
      </view>
      <view class="reminder-summary-copy">
        <text class="reminder-summary-kicker">{{ prompt ? (prompt.kind === 'due' ? '提醒时间到了' : '24 小时内有安排') : '近期提醒' }}</text>
        <text class="reminder-summary-title">{{ primaryText }}</text>
        <text class="reminder-summary-desc">{{ detailText }}</text>
      </view>
      <text class="reminder-summary-action">查看 ›</text>
    </view>
    <view class="reminder-summary-foot">
      <text>{{ summary.activeCount }} 项待处理</text>
      <text v-if="summary.due.length" class="reminder-summary-due">{{ summary.due.length }} 项已到提醒时间</text>
      <text v-else-if="summary.withinSevenDays.length">{{ summary.withinSevenDays.length }} 项在 7 天内</text>
      <button v-if="prompt" class="reminder-summary-dismiss" @tap.stop="$emit('dismiss')">知道了</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReminderPrompt, ReminderSummary } from '@/utils/reminders'

const props = defineProps<{
  summary: ReminderSummary
  prompt: ReminderPrompt | null
}>()

defineEmits<{
  open: []
  dismiss: []
}>()

const primaryText = computed(() => {
  const first = props.prompt?.items[0] || props.summary.next
  if (!first) return '暂无待处理提醒'
  if (props.prompt && props.prompt.items.length > 1) return `${first.title}等 ${props.prompt.items.length} 项`
  return first.title
})

const detailText = computed(() => {
  const first = props.prompt?.items[0] || props.summary.next
  if (!first) return '进入日历可设置或调整提醒。'
  return `${first.date} ${first.time} · 可加入手机日历，到点由手机系统通知`
})
</script>

<style scoped>
.reminder-summary-card { margin-top: 24rpx; padding: 24rpx 26rpx 20rpx; border-radius: 28rpx; background: #f1f8f4; border: 1rpx solid rgba(22, 128, 106, .08); box-shadow: 0 12rpx 28rpx rgba(22, 128, 106, .06); }
.reminder-summary-main { display: flex; align-items: center; gap: 16rpx; }
.reminder-summary-icon { display: flex; align-items: center; justify-content: center; width: 68rpx; height: 68rpx; flex-shrink: 0; border-radius: 22rpx; background: #dff0e8; color: #166c5b; font-size: 34rpx; font-weight: 900; }
.reminder-summary-icon--urgent { background: #fff0e6; color: #a45232; }
.reminder-summary-copy { min-width: 0; flex: 1; }
.reminder-summary-kicker { display: block; color: #568373; font-size: 21rpx; font-weight: 800; }
.reminder-summary-title { display: block; margin-top: 5rpx; color: #3f4b46; font-size: 28rpx; line-height: 1.4; font-weight: 800; overflow-wrap: anywhere; }
.reminder-summary-desc { display: block; margin-top: 6rpx; color: #74817c; font-size: 22rpx; line-height: 1.5; }
.reminder-summary-action { flex-shrink: 0; color: #166c5b; font-size: 23rpx; font-weight: 800; }
.reminder-summary-foot { display: flex; align-items: center; gap: 18rpx; margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid rgba(22, 128, 106, .1); color: #708078; font-size: 21rpx; }
.reminder-summary-due { color: #a45232; }
.reminder-summary-dismiss { margin: 0 0 0 auto; padding: 0; background: transparent; color: #568373; font-size: 21rpx; line-height: 1.6; }
.reminder-summary-dismiss::after { border: 0; }
</style>
