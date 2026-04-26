<template>
  <view class="lazy-image-wrapper" :style="{ width, height }">
    <!-- 占位 -->
    <view v-if="!loaded" class="lazy-placeholder" :style="{ width, height }">
      <view class="lazy-placeholder-icon" />
    </view>

    <!-- 实际图片 -->
    <image
      v-if="shouldLoad"
      class="lazy-image"
      :class="{ 'lazy-loaded': loaded }"
      :src="src"
      :mode="mode"
      :lazy-load="true"
      @load="onLoad"
      @error="onError"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  src: string
  width?: string
  height?: string
  mode?: string
}>(), {
  width: '100%',
  height: '200rpx',
  mode: 'aspectFill',
})

const loaded = ref(false)
const shouldLoad = ref(false)

function onLoad() {
  loaded.value = true
}

function onError() {
  // 加载失败保持占位
}

onMounted(() => {
  // 小程序中使用 IntersectionObserver
  const observer = uni.createIntersectionObserver(undefined as any, {
    thresholds: [0],
  })

  // 在可视区域 200px 范围内开始加载
  observer.relativeToViewport({ bottom: 200 }).observe('.lazy-image-wrapper', (res) => {
    if (res.intersectionRatio > 0) {
      shouldLoad.value = true
      observer.disconnect()
    }
  })
})
</script>

<style scoped>
.lazy-image-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: inherit;
}
.lazy-placeholder {
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lazy-placeholder-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 8rpx;
  background: #e0e0e0;
}
.lazy-image {
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.lazy-image.lazy-loaded {
  opacity: 1;
}
</style>
