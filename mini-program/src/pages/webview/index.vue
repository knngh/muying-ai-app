<template>
  <view class="webview-page">
    <web-view v-if="url" :src="url" />
    <view v-else class="empty-state">
      <text class="empty-text">来源链接不可用</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const url = ref('')

onLoad((options) => {
  const rawUrl = typeof options?.url === 'string' ? options.url : ''
  url.value = rawUrl ? decodeURIComponent(rawUrl) : ''
})
</script>

<style scoped>
.webview-page {
  height: 100vh;
  background: #fff;
}

.empty-state {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  box-sizing: border-box;
}

.empty-text {
  font-size: 28rpx;
  color: #6b7285;
}
</style>
