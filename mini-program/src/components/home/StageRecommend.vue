<template>
  <view class="stage-recommend-card">
    <view class="section-head">
      <view>
        <text class="section-title">{{ title }}</text>
        <text class="section-caption section-caption--block">{{ caption }}</text>
      </view>
      <view class="stage-recommend-badge">
        <text class="stage-recommend-badge-text">{{ badge }}</text>
      </view>
    </view>

    <view class="stage-topic-grid">
      <view
        v-for="item in items"
        :key="item.key"
        class="stage-topic-card"
        @tap="$emit('openRecommendation', item)"
      >
        <text class="stage-topic-title">{{ item.title }}</text>
        <text class="stage-topic-desc">{{ item.desc }}</text>
        <text class="stage-topic-action">去知识库筛选</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { StageRecommendationItem } from '@/utils/home-helpers'

defineProps<{
  title: string
  caption: string
  badge: string
  items: StageRecommendationItem[]
}>()

defineEmits<{
  openRecommendation: [item: StageRecommendationItem]
}>()
</script>

<style scoped>
.stage-recommend-card { margin-top: 22rpx; padding: 30rpx; border-radius: 30rpx; background: rgba(255, 255, 255, 0.86); box-shadow: 0 14rpx 34rpx rgba(31, 42, 55, 0.05); }
.section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 18rpx; }
.section-title { font-size: 32rpx; font-weight: 800; color: #24303d; }
.section-caption--block { display: block; margin-top: 6rpx; font-size: 22rpx; color: #8a96a3; }
.stage-recommend-badge { flex-shrink: 0; padding: 10rpx 18rpx; border-radius: 999rpx; background: rgba(47, 124, 246, 0.1); }
.stage-recommend-badge-text { font-size: 22rpx; font-weight: 700; color: #326ac8; }
.stage-topic-grid { display: grid; gap: 16rpx; margin-top: 20rpx; }
.stage-topic-card { padding: 24rpx; border-radius: 24rpx; background: linear-gradient(145deg, #eef5ff 0%, #f9fbff 100%); }
.stage-topic-title { display: block; font-size: 28rpx; line-height: 1.5; font-weight: 700; color: #24303d; }
.stage-topic-desc { display: block; margin-top: 10rpx; font-size: 23rpx; line-height: 1.65; color: #667486; }
.stage-topic-action { display: block; margin-top: 14rpx; font-size: 22rpx; font-weight: 700; color: #326ac8; }
</style>
