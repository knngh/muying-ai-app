<template>
  <view class="calendar-spotlight" @tap="$emit('navigate', '/pages/calendar/index')">
    <view class="calendar-spotlight-copy">
      <text class="calendar-spotlight-kicker">更直接的入口</text>
      <text class="calendar-spotlight-title">{{ title }}</text>
      <text class="calendar-spotlight-desc">{{ desc }}</text>
    </view>
    <view class="calendar-spotlight-side">
      <text class="calendar-spotlight-week">{{ badge }}</text>
      <text class="calendar-spotlight-action">去日历</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  desc: string
  badge: string
}>()

defineEmits<{
  navigate: [url: string]
}>()
</script>

<style scoped>
.calendar-spotlight { margin: 22rpx 32rpx 0; padding: 26rpx 28rpx; border-radius: 30rpx; background: linear-gradient(135deg, #e8a1a6 0%, #d88188 100%); box-shadow: 0 18rpx 38rpx rgba(216, 129, 136, 0.2); display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }
.calendar-spotlight-copy { flex: 1; }
.calendar-spotlight-kicker { display: block; font-size: 22rpx; font-weight: 700; letter-spacing: 2rpx; color: rgba(255, 255, 255, 0.72); }
.calendar-spotlight-title { display: block; margin-top: 10rpx; font-size: 36rpx; line-height: 1.3; font-weight: 800; color: #ffffff; }
.calendar-spotlight-desc { display: block; margin-top: 14rpx; font-size: 24rpx; line-height: 1.65; color: rgba(245, 249, 255, 0.88); }
.calendar-spotlight-side { flex-shrink: 0; min-width: 128rpx; padding: 18rpx 18rpx 16rpx; border-radius: 24rpx; background: rgba(255, 255, 255, 0.16); text-align: center; }
.calendar-spotlight-week { display: block; font-size: 30rpx; font-weight: 800; color: #ffffff; }
.calendar-spotlight-action { display: block; margin-top: 10rpx; font-size: 22rpx; font-weight: 700; color: rgba(255, 255, 255, 0.9); }
</style>
