<template>
  <view class="paused-page"><view class="paused-mark">贝</view><text class="paused-title">资料库暂时下线</text><text class="paused-copy">你可以继续使用孕育日历和记录工具。</text><button class="paused-action" @tap="openTools">前往工具箱</button></view>
</template>
<script setup lang="ts">
function openTools() { uni.switchTab({ url: '/pages/tools/index' }) }
</script>
<style scoped>
.paused-page { min-height: 100vh; padding: 140rpx 40rpx; background: #fcf9f8; text-align: center; box-sizing: border-box; }
.paused-mark { width: 100rpx; height: 100rpx; line-height: 100rpx; margin: 0 auto 28rpx; border-radius: 28rpx; background: #edf5f1; color: #16806a; font-size: 40rpx; }
.paused-title { display: block; font-size: 36rpx; font-weight: 800; color: #4a4240; }
.paused-copy { display: block; margin-top: 20rpx; font-size: 27rpx; color: #766b67; }
.paused-action { margin-top: 40rpx; padding: 20rpx; border-radius: 18rpx; background: #16806a; color: #fff; font-size: 28rpx; }
.paused-action::after { border: 0; }
</style>
