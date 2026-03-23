<template>
  <view class="knowledge-page">
    <!-- Search Bar -->
    <view class="search-bar">
      <input
        v-model="searchText"
        class="search-input"
        placeholder="搜索文章..."
        confirm-type="search"
        @confirm="handleSearch"
      />
      <view class="search-btn" @tap="handleSearch">
        <text class="search-btn-text">搜索</text>
      </view>
    </view>

    <!-- Filters -->
    <view class="filters">
      <!-- Category Picker -->
      <picker
        :range="categoryOptions"
        range-key="name"
        @change="onCategoryChange"
      >
        <view class="filter-picker">
          <text class="filter-picker-text">
            {{ selectedCategoryLabel || '全部分类' }}
          </text>
          <text class="picker-arrow">▼</text>
        </view>
      </picker>

      <!-- Stage Picker -->
      <picker
        :range="stageOptions"
        range-key="label"
        @change="onStageChange"
      >
        <view class="filter-picker">
          <text class="filter-picker-text">
            {{ selectedStageLabel || '全部阶段' }}
          </text>
          <text class="picker-arrow">▼</text>
        </view>
      </picker>
    </view>

    <!-- Hot Tags -->
    <scroll-view v-if="tags.length > 0" class="hot-tags" scroll-x>
      <view class="tags-inner">
        <view
          v-for="tag in tags"
          :key="tag.id"
          :class="['tag-item', selectedTag === tag.slug ? 'tag-active' : '']"
          @tap="handleTagTap(tag.slug)"
        >
          <text :class="['tag-text', selectedTag === tag.slug ? 'tag-text-active' : '']">
            {{ tag.name }}
          </text>
        </view>
      </view>
    </scroll-view>

    <!-- Article List -->
    <view class="article-list">
      <view v-if="loading && articles.length === 0" class="loading-state">
        <text class="loading-text">加载中...</text>
      </view>

      <view v-if="!loading && articles.length === 0" class="empty-state">
        <text class="empty-text">暂无文章</text>
      </view>

      <view
        v-for="article in articles"
        :key="article.id"
        class="article-card"
        @tap="goToDetail(article.slug)"
      >
        <image
          v-if="article.coverImage"
          :src="article.coverImage"
          class="article-cover"
          mode="aspectFill"
        />
        <view class="article-body">
          <text class="article-title">{{ article.title }}</text>
          <view class="article-tags-row">
            <text v-if="article.category" class="category-tag">
              {{ article.category.name }}
            </text>
          </view>
          <text v-if="article.summary" class="article-summary">
            {{ article.summary }}
          </text>
          <view class="article-stats">
            <text class="stat-item">👁 {{ article.viewCount || 0 }}</text>
            <text class="stat-item">👍 {{ article.likeCount || 0 }}</text>
            <text class="stat-item">⭐ {{ article.collectCount || 0 }}</text>
          </view>
        </view>
      </view>

      <!-- Load More -->
      <view
        v-if="articles.length > 0 && articles.length < total"
        class="load-more"
        @tap="handleLoadMore"
      >
        <text class="load-more-text">
          {{ loading ? '加载中...' : '加载更多' }}
        </text>
      </view>

      <view v-if="articles.length > 0 && articles.length >= total" class="no-more">
        <text class="no-more-text">— 没有更多了 —</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useKnowledgeStore } from '@/stores/knowledge'

const knowledgeStore = useKnowledgeStore()

const searchText = ref('')
const selectedTag = ref<string | null>(null)
const selectedCategoryIndex = ref(0)
const selectedStageIndex = ref(0)

const stageOptions = [
  { label: '全部阶段', value: '' },
  { label: '备孕期', value: 'preparation' },
  { label: '孕早期 (1-12周)', value: 'first-trimester' },
  { label: '孕中期 (13-27周)', value: 'second-trimester' },
  { label: '孕晚期 (28-40周)', value: 'third-trimester' },
  { label: '0-6月', value: '0-6-months' },
  { label: '6-12月', value: '6-12-months' },
  { label: '1-3岁', value: '1-3-years' },
]

const articles = computed(() => knowledgeStore.articles)
const categories = computed(() => knowledgeStore.categories)
const tags = computed(() => knowledgeStore.tags)
const loading = computed(() => knowledgeStore.loading)
const total = computed(() => knowledgeStore.total)

const categoryOptions = computed(() => {
  return [{ id: 0, name: '全部分类', slug: '' }, ...categories.value]
})

const selectedCategoryLabel = computed(() => {
  const cat = categoryOptions.value[selectedCategoryIndex.value]
  return cat && cat.slug ? cat.name : ''
})

const selectedStageLabel = computed(() => {
  const stage = stageOptions[selectedStageIndex.value]
  return stage && stage.value ? stage.label : ''
})

onMounted(async () => {
  await Promise.all([
    knowledgeStore.fetchCategories(),
    knowledgeStore.fetchTags(),
  ])
  if (!knowledgeStore.selectedStage) {
    knowledgeStore.fetchArticles({ reset: true })
  }
})

onShow(() => {
  if (knowledgeStore.selectedStage) {
    const idx = stageOptions.findIndex(s => s.value === knowledgeStore.selectedStage)
    if (idx >= 0) {
      selectedStageIndex.value = idx
    }
    knowledgeStore.fetchArticles({ reset: true })
  }
})

function handleSearch() {
  const keyword = searchText.value.trim()
  if (keyword) {
    knowledgeStore.search(keyword)
  } else {
    knowledgeStore.setKeyword('')
    knowledgeStore.fetchArticles({ reset: true })
  }
}

function onCategoryChange(e: { detail: { value: number } }) {
  const idx = e.detail.value
  selectedCategoryIndex.value = idx
  const cat = categoryOptions.value[idx]
  knowledgeStore.setCategory(cat.slug || null)
}

function onStageChange(e: { detail: { value: number } }) {
  const idx = e.detail.value
  selectedStageIndex.value = idx
  const stage = stageOptions[idx]
  knowledgeStore.setStage(stage.value || null)
}

function handleTagTap(tagSlug: string) {
  if (selectedTag.value === tagSlug) {
    selectedTag.value = null
    knowledgeStore.setTag(null)
  } else {
    selectedTag.value = tagSlug
    knowledgeStore.setTag(tagSlug)
  }
}

function handleLoadMore() {
  if (loading.value) return
  knowledgeStore.fetchArticles({ page: knowledgeStore.page + 1 })
}

function goToDetail(slug: string) {
  uni.navigateTo({ url: `/pages/knowledge-detail/index?slug=${slug}` })
}
</script>

<style scoped>
.knowledge-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

/* Search Bar */
.search-bar {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  background-color: #ffffff;
}

.search-input {
  flex: 1;
  height: 72rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  background-color: #f5f5f5;
  border-radius: 36rpx;
  box-sizing: border-box;
}

.search-btn {
  margin-left: 16rpx;
  padding: 16rpx 28rpx;
  background-color: #ff6b9d;
  border-radius: 36rpx;
  flex-shrink: 0;
}

.search-btn-text {
  font-size: 26rpx;
  color: #ffffff;
  font-weight: 600;
}

/* Filters */
.filters {
  display: flex;
  padding: 16rpx 24rpx;
  background-color: #ffffff;
  border-bottom: 1rpx solid #f0f0f0;
  gap: 16rpx;
}

.filter-picker {
  display: flex;
  align-items: center;
  padding: 12rpx 20rpx;
  background-color: #f5f5f5;
  border-radius: 24rpx;
}

.filter-picker-text {
  font-size: 24rpx;
  color: #333333;
  margin-right: 8rpx;
}

.picker-arrow {
  font-size: 20rpx;
  color: #999999;
}

/* Hot Tags */
.hot-tags {
  white-space: nowrap;
  background-color: #ffffff;
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
  -webkit-overflow-scrolling: touch;
}

.tags-inner {
  display: flex;
  gap: 12rpx;
}

.tag-item {
  display: inline-flex;
  padding: 10rpx 24rpx;
  background-color: #f5f5f5;
  border-radius: 24rpx;
  flex-shrink: 0;
}

.tag-active {
  background-color: #ff6b9d;
}

.tag-text {
  font-size: 24rpx;
  color: #666666;
  white-space: nowrap;
}

.tag-text-active {
  color: #ffffff;
}

/* Article List */
.article-list {
  padding: 16rpx 24rpx;
}

.article-card {
  background-color: #ffffff;
  border-radius: 20rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.article-cover {
  width: 100%;
  height: 300rpx;
}

.article-body {
  padding: 24rpx;
}

.article-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 12rpx;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 12rpx;
}

.category-tag {
  font-size: 22rpx;
  color: #ff6b9d;
  background-color: rgba(255, 107, 157, 0.1);
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
}

.article-summary {
  font-size: 26rpx;
  color: #666666;
  line-height: 1.6;
  margin-bottom: 16rpx;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-stats {
  display: flex;
  gap: 24rpx;
}

.stat-item {
  font-size: 22rpx;
  color: #999999;
}

/* Load More */
.load-more {
  display: flex;
  justify-content: center;
  padding: 28rpx;
  background-color: #ffffff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
}

.load-more-text {
  font-size: 26rpx;
  color: #ff6b9d;
  font-weight: 500;
}

.no-more {
  text-align: center;
  padding: 28rpx;
}

.no-more-text {
  font-size: 24rpx;
  color: #cccccc;
}

/* States */
.loading-state,
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 120rpx 0;
}

.loading-text,
.empty-text {
  font-size: 28rpx;
  color: #999999;
}
</style>
