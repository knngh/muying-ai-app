<template>
  <view class="focus-card">
    <view class="section-head">
      <text class="section-title">本周先做这几件事</text>
      <text class="section-caption">{{ caption }}</text>
    </view>

    <view
      v-for="item in items"
      :key="item.title"
      class="focus-item"
    >
      <view class="focus-index">
        <text class="focus-index-text">{{ item.index }}</text>
      </view>
      <view class="focus-copy">
        <text class="focus-title">{{ item.title }}</text>
        <text class="focus-desc">{{ item.desc }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  caption: string
  items: Array<{ index: string; title: string; desc: string }>
}>()
</script>

<style scoped>
.focus-card { margin-top: 22rpx; padding: 28rpx; border-radius: 26rpx; background: rgba(255, 255, 255, 0.92); border: 1rpx solid rgba(31, 42, 55, 0.06); box-shadow: 0 12rpx 30rpx rgba(31, 42, 55, 0.02); }
.section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 18rpx; }
.section-title { font-size: 31rpx; line-height: 1.35; font-weight: 900; color: #444; }
.section-caption { flex-shrink: 0; font-size: 22rpx; color: #b25d35; }
.focus-item { display: flex; gap: 18rpx; margin-top: 24rpx; }
.focus-index { width: 64rpx; height: 64rpx; border-radius: 20rpx; background: rgba(22, 128, 106, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.focus-index-text { font-size: 24rpx; font-weight: 900; color: #16806a; }
.focus-copy { flex: 1; }
.focus-title { display: block; font-size: 28rpx; font-weight: 800; color: #293542; }
.focus-desc { display: block; margin-top: 10rpx; font-size: 24rpx; line-height: 1.7; color: #6b7787; }
</style>
