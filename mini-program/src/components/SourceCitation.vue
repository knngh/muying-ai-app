<template>
  <view v-if="sources.length" class="source-citation">
    <text class="source-label">参考来源</text>
    <view
      v-for="(source, index) in sources"
      :key="index"
      class="source-item"
      @tap="onSourceTap(source)"
    >
      <view class="source-badge" :class="{ authoritative: source.authoritative }">
        {{ source.authoritative ? '权威' : '参考' }}
      </view>
      <view class="source-info">
        <text class="source-title">{{ source.title }}</text>
        <text v-if="source.sourceOrg" class="source-org">{{ source.sourceOrg }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { SourceReference } from '@/api/ai'

defineProps<{
  sources: SourceReference[]
}>()

function onSourceTap(source: SourceReference) {
  if (source.url) {
    uni.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(source.url)}&title=${encodeURIComponent(source.title || '来源原文')}`,
    })
  }
}
</script>

<style scoped>
.source-citation {
  margin-top: 16rpx;
  padding: 16rpx 0;
}
.source-label {
  font-size: 22rpx;
  color: #999;
  margin-bottom: 12rpx;
  display: block;
}
.source-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 16rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  margin-bottom: 8rpx;
}
.source-badge {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: #e8e8e8;
  color: #666;
  flex-shrink: 0;
}
.source-badge.authoritative {
  background: #e6f7e6;
  color: #389e0d;
}
.source-info {
  flex: 1;
  min-width: 0;
}
.source-title {
  font-size: 24rpx;
  color: #444;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-org {
  font-size: 20rpx;
  color: #999;
  display: block;
  margin-top: 4rpx;
}
</style>
