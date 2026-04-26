<template>
  <view v-if="articles.length" class="recent-ai-card">
    <view class="section-head">
      <view>
        <text class="section-title">最近权威线索</text>
        <text class="section-caption section-caption--block">回到最近命中的权威内容继续阅读</text>
      </view>
      <view class="recent-ai-link" @tap="$emit('navigate', '/pages/knowledge/index')">
        <text class="recent-ai-link-text">去知识库</text>
      </view>
    </view>

    <view
      v-for="item in articles"
      :key="item.slug"
      class="recent-ai-item"
      @tap="$emit('openHit', item)"
    >
      <view class="recent-ai-copy">
        <text class="recent-ai-title">{{ item.title }}</text>
        <text class="recent-ai-meta">
          {{ item.sourceLabel }}
          <text v-if="item.topicLabel"> · {{ item.topicLabel }}</text>
          · {{ item.hitLabel }}
        </text>
      </view>
      <text class="recent-ai-action">继续看</text>
    </view>

    <view v-if="topics.length || sources.length" class="recent-ai-chip-panel">
      <view v-if="topics.length" class="recent-ai-chip-row">
        <text class="recent-ai-chip-label">按主题继续</text>
        <view
          v-for="item in topics"
          :key="`topic-${item.displayName}`"
          class="recent-ai-topic-chip"
          @tap="$emit('openTopic', item)"
        >
          <text class="recent-ai-chip-name">{{ item.displayName }}</text>
          <text class="recent-ai-chip-count">{{ item.count }} 次</text>
        </view>
      </view>

      <view v-if="sources.length" class="recent-ai-chip-row">
        <text class="recent-ai-chip-label">按机构继续</text>
        <view
          v-for="item in sources"
          :key="`source-${item.displayName}`"
          class="recent-ai-source-chip"
          @tap="$emit('openSource', item)"
        >
          <text class="recent-ai-chip-name">{{ item.displayName }}</text>
          <text class="recent-ai-chip-count">{{ item.count }} 次</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { HomeRecentAiHitItem, HomeRecentAiTopic, HomeRecentAiSource } from '@/utils/home-helpers'

defineProps<{
  articles: HomeRecentAiHitItem[]
  topics: HomeRecentAiTopic[]
  sources: HomeRecentAiSource[]
}>()

defineEmits<{
  navigate: [url: string]
  openHit: [item: HomeRecentAiHitItem]
  openTopic: [item: HomeRecentAiTopic]
  openSource: [item: HomeRecentAiSource]
}>()
</script>

<style scoped>
.recent-ai-card { margin-top: 22rpx; padding: 30rpx; border-radius: 30rpx; background: rgba(255, 255, 255, 0.86); box-shadow: 0 14rpx 34rpx rgba(31, 42, 55, 0.05); }
.section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 18rpx; }
.section-title { font-size: 32rpx; font-weight: 800; color: #24303d; }
.section-caption--block { display: block; margin-top: 6rpx; font-size: 22rpx; color: #8a96a3; }
.recent-ai-link { flex-shrink: 0; padding: 10rpx 18rpx; border-radius: 999rpx; background: rgba(31, 143, 116, 0.1); }
.recent-ai-link-text { font-size: 22rpx; font-weight: 700; color: #16735d; }
.recent-ai-item { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 22rpx; padding: 22rpx 24rpx; border-radius: 24rpx; background: linear-gradient(145deg, #fff7f0 0%, #fffcf8 100%); }
.recent-ai-copy { flex: 1; }
.recent-ai-title { display: block; font-size: 28rpx; line-height: 1.55; font-weight: 700; color: #24303d; }
.recent-ai-meta { display: block; margin-top: 10rpx; font-size: 22rpx; line-height: 1.55; color: #7a8697; }
.recent-ai-action { flex-shrink: 0; font-size: 24rpx; font-weight: 700; color: #f36f45; }
.recent-ai-chip-panel { margin-top: 18rpx; padding: 18rpx; border-radius: 24rpx; background: rgba(255, 255, 255, 0.82); }
.recent-ai-chip-row + .recent-ai-chip-row { margin-top: 16rpx; }
.recent-ai-chip-label { display: block; margin-bottom: 12rpx; font-size: 22rpx; font-weight: 700; color: #7a8697; }
.recent-ai-topic-chip, .recent-ai-source-chip { display: inline-flex; align-items: center; gap: 10rpx; margin-right: 12rpx; margin-bottom: 12rpx; padding: 12rpx 18rpx; border-radius: 999rpx; }
.recent-ai-topic-chip { background: rgba(31, 143, 116, 0.1); }
.recent-ai-source-chip { background: rgba(243, 111, 69, 0.1); }
.recent-ai-chip-name { font-size: 23rpx; font-weight: 700; color: #324255; }
.recent-ai-chip-count { font-size: 21rpx; color: #7a8697; }
</style>
