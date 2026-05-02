import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import {
  View,
  FlatList,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import {
  Text,
  Searchbar,
  Card,
  Chip,
  ActivityIndicator,
  IconButton,
  Button,
} from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RootStackParamList } from '../navigation/AppNavigator'
import { ScreenContainer } from '../components/layout'
import type { ApiError } from '../api'
import { config } from '../config'
import { trackAppEvent } from '../services/analytics'
import { useAppStore } from '../stores/appStore'
import { useKnowledgeStore, type RecentAIHitArticle } from '../stores/knowledgeStore'
import { buildKnowledgeDetailChatContext } from '../utils/aiEntryContext'
import { buildKnowledgeDetailQuestion } from '../utils/aiEntryPrompts'
import { getStageSummary, type LifecycleStageKey } from '../utils/stage'
import { KNOWLEDGE_STAGE_OPTIONS } from '../utils/knowledgeStage'
import { colors, spacing, fontSize, categoryColors, borderRadius } from '../theme'
import { articleApi, type Article, type AuthorityArticleTranslation } from '../api/modules'
import {
  buildKnowledgeSourceDigest as buildKnowledgeSourceDigestShared,
  buildKnowledgeVariantReadingSuggestion as buildKnowledgeVariantReadingSuggestionShared,
  buildKnowledgeVariantFilterFeedback as buildKnowledgeVariantFilterFeedbackShared,
  buildKnowledgeVariantRecommendation as buildKnowledgeVariantRecommendationShared,
  buildKnowledgeRepresentativeReason as buildKnowledgeRepresentativeReasonShared,
  buildKnowledgeVariantDifference as buildKnowledgeVariantDifferenceShared,
  buildKnowledgeVariantPreview as buildKnowledgeVariantPreviewShared,
  buildKnowledgeReadingMeta as buildKnowledgeReadingMetaShared,
  filterKnowledgeVariants as filterKnowledgeVariantsShared,
  formatKnowledgeDisplayDate as formatKnowledgeDisplayDateShared,
  getKnowledgeDisplayTags as getKnowledgeDisplayTagsShared,
  getKnowledgeDisplayTitle as getKnowledgeDisplayTitleShared,
  groupKnowledgeArticles as groupKnowledgeArticlesShared,
  getKnowledgeSourceLabel as getKnowledgeSourceLabelShared,
  getKnowledgeSourceSignal as getKnowledgeSourceSignalShared,
  getKnowledgeStageLabel as getKnowledgeStageLabelShared,
  isGenericForeignTitle,
  isChineseKnowledgeArticle as isChineseKnowledgeArticleShared,
  normalizeKnowledgeLabel as normalizeKnowledgeLabelShared,
  normalizePlainText,
  sanitizeTranslationText,
  sortKnowledgeVariants as sortKnowledgeVariantsShared,
  shouldHideAuthorityCategoryChip as shouldHideAuthorityCategoryChipShared,
} from '../utils/knowledgeText'

type KnowledgeNavProp = StackNavigationProp<RootStackParamList>
type KnowledgeArticleGroup = ReturnType<typeof groupKnowledgeArticlesShared>[number]

type RecentAIHitTopic = {
  topic: string
  displayName: string
  count: number
  latestHitAt: string
  sampleSlug: string
  sampleQaId?: string
  originEntrySource?: string
  originReportId?: string
}

type RecentAIHitSource = {
  source: string
  displayName: string
  query: string
  count: number
  latestHitAt: string
  sampleSlug: string
  sampleQaId?: string
  originEntrySource?: string
  originReportId?: string
}

const RECENT_AI_HIT_SIGNAL_WINDOW_HOURS = 48
const variantFilterOptions = [
  { label: '全部版本', value: 'all' as const },
  { label: '仅中文源', value: 'zh' as const },
  { label: '最近版本', value: 'latest' as const },
]

const variantSortOptions = [
  { label: '推荐顺序', value: 'recommended' as const },
  { label: '最近更新', value: 'recent' as const },
  { label: '中文优先', value: 'zhFirst' as const },
]

const stageOptions = KNOWLEDGE_STAGE_OPTIONS

const lifecycleStageMap: Record<LifecycleStageKey, string> = {
  preparing: 'preparation',
  pregnant_early: 'first-trimester',
  pregnant_mid: 'second-trimester',
  pregnant_late: 'third-trimester',
  postpartum_newborn: 'newborn',
  postpartum_recovery: 'postpartum',
  infant_0_6: '0-6-months',
  infant_6_12: '6-12-months',
  toddler_1_3: '1-3-years',
  child_3_plus: '3-years-plus',
}

const stageLabelMap = Object.fromEntries(
  stageOptions
    .filter((option) => option.value)
    .map((option) => [option.value as string, option.label]),
) as Record<string, string>

function formatArticleSource(article: Article) {
  return getKnowledgeSourceLabelShared(article)
}

function formatArticleStage(stage?: string) {
  if (!stage) return '全阶段'
  return getKnowledgeStageLabelShared(stage, stageLabelMap[stage] || '全阶段')
}

function formatArticleDate(article: Article) {
  return formatKnowledgeDisplayDateShared(article, 'iso')
}

function resolveSourceSignal(article: Article) {
  return getKnowledgeSourceSignalShared(article)
}

function isChineseArticle(article: Article) {
  return isChineseKnowledgeArticleShared(article)
}

function normalizeKnowledgeLabel(label?: string) {
  return normalizeKnowledgeLabelShared(label)
}

function shouldHideAuthorityCategoryChip(article: Article) {
  return shouldHideAuthorityCategoryChipShared(article)
}

function getArticleDisplayTags(article: Article) {
  return getKnowledgeDisplayTagsShared(article)
}

function shouldAutoApplyStageFilter(stage: string | null) {
  return Boolean(stage && stage !== 'preparation')
}

function getTranslatedHeadline(summary?: string) {
  const value = (summary || '').trim()
  if (!value) return ''

  return value
    .split(/[。！？.!?]/u)[0]
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 30)
}

function getLocalizedFallbackTitle(article: Article) {
  return getKnowledgeDisplayTitleShared(article)
}

function getReadingMeta(article: Article) {
  return buildKnowledgeReadingMetaShared(article)
}

function getVariantPreview(article: Article) {
  return buildKnowledgeVariantPreviewShared(article)
}

function getRepresentativeReason(article: Article, variants: Article[]) {
  return buildKnowledgeRepresentativeReasonShared(article, variants)
}

function getVariantDifference(representative: Article, variant: Article) {
  return buildKnowledgeVariantDifferenceShared(representative, variant)
}

function getFilteredVariants(representative: Article, variants: Article[], mode: 'all' | 'zh' | 'latest') {
  return filterKnowledgeVariantsShared(representative, variants, mode)
}

function getVisibleVariants(
  representative: Article,
  variants: Article[],
  filterMode: 'all' | 'zh' | 'latest',
  sortMode: 'recommended' | 'recent' | 'zhFirst',
) {
  return sortKnowledgeVariantsShared(getFilteredVariants(representative, variants, filterMode), sortMode)
}

function getVariantRecommendation(representative: Article, variants: Article[]) {
  return buildKnowledgeVariantRecommendationShared(representative, variants)
}

function getVariantFilterFeedback(representative: Article, variants: Article[], mode: 'all' | 'zh' | 'latest') {
  return buildKnowledgeVariantFilterFeedbackShared(representative, variants, mode)
}

function getVariantSourceDigest(representative: Article, variants: Article[]) {
  return buildKnowledgeSourceDigestShared([representative, ...variants])
}

function getVariantReadingSuggestion(representative: Article, variants: Article[]) {
  return buildKnowledgeVariantReadingSuggestionShared([representative, ...variants])
}

function getRecentAiHitDisplayTitle(item: RecentAIHitArticle) {
  if (!isGenericForeignTitle(item.title)) {
    return item.title || '权威参考'
  }

  const stage = item.stage ? formatArticleStage(item.stage) : '全阶段'
  const primary = normalizeKnowledgeLabel(item.topic) || (stage !== '全阶段' ? stage : '权威')
  return `${primary}参考`
}

function formatRecentHitTime(value?: string) {
  if (!value) return '刚刚命中'

  const diffMs = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diffMs) || diffMs < 0) return '刚刚命中'

  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return '刚刚命中'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前命中`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} 小时前命中`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} 天前命中`
}

function formatRecentHitReason(hit: RecentAIHitArticle) {
  if (hit.matchReason === 'entry_meta') return '沿用会话上下文'
  if (hit.matchReason === 'source_url') return '按来源链接命中'
  if (hit.matchReason === 'source_title') return '按来源标题命中'
  return '按主题关键词命中'
}

function shouldKeepRecentHitSignal(count: number, latestHitAt: string) {
  if (count >= 2) {
    return true
  }

  const timestamp = new Date(latestHitAt).getTime()
  if (Number.isNaN(timestamp)) {
    return false
  }

  const maxAgeMs = RECENT_AI_HIT_SIGNAL_WINDOW_HOURS * 60 * 60 * 1000
  return Date.now() - timestamp <= maxAgeMs
}

function buildRecentAIHitTopics(items: RecentAIHitArticle[]): RecentAIHitTopic[] {
  const topicMap = new Map<string, RecentAIHitTopic>()

  for (const item of items) {
    const displayName = normalizeKnowledgeLabel(item.topic)
    if (!displayName) {
      continue
    }

    const key = displayName.toLowerCase()
    const existing = topicMap.get(key)
    if (!existing) {
      topicMap.set(key, {
        topic: item.topic || displayName,
        displayName,
        count: 1,
        latestHitAt: item.lastHitAt,
        sampleSlug: item.slug,
        sampleQaId: item.qaId,
        originEntrySource: item.originEntrySource,
        originReportId: item.originReportId,
      })
      continue
    }

    existing.count += 1
    if (item.lastHitAt > existing.latestHitAt) {
      existing.latestHitAt = item.lastHitAt
      existing.sampleSlug = item.slug
      existing.sampleQaId = item.qaId
      existing.originEntrySource = item.originEntrySource
      existing.originReportId = item.originReportId
    }
  }

  return Array.from(topicMap.values())
    .filter((item) => shouldKeepRecentHitSignal(item.count, item.latestHitAt))
    .sort((left, right) => right.count - left.count || right.latestHitAt.localeCompare(left.latestHitAt))
    .slice(0, 5)
}

function buildRecentAIHitSources(items: RecentAIHitArticle[]): RecentAIHitSource[] {
  const sourceMap = new Map<string, RecentAIHitSource>()

  for (const item of items) {
    const rawSource = (item.sourceOrg || item.source || '').trim()
    const displayName = normalizeKnowledgeLabel(rawSource)
    if (!displayName) {
      continue
    }

    const key = displayName.toLowerCase()
    const existing = sourceMap.get(key)
    if (!existing) {
      sourceMap.set(key, {
        source: rawSource,
        displayName,
        query: rawSource || displayName,
        count: 1,
        latestHitAt: item.lastHitAt,
        sampleSlug: item.slug,
        sampleQaId: item.qaId,
        originEntrySource: item.originEntrySource,
        originReportId: item.originReportId,
      })
      continue
    }

    existing.count += 1
    if (item.lastHitAt > existing.latestHitAt) {
      existing.latestHitAt = item.lastHitAt
      existing.sampleSlug = item.slug
      existing.sampleQaId = item.qaId
      existing.originEntrySource = item.originEntrySource
      existing.originReportId = item.originReportId
    }
  }

  return Array.from(sourceMap.values())
    .filter((item) => shouldKeepRecentHitSignal(item.count, item.latestHitAt))
    .sort((left, right) => right.count - left.count || right.latestHitAt.localeCompare(left.latestHitAt))
    .slice(0, 5)
}

function buildRecentTopicQuestion(topic: string, stageLabel: string) {
  return `最近阅读问答多次命中“${topic}”这个主题。请结合我当前的${stageLabel}阶段，帮我梳理这个主题最值得关注的点，以及接下来可以怎么安排？`
}

function buildRecentSourceQuestion(source: string, stageLabel: string) {
  return `最近阅读问答多次引用${source}相关的权威内容。请结合我当前的${stageLabel}阶段，帮我总结这个来源下最值得优先看的主题，以及我接下来该关注什么？`
}

export default function KnowledgeScreen() {
  const navigation = useNavigation<KnowledgeNavProp>()
  const user = useAppStore((state) => state.user)
  const stageSummary = getStageSummary(user)
  const isPreparationLifecycle = stageSummary.lifecycleKey === 'preparing'
  const initializedLifecycleRef = useRef<string | null>(null)
  const suggestedKeywords = useMemo(
    () => (stageSummary.knowledgeKeywords || []).slice(0, 4),
    [stageSummary.knowledgeKeywords],
  )
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false)
  const [expandedVariantGroups, setExpandedVariantGroups] = useState<Record<string, boolean>>({})
  const [variantFilterModes, setVariantFilterModes] = useState<Record<string, 'all' | 'zh' | 'latest'>>({})
  const [variantSortModes, setVariantSortModes] = useState<Record<string, 'recommended' | 'recent' | 'zhFirst'>>({})
  const translationInFlightRef = useRef<Set<string>>(new Set())
  const [translations, setTranslations] = useState<Record<string, AuthorityArticleTranslation>>({})
  const [translationFailed, setTranslationFailed] = useState<Record<string, boolean>>({})
  const {
    articles,
    categories,
    tags,
    recentAiHitArticles,
    hydrateRecentAiHitArticles,
    total,
    page,
    selectedCategory,
    selectedTag,
    selectedStage,
    keyword,
    loading,
    error,
    errorDetail,
    fetchArticles,
    fetchCategories,
    fetchTags,
    setCategory,
    setTag,
    setStage,
    setKeyword,
    initializeFilters,
    search,
    reset,
  } = useKnowledgeStore()
  const displayedArticleGroups = useMemo(() => groupKnowledgeArticlesShared(articles), [articles])
  const mergedArticleCount = useMemo(
    () => displayedArticleGroups.reduce((count, group) => count + group.mergedCount, 0),
    [displayedArticleGroups],
  )

  useEffect(() => {
    const validSlugs = new Set(displayedArticleGroups.map((group) => group.article.slug))
    setExpandedVariantGroups((current) => Object.fromEntries(
      Object.entries(current).filter(([slug, expanded]) => expanded && validSlugs.has(slug)),
    ))
    setVariantFilterModes((current) => Object.fromEntries(
      Object.entries(current).filter(([slug]) => validSlugs.has(slug)),
    ) as Record<string, 'all' | 'zh' | 'latest'>)
    setVariantSortModes((current) => Object.fromEntries(
      Object.entries(current).filter(([slug]) => validSlugs.has(slug)),
    ) as Record<string, 'recommended' | 'recent' | 'zhFirst'>)
  }, [displayedArticleGroups])

  useEffect(() => {
    void fetchCategories()
    void fetchTags()
    void hydrateRecentAiHitArticles()
  }, [fetchCategories, fetchTags, hydrateRecentAiHitArticles])

  useEffect(() => {
    const initialStage = lifecycleStageMap[stageSummary.lifecycleKey] || null
    if (initializedLifecycleRef.current === initialStage) {
      return
    }

    initializedLifecycleRef.current = initialStage
    if (shouldAutoApplyStageFilter(initialStage)) {
      initializeFilters(initialStage)
      void fetchArticles({ reset: true })
      return
    }

    initializeFilters(null)
    void fetchArticles({ reset: true })
  }, [fetchArticles, initializeFilters, stageSummary.lifecycleKey])

  useEffect(() => {
    const candidates = articles
      .filter((item) => !isChineseArticle(item))
      .filter((item) => !translations[item.slug] && !translationFailed[item.slug])
      .filter((item) => !translationInFlightRef.current.has(item.slug))
      .slice(0, 6)

    if (candidates.length === 0) return

    let cancelled = false

    candidates.forEach((item) => {
      translationInFlightRef.current.add(item.slug)
      void articleApi.kickoffTranslation(item.slug)
        .then((nextTranslation) => {
          if (cancelled || !nextTranslation) return
          setTranslations((prev) => ({ ...prev, [item.slug]: nextTranslation }))
        })
        .catch(() => {
          if (cancelled) return
          setTranslationFailed((prev) => ({ ...prev, [item.slug]: true }))
        })
        .finally(() => {
          translationInFlightRef.current.delete(item.slug)
        })
    })

    return () => {
      cancelled = true
    }
  }, [articles, translationFailed, translations])

  const activeStageLabel = selectedStage ? formatArticleStage(selectedStage) : '全部阶段'
  const activeCategoryLabel = selectedCategory
    ? categories.find((item) => item.slug === selectedCategory)?.name || '已选分类'
    : ''
  const activeTagLabel = selectedTag
    ? tags.find((item) => item.slug === selectedTag)?.name || '已选标签'
    : ''
  const resolvedErrorDetail = errorDetail as ApiError | null
  const hasNetworkError = resolvedErrorDetail?.errorType === 'network' || resolvedErrorDetail?.errorType === 'timeout'
  const hasHttpError = resolvedErrorDetail?.errorType === 'http'
  const emptyTitle = hasNetworkError ? '知识库暂时连不上服务' : '当前筛选下还没有文章'
  const emptyText = hasNetworkError
    ? '当前设备到接口服务的连接异常或超时，不是内容为空。请优先检查当前网络、DNS、证书链路，再重新进入知识库。'
    : config.enablePublicAiFeatures
      ? '可以先放宽筛选范围，或直接继续提问；新同步的权威内容也会继续补入这里。'
      : '可以先放宽筛选范围，或换一个阶段主题继续检索；新同步的权威内容也会继续补入这里。'
  const errorBannerText = hasNetworkError
    ? `当前设备访问 ${resolvedErrorDetail?.requestUrl || '/articles'} 失败。请优先检查 beihu.me 域名解析、移动网络连通性与 HTTPS 证书配置。`
    : hasHttpError
      ? `服务已响应，但返回了 ${resolvedErrorDetail?.status || '--'} 状态。${error || ''}`
      : error || ''
  const recentAiHitTopics = useMemo(
    () => buildRecentAIHitTopics(recentAiHitArticles),
    [recentAiHitArticles],
  )
  const recentAiHitSources = useMemo(
    () => buildRecentAIHitSources(recentAiHitArticles),
    [recentAiHitArticles],
  )

  const handleSearch = useCallback(() => {
    if (keyword.trim()) {
      search(keyword.trim())
    } else {
      fetchArticles({ reset: true })
    }
  }, [keyword, search, fetchArticles])

  const handleLoadMore = useCallback(() => {
    if (!loading && articles.length < total) {
      fetchArticles({ page: page + 1 })
    }
  }, [loading, articles.length, total, page, fetchArticles])

  const handleClearFilters = useCallback(() => {
    reset()
    fetchArticles({ reset: true })
  }, [fetchArticles, reset])

  const handleQuickKeyword = useCallback((value: string) => {
    setKeyword(value)
    void search(value)
  }, [search, setKeyword])

  const handleOpenRecentAiHit = useCallback((item: RecentAIHitArticle) => {
    void trackAppEvent('app_knowledge_recent_ai_hit_click', {
      page: 'KnowledgeScreen',
      properties: {
        slug: item.slug,
        articleId: item.articleId,
        qaId: item.qaId || null,
        trigger: item.trigger || null,
        matchReason: item.matchReason || null,
        entrySource: item.originEntrySource || null,
        articleSlug: item.slug,
        reportId: item.originReportId || null,
      },
    })

    navigation.navigate('KnowledgeDetail', {
      slug: item.slug,
      source: 'chat_hit',
      aiContext: {
        qaId: item.qaId,
        trigger: item.trigger,
        matchReason: item.matchReason,
        originEntrySource: item.originEntrySource,
        originReportId: item.originReportId,
      },
    })
  }, [navigation])

  const handleOpenRecentAiTopic = useCallback((item: RecentAIHitTopic) => {
    void trackAppEvent('app_knowledge_recent_ai_topic_click', {
      page: 'KnowledgeScreen',
      properties: {
        topic: item.topic,
        displayName: item.displayName,
        hitCount: item.count,
        sampleSlug: item.sampleSlug,
        qaId: item.sampleQaId || null,
        entrySource: item.originEntrySource || null,
        reportId: item.originReportId || null,
      },
    })

    setKeyword(item.displayName)
    void search(item.displayName)
  }, [search, setKeyword])

  const handleOpenRecentAiSource = useCallback((item: RecentAIHitSource) => {
    void trackAppEvent('app_knowledge_recent_ai_source_click', {
      page: 'KnowledgeScreen',
      properties: {
        sourceOrg: item.source,
        displayName: item.displayName,
        query: item.query,
        hitCount: item.count,
        sampleSlug: item.sampleSlug,
        qaId: item.sampleQaId || null,
        entrySource: item.originEntrySource || null,
        reportId: item.originReportId || null,
      },
    })

    setKeyword(item.query)
    void search(item.query)
  }, [search, setKeyword])

  const handleAskRecentAiArticle = useCallback((item: RecentAIHitArticle) => {
    if (!config.enablePublicAiFeatures) {
      handleOpenRecentAiHit(item)
      return
    }

    const title = getRecentAiHitDisplayTitle(item)
    const sourceOrg = item.sourceOrg || item.source || ''
    const summary = normalizePlainText(item.summary)
    const question = buildKnowledgeDetailQuestion({
      title,
      summary,
      sourceOrg,
      topic: item.topic,
    })

    void trackAppEvent('app_knowledge_recent_ai_ask_click', {
      page: 'KnowledgeScreen',
      properties: {
        targetType: 'article',
        slug: item.slug,
        articleId: item.articleId,
        qaId: item.qaId || null,
        entrySource: item.originEntrySource || null,
        articleSlug: item.slug,
        reportId: item.originReportId || null,
      },
    })

    navigation.navigate('Main', {
      screen: 'Chat',
      params: {
        prefillQuestion: question,
        prefillContext: {
          ...buildKnowledgeDetailChatContext({
            slug: item.slug,
            title,
            summary,
            sourceOrg,
            topic: item.topic,
            stageKey: stageSummary.lifecycleKey,
          }),
          entrySource: 'knowledge_recent_ai',
        },
        autoSend: true,
        source: 'knowledge_recent_ai',
      },
    })
  }, [handleOpenRecentAiHit, navigation, stageSummary.lifecycleKey])

  const handleAskRecentAiTopic = useCallback((item: RecentAIHitTopic) => {
    if (!config.enablePublicAiFeatures) {
      setKeyword(item.displayName)
      void search(item.displayName)
      return
    }

    const question = buildRecentTopicQuestion(item.displayName, stageSummary.lifecycleLabel)

    void trackAppEvent('app_knowledge_recent_ai_ask_click', {
      page: 'KnowledgeScreen',
      properties: {
        targetType: 'topic',
        topic: item.topic,
        displayName: item.displayName,
        qaId: item.sampleQaId || null,
        entrySource: item.originEntrySource || null,
        articleSlug: item.sampleSlug,
        reportId: item.originReportId || null,
      },
    })

    navigation.navigate('Main', {
      screen: 'Chat',
      params: {
        prefillQuestion: question,
        prefillContext: {
          entrySource: 'knowledge_recent_ai',
          stage: stageSummary.lifecycleKey,
          articleSlug: item.sampleSlug,
          articleTopic: item.displayName,
          reportId: item.originReportId || null,
        },
        autoSend: true,
        source: 'knowledge_recent_ai',
      },
    })
  }, [navigation, search, setKeyword, stageSummary.lifecycleKey, stageSummary.lifecycleLabel])

  const handleAskRecentAiSource = useCallback((item: RecentAIHitSource) => {
    if (!config.enablePublicAiFeatures) {
      setKeyword(item.query)
      void search(item.query)
      return
    }

    const question = buildRecentSourceQuestion(item.displayName, stageSummary.lifecycleLabel)

    void trackAppEvent('app_knowledge_recent_ai_ask_click', {
      page: 'KnowledgeScreen',
      properties: {
        targetType: 'source',
        sourceOrg: item.source,
        displayName: item.displayName,
        qaId: item.sampleQaId || null,
        entrySource: item.originEntrySource || null,
        articleSlug: item.sampleSlug,
        reportId: item.originReportId || null,
      },
    })

    navigation.navigate('Main', {
      screen: 'Chat',
      params: {
        prefillQuestion: question,
        prefillContext: {
          entrySource: 'knowledge_recent_ai',
          stage: stageSummary.lifecycleKey,
          articleSlug: item.sampleSlug,
          articleSourceOrg: item.displayName,
          reportId: item.originReportId || null,
        },
        autoSend: true,
        source: 'knowledge_recent_ai',
      },
    })
  }, [navigation, search, setKeyword, stageSummary.lifecycleKey, stageSummary.lifecycleLabel])

  const toggleVariantGroup = useCallback((slug: string) => {
    setExpandedVariantGroups((current) => ({
      ...current,
      [slug]: !current[slug],
    }))
  }, [])

  const setVariantFilterMode = useCallback((slug: string, mode: 'all' | 'zh' | 'latest') => {
    setVariantFilterModes((current) => ({
      ...current,
      [slug]: mode,
    }))
  }, [])

  const setVariantSortMode = useCallback((slug: string, mode: 'recommended' | 'recent' | 'zhFirst') => {
    setVariantSortModes((current) => ({
      ...current,
      [slug]: mode,
    }))
  }, [])

  const renderArticleItem = ({ item: group }: { item: KnowledgeArticleGroup }) => {
    const item = group.article
    const catColor = item.category
      ? categoryColors[item.category.name] || colors.primary
      : colors.primary
    const categoryChipStyle = [styles.categoryChip, { backgroundColor: catColor + '20' }]
    const categoryChipTextStyle = { fontSize: fontSize.xs, color: catColor }
    const showCategoryChip = Boolean(item.category && !shouldHideAuthorityCategoryChip(item))
    const sourceSignal = resolveSourceSignal(item)
    const sourceLabel = formatArticleSource(item)
    const stageLabel = formatArticleStage(item.stage)
    const dateLabel = formatArticleDate(item)
    const previewTags = getArticleDisplayTags(item).slice(0, 2)
    const readingMeta = getReadingMeta(item)
    const representativeReason = getRepresentativeReason(item, group.variants)
    const variantRecommendation = getVariantRecommendation(item, group.variants)
    const rawTranslation = translations[item.slug]
    const translatedTitle = sanitizeTranslationText(rawTranslation?.translatedTitle, 'title')
    const translatedSummary = sanitizeTranslationText(rawTranslation?.translatedSummary, 'summary')
    const articleTranslation = rawTranslation && (translatedTitle || translatedSummary)
      ? {
          ...rawTranslation,
          translatedTitle,
          translatedSummary,
        }
      : undefined
    const translatedHeadline = getTranslatedHeadline(translatedSummary)
    const displayedTitle = translatedTitle
      || (isGenericForeignTitle(item.title)
        ? (translatedHeadline || getLocalizedFallbackTitle(item))
        : item.title)
    const displayedSummary = normalizePlainText(translatedSummary || item.summary)
    const isExpanded = Boolean(expandedVariantGroups[item.slug])
    const variantFilterMode = variantFilterModes[item.slug] || 'all'
    const variantSortMode = variantSortModes[item.slug] || 'recommended'
    const filteredVariants = getFilteredVariants(item, group.variants, variantFilterMode)
    const visibleVariants = getVisibleVariants(item, group.variants, variantFilterMode, variantSortMode)
    const variantFilterFeedback = getVariantFilterFeedback(item, group.variants, variantFilterMode)
    const variantSourceDigest = getVariantSourceDigest(item, visibleVariants)
    const variantReadingSuggestion = getVariantReadingSuggestion(item, visibleVariants)

    return (
      <Card
        style={styles.articleCard}
        onPress={() => navigation.navigate('KnowledgeDetail', { slug: item.slug })}
      >
        <Card.Content>
          <View style={styles.articleWash} />
          <View style={styles.articleTopRow}>
            <Text style={styles.articleEyebrow}>权威内容</Text>
            <View style={styles.articleSignalRow}>
              <Chip compact style={styles.signalBadge} textStyle={styles.signalBadgeText}>
                {sourceSignal}
              </Chip>
              {item.isVerified ? (
                <Chip compact style={styles.signalBadge} textStyle={styles.signalBadgeText}>
                  已核验
                </Chip>
              ) : null}
            </View>
          </View>
          <Text style={styles.articleTitle} numberOfLines={2}>
            {displayedTitle}
          </Text>
          {articleTranslation && !isChineseArticle(item) ? (
            <Text style={styles.articleAssistText} numberOfLines={1}>
              已准备中文辅助阅读
            </Text>
          ) : null}
          <View style={styles.articleSourceRow}>
            <Text style={styles.articleSourceText} numberOfLines={1} ellipsizeMode="tail">
              {sourceLabel}
            </Text>
            <View style={styles.articleDateBadge}>
              <Text style={styles.articleDateText} numberOfLines={1}>
                {dateLabel}
              </Text>
            </View>
          </View>
          <View style={styles.articleMeta}>
            <Chip compact style={styles.stageChip} textStyle={styles.stageChipText}>
              {stageLabel}
            </Chip>
            {showCategoryChip && item.category && (
              <Chip
                style={categoryChipStyle}
                textStyle={categoryChipTextStyle}
                compact
              >
                {item.category.name}
              </Chip>
            )}
            {previewTags.map((tag) => (
              <Chip key={tag.id} compact style={styles.tagPreviewChip} textStyle={styles.tagPreviewChipText}>
                {tag.displayName}
              </Chip>
              ))}
          </View>
          <View style={styles.readingMetaRow}>
            <View style={styles.readingMetaPill}>
              <Text style={styles.readingMetaText}>{readingMeta.estimatedMinutesLabel}</Text>
            </View>
            <View style={styles.readingMetaPill}>
              <Text style={styles.readingMetaText}>{readingMeta.textLengthLabel}</Text>
            </View>
            <View style={styles.readingMetaPill}>
              <Text style={styles.readingMetaText}>{readingMeta.sectionLabel}</Text>
            </View>
          </View>
          {displayedSummary ? (
            <Text style={styles.articleSummary} numberOfLines={2}>
              {displayedSummary}
            </Text>
          ) : null}
          {representativeReason ? (
            <View style={styles.representativeReason}>
              <View style={styles.representativeReasonBadge}>
                <Text style={styles.representativeReasonBadgeText}>{representativeReason.badge}</Text>
              </View>
              <Text style={styles.representativeReasonText}>{representativeReason.description}</Text>
            </View>
          ) : null}
          {group.mergedCount > 0 ? (
            <View style={styles.variantPanel}>
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.variantToggle}
                onPress={() => toggleVariantGroup(item.slug)}
              >
                <Text style={styles.variantToggleText}>
                  {isExpanded ? '收起同源版本' : `还有 ${group.mergedCount} 个同源版本`}
                </Text>
              </TouchableOpacity>
              {isExpanded ? (
                <View style={styles.variantList}>
                  {variantRecommendation ? (
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={styles.variantRecommendation}
                      onPress={() => navigation.navigate('KnowledgeDetail', { slug: variantRecommendation.article.slug })}
                    >
                      <View style={styles.variantRecommendationCopy}>
                        <Text style={styles.variantRecommendationLabel}>{variantRecommendation.actionLabel}</Text>
                        <Text style={styles.variantRecommendationText}>{variantRecommendation.description}</Text>
                      </View>
                      <Text style={styles.variantRecommendationAction}>直接查看</Text>
                    </TouchableOpacity>
                  ) : null}
                  {group.variants.length > 1 ? (
                    <View style={styles.variantFilterRow}>
                      {variantFilterOptions.map((option) => (
                        <TouchableOpacity
                          key={`${item.slug}-${option.value}`}
                          activeOpacity={0.88}
                          style={variantFilterMode === option.value ? [styles.variantFilterChip, styles.variantFilterChipActive] : styles.variantFilterChip}
                          onPress={() => setVariantFilterMode(item.slug, option.value)}
                        >
                          <Text style={variantFilterMode === option.value ? [styles.variantFilterChipText, styles.variantFilterChipTextActive] : styles.variantFilterChipText}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                  {filteredVariants.length > 1 ? (
                    <View style={styles.variantSortRow}>
                      {variantSortOptions.map((option) => (
                        <TouchableOpacity
                          key={`${item.slug}-sort-${option.value}`}
                          activeOpacity={0.88}
                          style={variantSortMode === option.value ? [styles.variantSortChip, styles.variantSortChipActive] : styles.variantSortChip}
                          onPress={() => setVariantSortMode(item.slug, option.value)}
                        >
                          <Text style={variantSortMode === option.value ? [styles.variantSortChipText, styles.variantSortChipTextActive] : styles.variantSortChipText}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                  {variantFilterFeedback ? (
                    <View style={styles.variantFilterFeedback}>
                      <Text style={styles.variantFilterFeedbackLabel}>{variantFilterFeedback.label}</Text>
                      <Text style={styles.variantFilterFeedbackText}>{variantFilterFeedback.description}</Text>
                    </View>
                  ) : null}
                  <View style={styles.variantSourceDigest}>
                    <Text style={styles.variantSourceDigestLabel}>{variantSourceDigest.summaryLabel}</Text>
                    <Text style={styles.variantSourceDigestText}>{variantSourceDigest.description}</Text>
                  </View>
                  <View style={styles.variantReadingSuggestion}>
                    <Text style={styles.variantReadingSuggestionLabel}>{variantReadingSuggestion.label}</Text>
                    <Text style={styles.variantReadingSuggestionText}>{variantReadingSuggestion.description}</Text>
                  </View>
                  {visibleVariants.length > 0 ? visibleVariants.map((variant) => {
                    const variantDifference = getVariantDifference(item, variant)
                    const variantPreview = getVariantPreview(variant)

                    return (
                    <TouchableOpacity
                      key={variant.slug}
                      activeOpacity={0.88}
                      style={styles.variantItem}
                      onPress={() => navigation.navigate('KnowledgeDetail', { slug: variant.slug })}
                    >
                      <Text style={styles.variantTitle} numberOfLines={2}>
                        {getKnowledgeDisplayTitleShared(variant)}
                      </Text>
                      <Text style={styles.variantMeta} numberOfLines={1}>{variantPreview.sourceLabel}</Text>
                      <View style={styles.variantHintRow}>
                        {variantDifference.badges.map((badge) => (
                          <View key={`${variant.slug}-hint-${badge}`} style={styles.variantHintBadge}>
                            <Text style={styles.variantHintBadgeText}>{badge}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={styles.variantChipRow}>
                        {variantPreview.chips.map((chip) => (
                          <View key={`${variant.slug}-${chip}`} style={styles.variantChip}>
                            <Text style={styles.variantChipText}>{chip}</Text>
                          </View>
                        ))}
                      </View>
                    </TouchableOpacity>
                    )
                  }) : (
                    <View style={styles.variantEmpty}>
                      <Text style={styles.variantEmptyText}>当前同源版本里没有符合筛选条件的结果。</Text>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.articleFooter}>
            <View style={styles.articleStats}>
              <View style={styles.statItem}>
                <IconButton icon="eye-outline" size={14} iconColor={colors.textSecondary} style={styles.statIcon} />
                <Text style={styles.statText}>{item.viewCount || 0}</Text>
              </View>
              <View style={styles.statItem}>
                <IconButton icon="thumb-up-outline" size={14} iconColor={colors.textSecondary} style={styles.statIcon} />
                <Text style={styles.statText}>{item.likeCount || 0}</Text>
              </View>
              <View style={styles.statItem}>
                <IconButton icon="bookmark-outline" size={14} iconColor={colors.textSecondary} style={styles.statIcon} />
                <Text style={styles.statText}>{item.collectCount || 0}</Text>
              </View>
            </View>
            <Text style={styles.articleCta}>查看详情</Text>
          </View>
        </Card.Content>
      </Card>
    )
  }

  const renderHeader = () => (
    <View>
      {recentAiHitArticles.length > 0 ? (
        <View style={styles.recentAiHitSection}>
          <View style={styles.recentAiHitHeader}>
            <View>
              <Text style={styles.recentAiHitEyebrow}>最近阅读线索</Text>
              <Text style={styles.recentAiHitTitle}>最近由阅读问答命中的权威文章</Text>
            </View>
            <Chip compact style={styles.recentAiHitBadge} textStyle={styles.recentAiHitBadgeText}>
              {recentAiHitArticles.length} 篇
            </Chip>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentAiHitRow}>
            {recentAiHitArticles.slice(0, 5).map((item) => (
              <TouchableOpacity
                key={`recent-ai-hit-${item.slug}`}
                activeOpacity={0.88}
                style={styles.recentAiHitCard}
                onPress={() => handleOpenRecentAiHit(item)}
              >
                <Text style={styles.recentAiHitCardEyebrow}>{formatRecentHitTime(item.lastHitAt)}</Text>
                <Text style={styles.recentAiHitCardTitle} numberOfLines={2}>{getRecentAiHitDisplayTitle(item)}</Text>
                <Text style={styles.recentAiHitCardMeta} numberOfLines={1}>
                  {normalizeKnowledgeLabel(item.sourceOrg || item.source) || '权威机构'}
                </Text>
                <View style={styles.recentAiHitCardFooter}>
                  <Chip compact style={styles.recentAiHitReasonChip} textStyle={styles.recentAiHitReasonChipText}>
                    {formatRecentHitReason(item)}
                  </Chip>
                  {item.topic ? (
                    <Text style={styles.recentAiHitTopic} numberOfLines={1}>{normalizeKnowledgeLabel(item.topic)}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {config.enablePublicAiFeatures ? (
            <View style={styles.recentAiAskRow}>
              {recentAiHitArticles[0] ? (
                <Button
                  mode="contained-tonal"
                  compact
                  icon="message-question-outline"
                  buttonColor="rgba(54,92,104,0.14)"
                  textColor={colors.techDark}
                  style={styles.recentAiAskButton}
                  onPress={() => handleAskRecentAiArticle(recentAiHitArticles[0])}
                >
                  围绕最近文章继续提问
                </Button>
              ) : null}
              {recentAiHitTopics[0] ? (
                <Button
                  mode="contained-tonal"
                  compact
                  icon="message-question-outline"
                  buttonColor="rgba(197,108,71,0.12)"
                  textColor={colors.primaryDark}
                  style={styles.recentAiAskButton}
                  onPress={() => handleAskRecentAiTopic(recentAiHitTopics[0])}
                >
                  围绕最近主题继续提问
                </Button>
              ) : null}
              {recentAiHitSources[0] ? (
                <Button
                  mode="contained-tonal"
                  compact
                  icon="message-question-outline"
                  buttonColor="rgba(184,138,72,0.14)"
                  textColor={colors.gold}
                  style={styles.recentAiAskButton}
                  onPress={() => handleAskRecentAiSource(recentAiHitSources[0])}
                >
                  围绕最近机构继续提问
                </Button>
              ) : null}
            </View>
          ) : null}
          {recentAiHitTopics.length > 0 ? (
            <View style={styles.recentAiTopicBox}>
              <Text style={styles.recentAiTopicTitle}>按命中主题继续看</Text>
              <View style={styles.recentAiTopicRow}>
                {recentAiHitTopics.map((item) => (
                  <TouchableOpacity
                    key={`recent-ai-topic-${item.displayName}`}
                    activeOpacity={0.88}
                    style={styles.recentAiTopicChip}
                    onPress={() => handleOpenRecentAiTopic(item)}
                  >
                    <Text style={styles.recentAiTopicName}>{item.displayName}</Text>
                    <Text style={styles.recentAiTopicCount}>{item.count} 次命中</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
          {recentAiHitSources.length > 0 ? (
            <View style={styles.recentAiSourceBox}>
              <Text style={styles.recentAiTopicTitle}>按权威机构继续看</Text>
              <View style={styles.recentAiTopicRow}>
                {recentAiHitSources.map((item) => (
                  <TouchableOpacity
                    key={`recent-ai-source-${item.displayName}`}
                    activeOpacity={0.88}
                    style={styles.recentAiSourceChip}
                    onPress={() => handleOpenRecentAiSource(item)}
                  >
                    <Text style={styles.recentAiSourceName}>{item.displayName}</Text>
                    <Text style={styles.recentAiTopicCount}>{item.count} 次引用</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <LinearGradient
        colors={['rgba(248,227,214,0.96)', 'rgba(241,209,191,0.92)', 'rgba(250,244,238,0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.filterPanel}
      >
        <View style={styles.filterGlow} />
        <View style={styles.filterRing} />
        <Text style={styles.filterPanelEyebrow}>筛选条件</Text>
        <Text style={styles.filterPanelTitle}>按阶段、分类和主题快速缩小范围</Text>
        <View style={styles.filterStatsRow}>
          <View style={styles.filterStatCard}>
            <Text style={styles.filterStatLabel}>当前阶段</Text>
            <Text style={styles.filterStatValue}>{stageSummary.lifecycleLabel}</Text>
          </View>
          <View style={styles.filterStatCard}>
            <Text style={styles.filterStatLabel}>筛选范围</Text>
            <Text style={styles.filterStatValue}>{activeStageLabel}</Text>
          </View>
          <View style={styles.filterStatCard}>
            <Text style={styles.filterStatLabel}>内容总量</Text>
            <Text style={styles.filterStatValue}>{total || articles.length} 篇</Text>
          </View>
        </View>

        <View style={styles.stageDropdownSection}>
          <Text style={styles.stageDropdownLabel}>阶段范围</Text>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.stageDropdownTrigger, stageDropdownOpen && styles.stageDropdownTriggerOpen]}
            onPress={() => setStageDropdownOpen((prev) => !prev)}
          >
            <View style={styles.stageDropdownCopy}>
              <Text style={styles.stageDropdownValue}>{activeStageLabel}</Text>
              <Text style={styles.stageDropdownHint}>{stageDropdownOpen ? '收起选项' : '点击切换阶段范围'}</Text>
            </View>
            <MaterialCommunityIcons
              name={stageDropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.techDark}
            />
          </TouchableOpacity>

          {stageDropdownOpen ? (
            <View style={styles.stageDropdownMenu}>
              {stageOptions.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.stageButton,
                    selectedStage === option.value && styles.stageButtonActive,
                  ]}
                  onPress={() => {
                    setStage(option.value)
                    setStageDropdownOpen(false)
                  }}
                  activeOpacity={0.88}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                >
                  <Text
                    style={[
                      styles.stageButtonText,
                      selectedStage === option.value && styles.stageButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      </LinearGradient>

      {/* Category Filter */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          <Chip
            selected={!selectedCategory}
            onPress={() => setCategory(null)}
            style={styles.filterChip}
            compact
          >
            全部
          </Chip>
          {categories.map((cat) => (
            <Chip
              key={cat.id}
              selected={selectedCategory === cat.slug}
              onPress={() =>
                setCategory(selectedCategory === cat.slug ? null : cat.slug)
              }
              style={styles.filterChip}
              compact
            >
              {cat.name}
            </Chip>
          ))}
        </ScrollView>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagScroll}
          contentContainerStyle={styles.tagScrollContent}
        >
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              selected={selectedTag === tag.slug}
              onPress={() =>
                setTag(selectedTag === tag.slug ? null : tag.slug)
              }
              style={styles.tagChip}
              textStyle={styles.tagChipText}
              compact
              mode="outlined"
            >
              {tag.name}
            </Chip>
          ))}
        </ScrollView>
      )}
    </View>
  )

  const renderFooter = () => {
    if (!loading) return null
    return (
      <ActivityIndicator
        style={styles.footerLoader}
        color={colors.primary}
        size="small"
      />
    )
  }

  return (
    <ScreenContainer style={styles.container}>
      <LinearGradient
        colors={['rgba(248,227,214,0.96)', 'rgba(241,209,191,0.92)', 'rgba(250,244,238,0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerGlow} />
        <View style={styles.headerRing} />
        <Text style={styles.headerEyebrow}>知识库</Text>
        <Text style={styles.headerTitle}>按阶段找到更贴近当前周期的权威内容</Text>
        <Text style={styles.headerSubtitle}>
          {isPreparationLifecycle
            ? '备孕期权威内容仍在持续补齐，当前默认先展示全站可用文章，并优先提供备孕相关检索建议。'
            : `默认优先展示更贴近 ${stageSummary.lifecycleLabel} 的内容，可继续按分类、标签与来源收窄。`}
        </Text>
      </LinearGradient>

      <Searchbar
        placeholder={isPreparationLifecycle ? '搜索备孕、孕期相关内容' : `搜索${stageSummary.lifecycleLabel}相关内容`}
        value={keyword}
        onChangeText={setKeyword}
        onSubmitEditing={handleSearch}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
      />

      {suggestedKeywords.length > 0 ? (
        <View style={styles.suggestedSearchBar}>
          <Text style={styles.suggestedSearchLabel}>推荐检索</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedSearchRow}>
            {suggestedKeywords.map((item) => (
              <Chip
                key={item}
                compact
                style={styles.suggestedSearchChip}
                textStyle={styles.suggestedSearchChipText}
                onPress={() => handleQuickKeyword(item)}
              >
                {item}
              </Chip>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerTitle}>
            {hasNetworkError ? '当前请求失败' : '当前加载失败'}
          </Text>
          <Text style={styles.errorBannerText}>{errorBannerText}</Text>
        </View>
      ) : null}

      {(selectedStage || selectedCategory || selectedTag || keyword.trim()) ? (
        <View style={styles.activeFilterBar}>
          <View style={styles.activeFilterHeader}>
            <Text style={styles.activeFilterTitle}>当前筛选</Text>
            <Button compact mode="text" textColor={colors.primaryDark} onPress={handleClearFilters}>
              清空
            </Button>
          </View>
          <View style={styles.activeFilterRow}>
            {selectedStage ? (
              <Chip compact style={styles.activeFilterChip} textStyle={styles.activeFilterChipText}>
                阶段 · {activeStageLabel}
              </Chip>
            ) : null}
            {selectedCategory ? (
              <Chip compact style={styles.activeFilterChip} textStyle={styles.activeFilterChipText}>
                分类 · {activeCategoryLabel}
              </Chip>
            ) : null}
            {selectedTag ? (
              <Chip compact style={styles.activeFilterChip} textStyle={styles.activeFilterChipText}>
                标签 · {activeTagLabel}
              </Chip>
            ) : null}
            {keyword.trim() ? (
              <Chip compact style={styles.activeFilterChip} textStyle={styles.activeFilterChipText}>
                搜索 · {keyword.trim()}
              </Chip>
            ) : null}
            {loading ? (
              <Chip compact style={styles.loadingFilterChip} textStyle={styles.loadingFilterChipText}>
                正在更新
              </Chip>
            ) : null}
          </View>
        </View>
      ) : null}

      {mergedArticleCount > 0 ? (
        <View style={styles.dedupeNotice}>
          <Text style={styles.dedupeNoticeText}>已合并 {mergedArticleCount} 篇重复来源，当前展示更干净的结果列表。</Text>
        </View>
      ) : null}

      <FlatList
        data={displayedArticleGroups}
        renderItem={renderArticleItem}
        keyExtractor={(item) => item.article.slug}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconShell}>
                <IconButton
                  icon="book-sync-outline"
                  size={20}
                  iconColor={colors.techDark}
                  style={styles.emptyIcon}
                />
              </View>
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyText}>{emptyText}</Text>
              {suggestedKeywords.length > 0 ? (
                <View style={styles.emptySuggestionWrap}>
                  {suggestedKeywords.map((item) => (
                    <Chip
                      key={`empty-${item}`}
                      compact
                      style={styles.emptySuggestionChip}
                      textStyle={styles.emptySuggestionChipText}
                      onPress={() => handleQuickKeyword(item)}
                    >
                      搜索 {item}
                    </Chip>
                  ))}
                </View>
              ) : null}
              <View style={styles.emptyActionRow}>
                <Button
                  mode="contained"
                  compact
                  buttonColor={colors.primary}
                  onPress={handleClearFilters}
                  style={styles.emptyPrimaryButton}
                >
                  放宽筛选
                </Button>
                {config.enablePublicAiFeatures ? (
                  <Button
                    mode="outlined"
                    compact
                    textColor={colors.techDark}
                    onPress={() => navigation.navigate('Main', { screen: 'Chat' })}
                    style={styles.emptySecondaryButton}
                  >
                    继续提问
                  </Button>
                ) : null}
              </View>
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        onRefresh={() => fetchArticles({ reset: true })}
        refreshing={loading && displayedArticleGroups.length > 0}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerGlow: {
    position: 'absolute',
    top: -24,
    right: -16,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(255,248,242,0.42)',
  },
  headerRing: {
    position: 'absolute',
    top: 20,
    right: 22,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  headerEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerTitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 30,
  },
  headerSubtitle: {
    marginTop: spacing.xs,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  filterPanel: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentAiHitSection: {
    marginBottom: spacing.md,
  },
  recentAiHitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  recentAiHitEyebrow: {
    color: colors.techDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  recentAiHitTitle: {
    marginTop: 2,
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  recentAiHitBadge: {
    backgroundColor: 'rgba(220,236,238,0.82)',
  },
  recentAiHitBadgeText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  recentAiHitRow: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  recentAiAskRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  recentAiAskButton: {
    borderRadius: borderRadius.pill,
  },
  recentAiHitCard: {
    width: 236,
    padding: spacing.md - 2,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    gap: spacing.xs,
  },
  recentAiHitCardEyebrow: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  recentAiHitCardTitle: {
    color: colors.ink,
    fontSize: fontSize.md,
    fontWeight: '700',
    lineHeight: 22,
    minHeight: 44,
  },
  recentAiHitCardMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  recentAiHitCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  recentAiHitReasonChip: {
    backgroundColor: 'rgba(255, 249, 243, 0.94)',
  },
  recentAiHitReasonChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  recentAiHitTopic: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
    color: colors.textLight,
    fontSize: fontSize.xs,
  },
  recentAiTopicBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentAiSourceBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentAiTopicTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  recentAiTopicRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recentAiTopicChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(220,236,238,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.14)',
  },
  recentAiSourceChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255, 249, 243, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.14)',
  },
  recentAiTopicName: {
    color: colors.techDark,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  recentAiSourceName: {
    color: colors.primaryDark,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  recentAiTopicCount: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  filterGlow: {
    position: 'absolute',
    top: -22,
    right: -12,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,248,242,0.34)',
  },
  filterRing: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.1)',
  },
  filterPanelEyebrow: {
    color: colors.techDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  filterPanelTitle: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  filterStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  filterStatCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterStatLabel: {
    color: colors.textLight,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  filterStatValue: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  searchbar: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    elevation: 0,
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    fontSize: fontSize.md,
  },
  suggestedSearchBar: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  suggestedSearchLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  suggestedSearchRow: {
    gap: spacing.sm,
  },
  suggestedSearchChip: {
    backgroundColor: 'rgba(220,236,238,0.8)',
    borderColor: 'rgba(94,126,134,0.14)',
  },
  suggestedSearchChipText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  errorBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(226, 122, 89, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(226, 122, 89, 0.18)',
  },
  errorBannerTitle: {
    color: colors.red,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  errorBannerText: {
    marginTop: spacing.xs / 2,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  activeFilterBar: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  activeFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  activeFilterTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  activeFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  activeFilterChip: {
    backgroundColor: 'rgba(255, 249, 243, 0.94)',
    borderColor: 'rgba(184,138,72,0.14)',
  },
  activeFilterChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  dedupeNotice: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  dedupeNoticeText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    lineHeight: 18,
  },
  loadingFilterChip: {
    backgroundColor: 'rgba(220,236,238,0.76)',
  },
  loadingFilterChipText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxxl * 3 + spacing.lg,
  },
  stageDropdownSection: {
    marginTop: spacing.md,
  },
  stageDropdownLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  stageDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stageDropdownTriggerOpen: {
    borderColor: 'rgba(197,108,71,0.24)',
    backgroundColor: 'rgba(246,225,212,0.72)',
  },
  stageDropdownCopy: {
    flex: 1,
  },
  stageDropdownValue: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  stageDropdownHint: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  stageDropdownMenu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  stageButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255, 249, 243, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.14)',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: 'rgba(197,108,71,0.28)',
  },
  stageButtonText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  stageButtonTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  categoryScroll: {
    marginBottom: spacing.sm,
  },
  categoryScrollContent: {
    gap: spacing.sm,
  },
  filterChip: {
    marginRight: spacing.xs,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255, 249, 243, 0.94)',
    borderColor: 'rgba(184,138,72,0.14)',
  },
  tagScroll: {
    marginBottom: spacing.md,
  },
  tagScrollContent: {
    gap: spacing.sm,
  },
  tagChip: {
    marginRight: spacing.xs,
    backgroundColor: 'rgba(255, 249, 243, 0.94)',
    borderRadius: borderRadius.pill,
    borderColor: 'rgba(184,138,72,0.14)',
  },
  tagChipText: {
    fontSize: fontSize.xs,
  },
  articleCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 0,
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    overflow: 'hidden',
  },
  articleWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 84,
    height: 84,
    borderBottomLeftRadius: 42,
    backgroundColor: 'rgba(248,227,214,0.28)',
  },
  articleTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  articleEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  articleSignalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    flexShrink: 1,
  },
  signalBadge: {
    backgroundColor: 'rgba(255, 244, 235, 0.94)',
    borderColor: 'rgba(184,138,72,0.12)',
  },
  signalBadgeText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '700',
  },
  articleTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    lineHeight: 24,
  },
  articleAssistText: {
    color: colors.techDark,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  articleSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  articleSourceText: {
    flex: 1,
    minWidth: 0,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginRight: spacing.xs,
  },
  articleDateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255, 249, 243, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
  },
  articleDateText: {
    color: colors.textLight,
    fontSize: 11,
    fontWeight: '600',
  },
  articleMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  readingMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  readingMetaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(244,250,250,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  readingMetaText: {
    color: colors.techDark,
    fontSize: 11,
    fontWeight: '700',
  },
  stageChip: {
    backgroundColor: 'rgba(217,144,122,0.18)',
  },
  stageChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  categoryChip: {
    height: 24,
  },
  tagPreviewChip: {
    backgroundColor: 'rgba(255, 249, 243, 0.92)',
    borderColor: 'rgba(184,138,72,0.12)',
  },
  tagPreviewChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  articleSummary: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
    textAlign: 'justify',
  },
  representativeReason: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  representativeReasonBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(225,120,84,0.14)',
  },
  representativeReasonBadgeText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  representativeReasonText: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  variantPanel: {
    marginBottom: spacing.sm,
  },
  variantToggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(244,250,250,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  variantToggleText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  variantList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  variantRecommendation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,246,223,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.16)',
  },
  variantRecommendationCopy: {
    flex: 1,
  },
  variantRecommendationLabel: {
    color: '#8b6723',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  variantRecommendationText: {
    marginTop: spacing.xs / 2,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  variantRecommendationAction: {
    color: '#7d5f22',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  variantFilterFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(244,250,250,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.1)',
  },
  variantFilterFeedbackLabel: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  variantFilterFeedbackText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  variantSourceDigest: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,248,240,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
  },
  variantSourceDigestLabel: {
    color: '#8b6723',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  variantSourceDigestText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  variantReadingSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(241,247,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(84,126,186,0.12)',
  },
  variantReadingSuggestionLabel: {
    color: '#456996',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  variantReadingSuggestionText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  variantSortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  variantSortChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(241,247,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(84,126,186,0.14)',
  },
  variantSortChipActive: {
    backgroundColor: 'rgba(84,126,186,0.16)',
  },
  variantSortChipText: {
    color: '#55759d',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  variantSortChipTextActive: {
    color: '#35547a',
  },
  variantFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  variantFilterChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  variantFilterChipActive: {
    backgroundColor: 'rgba(77,109,118,0.12)',
  },
  variantFilterChipText: {
    color: colors.techDark,
    fontSize: 11,
    fontWeight: '700',
  },
  variantFilterChipTextActive: {
    color: '#35535c',
  },
  variantItem: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(250,252,252,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.1)',
  },
  variantTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  variantMeta: {
    marginTop: spacing.xs / 2,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  variantChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  variantHintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  variantHintBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(225,120,84,0.14)',
  },
  variantHintBadgeText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  variantChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(244,250,250,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  variantChipText: {
    color: colors.techDark,
    fontSize: 11,
    fontWeight: '700',
  },
  variantEmpty: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(250,252,252,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.1)',
  },
  variantEmptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  articleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  articleStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    margin: 0,
    width: 20,
    height: 20,
  },
  statText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  articleCta: {
    color: colors.primaryDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  footerLoader: {
    marginVertical: spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.xl + spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconShell: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,236,238,0.8)',
    marginBottom: spacing.sm,
  },
  emptyIcon: {
    margin: 0,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptySuggestionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  emptySuggestionChip: {
    backgroundColor: 'rgba(220,236,238,0.78)',
    borderColor: 'rgba(94,126,134,0.14)',
  },
  emptySuggestionChipText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  emptyPrimaryButton: {
    borderRadius: borderRadius.pill,
  },
  emptySecondaryButton: {
    borderRadius: borderRadius.pill,
    borderColor: 'rgba(94,126,134,0.18)',
  },
})
