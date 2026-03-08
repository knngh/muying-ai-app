<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getRecommendList } from '@/api/recommend'
import type { RecommendProduct } from '@/api/types'
import ProductCard from '@/components/ProductCard.vue'

const list = ref<RecommendProduct[]>([])
const loading = ref(true)

onMounted(async () => {
  list.value = await getRecommendList()
  loading.value = false
})
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">为你推荐</text>
      <text class="subtitle">根据你的阶段与场景推荐，仅供参考</text>
    </view>
    <view v-if="loading" class="loading">加载中...</view>
    <view v-else class="list">
      <ProductCard v-for="p in list" :key="p.id" :product="p" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f8f8f8;
  padding: 24rpx 24rpx 120rpx;
}
.header {
  margin-bottom: 24rpx;
  .title {
    display: block;
    font-size: 36rpx;
    font-weight: 700;
    color: #333;
  }
  .subtitle {
    font-size: 24rpx;
    color: #999;
  }
}
.loading {
  text-align: center;
  padding: 60rpx;
  color: #999;
}
.list {
  padding-bottom: 40rpx;
}
</style>
