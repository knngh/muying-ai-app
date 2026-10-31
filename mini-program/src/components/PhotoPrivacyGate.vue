<template>
  <view v-if="visible" class="privacy-mask" @tap="finish(false)">
    <view class="privacy-dialog" role="dialog" aria-label="照片隐私授权" @tap.stop>
      <text class="privacy-title">使用照片前需要你的同意</text>
      <text class="privacy-desc">只处理你主动选择、拍摄或保存的照片，用于孕育记录。拒绝授权不影响工具和日历使用。</text>
      <button class="privacy-link" @tap="openPolicy">查看隐私指引</button>
      <view class="privacy-actions">
        <button class="privacy-reject" @tap="finish(false)">暂不同意</button>
        <button id="photo-privacy-agree" class="privacy-agree" open-type="agreePrivacyAuthorization" @agreeprivacyauthorization="finish(true)">同意并继续</button>
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { ensurePhotoPrivacy } from '@/utils/photo-privacy'
const visible = ref(false)
let pending: Promise<boolean> | null = null
let resolveConsent: ((value: boolean) => void) | null = null
function finish(authorized: boolean) {
  visible.value = false
  const resolve = resolveConsent
  resolveConsent = null
  resolve?.(authorized)
}
function openPolicy() {
  finish(false)
  uni.navigateTo({ url: '/pages/privacy-policy/index' })
}
function authorize(): Promise<boolean> {
  if (pending) return pending
  pending = ensurePhotoPrivacy(() => new Promise(resolve => {
    resolveConsent = resolve
    visible.value = true
  })).finally(() => { pending = null })
  return pending
}
onHide(() => finish(false))
onBeforeUnmount(() => finish(false))
defineExpose({ authorize })
</script>
<style scoped>
.privacy-mask { position: fixed; inset: 0; z-index: 1500; display: flex; align-items: center; justify-content: center; padding: 40rpx; background: rgba(0,0,0,.5); }
.privacy-dialog { width: 100%; max-width: 620rpx; padding: 40rpx; box-sizing: border-box; border-radius: 24rpx; background: #fff; }
.privacy-title, .privacy-desc { display: block; }
.privacy-title { color: #25313c; font-size: 32rpx; font-weight: 700; }
.privacy-desc { margin-top: 20rpx; color: #647181; font-size: 26rpx; line-height: 1.65; }
.privacy-link { margin: 18rpx 0 0; padding: 8rpx 0; color: #16806a; background: transparent; text-align: left; font-size: 26rpx; }
.privacy-link::after { border: 0; }
.privacy-actions { display: flex; gap: 18rpx; margin-top: 24rpx; }
.privacy-actions button { flex: 1; margin: 0; padding: 18rpx 8rpx; border-radius: 12rpx; font-size: 26rpx; line-height: 1.6; }
.privacy-reject { color: #647181; background: #f3f5f7; }
.privacy-agree { color: #fff; background: #16806a; }
</style>
