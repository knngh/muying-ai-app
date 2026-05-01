<template>
  <view class="knowledge-page">
    <view class="hero">
      <text class="hero-title">权威知识库</text>
      <text class="hero-subtitle">优先展示中国政府网、国家卫健委、中国疾控、国家疾控局及 WHO、CDC、AAP、ACOG、NHS 等公开资料。</text>
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

    <view class="stage-guide-panel">
      <view class="section-head">
        <view>
          <text class="section-title">{{ stageGuide.title }}</text>
          <text class="section-caption section-caption--block">{{ stageGuide.caption }}</text>
        </view>
        <text class="stage-guide-badge">{{ stageGuide.badge }}</text>
      </view>
      <view class="stage-guide-grid">
        <view
          v-for="item in stageGuide.items"
          :key="item.key"
          class="stage-guide-card"
          @tap="applyStageGuide(item)"
        >
          <text class="stage-guide-title">{{ item.title }}</text>
          <text class="stage-guide-desc">{{ item.desc }}</text>
          <text class="stage-guide-action">筛选这个方向</text>
        </view>
      </view>
    </view>

    <view class="scenario-panel">
      <view class="section-head">
        <text class="section-title">按场景快速查</text>
        <text class="section-caption">替代泛搜，更容易读到可用内容</text>
      </view>
      <scroll-view class="scenario-scroll" scroll-x>
        <view class="scenario-row">
          <view
            v-for="option in scenarioOptions"
            :key="option.key"
            :class="['scenario-card', activeScenarioKey === option.key ? 'scenario-card--active' : '']"
            @tap="applyScenario(option)"
          >
            <text :class="['scenario-title', activeScenarioKey === option.key ? 'scenario-title--active' : '']">{{ option.label }}</text>
            <text :class="['scenario-desc', activeScenarioKey === option.key ? 'scenario-desc--active' : '']">{{ option.hint }}</text>
          </view>
        </view>
      </scroll-view>
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
        <text class="result-pill-text">{{ resultPillText }}</text>
      </view>
    </view>

    <view v-if="activeFilterText" class="active-filter-card">
      <text class="active-filter-label">当前范围</text>
      <text class="active-filter-text">{{ activeFilterText }}</text>
      <view class="active-filter-clear" @tap="resetFilters">
        <text class="active-filter-clear-text">清空</text>
      </view>
    </view>

    <view class="article-list">
      <view v-if="loading && displayedArticleGroups.length === 0" class="state-box">
        <text class="state-text">权威内容加载中...</text>
      </view>

      <view v-else-if="!loading && displayedArticleGroups.length === 0" class="state-box">
        <text class="state-text">当前筛选条件下暂无权威文章</text>
        <view class="state-btn" @tap="resetFilters">
          <text class="state-btn-text">恢复默认筛选</text>
        </view>
      </view>

      <view
        v-for="group in displayedArticleGroups"
        :key="group.article.slug"
        class="article-card"
        @tap="goToDetail(group.article)"
      >
        <view class="article-header">
          <view class="badge-row">
            <text class="source-badge">{{ formatSourceLabel(group.article.sourceOrg || group.article.source || '权威来源') }}</text>
            <text :class="['tier-badge', `tier-badge--${getAuthorityRegionTag(group.article)}`]">{{ getAuthorityRegionLabel(group.article) }}</text>
            <text v-if="group.article.topic" class="topic-badge">{{ group.article.topic }}</text>
          </view>
          <text class="article-title">{{ getListDisplayTitle(group.article) }}</text>
        </view>

        <view v-if="getArticleContextLabel(group.article)" class="article-context-row">
          <text class="article-context-chip">{{ getArticleContextLabel(group.article) }}</text>
        </view>

        <view class="reading-meta-row">
          <text class="reading-meta-pill">{{ getReadingMeta(group.article).estimatedMinutesLabel }}</text>
          <text class="reading-meta-pill">{{ getReadingMeta(group.article).textLengthLabel }}</text>
          <text class="reading-meta-pill">{{ getReadingMeta(group.article).sectionLabel }}</text>
        </view>

        <text class="article-summary">{{ getListDisplaySummary(group.article) }}</text>

        <view v-if="getRepresentativeReason(group.article, group.variants)" class="representative-reason">
          <text class="representative-reason-badge">{{ getRepresentativeReason(group.article, group.variants)?.badge }}</text>
          <text class="representative-reason-text">{{ getRepresentativeReason(group.article, group.variants)?.description }}</text>
        </view>

        <view v-if="group.mergedCount > 0" class="variant-panel">
          <view class="variant-toggle" @tap.stop="toggleVariantGroup(group.article.slug)">
            <text class="variant-toggle-text">{{ isVariantGroupExpanded(group.article.slug) ? '收起同源版本' : `还有 ${group.mergedCount} 个同源版本` }}</text>
          </view>

          <view v-if="isVariantGroupExpanded(group.article.slug)" class="variant-list">
            <view
              v-if="getVariantRecommendation(group.article, group.variants)"
              class="variant-recommendation"
              @tap.stop="openVariantRecommendation(group.article, group.variants)"
            >
              <view class="variant-recommendation-copy">
                <text class="variant-recommendation-label">{{ getVariantRecommendation(group.article, group.variants)?.actionLabel }}</text>
                <text class="variant-recommendation-text">{{ getVariantRecommendation(group.article, group.variants)?.description }}</text>
              </view>
              <text class="variant-recommendation-action">直接查看</text>
            </view>
            <view v-if="group.variants.length > 1" class="variant-filter-row">
              <view
                v-for="option in variantFilterOptions"
                :key="`${group.article.slug}-${option.value}`"
                :class="['variant-filter-chip', getVariantFilterMode(group.article.slug) === option.value ? 'variant-filter-chip--active' : '']"
                @tap.stop="setVariantFilterMode(group.article.slug, option.value)"
              >
                <text :class="['variant-filter-chip-text', getVariantFilterMode(group.article.slug) === option.value ? 'variant-filter-chip-text--active' : '']">
                  {{ option.label }}
                </text>
              </view>
            </view>
            <view v-if="getFilteredVariants(group.article, group.variants, group.article.slug).length > 1" class="variant-sort-row">
              <view
                v-for="option in variantSortOptions"
                :key="`${group.article.slug}-sort-${option.value}`"
                :class="['variant-sort-chip', getVariantSortMode(group.article.slug) === option.value ? 'variant-sort-chip--active' : '']"
                @tap.stop="setVariantSortMode(group.article.slug, option.value)"
              >
                <text :class="['variant-sort-chip-text', getVariantSortMode(group.article.slug) === option.value ? 'variant-sort-chip-text--active' : '']">
                  {{ option.label }}
                </text>
              </view>
            </view>
            <view v-if="getVariantFilterFeedback(group.article, group.variants, group.article.slug)" class="variant-filter-feedback">
              <text class="variant-filter-feedback-label">{{ getVariantFilterFeedback(group.article, group.variants, group.article.slug)?.label }}</text>
              <text class="variant-filter-feedback-text">{{ getVariantFilterFeedback(group.article, group.variants, group.article.slug)?.description }}</text>
            </view>
            <view class="variant-source-digest">
              <text class="variant-source-digest-label">{{ getVariantSourceDigest(group.article, group.variants, group.article.slug).summaryLabel }}</text>
              <text class="variant-source-digest-text">{{ getVariantSourceDigest(group.article, group.variants, group.article.slug).description }}</text>
            </view>
            <view class="variant-reading-suggestion">
              <text class="variant-reading-suggestion-label">{{ getVariantReadingSuggestion(group.article, group.variants, group.article.slug).label }}</text>
              <text class="variant-reading-suggestion-text">{{ getVariantReadingSuggestion(group.article, group.variants, group.article.slug).description }}</text>
            </view>
            <view
              v-for="variant in getVisibleVariants(group.article, group.variants, group.article.slug)"
              :key="variant.slug"
              class="variant-item"
              @tap.stop="goToDetail(variant)"
            >
              <text class="variant-title">{{ getListDisplayTitle(variant) }}</text>
              <text class="variant-meta">{{ getVariantPreview(variant).sourceLabel }}</text>
              <view class="variant-hint-row">
                <text
                  v-for="badge in getVariantDifference(group.article, variant).badges"
                  :key="`${variant.slug}-hint-${badge}`"
                  class="variant-hint-badge"
                >
                  {{ badge }}
                </text>
              </view>
              <view class="variant-chip-row">
                <text
                  v-for="chip in getVariantPreview(variant).chips"
                  :key="`${variant.slug}-${chip}`"
                  class="variant-chip"
                >
                  {{ chip }}
                </text>
              </view>
            </view>
            <text v-if="!getFilteredVariants(group.article, group.variants, group.article.slug).length" class="variant-empty">
              当前同源版本里没有符合筛选条件的结果。
            </text>
          </view>
        </view>

        <view class="article-meta">
          <text v-if="group.article.audience" class="meta-item">{{ group.article.audience }}</text>
          <text v-if="group.article.region" class="meta-item">{{ group.article.region }}</text>
          <text class="meta-item">来源更新 {{ formatDate(group.article.sourceUpdatedAt || group.article.publishedAt || group.article.createdAt) }}</text>
        </view>

        <view class="reading-note">
          <text class="reading-note-text">{{ getReadingHint(group.article) }}</text>
        </view>

        <view class="article-footer">
          <text class="verified-text">已校验来源 · 同步 {{ formatDate(group.article.lastSyncedAt || group.article.updatedAt || group.article.createdAt) }}</text>
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
import { onReachBottom, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { useKnowledgeStore } from '@/stores/knowledge'
import type { Article } from '@/api/modules'
import { getAuthorityRegionLabel, getAuthorityRegionTag } from '@/utils/authority-source'
import {
  buildKnowledgeSourceDigest,
  buildKnowledgeVariantReadingSuggestion,
  buildKnowledgeVariantFilterFeedback,
  buildKnowledgeVariantRecommendation,
  buildKnowledgeRepresentativeReason,
  buildKnowledgeVariantDifference,
  buildKnowledgeVariantPreview,
  buildKnowledgeReadingMeta,
  filterKnowledgeVariants,
  formatDate,
  formatSourceLabel,
  getKnowledgeDisplaySummary,
  getKnowledgeDisplayTitle,
  getKnowledgeFallbackSummary,
  getKnowledgeStageLabel,
  groupKnowledgeArticles,
  isChineseKnowledgeArticle,
  sortKnowledgeVariants,
} from '@/utils/knowledge-format'

const knowledgeStore = useKnowledgeStore()

interface StageGuideItem {
  key: string
  title: string
  desc: string
  keyword: string
  stage: string | null
}

type VariantFilterMode = 'all' | 'zh' | 'latest'
type VariantSortMode = 'recommended' | 'recent' | 'zhFirst'

const searchText = ref('')
const selectedStageIndex = ref(0)
const activeScenarioKey = ref('')
const expandedVariantGroups = ref<string[]>([])
const variantFilterModes = ref<Record<string, VariantFilterMode>>({})
const variantSortModes = ref<Record<string, VariantSortMode>>({})

const variantFilterOptions = [
  { label: '全部版本', value: 'all' },
  { label: '仅中文源', value: 'zh' },
  { label: '最近版本', value: 'latest' },
] as const

const variantSortOptions = [
  { label: '推荐顺序', value: 'recommended' },
  { label: '最近更新', value: 'recent' },
  { label: '中文优先', value: 'zhFirst' },
] as const

const sourceOptions = [
  { label: '全部', value: 'all' },
  { label: '中国政府网', value: '中国政府网' },
  { label: '国家卫健委', value: '国家卫生健康委员会' },
  { label: '中国疾控', value: '中国疾病预防控制中心' },
  { label: '国家疾控局', value: '国家疾病预防控制局' },
  { label: 'WHO', value: 'who' },
  { label: 'CDC', value: 'cdc' },
  { label: '美国儿科学会', value: 'aap' },
  { label: '美国妇产科医师学会', value: 'acog' },
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
  { label: '产后恢复', value: 'postpartum' },
  { label: '月子/新生儿', value: 'newborn' },
  { label: '0-6月', value: '0-6-months' },
  { label: '6-12月', value: '6-12-months' },
  { label: '1-3岁', value: '1-3-years' },
  { label: '3岁+', value: '3-years-plus' },
]

const scenarioOptions = [
  {
    key: 'early-risk',
    label: '孕早期风险',
    hint: '出血、孕吐、叶酸、初次产检',
    keyword: '孕早期 出血 孕吐 叶酸 产检',
    stage: 'first-trimester',
  },
  {
    key: 'checkup-nutrition',
    label: '产检与营养',
    hint: '孕中晚期产检、体重、饮食',
    keyword: '产检 营养 体重 孕期',
    stage: 'second-trimester',
  },
  {
    key: 'feeding',
    label: '母乳与喂养',
    hint: '母乳、配方奶、辅食开始',
    keyword: '母乳 喂养 辅食',
    stage: '0-6-months',
  },
  {
    key: 'vaccine',
    label: '疫苗与发热',
    hint: '接种、发热、黄疸、就医判断',
    keyword: '疫苗 发热 黄疸 新生儿',
    stage: '0-6-months',
  },
  {
    key: 'development',
    label: '发育与安全',
    hint: '睡眠、发育、意外预防',
    keyword: '发育 睡眠 安全 婴幼儿',
    stage: '6-12-months',
  },
] as const

const articles = computed(() => knowledgeStore.articles)
const displayedArticleGroups = computed(() => groupKnowledgeArticles(articles.value))
const mergedArticleCount = computed(() => displayedArticleGroups.value.reduce((count, group) => count + group.mergedCount, 0))
const loading = computed(() => knowledgeStore.loading)
const total = computed(() => knowledgeStore.total)
const selectedSource = computed(() => knowledgeStore.selectedSource)
const selectedStageLabel = computed(() => stageOptions[selectedStageIndex.value]?.label || '全部阶段')
const activeFilterText = computed(() => {
  const parts: string[] = []
  const keyword = searchText.value.trim()
  const stage = stageOptions[selectedStageIndex.value]
  const source = sourceOptions.find(option => option.value === selectedSource.value)

  if (keyword) parts.push(`关键词：${keyword}`)
  if (stage?.value) parts.push(`阶段：${stage.label}`)
  if (source && source.value !== 'all') parts.push(`来源：${source.label}`)

  return parts.join(' · ')
})
const resultPillText = computed(() => (
  mergedArticleCount.value > 0
    ? `当前展示 ${displayedArticleGroups.value.length} 篇 · 已合并 ${mergedArticleCount.value} 篇重复来源`
    : `当前展示 ${displayedArticleGroups.value.length || total.value} 篇 · 中文源优先`
))

watch(displayedArticleGroups, (groups) => {
  const validSlugs = new Set(groups.map(group => group.article.slug))
  expandedVariantGroups.value = expandedVariantGroups.value.filter(slug => validSlugs.has(slug))
  variantFilterModes.value = Object.fromEntries(
    Object.entries(variantFilterModes.value).filter(([slug]) => validSlugs.has(slug)),
  ) as Record<string, VariantFilterMode>
  variantSortModes.value = Object.fromEntries(
    Object.entries(variantSortModes.value).filter(([slug]) => validSlugs.has(slug)),
  ) as Record<string, VariantSortMode>
}, { immediate: true })

function resolveStoredStage(): string | null {
  const storedWeek = Number.parseInt(String(uni.getStorageSync('userPregnancyWeek') || ''), 10)
  if (Number.isNaN(storedWeek) || storedWeek < 1 || storedWeek > 40) {
    return null
  }

  if (storedWeek <= 12) return 'first-trimester'
  if (storedWeek <= 27) return 'second-trimester'
  return 'third-trimester'
}

function buildStageGuideItems(stage: string | null): StageGuideItem[] {
  if (stage === 'first-trimester') {
    return [
      { key: 'early-risk', title: '孕早期风险信号', desc: '先看出血、腹痛、孕吐和何时需要尽快线下就医。', keyword: '孕早期 出血 腹痛 孕吐 就医', stage },
      { key: 'early-checkup', title: '叶酸与首次产检', desc: '把叶酸补充、建档和初次产检节点看清楚。', keyword: '叶酸 建档 初次产检 早孕', stage },
      { key: 'early-diet', title: '饮食与生活方式', desc: '集中看补剂、忌口和早孕期的日常注意事项。', keyword: '孕早期 饮食 补剂 注意事项', stage },
    ]
  }

  if (stage === 'second-trimester') {
    return [
      { key: 'mid-checkup', title: '产检节点', desc: '先理顺糖耐、B 超、常见指标和复查时机。', keyword: '孕中期 糖耐 B超 产检 报告', stage },
      { key: 'mid-nutrition', title: '营养与体重管理', desc: '优先看体重变化、营养补充和运动安排。', keyword: '孕中期 营养 体重 运动', stage },
      { key: 'mid-fetal-movement', title: '胎动与异常信号', desc: '先把胎动观察、宫缩区别和异常信号看明白。', keyword: '胎动 宫缩 异常信号', stage },
    ]
  }

  if (stage === 'third-trimester') {
    return [
      { key: 'late-delivery', title: '临近分娩准备', desc: '优先看入院信号、待产包和分娩前准备。', keyword: '孕晚期 入院信号 待产包 分娩准备', stage },
      { key: 'late-breastfeeding', title: '哺乳与新生儿护理', desc: '先读产后喂养、皮肤接触和新生儿护理的基础内容。', keyword: '哺乳 新生儿护理 产后 喂养', stage },
      { key: 'late-warning', title: '胎动与破水', desc: '重点区分规律宫缩、破水和需要尽快处理的异常情况。', keyword: '孕晚期 宫缩 破水 胎动', stage },
    ]
  }

  if (stage === 'newborn' || stage === '0-6-months') {
    return [
      { key: 'newborn-feeding', title: '喂养与黄疸', desc: '先看母乳、黄疸和体重变化的基础判断。', keyword: '新生儿 喂养 黄疸 体重', stage },
      { key: 'newborn-vaccine', title: '疫苗与发热', desc: '把接种安排和发热处理的权威口径看准。', keyword: '新生儿 疫苗 发热 接种', stage },
      { key: 'newborn-sleep', title: '睡眠与护理', desc: '先熟悉睡眠、安全睡姿和日常护理。', keyword: '新生儿 睡眠 护理 安全', stage },
    ]
  }

  return [
    { key: 'authority-start', title: '中国权威来源', desc: '优先看中国政府网、国家卫健委和中国疾控的公开内容。', keyword: '国家卫健委 中国疾控 孕产 指南', stage: null },
    { key: 'pregnancy-start', title: '孕期常见主题', desc: '从产检、营养、风险信号这些高频主题进入。', keyword: '产检 营养 风险信号 孕期', stage: null },
    { key: 'newborn-start', title: '新生儿高频问题', desc: '提前熟悉喂养、黄疸、疫苗和睡眠主题。', keyword: '新生儿 喂养 黄疸 疫苗 睡眠', stage: 'newborn' },
  ]
}

const resolvedStage = computed(() => stageOptions[selectedStageIndex.value]?.value || resolveStoredStage())
const stageGuide = computed(() => {
  const stage = resolvedStage.value
  const label = stageOptions.find(item => item.value === stage)?.label || '当前阶段'

  return {
    title: stage ? `${label}建议先看这些` : '第一次来建议先看这些',
    caption: stage ? '先从高频主题切入，再用机构和关键词继续缩小范围。' : '先从高频入口熟悉知识库，再决定接下来补什么信息。',
    badge: stage ? label : '冷启动',
    items: buildStageGuideItems(stage || null),
  }
})
function syncLocalFiltersFromStore() {
  searchText.value = knowledgeStore.keyword
  syncStageIndex(knowledgeStore.selectedStage)
  activeScenarioKey.value = ''
}

async function loadArticles(reset = true) {
  await knowledgeStore.fetchArticles({ reset, page: reset ? 1 : knowledgeStore.page + 1 })
}

onMounted(async () => {
  syncLocalFiltersFromStore()
  await loadArticles(true)
})

onShow(async () => {
  syncLocalFiltersFromStore()
  if (articles.value.length === 0) {
    await loadArticles(true)
  }
})

function handleSearch() {
  const keyword = searchText.value.trim()
  activeScenarioKey.value = ''
  void knowledgeStore.applyFilters({
    keyword,
    source: selectedSource.value,
    stage: stageOptions[selectedStageIndex.value]?.value || null,
  })
}

function handleSourceChange(source: string) {
  if (selectedSource.value === source) {
    return
  }
  activeScenarioKey.value = ''
  void knowledgeStore.applyFilters({
    keyword: searchText.value,
    source,
    stage: stageOptions[selectedStageIndex.value]?.value || null,
  })
}

function onStageChange(e: { detail: { value: number } }) {
  const idx = e.detail.value
  selectedStageIndex.value = idx
  const stage = stageOptions[idx]
  activeScenarioKey.value = ''
  void knowledgeStore.applyFilters({
    keyword: searchText.value,
    source: selectedSource.value,
    stage: stage.value || null,
  })
}

function syncStageIndex(stageValue?: string | null) {
  const nextIndex = stageOptions.findIndex(option => option.value === (stageValue || ''))
  selectedStageIndex.value = nextIndex >= 0 ? nextIndex : 0
}

function applyScenario(option: typeof scenarioOptions[number]) {
  activeScenarioKey.value = option.key
  searchText.value = option.keyword
  syncStageIndex(option.stage)
  void knowledgeStore.applyFilters({
    keyword: option.keyword,
    source: 'all',
    stage: option.stage,
  })
}

function handleLoadMore() {
  if (loading.value || articles.value.length >= total.value) {
    return
  }
  void loadArticles(false)
}

onReachBottom(() => {
  handleLoadMore()
})

function resetFilters() {
  selectedStageIndex.value = 0
  searchText.value = ''
  activeScenarioKey.value = ''
  knowledgeStore.reset()
  void knowledgeStore.fetchArticles({ reset: true, page: 1 })
}

function applyStageGuide(item: StageGuideItem) {
  activeScenarioKey.value = ''
  searchText.value = item.keyword
  syncStageIndex(item.stage)
  void knowledgeStore.applyFilters({
    keyword: item.keyword,
    source: 'all',
    stage: item.stage,
  })
}

function goToDetail(article: Article) {
  const shouldWarmTranslation = isChineseKnowledgeArticle(article) ? '0' : '1'
  uni.navigateTo({ url: `/pages/knowledge-detail/index?slug=${encodeURIComponent(article.slug)}&translation=${shouldWarmTranslation}` })
}

function getReadingHint(article: Article): string {
  if (isChineseKnowledgeArticle(article)) {
    return '优先读中文原文与同步时间，适合直接核对政策和指南表述。'
  }

  return '进入详情后会自动准备中文辅助阅读，适合先看摘要再决定是否打开机构原文。'
}

function getReadingMeta(article: Article) {
  return buildKnowledgeReadingMeta(article)
}

function getStageLabel(stage?: string | null): string {
  return getKnowledgeStageLabel(stage || undefined, stageOptions.find(item => item.value === (stage || ''))?.label || '当前阶段')
}

function getListDisplayTitle(article: Article): string {
  return getKnowledgeDisplayTitle(article)
}

function getListDisplaySummary(article: Article): string {
  return getKnowledgeDisplaySummary(article, getKnowledgeFallbackSummary(article))
}

function getArticleContextLabel(article: Article) {
  return article.audience ? `适用对象：${article.audience}` : ''
}

function getRepresentativeReason(article: Article, variants: Article[]) {
  return buildKnowledgeRepresentativeReason(article, variants)
}

function getVariantRecommendation(representative: Article, variants: Article[]) {
  return buildKnowledgeVariantRecommendation(representative, variants)
}

function openVariantRecommendation(representative: Article, variants: Article[]) {
  const recommendation = getVariantRecommendation(representative, variants)
  if (!recommendation) {
    return
  }

  goToDetail(recommendation.article)
}

function toggleVariantGroup(slug: string) {
  const expanded = new Set(expandedVariantGroups.value)
  if (expanded.has(slug)) {
    expanded.delete(slug)
  } else {
    expanded.add(slug)
  }
  expandedVariantGroups.value = Array.from(expanded)
}

function isVariantGroupExpanded(slug: string) {
  return expandedVariantGroups.value.includes(slug)
}

function setVariantFilterMode(slug: string, mode: VariantFilterMode) {
  variantFilterModes.value = {
    ...variantFilterModes.value,
    [slug]: mode,
  }
}

function getVariantFilterMode(slug: string): VariantFilterMode {
  return variantFilterModes.value[slug] || 'all'
}

function setVariantSortMode(slug: string, mode: VariantSortMode) {
  variantSortModes.value = {
    ...variantSortModes.value,
    [slug]: mode,
  }
}

function getVariantSortMode(slug: string): VariantSortMode {
  return variantSortModes.value[slug] || 'recommended'
}

function getFilteredVariants(representative: Article, variants: Article[], slug: string) {
  return filterKnowledgeVariants(representative, variants, getVariantFilterMode(slug))
}

function getVisibleVariants(representative: Article, variants: Article[], slug: string) {
  return sortKnowledgeVariants(getFilteredVariants(representative, variants, slug), getVariantSortMode(slug))
}

function getVariantFilterFeedback(representative: Article, variants: Article[], slug: string) {
  return buildKnowledgeVariantFilterFeedback(representative, variants, getVariantFilterMode(slug))
}

function getVariantSourceDigest(representative: Article, variants: Article[], slug: string) {
  return buildKnowledgeSourceDigest([representative, ...getVisibleVariants(representative, variants, slug)])
}

function getVariantReadingSuggestion(representative: Article, variants: Article[], slug: string) {
  return buildKnowledgeVariantReadingSuggestion([representative, ...getVisibleVariants(representative, variants, slug)])
}

function getVariantPreview(article: Article) {
  return buildKnowledgeVariantPreview(article)
}

function getVariantDifference(representative: Article, variant: Article) {
  return buildKnowledgeVariantDifference(representative, variant)
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
  background: linear-gradient(180deg, #f9f0f5 0%, #fff7f2 100%);
  padding-bottom: 40rpx;
}

.hero {
  margin: 24rpx 28rpx 22rpx;
  padding: 34rpx 30rpx;
  border-radius: 28rpx;
  background: linear-gradient(180deg, #ffffff 0%, #fdf5f0 100%);
  border: 1rpx solid rgba(31, 42, 55, 0.06);
}

.hero-title {
  display: block;
  font-size: 44rpx;
  line-height: 1.25;
  font-weight: 900;
  color: #444;
  margin-bottom: 12rpx;
  letter-spacing: 1rpx;
}

.hero-subtitle {
  display: block;
  font-size: 26rpx;
  line-height: 1.6;
  color: #5f6d7c;
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
  padding: 0 28rpx 22rpx;
}

.cold-start-card {
  margin: 0 28rpx 24rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 248, 240, 0.95);
  border: 1rpx solid rgba(243, 111, 69, 0.12);
}

.cold-start-title {
  display: block;
  font-size: 28rpx;
  line-height: 1.45;
  font-weight: 800;
  color: #444;
}

.cold-start-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 23rpx;
  line-height: 1.7;
  color: #6d7887;
}

.stage-guide-panel {
  padding: 0 28rpx 24rpx;
}

.stage-guide-badge {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(47, 124, 246, 0.12);
  font-size: 22rpx;
  font-weight: 700;
  color: #326ac8;
}

.stage-guide-grid {
  display: grid;
  gap: 16rpx;
}

.stage-guide-card {
  padding: 22rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.94);
  border: 1rpx solid rgba(31, 42, 55, 0.06);
}

.stage-guide-title {
  display: block;
  font-size: 27rpx;
  font-weight: 800;
  line-height: 1.45;
  color: #444;
}

.stage-guide-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 1.65;
  color: #6d7887;
}

.stage-guide-action {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: #1f8f74;
}

.search-input {
  flex: 1;
  height: 76rpx;
  padding: 0 24rpx;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 38rpx;
  border: 1rpx solid rgba(31, 42, 55, 0.08);
  font-size: 28rpx;
  box-sizing: border-box;
}

.search-btn {
  margin-left: 16rpx;
  padding: 16rpx 28rpx;
  border-radius: 36rpx;
  background: #16806a;
}

.search-btn-text {
  font-size: 26rpx;
  color: #fff;
  font-weight: 600;
}

.recent-ai-section {
  padding: 0 28rpx 24rpx;
}

.section-caption--block {
  display: block;
  margin-top: 6rpx;
}

.recent-ai-count {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(31, 143, 116, 0.12);
  font-size: 22rpx;
  font-weight: 700;
  color: #1c7a63;
}

.recent-ai-scroll {
  white-space: nowrap;
}

.recent-ai-row {
  display: inline-flex;
  gap: 16rpx;
  padding-right: 28rpx;
}

.recent-ai-card {
  width: 252rpx;
  min-height: 164rpx;
  padding: 20rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10rpx 28rpx rgba(31, 42, 55, 0.02);
  box-sizing: border-box;
}

.recent-ai-card-kicker {
  display: block;
  font-size: 21rpx;
  font-weight: 700;
  color: #1c7a63;
}

.recent-ai-card-title {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.5;
  font-weight: 700;
  color: #444;
}

.recent-ai-card-meta,
.recent-ai-card-topic {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 1.45;
  color: #6f7d8d;
}

.recent-ai-chip-panel {
  margin-top: 18rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.82);
}

.recent-ai-chip-row + .recent-ai-chip-row {
  margin-top: 16rpx;
}

.recent-ai-chip-label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: #7a8697;
}

.recent-ai-topic-chip,
.recent-ai-source-chip {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  margin-right: 12rpx;
  margin-bottom: 12rpx;
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
}

.recent-ai-topic-chip {
  background: rgba(31, 143, 116, 0.1);
}

.recent-ai-source-chip {
  background: rgba(243, 111, 69, 0.1);
}

.recent-ai-chip-name {
  font-size: 23rpx;
  font-weight: 700;
  color: #324255;
}

.recent-ai-chip-count {
  font-size: 21rpx;
  color: #7a8697;
}

.scenario-panel {
  padding: 0 28rpx 24rpx;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 800;
  color: #444;
}

.section-caption {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #8a96a3;
}

.scenario-scroll {
  white-space: nowrap;
}

.scenario-row {
  display: inline-flex;
  gap: 16rpx;
  padding-right: 28rpx;
}

.scenario-card {
  width: 220rpx;
  min-height: 126rpx;
  padding: 20rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(31, 42, 55, 0.06);
  box-sizing: border-box;
}

.scenario-card--active {
  background: linear-gradient(135deg, #e8a1a6 0%, #c7656e 100%);
}

.scenario-title {
  display: block;
  font-size: 27rpx;
  font-weight: 800;
  color: #263342;
}

.scenario-title--active {
  color: #ffffff;
}

.scenario-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 1.45;
  color: #687588;
  white-space: normal;
}

.scenario-desc--active {
  color: rgba(255, 255, 255, 0.82);
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
  background: #e8a1a6;
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

.active-filter-card {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin: 0 28rpx 22rpx;
  padding: 18rpx 20rpx;
  border-radius: 24rpx;
  background: rgba(47, 124, 246, 0.08);
}

.active-filter-label {
  flex-shrink: 0;
  font-size: 22rpx;
  font-weight: 800;
  color: #326ac8;
}

.active-filter-text {
  flex: 1;
  font-size: 23rpx;
  line-height: 1.45;
  color: #405269;
}

.active-filter-clear {
  flex-shrink: 0;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(47, 124, 246, 0.12);
}

.active-filter-clear-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #326ac8;
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
  background: #e8a1a6;
}

.state-btn-text {
  font-size: 24rpx;
  font-weight: 700;
  color: #fff;
}

.article-card {
  margin-bottom: 22rpx;
  padding: 28rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(31, 42, 55, 0.06);
  box-shadow: 0 8rpx 24rpx rgba(31, 42, 55, 0.02);
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
  display: inline-flex;
  width: auto;
  box-sizing: border-box;
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
  line-height: 1.45;
  border-radius: 999rpx;
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
  color: #444;
}

.article-summary {
  display: block;
  font-size: 26rpx;
  line-height: 1.7;
  color: #5d6b7b;
  margin-bottom: 18rpx;
  text-align: justify;
}

.reading-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.reading-meta-pill {
  display: inline-flex;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(244, 250, 250, 0.94);
  border: 1rpx solid rgba(80, 119, 130, 0.12);
  font-size: 22rpx;
  color: #4f6d77;
  font-weight: 700;
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

.variant-panel {
  margin-bottom: 18rpx;
}

.representative-reason {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 18rpx;
}

.representative-reason-badge {
  display: inline-flex;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(243, 111, 69, 0.12);
  font-size: 20rpx;
  line-height: 1.4;
  color: #d35b34;
  font-weight: 700;
}

.representative-reason-text {
  flex: 1;
  min-width: 0;
  font-size: 22rpx;
  line-height: 1.55;
  color: #6d7887;
}

.variant-toggle {
  padding: 16rpx 18rpx;
  border-radius: 20rpx;
  background: rgba(244, 250, 250, 0.94);
  border: 1rpx solid rgba(80, 119, 130, 0.12);
}

.variant-toggle-text {
  font-size: 23rpx;
  font-weight: 700;
  color: #4f6d77;
}

.variant-list {
  display: grid;
  gap: 12rpx;
  margin-top: 12rpx;
}

.variant-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.variant-recommendation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  background: rgba(255, 246, 223, 0.72);
  border: 1rpx solid rgba(184, 138, 72, 0.16);
}

.variant-recommendation-copy {
  flex: 1;
  min-width: 0;
}

.variant-recommendation-label {
  display: block;
  font-size: 22rpx;
  line-height: 1.45;
  color: #8b6723;
  font-weight: 700;
}

.variant-recommendation-text {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.55;
  color: #6d7887;
}

.variant-recommendation-action {
  flex-shrink: 0;
  font-size: 22rpx;
  line-height: 1.4;
  color: #7d5f22;
  font-weight: 700;
}

.variant-filter-feedback {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
  padding: 16rpx 18rpx;
  border-radius: 20rpx;
  background: rgba(244, 250, 250, 0.78);
  border: 1rpx solid rgba(80, 119, 130, 0.1);
}

.variant-filter-feedback-label {
  font-size: 21rpx;
  line-height: 1.4;
  color: #4f6d77;
  font-weight: 700;
}

.variant-filter-feedback-text {
  font-size: 21rpx;
  line-height: 1.55;
  color: #6d7887;
}

.variant-source-digest {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
  padding: 16rpx 18rpx;
  border-radius: 20rpx;
  background: rgba(255, 248, 240, 0.72);
  border: 1rpx solid rgba(184, 138, 72, 0.12);
}

.variant-source-digest-label {
  font-size: 21rpx;
  line-height: 1.4;
  color: #8b6723;
  font-weight: 700;
}

.variant-source-digest-text {
  font-size: 21rpx;
  line-height: 1.55;
  color: #6d7887;
}

.variant-reading-suggestion {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
  padding: 16rpx 18rpx;
  border-radius: 20rpx;
  background: rgba(241, 247, 255, 0.82);
  border: 1rpx solid rgba(84, 126, 186, 0.12);
}

.variant-reading-suggestion-label {
  font-size: 21rpx;
  line-height: 1.4;
  color: #456996;
  font-weight: 700;
}

.variant-reading-suggestion-text {
  font-size: 21rpx;
  line-height: 1.55;
  color: #6d7887;
}

.variant-sort-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.variant-sort-chip {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(241, 247, 255, 0.92);
  border: 1rpx solid rgba(84, 126, 186, 0.14);
}

.variant-sort-chip--active {
  background: rgba(84, 126, 186, 0.16);
}

.variant-sort-chip-text {
  font-size: 21rpx;
  line-height: 1.4;
  color: #55759d;
  font-weight: 700;
}

.variant-sort-chip-text--active {
  color: #35547a;
}

.variant-filter-chip {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(80, 119, 130, 0.12);
}

.variant-filter-chip--active {
  background: rgba(79, 109, 119, 0.12);
}

.variant-filter-chip-text {
  font-size: 21rpx;
  line-height: 1.4;
  color: #4f6d77;
  font-weight: 700;
}

.variant-filter-chip-text--active {
  color: #35535c;
}

.variant-item {
  padding: 18rpx;
  border-radius: 20rpx;
  background: rgba(250, 252, 252, 0.98);
  border: 1rpx solid rgba(80, 119, 130, 0.1);
}

.variant-title {
  display: block;
  font-size: 24rpx;
  line-height: 1.55;
  font-weight: 700;
  color: #2c3948;
}

.variant-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  line-height: 1.45;
  color: #7a8697;
}

.variant-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
}

.variant-hint-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
}

.variant-hint-badge {
  display: inline-flex;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(243, 111, 69, 0.12);
  font-size: 20rpx;
  line-height: 1.4;
  color: #d35b34;
  font-weight: 700;
}

.variant-chip {
  display: inline-flex;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(244, 250, 250, 0.94);
  border: 1rpx solid rgba(80, 119, 130, 0.12);
  font-size: 20rpx;
  line-height: 1.4;
  color: #4f6d77;
  font-weight: 700;
}

.variant-empty {
  display: block;
  padding: 18rpx;
  border-radius: 20rpx;
  background: rgba(250, 252, 252, 0.98);
  border: 1rpx solid rgba(80, 119, 130, 0.1);
  font-size: 22rpx;
  line-height: 1.6;
  color: #6d7887;
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
