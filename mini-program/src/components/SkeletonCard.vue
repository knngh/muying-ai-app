<template>
  <view class="skeleton-card">
    <view v-if="avatar" class="skeleton-avatar" />
    <view class="skeleton-lines">
      <view
        v-for="i in rows"
        :key="i"
        class="skeleton-line"
        :style="{ width: i === rows ? '60%' : '100%' }"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  rows?: number
  avatar?: boolean
}>(), {
  rows: 3,
  avatar: false,
})
</script>

<style scoped>
.skeleton-card {
  display: flex;
  gap: 20rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
}
.skeleton-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  flex-shrink: 0;
}
.skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  justify-content: center;
}
.skeleton-line {
  height: 24rpx;
  border-radius: 8rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
