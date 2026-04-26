<template>
  <view v-if="visible" class="emergency-banner">
    <view class="emergency-icon">!</view>
    <view class="emergency-text">
      <text class="emergency-title">紧急提醒</text>
      <text class="emergency-desc">{{ message }}</text>
    </view>
    <view class="emergency-action" @tap="onCallTap">
      <text>拨打急救</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  message?: string
}>()

function onCallTap() {
  uni.makePhoneCall({ phoneNumber: '120' })
}
</script>

<style scoped>
.emergency-banner {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  margin: 16rpx 24rpx;
  gap: 16rpx;
}
.emergency-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: bold;
  font-size: 28rpx;
  flex-shrink: 0;
}
.emergency-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.emergency-title {
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
}
.emergency-desc {
  color: rgba(255, 255, 255, 0.9);
  font-size: 24rpx;
  line-height: 1.4;
}
.emergency-action {
  background: #fff;
  color: #ff4d4f;
  font-size: 24rpx;
  font-weight: 600;
  padding: 12rpx 24rpx;
  border-radius: 24rpx;
  flex-shrink: 0;
}
</style>
