<template>
  <view class="hero-section">
    <view class="hero-copy">
      <text class="eyebrow">{{ eyebrow }}</text>
      <text class="hero-title">{{ title }}</text>
      <text class="hero-subtitle">{{ subtitle }}</text>
    </view>

    <view class="hero-badges">
      <view class="hero-badge">
        <text class="hero-badge-label">当前阶段</text>
        <text class="hero-badge-value">{{ stageLabel }}</text>
      </view>
      <view class="hero-badge">
        <text class="hero-badge-label">使用状态</text>
        <text class="hero-badge-value">{{ loginLabel }}</text>
      </view>
    </view>

    <view class="trust-strip">
      <text class="trust-strip-text">先查权威资料，再安排本周重点与记录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  subtitle: string
  stageLabel: string
  loginLabel: string
}>()
</script>

<style scoped>
.hero-section { padding: 116rpx 32rpx 0; }
.hero-copy { padding: 44rpx 36rpx 34rpx; border-radius: 40rpx; background: linear-gradient(145deg, rgba(255, 247, 242, 0.95) 0%, rgba(255, 255, 255, 0.95) 100%); box-shadow: 0 18rpx 46rpx rgba(225, 131, 85, 0.08); }
.eyebrow { display: block; margin-bottom: 16rpx; font-size: 22rpx; font-weight: 700; letter-spacing: 2rpx; color: #b25d35; }
.hero-title { display: block; font-size: 50rpx; line-height: 1.24; font-weight: 800; color: #444; }
.hero-subtitle { display: block; margin-top: 18rpx; font-size: 27rpx; line-height: 1.7; color: #566476; }
.hero-badges { display: flex; gap: 18rpx; margin-top: 24rpx; }
.hero-badge { flex: 1; padding: 24rpx 26rpx; border-radius: 26rpx; background: rgba(255, 255, 255, 0.78); box-shadow: 0 10rpx 28rpx rgba(31, 42, 55, 0.06); }
.hero-badge-label { display: block; font-size: 22rpx; color: #8a96a3; }
.hero-badge-value { display: block; margin-top: 10rpx; font-size: 28rpx; font-weight: 700; color: #27313d; }
.trust-strip { margin-top: 22rpx; padding: 18rpx 24rpx; border-radius: 999rpx; background: rgba(31, 143, 116, 0.1); }
.trust-strip-text { display: block; text-align: center; font-size: 24rpx; color: #16735d; font-weight: 600; }
</style>
