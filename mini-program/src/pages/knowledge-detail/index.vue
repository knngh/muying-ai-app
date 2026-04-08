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
            {{ article.sourceOrg || article.source }}
          </text>
          <text v-if="article.topic" class="badge badge-topic">{{ article.topic }}</text>
          <text v-if="article.isVerified" class="badge badge-verified">权威来源</text>
        </view>

        <text class="article-title">{{ displayedTitle }}</text>

        <view class="meta-row">
          <text v-if="article.audience" class="meta-item">{{ article.audience }}</text>
          <text v-if="article.region" class="meta-item">{{ article.region }}</text>
          <text class="meta-item">{{ formatDate(article.publishedAt || article.createdAt) }}</text>
        </view>
      </view>

      <view v-if="displayedSummary" class="summary-box">
        <text class="summary-label">{{ showingTranslation ? '中文摘要' : '核心摘要' }}</text>
        <text class="summary-text">{{ displayedSummary }}</text>
      </view>

      <view v-if="article.sourceUrl" class="source-box">
        <text class="source-label">原始来源</text>
        <text class="source-url">{{ article.sourceUrl }}</text>
        <view class="source-btn" @tap="openSource(article.sourceUrl)">
          <text class="source-btn-text">查看机构原文</text>
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
      </view>

      <view class="article-content">
        <text v-if="translationError" class="translation-error">{{ translationError }}</text>
        <rich-text :nodes="displayedContent" class="content-text" />
      </view>

      <view v-if="article.disclaimer" class="disclaimer-box">
        <text class="disclaimer-text">{{ article.disclaimer }}</text>
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
import { articleApi, type AuthorityArticleTranslation } from '@/api/modules'
import { useKnowledgeStore } from '@/stores/knowledge'

const knowledgeStore = useKnowledgeStore()
let currentSlug = ''

const article = computed(() => knowledgeStore.currentArticle)
const loading = computed(() => knowledgeStore.loading)
const error = computed(() => knowledgeStore.error)
const translation = ref<AuthorityArticleTranslation | null>(null)
const translating = ref(false)
const translationError = ref('')
const showingTranslation = ref(false)
const translationPrefetchStarted = ref(false)

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

onLoad((options) => {
  if (typeof options?.slug === 'string') {
    currentSlug = options.slug
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

async function toggleTranslation() {
  if (!article.value || !currentSlug || translating.value || translationDisabled.value) {
    return
  }

  if (showingTranslation.value) {
    showingTranslation.value = false
    return
  }

  if (!translation.value) {
    translating.value = true
    translationError.value = ''
    try {
      translation.value = await articleApi.getTranslation(currentSlug)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '翻译失败，请稍后重试'
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
  translation.value = null
  translating.value = false
  translationError.value = ''
  showingTranslation.value = false
  translationPrefetchStarted.value = false

  await knowledgeStore.fetchArticleDetail(slug)

  if (!isLikelyChineseSource.value) {
    void prefetchTranslation()
  }
}

async function prefetchTranslation() {
  if (
    !currentSlug
    || translation.value
    || translating.value
    || translationPrefetchStarted.value
    || isLikelyChineseSource.value
  ) {
    return
  }

  translationPrefetchStarted.value = true
  try {
    translation.value = await articleApi.getTranslation(currentSlug)
  } catch {
    translationPrefetchStarted.value = false
  }
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
.summary-box,
.source-box,
.translation-box,
.article-content,
.disclaimer-box {
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
