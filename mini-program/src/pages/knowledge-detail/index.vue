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
          <text v-if="article.isVerified" class="badge badge-verified">权威来源</text>
        </view>

        <text class="article-title">{{ displayedTitle }}</text>

        <view class="meta-row">
          <text v-if="article.audience" class="meta-item">{{ article.audience }}</text>
          <text v-if="article.region" class="meta-item">{{ article.region }}</text>
          <text class="meta-item">来源更新 {{ formatDate(article.sourceUpdatedAt || article.publishedAt || article.createdAt) }}</text>
          <text v-if="article.lastSyncedAt" class="meta-item">同步 {{ formatDate(article.lastSyncedAt) }}</text>
        </view>
      </view>

      <view class="authority-callout" :class="`authority-callout--${authorityRegionTag}`">
        <text class="authority-callout-label">{{ authorityRegionLabel }}</text>
        <text class="authority-callout-text">{{ authorityCalloutText }}</text>
      </view>

      <view class="read-guide-box">
        <text class="read-guide-title">建议这样阅读</text>
        <text
          v-for="item in detailHighlights"
          :key="item"
          class="read-guide-item"
        >
          {{ item }}
        </text>
      </view>

      <view v-if="displayedSummary" class="summary-box">
        <text class="summary-label">{{ showingTranslation ? '中文摘要' : '核心摘要' }}</text>
        <text class="summary-text">{{ displayedSummary }}</text>
      </view>

      <view v-if="displayedSourceUrl" class="source-box">
        <text class="source-label">原始来源</text>
        <text class="source-url">{{ displayedSourceUrl }}</text>
        <view class="source-btn" @tap="openSource(displayedSourceUrl)">
          <text class="source-btn-text">查看机构原文</text>
        </view>
      </view>
      <view v-else class="source-box source-box--muted">
        <text class="source-label">原始来源</text>
        <text class="source-url">当前未提供可直接打开的机构原文链接，请优先参考本页摘要、同步时间和机构标签。</text>
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

      <view class="share-bar">
        <button class="share-btn" open-type="share">
          <text class="share-btn-text">分享给家人</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import type { AuthorityArticleTranslation } from '@/api/modules'
import { useKnowledgeStore } from '@/stores/knowledge'
import { getAuthorityRegionLabel, getAuthorityRegionTag, isChineseAuthoritySource } from '@/utils/authority-source'

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

const displayedTitle = computed(() => (
  showingTranslation.value && translation.value?.translatedTitle
    ? translation.value.translatedTitle
    : (article.value?.title || '')
))

const displayedSummary = computed(() => (
  showingTranslation.value && translation.value?.translatedSummary
    ? translation.value.translatedSummary
    : (article.value?.summary || '')
))

const displayedSourceUrl = computed(() => sanitizeAuthoritySourceUrl(
  article.value?.sourceUrl,
  article.value?.sourceOrg || article.value?.source || '',
))

const displayedContent = computed(() => (
  showingTranslation.value && translation.value?.translatedContent
    ? formatRichArticleContent(translation.value.translatedContent)
    : formatRichArticleContent(article.value?.content || '')
))

const translationNoticeText = computed(() => (
  translation.value?.translationNotice || '以下内容由系统基于权威机构原文辅助翻译，仅用于阅读理解，不替代医疗建议。请以原始来源和线下医生意见为准。'
))

const sourceLanguageSample = computed(() => stripHtmlTags([
  article.value?.title || '',
  article.value?.summary || '',
  article.value?.content || '',
].join(' ')))

const isLikelyChineseSource = computed(() => (
  Boolean(translation.value?.isSourceChinese) || isMostlyChineseText(sourceLanguageSample.value)
))

const showTranslationEntry = computed(() => !isLikelyChineseSource.value)

const translationDisabled = computed(() => Boolean(isLikelyChineseSource.value && !showingTranslation.value))

const translationButtonText = computed(() => {
  if (translating.value) return '准备中...'
  if (translation.value?.isSourceChinese) return '原文已是中文'
  return showingTranslation.value ? '查看原文' : '查看中文'
})

const translationDescriptionText = computed(() => {
  if (translation.value?.isSourceChinese) {
    return translationNoticeText.value
  }

  if (showingTranslation.value) {
    return translationNoticeText.value
  }

  return '打开文章后会优先准备中文阅读版，生成一次后后续直接读取缓存。'
})

const authorityRegionLabel = computed(() => getAuthorityRegionLabel(article.value))
const authorityRegionTag = computed(() => getAuthorityRegionTag(article.value))
const authorityCalloutText = computed(() => {
  if (isChineseAuthoritySource(article.value)) {
    return '这篇内容来自中国权威机构公开资料，默认展示中文原文与同步时间。'
  }

  return '这篇内容来自国际权威机构公开资料，可切换中文辅助阅读并查看原文链接。'
})

const detailHighlights = computed(() => {
  const highlights: string[] = []

  if (isChineseAuthoritySource(article.value)) {
    highlights.push('先看中文原文和来源更新时间，适合直接核对政策、指南和官方口径。')
  } else {
    highlights.push('先看摘要，再决定是否切换中文辅助阅读或打开机构原文。')
  }

  if (article.value?.audience) {
    highlights.push(`当前更适合 ${article.value.audience} 人群参考，使用前先确认是否与你的阶段一致。`)
  } else {
    highlights.push('使用前先确认适用阶段和对象，避免把通用建议直接套用到个体情况。')
  }

  highlights.push('如果内容涉及症状恶化、紧急情况或个体治疗方案，请结合线下医生意见判断。')
  return highlights
})

const translationReadyText = computed(() => {
  if (!showTranslationEntry.value) return ''
  if (translating.value) return '正在准备译文，保持当前页面即可。'
  if (translation.value && !showingTranslation.value) return '中文阅读版已准备好，点“查看中文”可直接切换。'
  if (translation.value && showingTranslation.value) return '当前正在查看中文辅助阅读版。'
  return ''
})

onLoad((options) => {
  if (typeof options?.slug === 'string') {
    currentSlug = options.slug
    shouldWarmTranslation.value = options?.translation === '1'
    autoShowTranslation.value = options?.translation === '1'
    void loadArticleDetail(options.slug)
  }
})

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
  if (!value) return ''

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

function retryLoad() {
  if (currentSlug) {
    void loadArticleDetail(currentSlug)
  }
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, ' ')
}

function isMostlyChineseText(input: string): boolean {
  const text = input.replace(/\s+/g, '')
  if (!text) return false

  const chineseCount = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length
  const latinCount = (text.match(/[A-Za-z]/g) || []).length

  if (chineseCount >= 24 && chineseCount >= latinCount) {
    return true
  }

  const letterCount = chineseCount + latinCount
  if (!letterCount) return false

  return chineseCount / letterCount >= 0.45
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function appendInlineStyle(attrs: string | undefined, inlineStyle: string): string {
  const normalizedAttrs = attrs || ''
  const styleMatch = normalizedAttrs.match(/\sstyle=(['"])(.*?)\1/i)

  if (!styleMatch) {
    return `${normalizedAttrs} style="${inlineStyle}"`
  }

  const quote = styleMatch[1]
  const existing = styleMatch[2]?.trim() || ''
  const merged = existing.endsWith(';') ? `${existing}${inlineStyle}` : `${existing};${inlineStyle}`
  return normalizedAttrs.replace(/\sstyle=(['"])(.*?)\1/i, ` style=${quote}${merged}${quote}`)
}

function addBlockSpacingToHtml(html: string): string {
  const blockStyles: Array<{ tag: string; style: string }> = [
    { tag: 'p', style: 'margin:0 0 1.1em;line-height:1.9;display:block;' },
    { tag: 'li', style: 'margin:0 0 0.7em;line-height:1.9;' },
    { tag: 'ul', style: 'margin:0 0 1em 1.2em;padding:0;' },
    { tag: 'ol', style: 'margin:0 0 1em 1.2em;padding:0;' },
    { tag: 'h1', style: 'margin:0 0 0.9em;line-height:1.5;font-weight:700;' },
    { tag: 'h2', style: 'margin:0 0 0.9em;line-height:1.55;font-weight:700;' },
    { tag: 'h3', style: 'margin:0 0 0.8em;line-height:1.6;font-weight:700;' },
  ]

  return blockStyles.reduce((result, item) => (
    result.replace(new RegExp(`<${item.tag}(\\s[^>]*)?>`, 'gi'), (_match, attrs?: string) => (
      `<${item.tag}${appendInlineStyle(attrs, item.style)}>`
    ))
  ), html)
}

function sanitizeAuthoritySourceUrl(url?: string, sourceText = ''): string {
  if (!url) {
    return ''
  }

  let pathname = ''
  try {
    pathname = new URL(url).pathname.toLowerCase().replace(/\/+$/g, '') || '/'
  } catch {
    return ''
  }

  const normalizedSource = `${sourceText} ${url}`.toLowerCase()
  const exactLandingPaths = new Set([
    '/',
    '/news-room',
    '/health-topics',
    '/health-topics/maternal-health',
    '/health-topics/child-health',
    '/health-topics/breastfeeding',
    '/health-topics/vaccines-and-immunization',
    '/pregnancy',
    '/breastfeeding',
    '/parents',
    '/child-development',
    '/vaccines-children',
    '/vaccines-pregnancy',
    '/vaccines-for-children',
    '/reproductivehealth',
    '/womens-health',
    '/contraception',
    '/growthcharts',
    '/ncbddd',
    '/act-early',
    '/early-care',
    '/protect-children',
    '/medicines-and-pregnancy',
    '/opioid-use-during-pregnancy',
    '/pregnancy-hiv-std-tb-hepatitis',
    '/english/ages-stages',
    '/english/health-issues',
    '/english/healthy-living',
    '/english/safety-prevention',
    '/english/family-life',
    '/clinical',
    '/topics',
    '/conditions',
    '/conditions/baby',
    '/conditions/pregnancy-and-baby',
    '/medicines',
    '/vaccinations',
    '/start-for-life',
  ])

  if (exactLandingPaths.has(pathname)) {
    return ''
  }

  if (/chinacdc|中国疾病预防控制中心/u.test(normalizedSource)) {
    if (pathname === '/' || pathname.endsWith('/list.html') || !/(?:\/t\d{8}_\d+\.(?:html?|shtml)|\.pdf(?:$|[?#]))/i.test(url)) {
      return ''
    }
  }

  if (/ndcpa|国家疾病预防控制局/u.test(normalizedSource)) {
    if (pathname === '/' || pathname.endsWith('/list.html') || !/\/common\/content\/content_\d+\.html(?:$|[?#])/i.test(url)) {
      return ''
    }
  }

  return url
}

function convertTextToRichHtml(text: string): string {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/([。！？!?；;])(?=(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|附件|附：|提示|建议|结论|原因|措施|何时就医))/gu, '$1\n')
    .trim()

  const blocks = normalized.split(/\n+/).map(line => line.trim()).filter(Boolean)
  const paragraphs: string[] = []
  let current = ''

  const pushCurrent = () => {
    if (current.trim()) {
      paragraphs.push(current.trim())
      current = ''
    }
  }

  blocks.forEach((line) => {
    const isHeading = /^(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|附件|附：|提示|建议|结论|原因|措施|何时就医)/u.test(line) && !/[。！？!?；;]$/.test(line)
    if (isHeading) {
      pushCurrent()
      paragraphs.push(line)
      return
    }

    const candidate = `${current} ${line}`.trim()
    if (current && candidate.length > 120) {
      pushCurrent()
      current = line
      return
    }

    current = candidate
  })

  pushCurrent()

  return paragraphs
    .map((line) => `<p style="margin:0 0 1.1em;line-height:1.9;display:block;">${escapeHtml(line)}</p>`)
    .join('')
}

function formatRichArticleContent(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) {
    return ''
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return addBlockSpacingToHtml(trimmed)
  }

  return convertTextToRichHtml(trimmed)
}

function openSource(url?: string) {
  if (!url) {
    uni.showToast({ title: '来源链接不可用', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
}

function normalizeTranslationError(err: unknown): string {
  const message = err instanceof Error ? err.message : '翻译失败，请稍后重试'
  if (/timeout|超时|timed out/i.test(message)) {
    return '译文生成时间较长，请稍后再试'
  }

  return message
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
      const message = normalizeTranslationError(err)
      translationError.value = message
      uni.showToast({ title: '翻译失败', icon: 'none' })
      return
    } finally {
      translating.value = false
    }
  }

  showingTranslation.value = true
}

async function loadArticleDetail(slug: string) {
  translation.value = knowledgeStore.getCachedTranslation(slug)
  translating.value = false
  translationError.value = ''
  showingTranslation.value = Boolean(translation.value && !translation.value.isSourceChinese && autoShowTranslation.value)

  const articleDetailTask = knowledgeStore.fetchArticleDetail(slug)
  if (shouldWarmTranslation.value && !translation.value) {
    void prefetchTranslation()
  }

  await articleDetailTask
  persistRecentKnowledge()
  syncContinueReading()

  if (!translation.value && !isLikelyChineseSource.value) {
    void prefetchTranslation()
  }
}

async function ensureTranslationLoaded(slug: string): Promise<AuthorityArticleTranslation> {
  const result = await knowledgeStore.fetchTranslation(slug)
  if (currentSlug === slug) {
    translation.value = result
  }
  return result
}

async function prefetchTranslation() {
  if (
    !currentSlug
    || translation.value
    || isLikelyChineseSource.value
  ) {
    return
  }

  try {
    const result = await ensureTranslationLoaded(currentSlug)
    if (currentSlug === result.slug && autoShowTranslation.value && !result.isSourceChinese) {
      showingTranslation.value = true
    }
  } catch {
    return
  }
}

function persistRecentKnowledge() {
  if (!article.value?.slug || !article.value?.title) {
    return
  }

  const currentItem = {
    slug: article.value.slug,
    title: article.value.title,
    sourceLabel: formatSourceLabel(article.value.sourceOrg || article.value.source || '权威来源'),
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

function syncContinueReading() {
  const currentArticle = article.value
  if (!currentArticle?.slug) {
    continueReadingItems.value = []
    return
  }

  const currentRegionTag = getAuthorityRegionTag(currentArticle)
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
      title: item.title,
      meta: buildContinueReadingMeta({
        sourceLabel: formatSourceLabel(item.sourceOrg || item.source || '权威来源'),
        updatedAtLabel: formatDate(item.sourceUpdatedAt || item.publishedAt || item.createdAt) || '最近同步',
        topic: item.topic,
        audience: item.audience,
      }),
      shouldWarmTranslation: item.sourceLanguage !== 'zh' && item.sourceLocale !== 'zh-CN',
    }))

  const storedRecent = uni.getStorageSync(RECENT_KNOWLEDGE_STORAGE_KEY) as RecentKnowledgeItem[] | null
  const fallbackRecent = (Array.isArray(storedRecent) ? storedRecent : [])
    .filter(item => item.slug !== currentArticle.slug)
    .map(item => ({
      slug: item.slug,
      title: item.title,
      meta: buildContinueReadingMeta({
        sourceLabel: item.sourceLabel,
        updatedAtLabel: item.updatedAtLabel,
      }),
      shouldWarmTranslation: false,
    }))

  const merged = [...relatedFromStore, ...fallbackRecent]
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
  const title = displayedTitle.value || article.value?.title || '贝护妈妈权威知识库'
  const path = currentSlug
    ? `/pages/knowledge-detail/index?slug=${encodeURIComponent(currentSlug)}`
    : '/pages/knowledge/index'
  const query = currentSlug ? `slug=${encodeURIComponent(currentSlug)}` : ''

  return {
    title,
    path,
    query,
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
.read-guide-box,
.summary-box,
.source-box,
.translation-box,
.article-content,
.disclaimer-box,
.continue-reading-box {
  background: #fff;
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
  color: #1f2a37;
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
  color: #24303d;
}

.authority-callout-text {
  display: block;
  margin-top: 10rpx;
  font-size: 25rpx;
  line-height: 1.7;
  color: #526072;
}

.read-guide-title {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: #24303d;
}

.read-guide-item {
  display: block;
  margin-top: 12rpx;
  font-size: 25rpx;
  line-height: 1.7;
  color: #5d6b7b;
}

.summary-label,
.source-label {
  display: block;
  font-size: 24rpx;
  color: #7a8697;
  margin-bottom: 14rpx;
}

.summary-text,
.source-url,
.disclaimer-text {
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
  padding: 16rpx 28rpx;
  border-radius: 999rpx;
  background: #1f8f74;
}

.source-btn-text {
  font-size: 26rpx;
  color: #fff;
  font-weight: 600;
}

.content-text {
  font-size: 30rpx;
  line-height: 1.85;
  color: #24303d;
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
  color: #24303d;
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
  color: #24303d;
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

.share-bar {
  padding: 16rpx 0 40rpx;
}

.share-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 24rpx 0;
  border-radius: 28rpx;
  background: #f36f45;
  border: none;
  line-height: 1;
}

.share-btn::after {
  border: none;
}

.share-btn-text {
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
}
</style>
