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
.focus-card { margin-top: 22rpx; padding: 30rpx; border-radius: 30rpx; background: rgba(255, 255, 255, 0.86); box-shadow: 0 14rpx 34rpx rgba(31, 42, 55, 0.05); }
.section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 18rpx; }
.section-title { font-size: 32rpx; font-weight: 800; color: #24303d; }
.section-caption { flex-shrink: 0; font-size: 22rpx; color: #8a96a3; }
.focus-item { display: flex; gap: 18rpx; margin-top: 24rpx; }
.focus-index { width: 64rpx; height: 64rpx; border-radius: 20rpx; background: #f8ede6; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.focus-index-text { font-size: 24rpx; font-weight: 800; color: #b5643f; }
.focus-copy { flex: 1; }
.focus-title { display: block; font-size: 28rpx; font-weight: 700; color: #293542; }
.focus-desc { display: block; margin-top: 10rpx; font-size: 24rpx; line-height: 1.7; color: #6b7787; }
</style>
