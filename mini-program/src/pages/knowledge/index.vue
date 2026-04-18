<template>
  <view class="knowledge-page">
    <view class="hero">
      <text class="hero-title">权威知识库</text>
      <text class="hero-subtitle">优先展示中国政府网、国家卫健委、中国疾控、国家疾控局及 WHO、CDC、AAP、ACOG、NHS 等公开资料，减少经验帖干扰。</text>
      <view class="hero-pills">
        <view class="hero-pill">
          <text class="hero-pill-text">中国权威源优先</text>
        </view>
        <view class="hero-pill">
          <text class="hero-pill-text">国际原文支持中文辅助阅读</text>
        </view>
      </view>
    </view>

    <view class="search-bar">
      <input
        v-model="searchText"
        class="search-input"
        placeholder="搜索孕产、喂养、发热、黄疸、疫苗..."
        confirm-type="search"
        @confirm="handleSearch"
      />
      <view class="search-btn" @tap="handleSearch">
        <text class="search-btn-text">搜索</text>
      </view>
    </view>

    <view class="filter-block">
      <text class="filter-title">机构来源</text>
      <scroll-view class="source-scroll" scroll-x>
        <view class="source-row">
          <view
            v-for="option in sourceOptions"
            :key="option.value"
            :class="['source-chip', selectedSource === option.value ? 'source-chip--active' : '']"
            @tap="handleSourceChange(option.value)"
          >
            <text :class="['source-chip-text', selectedSource === option.value ? 'source-chip-text--active' : '']">
              {{ option.label }}
            </text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="filter-row">
      <picker :range="stageOptions" range-key="label" :value="selectedStageIndex" @change="onStageChange">
        <view class="filter-picker">
          <text class="filter-picker-text">{{ selectedStageLabel }}</text>
          <text class="picker-arrow">▼</text>
        </view>
      </picker>

      <view class="result-pill">
        <text class="result-pill-text">共 {{ total }} 篇 · 中文源优先</text>
      </view>
    </view>

    <view class="article-list">
      <view v-if="loading && articles.length === 0" class="state-box">
        <text class="state-text">权威内容加载中...</text>
      </view>

      <view v-else-if="!loading && articles.length === 0" class="state-box">
        <text class="state-text">当前筛选条件下暂无权威文章</text>
        <view class="state-btn" @tap="resetFilters">
          <text class="state-btn-text">恢复默认筛选</text>
        </view>
      </view>

      <view
        v-for="article in articles"
        :key="article.slug"
        class="article-card"
        @tap="goToDetail(article)"
      >
        <view class="article-header">
          <view class="badge-row">
            <text class="source-badge">{{ formatSourceLabel(article.sourceOrg || article.source || '权威来源') }}</text>
            <text :class="['tier-badge', `tier-badge--${getAuthorityRegionTag(article)}`]">{{ getAuthorityRegionLabel(article) }}</text>
            <text v-if="article.topic" class="topic-badge">{{ article.topic }}</text>
          </view>
          <text class="article-title">{{ article.title }}</text>
        </view>

        <view v-if="getArticleContextLabel(article)" class="article-context-row">
          <text class="article-context-chip">{{ getArticleContextLabel(article) }}</text>
        </view>

        <text v-if="article.summary" class="article-summary">{{ article.summary }}</text>

        <view class="article-meta">
          <text v-if="article.audience" class="meta-item">{{ article.audience }}</text>
          <text v-if="article.region" class="meta-item">{{ article.region }}</text>
          <text class="meta-item">来源更新 {{ formatDate(article.sourceUpdatedAt || article.publishedAt || article.createdAt) }}</text>
        </view>

        <view class="reading-note">
          <text class="reading-note-text">{{ getReadingHint(article) }}</text>
        </view>

        <view class="article-footer">
          <text class="verified-text">已校验来源 · 同步 {{ formatDate(article.lastSyncedAt || article.updatedAt || article.createdAt) }}</text>
          <text class="read-more">查看详情</text>
        </view>
      </view>

      <view
        v-if="articles.length > 0 && articles.length < total"
        class="load-more"
        @tap="handleLoadMore"
      >
        <text class="load-more-text">{{ loading ? '加载中...' : '加载更多' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { useKnowledgeStore } from '@/stores/knowledge'
import type { Article } from '@/api/modules'
import { getAuthorityRegionLabel, getAuthorityRegionTag } from '@/utils/authority-source'

const knowledgeStore = useKnowledgeStore()

const searchText = ref('')
const selectedStageIndex = ref(0)

const sourceOptions = [
  { label: '全部', value: 'all' },
  { label: '中国政府网', value: '中国政府网' },
  { label: '国家卫健委', value: '国家卫生健康委员会' },
  { label: '中国疾控', value: '中国疾病预防控制中心' },
  { label: '国家疾控局', value: '国家疾病预防控制局' },
  { label: 'WHO', value: 'who' },
  { label: 'CDC', value: 'cdc' },
  { label: 'AAP', value: 'aap' },
  { label: 'ACOG', value: 'acog' },
  { label: 'NHS', value: 'nhs' },
  { label: 'Mayo Clinic', value: 'mayo' },
  { label: 'MSD', value: 'msd' },
]

const stageOptions = [
  { label: '全部阶段', value: '' },
  { label: '备孕期', value: 'preparation' },
  { label: '孕早期', value: 'first-trimester' },
  { label: '孕中期', value: 'second-trimester' },
  { label: '孕晚期', value: 'third-trimester' },
  { label: '0-6月', value: '0-6-months' },
  { label: '6-12月', value: '6-12-months' },
  { label: '1-3岁', value: '1-3-years' },
]

const articles = computed(() => knowledgeStore.articles)
const loading = computed(() => knowledgeStore.loading)
const total = computed(() => knowledgeStore.total)
const selectedSource = computed(() => knowledgeStore.selectedSource)
const selectedStageLabel = computed(() => stageOptions[selectedStageIndex.value]?.label || '全部阶段')
const duplicateArticleKeyCounts = computed(() => {
  const counts = new Map<string, number>()
  articles.value.forEach((article) => {
    const key = getArticleDuplicateKey(article)
    if (!key) {
      return
    }
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return counts
})

watch(articles, (list) => {
  if (list.length === 0) {
    return
  }

  void knowledgeStore.prefetchTranslations(list, 6)
}, { immediate: true })

async function loadArticles(reset = true) {
  await knowledgeStore.fetchArticles({ reset, page: reset ? 1 : knowledgeStore.page + 1 })
}

onMounted(async () => {
  await loadArticles(true)
})

onShow(async () => {
  if (articles.value.length === 0) {
    await loadArticles(true)
  }
})

function handleSearch() {
  const keyword = searchText.value.trim()
  knowledgeStore.setKeyword(keyword)
  void knowledgeStore.fetchArticles({ reset: true, page: 1 })
}

function handleSourceChange(source: string) {
  if (selectedSource.value === source) {
    return
  }
  knowledgeStore.setSource(source)
}

function onStageChange(e: { detail: { value: number } }) {
  const idx = e.detail.value
  selectedStageIndex.value = idx
  const stage = stageOptions[idx]
  knowledgeStore.setStage(stage.value || null)
}

function handleLoadMore() {
  if (loading.value || articles.value.length >= total.value) {
    return
  }
  void loadArticles(false)
}

function resetFilters() {
  selectedStageIndex.value = 0
  searchText.value = ''
  knowledgeStore.reset()
  void knowledgeStore.fetchArticles({ reset: true, page: 1 })
}

function goToDetail(article: Article) {
  if (article.sourceLanguage !== 'zh' && article.sourceLocale !== 'zh-CN') {
    void knowledgeStore.prefetchTranslations([article], 1)
  }

  const shouldWarmTranslation = article.sourceLanguage !== 'zh' && article.sourceLocale !== 'zh-CN' ? '1' : '0'
  uni.navigateTo({ url: `/pages/knowledge-detail/index?slug=${article.slug}&translation=${shouldWarmTranslation}` })
}

function getReadingHint(article: Article): string {
  if (article.sourceLanguage === 'zh' || article.sourceLocale === 'zh-CN') {
    return '优先读中文原文与同步时间，适合直接核对政策和指南表述。'
  }

  return '进入详情后会自动准备中文辅助阅读，适合先看摘要再决定是否打开机构原文。'
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatSourceLabel(label?: string): string {
  const value = (label || '').trim()
  if (!value) return '权威来源'

  const lower = value.toLowerCase()
  if (/american academy of pediatrics|healthychildren\.org|\baap\b/.test(lower)) return 'AAP'
  if (/mayo clinic|mayoclinic\.org/.test(lower)) return 'Mayo Clinic'
  if (/msd manuals?|msdmanuals\.cn|merck manual/.test(lower)) return 'MSD Manuals'
  if (/national health service|\bnhs\b|nhs\.uk/.test(lower)) return 'NHS'
  if (/world health organization|\bwho\b|who\.int/.test(lower)) return 'WHO'
  if (/centers? for disease control|\bcdc\b|cdc\.gov/.test(lower)) return 'CDC'
  if (/american college of obstetricians and gynecologists|\bacog\b|acog\.org/.test(lower)) return 'ACOG'
  return value
}

function normalizeArticleKeyPart(value?: string) {
  return (value || '')
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/[，。；：、]/g, ' ')
    .replace(/[|()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getArticleDuplicateKey(article: Article) {
  const sourceKey = normalizeArticleKeyPart(article.sourceOrg || article.source)
  const titleKey = normalizeArticleKeyPart(article.title)
  if (!sourceKey || !titleKey) {
    return ''
  }
  return `${sourceKey}::${titleKey}`
}

function getArticleContextLabel(article: Article) {
  const duplicateKey = getArticleDuplicateKey(article)
  const hasDuplicateTitle = duplicateKey ? (duplicateArticleKeyCounts.value.get(duplicateKey) || 0) > 1 : false
  const parts: string[] = []

  if (article.audience) {
    parts.push(`适用对象：${article.audience}`)
  }

  if (hasDuplicateTitle && article.topic) {
    parts.push(`重点：${article.topic}`)
  }

  if (hasDuplicateTitle && !parts.length) {
    parts.push('同题不同页面，进入前先看适用对象')
  }

  return parts.join(' · ')
}

function buildSharePayload() {
  const keyword = searchText.value.trim()
  const title = keyword
    ? `贝护妈妈权威知识库：${keyword}`
    : '贝护妈妈权威知识库：孕产与婴幼儿权威资料'

  return {
    title,
    path: '/pages/knowledge/index',
    query: keyword ? `keyword=${encodeURIComponent(keyword)}` : '',
  }
}

onShareAppMessage(() => buildSharePayload())

onShareTimeline(() => {
  const payload = buildSharePayload()
  return {
    title: payload.title,
    query: payload.query,
  }
})
</script>

<style scoped>
.knowledge-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #fffaf6 0%, #f7f9fc 28%, #f4f7fb 100%);
  padding-bottom: 40rpx;
}

.hero {
  padding: 48rpx 28rpx 28rpx;
}

.hero-title {
  display: block;
  font-size: 44rpx;
  font-weight: 700;
  color: #1f2a37;
  margin-bottom: 12rpx;
}

.hero-subtitle {
  display: block;
  font-size: 26rpx;
  line-height: 1.6;
  color: #5d6b7b;
}

.hero-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 20rpx;
}

.hero-pill {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(31, 143, 116, 0.08);
}

.hero-pill-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #1c7a63;
}

.search-bar {
  display: flex;
  align-items: center;
  padding: 0 28rpx 24rpx;
}

.search-input {
  flex: 1;
  height: 76rpx;
  padding: 0 24rpx;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 38rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.search-btn {
  margin-left: 16rpx;
  padding: 16rpx 28rpx;
  border-radius: 36rpx;
  background: #f36f45;
}

.search-btn-text {
  font-size: 26rpx;
  color: #fff;
  font-weight: 600;
}

.filter-block {
  padding: 0 28rpx 16rpx;
}

.filter-title {
  display: block;
  font-size: 24rpx;
  color: #7a8697;
  margin-bottom: 14rpx;
}

.source-scroll {
  white-space: nowrap;
}

.source-row {
  display: inline-flex;
  gap: 16rpx;
  padding-right: 28rpx;
}

.source-chip {
  padding: 14rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.9);
}

.source-chip--active {
  background: #1f8f74;
}

.source-chip-text {
  font-size: 24rpx;
  color: #4c5a69;
}

.source-chip-text--active {
  color: #fff;
  font-weight: 600;
}

.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28rpx 20rpx;
}

.filter-picker {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  padding: 16rpx 22rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.9);
}

.filter-picker-text,
.picker-arrow,
.result-pill-text {
  font-size: 24rpx;
  color: #4c5a69;
}

.result-pill {
  padding: 14rpx 20rpx;
  border-radius: 26rpx;
  background: rgba(31, 143, 116, 0.12);
}

.article-list {
  padding: 0 28rpx;
}

.state-box {
  margin-top: 60rpx;
  padding: 60rpx 32rpx;
  text-align: center;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 28rpx;
}

.state-text {
  font-size: 28rpx;
  color: #788595;
}

.state-btn {
  display: inline-flex;
  margin-top: 20rpx;
  padding: 16rpx 30rpx;
  border-radius: 999rpx;
  background: #1f8f74;
}

.state-btn-text {
  font-size: 24rpx;
  font-weight: 700;
  color: #fff;
}

.article-card {
  margin-bottom: 22rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10rpx 30rpx rgba(31, 42, 55, 0.06);
}

.article-header {
  margin-bottom: 14rpx;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.source-badge,
.tier-badge,
.topic-badge {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.source-badge {
  display: block;
  width: 100%;
  box-sizing: border-box;
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
  line-height: 1.45;
  border-radius: 20rpx;
  background: rgba(31, 143, 116, 0.12);
  color: #18755f;
}

.tier-badge--cn {
  background: rgba(41, 121, 255, 0.12);
  color: #285eb7;
}

.tier-badge--global {
  background: rgba(126, 87, 194, 0.1);
  color: #6b4ab1;
}

.topic-badge {
  background: rgba(243, 111, 69, 0.12);
  color: #d35b34;
}

.article-title {
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.5;
  color: #1f2a37;
}

.article-summary {
  display: block;
  font-size: 26rpx;
  line-height: 1.7;
  color: #5d6b7b;
  margin-bottom: 18rpx;
}

.article-context-row {
  margin-bottom: 14rpx;
}

.article-context-chip {
  display: inline-flex;
  max-width: 100%;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(47, 124, 246, 0.08);
  font-size: 22rpx;
  line-height: 1.45;
  color: #326ac8;
  font-weight: 700;
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.reading-note {
  margin-bottom: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 20rpx;
  background: #f7f9fc;
}

.reading-note-text {
  display: block;
  font-size: 23rpx;
  line-height: 1.6;
  color: #657284;
}

.meta-item {
  font-size: 22rpx;
  color: #7a8697;
}

.article-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.verified-text {
  font-size: 22rpx;
  color: #18755f;
}

.read-more {
  font-size: 24rpx;
  color: #f36f45;
  font-weight: 600;
}

.load-more {
  margin-top: 8rpx;
  padding: 24rpx 0 36rpx;
  text-align: center;
}

.load-more-text {
  font-size: 26rpx;
  color: #6d7a8a;
}
</style>
