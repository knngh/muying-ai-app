<script setup lang="ts">
import type { CalendarDayItem } from '@/api/types'

defineProps<{
  item: CalendarDayItem
}>()
</script>

<template>
  <view class="card">
    <view class="date">{{ item.date }}</view>
    <view class="title">{{ item.title }}</view>
    <view class="summary">{{ item.summary }}</view>
    <view v-if="item.tip" class="tip">💡 {{ item.tip }}</view>
    <view v-if="item.source" class="source">参考：{{ item.source }}</view>
  </view>
</template>

<style lang="scss" scoped>
.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(255, 107, 157, 0.08);
  .date {
    color: #ff6b9d;
    font-size: 24rpx;
    margin-bottom: 8rpx;
  }
  .title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 12rpx;
  }
  .summary {
    font-size: 28rpx;
    color: #666;
    line-height: 1.5;
    margin-bottom: 12rpx;
  }
  .tip {
    font-size: 24rpx;
    color: #888;
    margin-top: 8rpx;
  }
  .source {
    font-size: 22rpx;
    color: #999;
    margin-top: 8rpx;
  }
}
</style>
