<template>
  <view class="favorites-page">
    <SkeletonCard v-if="loading && !favorites.length" v-for="i in 3" :key="i" :rows="2" />

    <view v-if="!loading && !favorites.length" class="empty-state">
      <text class="empty-text">还没有收藏的文章</text>
      <view class="empty-action" @tap="goKnowledge">
        <text>去知识库看看</text>
      </view>
    </view>

    <view
      v-for="item in favorites"
      :key="item.id || item.slug"
      class="fav-card"
      @tap="openArticle(item.slug)"
    >
      <view class="fav-content">
        <text class="fav-title">{{ item.title }}</text>
        <text class="fav-meta">{{ item.sourceLabel || '权威来源' }} · {{ formatTime(item.createdAt) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { userApi } from '@/api/modules'
import SkeletonCard from '@/components/SkeletonCard.vue'
import dayjs from 'dayjs'

interface FavoriteItem {
  id: string
  slug: string
  title: string
  sourceLabel?: string
  createdAt: string
}

const favorites = ref<FavoriteItem[]>([])
const loading = ref(false)

function formatTime(dateStr: string) {
  return dayjs(dateStr).format('MM/DD')
}

async function loadFavorites() {
  loading.value = true
  try {
    const res = await userApi.getFavorites()
    favorites.value = (res as any)?.list || res || []
  } catch (e) {
    console.error('[Favorites] 加载失败:', e)
  } finally {
    loading.value = false
  }
}

function openArticle(slug: string) {
  uni.navigateTo({ url: `/pages/knowledge-detail/index?slug=${encodeURIComponent(slug)}` })
}

function goKnowledge() {
  uni.switchTab({ url: '/pages/knowledge/index' })
}

onShow(() => { loadFavorites() })
</script>

<style scoped>
.favorites-page { min-height: 100vh; background: #f5f7fa; padding: 24rpx; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 120rpx 0; }
.empty-text { font-size: 28rpx; color: #999; margin-bottom: 24rpx; }
.empty-action { background: #16806a; color: #fff; padding: 16rpx 40rpx; border-radius: 24rpx; font-size: 28rpx; }
.fav-card { background: #fffcf8; padding: 24rpx; border-radius: 16rpx; margin-bottom: 16rpx; box-shadow: 0 4rpx 12rpx rgba(31, 42, 55, 0.02); }
.fav-content { display: flex; flex-direction: column; gap: 8rpx; }
.fav-title { font-size: 28rpx; font-weight: 600; color: #444; line-height: 1.5; }
.fav-meta { font-size: 22rpx; color: #999; }
</style>
