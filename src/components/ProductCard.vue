<script setup lang="ts">
import type { RecommendProduct } from '@/api/types'

defineProps<{
  product: RecommendProduct
}>()

function openLink() {
  uni.showToast({ title: '即将跳转商品', icon: 'none' })
}
</script>

<template>
  <view class="card" @click="openLink">
    <image class="img" :src="product.image" mode="aspectFill" />
    <view class="info">
      <view class="title">{{ product.title }}</view>
      <view class="subtitle">{{ product.subtitle }}</view>
      <view class="reason">👉 {{ product.reason }}</view>
      <view class="price-row">
        <text class="price">¥{{ product.price }}</text>
        <text v-if="product.originalPrice" class="original">¥{{ product.originalPrice }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.card {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
  display: flex;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}
.img {
  width: 200rpx;
  height: 200rpx;
  flex-shrink: 0;
  background: #f5f5f5;
}
.info {
  flex: 1;
  padding: 20rpx 24rpx;
  min-width: 0;
}
.title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 6rpx;
}
.subtitle {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 8rpx;
}
.reason {
  font-size: 24rpx;
  color: #5b9cff;
  margin-bottom: 12rpx;
}
.price-row {
  .price { font-size: 32rpx; color: #ff6b9d; font-weight: 600; margin-right: 12rpx; }
  .original { font-size: 24rpx; color: #999; text-decoration: line-through; }
}
</style>
