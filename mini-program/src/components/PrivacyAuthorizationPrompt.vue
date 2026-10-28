<template>
  <view v-if="visible" class="privacy-auth-mask" @tap="emit('reject')">
    <view class="privacy-auth-dialog" @tap.stop>
      <text class="privacy-auth-title">使用照片前需要你的同意</text>
      <text class="privacy-auth-desc">{{ description }}</text>
      <text class="privacy-auth-link" @tap="emit('open-contract')">查看微信隐私保护指引</text>
      <view class="privacy-auth-actions">
        <button class="privacy-auth-reject" @tap="emit('reject')">暂不同意</button>
        <button
          id="agree-btn"
          class="privacy-auth-agree"
          open-type="agreePrivacyAuthorization"
          @agreeprivacyauthorization="emit('agree')"
        >同意并继续</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean; description: string }>()
const emit = defineEmits<{
  agree: []
  reject: []
  'open-contract': []
}>()
</script>

<style scoped lang="scss">
.privacy-auth-mask {
  position: fixed;
  z-index: 9999;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  background: rgba(31, 24, 24, 0.52);
}

.privacy-auth-dialog {
  box-sizing: border-box;
  width: 100%;
  max-width: 640rpx;
  padding: 36rpx;
  border-radius: 26rpx;
  background: #fffaf6;
}

.privacy-auth-title,
.privacy-auth-desc,
.privacy-auth-link {
  display: block;
}

.privacy-auth-title { font-size: 32rpx; font-weight: 700; color: #49383a; }
.privacy-auth-desc { margin-top: 20rpx; font-size: 26rpx; line-height: 1.6; color: #725f5e; }
.privacy-auth-link { margin-top: 20rpx; font-size: 25rpx; color: #8e5a5e; }
.privacy-auth-actions { display: flex; gap: 16rpx; margin-top: 32rpx; }
.privacy-auth-actions button { flex: 1; margin: 0; border-radius: 999rpx; font-size: 25rpx; }
.privacy-auth-actions button::after { border: 0; }
.privacy-auth-reject { background: #f0e8e3; color: #725f5e; }
.privacy-auth-agree { background: #a96068; color: #fff; }
</style>
