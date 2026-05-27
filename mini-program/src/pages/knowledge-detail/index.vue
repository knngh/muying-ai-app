<template>
  <view class="detail-page">
    <view v-if="loading" class="state-box">
      <text class="state-text">加载中...</text>
    </view>

    <view v-else-if="error" class="state-box">
      <text class="state-text state-text--error">{{ error }}</text>
      <view class="retry-btn" @tap="retryLoad">
        <text class="retry-btn-text">重试</text>
      </view>
    </view>

    <view v-else-if="article" class="article-detail">
      <view class="article-header">
        <view class="badge-row">
          <text v-if="article.sourceOrg || article.source" class="badge badge-source">
            {{ formatSourceLabel(article.sourceOrg || article.source) }}
          </text>
          <text class="badge" :class="`badge-tier--${authorityRegionTag}`">{{ authorityRegionLabel }}</text>
          <text v-if="article.topic" class="badge badge-topic">{{ article.topic }}</text>
          <text v-if="article.isVerified" class="badge badge-verified">来源已记录</text>
        </view>

        <text class="article-title">{{ displayedTitle }}</text>

        <view class="meta-row">
          <text class="meta-item">当前显示 {{ currentBodyLanguageLabel }}</text>
          <text v-if="article.audience" class="meta-item">{{ article.audience }}</text>
          <text v-if="article.region" class="meta-item">{{ article.region }}</text>
          <text v-if="article.sourceUpdatedAt" class="meta-item">来源更新 {{ formatDate(article.sourceUpdatedAt) }}</text>
          <text v-else class="meta-item">首次收录 {{ formatDate(article.createdAt || article.publishedAt) }}</text>
          <text v-if="article.lastSyncedAt" class="meta-item">最近校验 {{ formatDate(article.lastSyncedAt) }}</text>
        </view>
      </view>

      <view class="authority-callout" :class="`authority-callout--${authorityRegionTag}`">
        <text class="authority-callout-label">{{ authorityRegionLabel }}</text>
        <text class="authority-callout-text">{{ authorityCalloutText }}</text>
      </view>

      <view v-if="riskAlert" class="risk-alert-box">
        <text class="risk-alert-label">高风险提示</text>
        <text class="risk-alert-title">{{ riskAlert.title }}</text>
        <text class="risk-alert-desc">{{ riskAlert.desc }}</text>
        <view class="risk-alert-link" @tap="openTrustCenter">
          <text class="risk-alert-link-text">查看内容可信说明</text>
        </view>
      </view>

      <view class="context-board">
        <view class="context-card">
          <text class="context-card-label">适用对象</text>
          <text class="context-card-value">{{ article.audience || '母婴家庭通用参考' }}</text>
        </view>
        <view class="context-card">
          <text class="context-card-label">当前重点</text>
          <text class="context-card-value">{{ topicFocusLabel }}</text>
        </view>
      </view>

      <view v-if="displayedSourceUrl" class="source-box">
        <text class="source-label">原始来源</text>
        <text class="source-url">{{ displayedSourceUrl }}</text>
        <view class="source-btn" @tap="copySourceLink(displayedSourceUrl)">
          <text class="source-btn-text">复制链接</text>
        </view>
      </view>
      <view v-else class="source-box source-box--muted">
        <text class="source-label">原始来源</text>
        <text class="source-url">当前未提供可复制的机构来源链接，请优先参考本页摘要、最近校验时间和机构标签。</text>
      </view>

      <view v-if="displayedSummaryText" class="summary-box">
        <text class="summary-label">{{ showingTranslation ? '中文摘要' : originalSummaryLabel }}</text>
        <text class="summary-text">{{ displayedSummaryText }}</text>
      </view>

      <view v-if="contentOutline.length" class="outline-box">
        <text class="outline-kicker">正文目录</text>
        <text class="outline-title">按章节快速定位</text>
        <view
          v-for="item in contentOutline"
          :key="item.id"
          class="outline-item"
          :class="{ 'outline-item--sub': item.level === 3 }"
          @tap="jumpToSection(item.id)"
        >
          <text class="outline-item-label">{{ item.level === 3 ? '要点' : '章节' }}</text>
          <text class="outline-item-title">{{ item.title }}</text>
        </view>
      </view>

      <view v-if="showTranslationEntry" class="translation-box">
        <view class="translation-head">
          <text class="translation-title">中文辅助阅读</text>
          <view
            class="translation-btn"
            :class="{ 'translation-btn--disabled': translating || translationDisabled }"
            @tap="toggleTranslation"
          >
            <text class="translation-btn-text">
              {{ translationButtonText }}
            </text>
          </view>
        </view>
        <text class="translation-desc">
          {{ translationDescriptionText }}
        </text>
        <text v-if="translationReadyText" class="translation-ready-text">{{ translationReadyText }}</text>
      </view>

      <view class="article-content">
        <text v-if="translationError" class="translation-error">{{ translationError }}</text>
        <view class="body-language-banner" :class="{ 'body-language-banner--translated': showingTranslation }">
          <text class="body-language-label">{{ currentBodyLanguageLabel }}</text>
          <text class="body-language-text">{{ currentBodyLanguageDescription }}</text>
        </view>
        <view v-if="isBodyFallback" class="body-fallback-notice">
          <text class="body-fallback-notice-text">当前正文暂未同步，以下为摘要内容。</text>
        </view>
        <rich-text :nodes="displayedContent" class="content-text" />
      </view>

      <view v-if="article.disclaimer" class="disclaimer-box">
        <text class="disclaimer-text">{{ article.disclaimer }}</text>
      </view>

      <view v-if="continueReadingItems.length" class="continue-reading-box">
        <text class="continue-reading-title">继续阅读</text>
        <text class="continue-reading-desc">顺着当前主题继续看，信息会更连贯。</text>
        <view
          v-for="item in continueReadingItems"
          :key="item.slug"
          class="continue-reading-item"
          @tap="openContinueReading(item.slug)"
        >
          <view class="continue-reading-copy">
            <text class="continue-reading-item-title">{{ item.title }}</text>
            <text class="continue-reading-item-meta">{{ item.meta }}</text>
          </view>
          <text class="continue-reading-action">继续看</text>
        </view>
      </view>

      <view class="detail-actions">
        <view class="detail-link-btn" @tap="goBackToKnowledge">
          <text class="detail-link-btn-text">返回知识库</text>
        </view>
      </view>

      <view class="floating-reading-tools">
        <view class="mini-progress-badge">
          <text class="mini-progress-badge-text">已阅读 {{ readingProgress }}%</text>
        </view>
        <view
          v-if="showBackToTop"
          class="mini-back-top"
          @tap="backToTop"
        >
          <text class="mini-back-top-text">回到顶部</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onLoad, onPageScroll, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { articleApi, isTranslationPendingError } from '@/api/modules'
import type { AuthorityArticleTranslation } from '@/api/modules'
import type { Article } from '@/api/modules'
import { useKnowledgeStore } from '@/stores/knowledge'
import { buildAcquisitionPath, buildAcquisitionQuery, recordAcquisitionContext } from '@/utils/acquisition'
import { getAuthorityRegionLabel, getAuthorityRegionTag, isChineseAuthoritySource } from '@/utils/authority-source'
import { trackMiniEvent } from '@/utils/analytics'
import {
  addArticleHeadingAnchors,
  extractArticleOutline,
  formatDate,
  formatRichArticleContent,
  formatSourceLabel,
  getKnowledgeDisplayTitle,
  isChineseKnowledgeArticle,
  isMostlyChineseText,
  normalizePlainText,
  normalizeAuthoritySourceUrl,
  resolveKnowledgeSourceUrl,
  resolveKnowledgeDisplayContent,
  resolveKnowledgeOriginalContent,
  sanitizeTranslationText,
  stripHtmlTags,
} from '@/utils/knowledge-format'

const knowledgeStore = useKnowledgeStore()
let currentSlug = ''
const RECENT_KNOWLEDGE_STORAGE_KEY = 'recentKnowledgeArticles'

interface ContinueReadingItem {
  slug: string
  title: string
  meta: string
  shouldWarmTranslation: boolean
}

interface RecentKnowledgeItem {
  slug: string
  title: string
  sourceLabel: string
  updatedAtLabel: string
}

type RuntimeArticle = Article & {
  source_url?: string
  url?: string
  original_id?: string
  source_language?: string
  source_locale?: string
  references?: Array<{
    sourceUrl?: string
    source_url?: string
    url?: string
    link?: string
  }>
}

function toRuntimeArticle(articleItem?: Article | null): RuntimeArticle | null {
  return articleItem ? articleItem as RuntimeArticle : null
}

function getArticleSourceUrl(articleItem?: Article | null): string {
  return resolveKnowledgeSourceUrl(toRuntimeArticle(articleItem))
}

function getArticleSourceLanguageMeta(articleItem?: Article | null) {
  const runtimeArticle = toRuntimeArticle(articleItem)
  return {
    language: runtimeArticle?.sourceLanguage || runtimeArticle?.source_language || '',
    locale: runtimeArticle?.sourceLocale || runtimeArticle?.source_locale || '',
  }
}

const article = computed(() => knowledgeStore.currentArticle)
const loading = computed(() => knowledgeStore.loading)
const error = computed(() => knowledgeStore.error)
const translation = ref<AuthorityArticleTranslation | null>(null)
const translating = ref(false)
const translationError = ref('')
const showingTranslation = ref(false)
const shouldWarmTranslation = ref(false)
const autoShowTranslation = ref(false)
const continueReadingItems = ref<ContinueReadingItem[]>([])
const relatedArticles = ref<Article[]>([])
const readingProgress = ref(0)
const showBackToTop = ref(false)
const contentHeightPx = ref(1)
let translationRetryTimer: ReturnType<typeof setTimeout> | null = null
let translationRetryCount = 0
const MAX_TRANSLATION_RETRY_COUNT = 12
let detailOpenTrackedKey = ''

function getViewportHeight(): number {
  const windowInfo = uni.getWindowInfo()
  return windowInfo.windowHeight || 1
}

const viewportHeightPx = ref(getViewportHeight())

const translatedTitleText = computed(() => sanitizeTranslationText(translation.value?.translatedTitle, 'title'))
const translatedSummaryText = computed(() => sanitizeTranslationText(translation.value?.translatedSummary, 'summary'))
const translatedContentText = computed(() => sanitizeTranslationText(translation.value?.translatedContent, 'content'))
const articleDisplayContent = computed(() => resolveKnowledgeDisplayContent(article.value))
const articleOriginalContent = computed(() => resolveKnowledgeOriginalContent(article.value))
const translatedDisplayTitle = computed(() => (
  translatedTitleText.value
    || (articleDisplayContent.value.isTranslated ? articleDisplayContent.value.title : '')
))
const translatedDisplaySummary = computed(() => (
  translatedSummaryText.value
    || (articleDisplayContent.value.isTranslated ? articleDisplayContent.value.summary : '')
))
const translatedDisplayContent = computed(() => (
  translatedContentText.value
    || (articleDisplayContent.value.isTranslated ? articleDisplayContent.value.content : '')
))

const displayedTitle = computed(() => {
  if (showingTranslation.value && translatedDisplayTitle.value) {
    return translatedDisplayTitle.value
  }
  return articleOriginalContent.value.title || getKnowledgeDisplayTitle({
    title: article.value?.title,
    topic: article.value?.topic,
    stage: normalizedStageValue.value,
    category: article.value?.category,
  })
})

const displayedSummary = computed(() => {
  if (showingTranslation.value && translatedDisplaySummary.value) {
    return translatedDisplaySummary.value
  }
  return articleOriginalContent.value.summary
})

const displayedSummaryText = computed(() => normalizePlainText(displayedSummary.value))

const displayedSourceUrl = computed(() => normalizeAuthoritySourceUrl(getArticleSourceUrl(article.value)))

const displayedBodySource = computed(() => {
  if (showingTranslation.value) {
    return translatedDisplayContent.value
  }

  return articleOriginalContent.value.content
})

const isBodyFallback = computed(() => {
  return !stripHtmlTags(displayedBodySource.value).replace(/\s+/g, '').trim() && Boolean(displayedSummary.value)
})

const displayedContent = computed(() => {
  const body = displayedBodySource.value
  if (!body.trim() && displayedSummary.value) {
    return addArticleHeadingAnchors(formatRichArticleContent(displayedSummary.value))
  }
  return addArticleHeadingAnchors(formatRichArticleContent(body))
})

const contentOutline = computed(() => {
  const body = displayedBodySource.value
  if (!body.trim() && displayedSummary.value) {
    return extractArticleOutline(displayedSummary.value)
  }

  return extractArticleOutline(body)
})

const translationNoticeText = computed(() => (
  translation.value?.translationNotice || '以下内容由系统基于公开机构原文辅助翻译，仅用于阅读理解，不作为个人健康决策依据。请以原始来源和线下专业意见为准。'
))

const sourceLanguageSample = computed(() => stripHtmlTags([
  article.value?.title || '',
  article.value?.summary || '',
  article.value?.content || '',
].join(' ')))

const isLikelyChineseSource = computed(() => (
  Boolean(translation.value?.isSourceChinese)
    || Boolean(article.value && isChineseKnowledgeArticle(article.value))
    || isMostlyChineseText(sourceLanguageSample.value)
))

const showTranslationEntry = computed(() => !isLikelyChineseSource.value)

const translationDisabled = computed(() => Boolean(isLikelyChineseSource.value && !showingTranslation.value))

const originalLanguageLabel = computed(() => {
  const { language, locale } = getArticleSourceLanguageMeta(article.value)
  const normalizedLanguage = language.toLowerCase()
  const normalizedLocale = locale.toLowerCase()
  if (normalizedLanguage === 'zh' || normalizedLocale.startsWith('zh') || isLikelyChineseSource.value) return '中文'
  if (normalizedLanguage === 'en' || normalizedLocale.startsWith('en')) return '英文'
  if (/[A-Za-z]{3,}/.test(sourceLanguageSample.value) && !isMostlyChineseText(sourceLanguageSample.value)) return '英文'
  return ''
})

const originalSummaryLabel = computed(() => (
  originalLanguageLabel.value ? `${originalLanguageLabel.value}摘要` : '原文摘要'
))

const originalViewButtonText = computed(() => (
  originalLanguageLabel.value ? `查看${originalLanguageLabel.value}原文` : '查看原文'
))

const translationButtonText = computed(() => {
  if (translating.value) return '准备中...'
  if (translation.value?.isSourceChinese) return '原文已是中文'
  return showingTranslation.value ? originalViewButtonText.value : '查看中文'
})

const currentBodyLanguageLabel = computed(() => {
  if (showingTranslation.value) {
    return '中文辅助阅读'
  }

  return originalLanguageLabel.value ? `${originalLanguageLabel.value}原文` : '机构原文'
})

const currentBodyLanguageDescription = computed(() => {
  if (showingTranslation.value) {
    return displayedSourceUrl.value
      ? '当前正文为系统生成的中文辅助阅读版，可通过页面上方来源链接核对。'
      : '当前正文为系统生成的中文辅助阅读版，可切换回机构原文核对。'
  }

  return originalLanguageLabel.value
    ? `当前正文为${originalLanguageLabel.value}机构原文。`
    : '当前正文为机构原文。'
})

const translationDescriptionText = computed(() => {
  if (translation.value?.isSourceChinese) {
    return translationNoticeText.value
  }

  if (showingTranslation.value) {
    return translationNoticeText.value
  }

  return '打开文章后会由系统翻译服务生成中文阅读版，生成一次后后续直接读取缓存。'
})

const authorityRegionLabel = computed(() => getAuthorityRegionLabel(article.value))
const authorityRegionTag = computed(() => getAuthorityRegionTag(article.value))
const authorityCalloutText = computed(() => {
  if (isChineseAuthoritySource(article.value)) {
    return '这篇内容来自中国公开机构资料，默认展示中文原文与最近校验时间。'
  }

  return '这篇内容来自国际公开机构资料，可切换中文辅助阅读并核对来源链接。'
})

const riskAlert = computed(() => {
  const plainText = stripHtmlTags([
    article.value?.title || '',
    article.value?.summary || '',
    article.value?.content || '',
  ].join(' ')).replace(/\s+/g, ' ').trim()

  if (!plainText) {
    return null
  }

  if (/出血|腹痛|规律宫缩|破水|胎动(明显)?减少|胎动异常/u.test(plainText)) {
    return {
      title: '出现孕期急性信号时优先线下就医',
      desc: '如果当前内容涉及出血、腹痛、规律宫缩、破水或胎动明显变化，请不要只依赖页面信息，优先联系线下机构或尽快线下就医。',
    }
  }

  if (/高热|发热|呼吸困难|抽搐|精神差|严重呕吐|脱水/u.test(plainText)) {
    return {
      title: '发热和全身症状不建议只靠经验判断',
      desc: '孕期和婴幼儿出现高热、呼吸困难、抽搐、精神差、严重呕吐或脱水时，应尽快线下评估，不建议仅凭网上内容自行处理。',
    }
  }

  if (/黄疸|吃奶差|嗜睡|反应差/u.test(plainText)) {
    return {
      title: '新生儿异常表现应优先线下评估',
      desc: '如果涉及黄疸加重、吃奶明显变差、嗜睡或反应异常，应优先线下评估，再结合公开资料理解原因和处理方式。',
    }
  }

  if (/用药|药物|药品|剂量|处置安排/u.test(plainText)) {
    return {
      title: '涉及药物和处置安排请线下确认',
      desc: '公开资料和中文辅助阅读只用于帮助理解背景信息；涉及个人用药、剂量或处置安排时，请优先线下确认。',
    }
  }

  return null
})

const topicLabelMap: Record<string, string> = {
  pregnancy: '孕期与产检',
  postpartum: '产后恢复',
  newborn: '新生儿护理',
  feeding: '喂养与辅食',
  vaccination: '疫苗与预防',
  'common-symptoms': '常见症状判断',
  development: '发育与日常照护',
  policy: '政策与官方通知',
  general: '综合资料',
}

const stageLabelMap: Record<string, string> = {
  preparation: '备孕期',
  'first-trimester': '孕早期',
  'second-trimester': '孕中期',
  'third-trimester': '孕晚期',
  postpartum: '产后恢复',
  newborn: '月子/新生儿',
  '0-6-months': '0-6月',
  '6-12-months': '6-12月',
  '1-3-years': '1-3岁',
  '3-years-plus': '3岁+',
}

const topicFocusLabel = computed(() => (
  topicLabelMap[article.value?.topic || ''] || article.value?.topic || '当前条目重点'
))

const normalizedStageValue = computed(() => normalizeArticleStage(article.value))

const translationReadyText = computed(() => {
  if (!showTranslationEntry.value) return ''
  if (translationError.value) return ''
  if (translating.value) return '正在准备译文，保持当前页面即可。'
  if (translation.value && !showingTranslation.value) return '中文阅读版已准备好，点”查看中文”可直接切换。'
  if (translation.value && showingTranslation.value) return '当前正在查看中文辅助阅读版。'
  return ''
})

onLoad((options) => {
  recordAcquisitionContext(options)
  viewportHeightPx.value = getViewportHeight()
  readingProgress.value = 0
  showBackToTop.value = false
  if (typeof options?.slug === 'string') {
    currentSlug = options.slug
    shouldWarmTranslation.value = options?.translation === '1'
    autoShowTranslation.value = options?.translation === '1'
    void loadArticleDetail(options.slug)
  }
})

onPageScroll((event) => {
  const maxScroll = Math.max(contentHeightPx.value - viewportHeightPx.value, 0)
  const nextProgress = maxScroll > 0
    ? Math.min(100, Math.max(0, Math.round((event.scrollTop / maxScroll) * 100)))
    : 100

  readingProgress.value = nextProgress
  showBackToTop.value = event.scrollTop > 420
})

function retryLoad() {
  if (currentSlug) {
    void loadArticleDetail(currentSlug)
  }
}

function copySourceLink(url?: string) {
  if (!url) {
    uni.showToast({ title: '来源链接不可用', icon: 'none' })
    return
  }
  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showToast({ title: '来源链接已复制', icon: 'success' })
    },
    fail: () => {
      uni.showToast({ title: '复制失败，请手动复制', icon: 'none' })
    },
  })
}

function jumpToSection(sectionId: string) {
  uni.pageScrollTo({
    selector: `#${sectionId}`,
    duration: 280,
  })
}

function backToTop() {
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 280,
  })
}

function openTrustCenter() {
  uni.navigateTo({ url: '/pages/trust-center/index' })
}

function normalizeTranslationError(err: unknown): string {
  if (isTranslationPendingError(err)) {
    return '中文阅读版正在生成，完成后会自动切换'
  }

  const message = err instanceof Error ? err.message : '翻译失败，请稍后重试'
  if (/timeout|超时|timed out/i.test(message)) {
    return '中文阅读版正在生成，完成后会自动刷新'
  }

  return message
}

function getArticleTranslationVersion(articleItem: Article): string | undefined {
  return articleItem.sourceUpdatedAt || articleItem.publishedAt || articleItem.createdAt || undefined
}

async function toggleTranslation() {
  if (!article.value || !currentSlug || translating.value || translationDisabled.value) {
    return
  }

  if (showingTranslation.value) {
    autoShowTranslation.value = false
    showingTranslation.value = false
    return
  }

  if (!translation.value) {
    translating.value = true
    translationError.value = ''
    try {
      translation.value = await ensureTranslationLoaded(currentSlug)
    } catch (err: unknown) {
      if (isTranslationPendingError(err)) {
        scheduleTranslationRetry(currentSlug, err.retryAfterMs)
        return
      }
      const message = normalizeTranslationError(err)
      translationError.value = message
      uni.showToast({ title: message.includes('正在生成') ? '正在生成译文' : '翻译失败', icon: 'none' })
      return
    } finally {
      translating.value = false
    }
  }

  showingTranslation.value = true
}

async function loadArticleDetail(slug: string) {
  clearTranslationRetryTimer()
  translationRetryCount = 0
  readingProgress.value = 0
  showBackToTop.value = false
  contentHeightPx.value = Math.max(viewportHeightPx.value, 1)
  translation.value = knowledgeStore.getCachedTranslation(slug)
  translating.value = false
  translationError.value = ''
  showingTranslation.value = Boolean(translation.value && !translation.value.isSourceChinese && autoShowTranslation.value)
  relatedArticles.value = []

  const articleDetailTask = knowledgeStore.fetchArticleDetail(slug)
  if (shouldWarmTranslation.value && !translation.value) {
    void prefetchTranslation()
  }

  const loadedArticle = await articleDetailTask
  if (!loadedArticle || currentSlug !== slug) {
    handleMissingKnowledgeArticle(slug)
    return
  }

  if (!translation.value && loadedArticle.translation) {
    const normalizedServerTranslation = knowledgeStore.cacheTranslation(slug, loadedArticle.translation)
    if (normalizedServerTranslation) {
      translation.value = normalizedServerTranslation
      if (!normalizedServerTranslation.isSourceChinese) {
        showingTranslation.value = true
      }
    }
  }

  await syncRelatedArticles()

  const currentCachedTranslation = knowledgeStore.getCachedTranslation(slug, getArticleTranslationVersion(loadedArticle))
  if (currentCachedTranslation) {
    translation.value = currentCachedTranslation
  } else if (translation.value) {
    translation.value = null
    showingTranslation.value = false
  }

  persistRecentKnowledge()
  syncContinueReading()
  await measurePageMetrics()

  const detailTrackKey = `${slug}:${loadedArticle.id}`
  if (detailOpenTrackedKey !== detailTrackKey) {
    detailOpenTrackedKey = detailTrackKey
    trackMiniEvent('app_knowledge_detail_open', {
      page: 'KnowledgeDetailPage',
      properties: {
        slug,
        articleSlug: loadedArticle.slug || slug,
        articleId: loadedArticle.id,
        sourceOrg: loadedArticle.sourceOrg || loadedArticle.source || null,
        topic: loadedArticle.topic || null,
        contentType: loadedArticle.contentType || null,
        isVerified: Boolean(loadedArticle.isVerified),
      },
    })
  }

  if (!translation.value && !isLikelyChineseSource.value) {
    void prefetchTranslation()
  }
}

function removeStoredKnowledgeArticle(slug: string) {
  const storedRecent = uni.getStorageSync(RECENT_KNOWLEDGE_STORAGE_KEY) as RecentKnowledgeItem[] | null
  if (Array.isArray(storedRecent)) {
    uni.setStorageSync(
      RECENT_KNOWLEDGE_STORAGE_KEY,
      storedRecent.filter(item => item.slug !== slug),
    )
  }
}

function handleMissingKnowledgeArticle(slug: string) {
  removeStoredKnowledgeArticle(slug)

  if (/不存在|下线|not found/i.test(error.value || '')) {
    uni.showToast({ title: '内容已更新，正在刷新知识库', icon: 'none' })
    void knowledgeStore.fetchArticles({ reset: true, page: 1 })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/knowledge/index' })
    }, 800)
  }
}

async function measurePageMetrics() {
  await nextTick()

  setTimeout(() => {
    const query = uni.createSelectorQuery()
    query.select('.detail-page').boundingClientRect()
    query.exec((result) => {
      const rect = Array.isArray(result) ? result[0] : null
      const measuredHeight = rect && typeof rect.height === 'number'
        ? rect.height
        : 0

      contentHeightPx.value = Math.max(measuredHeight, viewportHeightPx.value, 1)
    })
  }, 60)
}

async function syncRelatedArticles() {
  if (!article.value?.id) {
    relatedArticles.value = []
    return
  }

  try {
    relatedArticles.value = await articleApi.getRelated(article.value.id, 4)
  } catch {
    relatedArticles.value = []
  }
}

async function ensureTranslationLoaded(slug: string): Promise<AuthorityArticleTranslation> {
  const result = await knowledgeStore.fetchTranslation(slug)
  if (currentSlug === slug) {
    translation.value = result
    clearTranslationRetryTimer()
    translationRetryCount = 0
  }
  return result
}

function clearTranslationRetryTimer() {
  if (translationRetryTimer) {
    clearTimeout(translationRetryTimer)
    translationRetryTimer = null
  }
}

function scheduleTranslationRetry(slug: string, retryAfterMs?: number) {
  if (slug !== currentSlug || translation.value || isLikelyChineseSource.value) {
    return
  }

  if (translationRetryCount >= MAX_TRANSLATION_RETRY_COUNT) {
    translationError.value = '中文阅读版仍在后台生成，完成后再次打开会直接读取缓存'
    return
  }

  clearTranslationRetryTimer()
  translationRetryCount += 1
  const delay = Math.min(Math.max(retryAfterMs || 5000, 4000), 15000)
  translationRetryTimer = setTimeout(() => {
    if (slug === currentSlug && !translation.value && !isLikelyChineseSource.value) {
      void prefetchTranslation()
    }
  }, delay)
}

async function prefetchTranslation() {
  if (
    !currentSlug
    || translation.value
    || isLikelyChineseSource.value
  ) {
    return
  }

  const slug = currentSlug
  translating.value = true
  translationError.value = ''

  try {
    const result = await knowledgeStore.fetchTranslation(slug)

    if (result && currentSlug === result.slug && !result.isSourceChinese) {
      translation.value = result
      clearTranslationRetryTimer()
      translationRetryCount = 0
      if (autoShowTranslation.value) {
        showingTranslation.value = true
      }
    }
  } catch (err) {
    if (isTranslationPendingError(err)) {
      scheduleTranslationRetry(slug, err.retryAfterMs)
      return
    }
    translationError.value = normalizeTranslationError(err)
    return
  } finally {
    if (currentSlug === slug) {
      translating.value = false
    }
  }
}

function persistRecentKnowledge() {
  if (!article.value?.slug || !article.value?.title) {
    return
  }

  const currentItem = {
    slug: article.value.slug,
    title: displayedTitle.value || article.value.title,
    sourceLabel: formatSourceLabel(article.value.sourceOrg || article.value.source || '公开来源'),
    updatedAtLabel: formatDate(article.value.sourceUpdatedAt || article.value.publishedAt || article.value.createdAt) || '最近同步',
  }

  const stored = uni.getStorageSync(RECENT_KNOWLEDGE_STORAGE_KEY) as Array<typeof currentItem> | null
  const nextList = [currentItem, ...(Array.isArray(stored) ? stored : []).filter(item => item.slug !== currentItem.slug)].slice(0, 3)
  uni.setStorageSync(RECENT_KNOWLEDGE_STORAGE_KEY, nextList)
}

function buildContinueReadingMeta(input: {
  sourceLabel?: string
  updatedAtLabel?: string
  topic?: string | null
  audience?: string | null
}) {
  return [
    input.sourceLabel,
    input.topic || undefined,
    input.audience || undefined,
    input.updatedAtLabel,
  ].filter(Boolean).join(' · ')
}

function getArticleCardTitle(target: Pick<Article, 'title' | 'topic' | 'stage'> | RecentKnowledgeItem): string {
  return getKnowledgeDisplayTitle({
    title: target.title,
    topic: 'topic' in target ? target.topic : undefined,
    stage: 'stage' in target ? target.stage : undefined,
  })
}

function normalizeArticleStage(target?: Article | null): string {
  const stage = target?.stage || ''
  if (stageLabelMap[stage]) {
    return stage
  }

  const source = `${target?.audience || ''} ${target?.topic || ''}`.toLowerCase()
  if (/备孕/.test(source)) return 'preparation'
  if (/孕妇|孕期/.test(source)) return 'second-trimester'
  if (/新生儿/.test(source)) return '0-6-months'
  if (/婴幼儿|幼儿/.test(source)) return '1-3-years'
  return ''
}

function syncContinueReading() {
  const currentArticle = article.value
  if (!currentArticle?.slug) {
    continueReadingItems.value = []
    return
  }

  const currentRegionTag = getAuthorityRegionTag(currentArticle)
  const relatedFromApi = relatedArticles.value.map(item => ({
    slug: item.slug,
    title: getArticleCardTitle(item),
    meta: item.publishedAt ? `相关文章 · ${formatDate(item.publishedAt)}` : '相关文章',
    shouldWarmTranslation: false,
  }))
  const relatedFromStore = knowledgeStore.articles
    .filter(item => item.slug !== currentArticle.slug)
    .map((item) => {
      let score = 0
      if (currentArticle.topic && item.topic === currentArticle.topic) score += 5
      if ((currentArticle.sourceOrg || currentArticle.source) && (item.sourceOrg || item.source) === (currentArticle.sourceOrg || currentArticle.source)) score += 3
      if (getAuthorityRegionTag(item) === currentRegionTag) score += 2
      if (currentArticle.audience && item.audience === currentArticle.audience) score += 1
      return { item, score }
    })
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => ({
      slug: item.slug,
      title: getArticleCardTitle(item),
      meta: buildContinueReadingMeta({
        sourceLabel: formatSourceLabel(item.sourceOrg || item.source || '公开来源'),
        updatedAtLabel: formatDate(item.sourceUpdatedAt || item.publishedAt || item.createdAt) || '最近同步',
        topic: item.topic,
        audience: item.audience,
      }),
      shouldWarmTranslation: !isChineseKnowledgeArticle(item),
    }))

  const storedRecent = uni.getStorageSync(RECENT_KNOWLEDGE_STORAGE_KEY) as RecentKnowledgeItem[] | null
  const fallbackRecent = (Array.isArray(storedRecent) ? storedRecent : [])
    .filter(item => item.slug !== currentArticle.slug)
    .map(item => ({
      slug: item.slug,
      title: getArticleCardTitle(item),
      meta: buildContinueReadingMeta({
        sourceLabel: item.sourceLabel,
        updatedAtLabel: item.updatedAtLabel,
      }),
      shouldWarmTranslation: false,
    }))

  const merged = [...relatedFromStore, ...relatedFromApi, ...fallbackRecent]
  const uniqueItems: ContinueReadingItem[] = []
  merged.forEach((item) => {
    if (!item.slug || uniqueItems.some(existing => existing.slug === item.slug)) {
      return
    }
    uniqueItems.push(item)
  })

  continueReadingItems.value = uniqueItems.slice(0, 3)
}

function openContinueReading(slug: string) {
  const target = continueReadingItems.value.find(item => item.slug === slug)
  if (!slug || slug === currentSlug || !target) {
    return
  }

  currentSlug = slug
  shouldWarmTranslation.value = target.shouldWarmTranslation
  autoShowTranslation.value = target.shouldWarmTranslation
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  void loadArticleDetail(slug)
}

function goBackToKnowledge() {
  uni.switchTab({ url: '/pages/knowledge/index' })
}

function buildSharePayload() {
  const title = displayedTitle.value || article.value?.title || '贝护妈妈孕育资料库'
  const extra = currentSlug ? { slug: currentSlug } : undefined
  const path = currentSlug
    ? buildAcquisitionPath('/pages/knowledge-detail/index', extra)
    : buildAcquisitionPath('/pages/knowledge/index')
  const query = buildAcquisitionQuery(extra)

  return {
    title,
    path,
    query,
  }
}

function trackKnowledgeShare(channel: 'share_app_message' | 'share_timeline') {
  if (!article.value) {
    return
  }

  trackMiniEvent('app_knowledge_detail_share', {
    page: 'KnowledgeDetailPage',
    properties: {
      slug: currentSlug,
      articleSlug: article.value.slug || currentSlug,
      articleId: article.value.id,
      sourceOrg: article.value.sourceOrg || article.value.source || null,
      topic: article.value.topic || null,
      channel,
    },
  })
}

onShareAppMessage(() => {
  trackKnowledgeShare('share_app_message')
  return buildSharePayload()
})

onShareTimeline(() => {
  trackKnowledgeShare('share_timeline')
  const payload = buildSharePayload()
  return {
    title: payload.title,
    query: payload.query,
  }
})

watch(
  () => [displayedContent.value, contentOutline.value.length, translationError.value, continueReadingItems.value.length, Boolean(article.value?.slug)],
  () => {
    if (!article.value) {
      return
    }
    void measurePageMetrics()
  },
)
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: #f7f9fc;
}

.state-box {
  padding: 220rpx 40rpx;
  text-align: center;
}

.state-text {
  display: block;
  font-size: 28rpx;
  color: #7a8697;
  margin-bottom: 24rpx;
}

.state-text--error {
  color: #d84b4b;
}

.retry-btn {
  display: inline-flex;
  padding: 16rpx 42rpx;
  border-radius: 999rpx;
  background: #f36f45;
}

.retry-btn-text {
  color: #fff;
  font-size: 26rpx;
}

.article-detail {
  padding: 28rpx;
}

.article-header,
.authority-callout,
.context-board,
.summary-box,
.source-box,
.outline-box,
.translation-box,
.article-content,
.disclaimer-box,
.continue-reading-box {
  background: #fffcf8;
  border-radius: 28rpx;
  margin-bottom: 20rpx;
  padding: 28rpx;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.badge {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.badge-source {
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

.badge-topic {
  background: rgba(243, 111, 69, 0.12);
  color: #d35b34;
}

.badge-verified {
  background: rgba(74, 144, 226, 0.12);
  color: #2e73b7;
}

.badge-tier--cn {
  background: rgba(41, 121, 255, 0.12);
  color: #285eb7;
}

.badge-tier--global {
  background: rgba(126, 87, 194, 0.1);
  color: #6b4ab1;
}

.article-title {
  display: block;
  font-size: 40rpx;
  line-height: 1.45;
  font-weight: 700;
  color: #444;
  margin-bottom: 18rpx;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.meta-item {
  font-size: 24rpx;
  color: #7a8697;
}

.authority-callout {
  border: 2rpx solid transparent;
}

.authority-callout--cn {
  background: rgba(41, 121, 255, 0.06);
  border-color: rgba(41, 121, 255, 0.12);
}

.authority-callout--global {
  background: rgba(126, 87, 194, 0.06);
  border-color: rgba(126, 87, 194, 0.12);
}

.authority-callout-label {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: #444;
}

.authority-callout-text {
  display: block;
  margin-top: 10rpx;
  font-size: 25rpx;
  line-height: 1.7;
  color: #526072;
}

.risk-alert-box {
  margin-bottom: 24rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(180deg, #fff6f3 0%, #fffdfb 100%);
  border: 1rpx solid rgba(224, 112, 83, 0.22);
}

.risk-alert-label {
  display: block;
  color: #b94b35;
  font-size: 22rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
}

.risk-alert-title {
  display: block;
  margin-top: 10rpx;
  color: #2c3e47;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.4;
}

.risk-alert-desc {
  display: block;
  margin-top: 10rpx;
  color: #6e5b56;
  font-size: 24rpx;
  line-height: 1.72;
}

.risk-alert-link {
  margin-top: 14rpx;
  align-self: flex-start;
  display: inline-flex;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.72);
}

.risk-alert-link-text {
  color: #b05a3c;
  font-size: 23rpx;
  font-weight: 700;
}

.context-board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.context-card {
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: #f7f9fc;
}

.context-card-label {
  display: block;
  font-size: 22rpx;
  color: #7a8697;
}

.context-card-value {
  display: block;
  margin-top: 10rpx;
  font-size: 27rpx;
  line-height: 1.5;
  font-weight: 700;
  color: #444;
}

.summary-label,
.source-label {
  display: block;
  font-size: 24rpx;
  color: #7a8697;
  margin-bottom: 14rpx;
}

.summary-text,
.disclaimer-text {
  font-size: 28rpx;
  line-height: 1.7;
  color: #3a4653;
  text-align: justify;
  text-align-last: left;
}

.source-url {
  display: block;
  font-size: 28rpx;
  line-height: 1.7;
  color: #3a4653;
}

.source-url {
  word-break: break-all;
}

.source-box--muted {
  background: rgba(255, 255, 255, 0.78);
}

.source-btn {
  display: inline-flex;
  margin-top: 20rpx;
  align-items: center;
  justify-content: center;
  padding: 16rpx 28rpx;
  border-radius: 999rpx;
  background: #1f8f74;
}

.source-btn-text {
  font-size: 26rpx;
  color: #fff;
  font-weight: 600;
}

.outline-kicker {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: #507782;
}

.outline-title {
  display: block;
  margin-top: 10rpx;
  font-size: 30rpx;
  line-height: 1.35;
  font-weight: 800;
  color: #444;
}

.outline-item + .outline-item {
  margin-top: 14rpx;
}

.outline-item {
  margin-top: 18rpx;
  padding: 20rpx 22rpx;
  border-radius: 22rpx;
  background: rgba(247, 249, 252, 0.92);
}

.outline-item--sub {
  margin-left: 22rpx;
}

.outline-item-label {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: #7b95a0;
}

.outline-item-title {
  display: block;
  margin-top: 8rpx;
  font-size: 25rpx;
  line-height: 1.6;
  font-weight: 700;
  color: #2c3f4d;
}

.body-language-banner {
  margin-bottom: 24rpx;
  padding: 20rpx 22rpx;
  border-radius: 22rpx;
  background: rgba(31, 143, 116, 0.08);
  border: 1rpx solid rgba(31, 143, 116, 0.14);
}

.body-language-banner--translated {
  background: rgba(243, 111, 69, 0.08);
  border-color: rgba(243, 111, 69, 0.16);
}

.body-language-label {
  display: block;
  font-size: 24rpx;
  font-weight: 800;
  color: #275b50;
}

.body-language-banner--translated .body-language-label {
  color: #b75a36;
}

.body-language-text {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.65;
  color: #526072;
}

.content-text {
  font-size: 30rpx;
  line-height: 1.85;
  color: #444;
  text-align: justify;
  text-align-last: left;
}

.translation-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 14rpx;
}

.translation-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #444;
}

.translation-desc {
  display: block;
  font-size: 25rpx;
  line-height: 1.7;
  color: #66788a;
}

.translation-ready-text {
  display: block;
  margin-top: 12rpx;
  font-size: 23rpx;
  color: #1c7a63;
}

.continue-reading-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #444;
}

.continue-reading-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 25rpx;
  line-height: 1.7;
  color: #5d6b7b;
}

.continue-reading-item + .continue-reading-item {
  margin-top: 16rpx;
}

.continue-reading-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 20rpx;
  padding: 22rpx 24rpx;
  border-radius: 22rpx;
  background: #f7f9fc;
}

.continue-reading-copy {
  flex: 1;
}

.continue-reading-item-title {
  display: block;
  font-size: 26rpx;
  line-height: 1.55;
  font-weight: 700;
  color: #25303c;
}

.continue-reading-item-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #7a8592;
}

.continue-reading-action {
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 700;
  color: #f36f45;
}

.detail-actions {
  display: flex;
  margin-bottom: 20rpx;
}

.detail-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 20rpx 28rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.88);
}

.detail-link-btn-text {
  font-size: 26rpx;
  font-weight: 700;
  color: #3a4a5d;
}

.translation-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14rpx 24rpx;
  border-radius: 999rpx;
  background: #f36f45;
}

.translation-btn--disabled {
  opacity: 0.65;
  pointer-events: none;
}

.translation-btn-text {
  color: #fff;
  font-size: 24rpx;
  font-weight: 600;
}

.translation-error {
  display: block;
  margin-bottom: 16rpx;
  color: #d84b4b;
  font-size: 24rpx;
}

.body-fallback-notice {
  margin-bottom: 20rpx;
  padding: 18rpx 22rpx;
  border-radius: 20rpx;
  background: rgba(47, 124, 246, 0.08);
}

.body-fallback-notice-text {
  font-size: 24rpx;
  line-height: 1.6;
  color: #326ac8;
}

.floating-reading-tools {
  position: fixed;
  right: 28rpx;
  bottom: 48rpx;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14rpx;
}

.mini-progress-badge,
.mini-back-top {
  box-shadow: 0 14rpx 32rpx rgba(44, 58, 76, 0.12);
}

.mini-progress-badge {
  padding: 12rpx 22rpx;
  border-radius: 999rpx;
  background: rgba(255, 250, 246, 0.94);
  border: 1rpx solid rgba(197, 108, 71, 0.14);
}

.mini-progress-badge-text {
  color: #6e6157;
  font-size: 22rpx;
  font-weight: 800;
}

.mini-back-top {
  padding: 16rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(44, 64, 77, 0.94);
}

.mini-back-top-text {
  color: #fff;
  font-size: 23rpx;
  font-weight: 700;
}
</style>
