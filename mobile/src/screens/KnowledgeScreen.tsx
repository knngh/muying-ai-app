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
import { useAppStore } from '../stores/appStore'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { getStageSummary, type LifecycleStageKey } from '../utils/stage'
import { KNOWLEDGE_STAGE_OPTIONS } from '../utils/knowledgeStage'
import { colors, spacing, fontSize, categoryColors, borderRadius } from '../theme'
import { articleApi, type Article, type AuthorityArticleTranslation } from '../api/modules'

type KnowledgeNavProp = StackNavigationProp<RootStackParamList>

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
  return article.sourceOrg || article.source || article.region || '权威内容'
}

function formatArticleStage(stage?: string) {
  if (!stage) return '全阶段'
  return stageLabelMap[stage] || stage
}

function formatArticleDate(article: Article) {
  const value = article.publishedAt || article.sourceUpdatedAt || article.createdAt
  if (!value) return '最近同步'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '最近同步'

  return date.toISOString().slice(0, 10)
}

function resolveSourceSignal(article: Article) {
  if (article.sourceLanguage === 'zh' || article.sourceLocale === 'zh-CN') {
    return '中文源'
  }

  return '国际源'
}

function isChineseArticle(article: Article) {
  return article.sourceLanguage === 'zh' || article.sourceLocale === 'zh-CN'
}

function normalizeKnowledgeLabel(label?: string) {
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
  const mapped = {
    pregnancy: '孕期',
    policy: '指南/政策',
    parenting: '养育',
    nutrition: '营养',
    vaccine: '疫苗',
    child: '儿童',
    toddler: '幼儿',
    infant: '婴儿',
    breastfeeding: '喂养',
  }[lower]

  return mapped || value
}

function isSourceLikeKnowledgeTag(label: string) {
  const normalized = normalizeKnowledgeLabel(label).toLowerCase()
  if (!normalized) return false

  return /^(aap|acog|cdc|who|nhs|mayo clinic|msd manuals)$/i.test(normalized)
    || /healthychildren|mayoclinic|msdmanuals|who\.int|cdc\.gov|nhs\.uk|acog\.org/i.test(normalized)
    || /american academy of pediatrics|american college of obstetricians and gynecologists|world health organization|national health service|centers? for disease control/i.test(normalized)
}

function shouldHideAuthorityCategoryChip(article: Article) {
  if (!article.category) return false
  if (article.category.slug === 'authority-source') return true

  const categoryKey = normalizeKnowledgeLabel(article.category.name).toLowerCase()
  const sourceKey = normalizeKnowledgeLabel(article.sourceOrg || article.source).toLowerCase()
  return Boolean(categoryKey && sourceKey && categoryKey === sourceKey)
}

function getArticleDisplayTags(article: Article) {
  const seen = new Set<string>()
  const sourceKey = normalizeKnowledgeLabel(article.sourceOrg || article.source).toLowerCase()
  const topicKey = normalizeKnowledgeLabel(article.topic).toLowerCase()

  return (article.tags || [])
    .map((tag) => ({
      ...tag,
      displayName: normalizeKnowledgeLabel(tag.name),
    }))
    .filter((tag) => {
      const key = tag.displayName.toLowerCase()
      if (!key) return false
      if (key === sourceKey || key === topicKey) return false
      if (isSourceLikeKnowledgeTag(key)) return false
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function shouldAutoApplyStageFilter(stage: string | null) {
  return Boolean(stage && stage !== 'preparation')
}

function isGenericForeignTitle(title?: string) {
  const value = (title || '').trim()
  if (!value) return false
  if (/[\u4e00-\u9fff]/u.test(value)) return false

  const normalized = value.toLowerCase()
  return normalized.length <= 24 && (
    /^(resources?|resource center|article|overview|guide|guidelines|information|faq|factsheet)$/i.test(normalized)
    || /^(recursos?|art[íi]culo|informaci[óo]n|gu[íi]a)$/i.test(normalized)
  )
}

function hasLeakedPrompt(text?: string) {
  if (!text) return false
  return /<translated_(title|summary|content)>/i.test(text)
    || /Be accurate and faithful to the original/i.test(text)
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
  const topic = normalizeKnowledgeLabel(article.topic)
  const category = article.category ? normalizeKnowledgeLabel(article.category.name) : ''
  const stage = formatArticleStage(article.stage)
  const primary = topic || category || (stage !== '全阶段' ? stage : '权威')
  return `${primary}参考`
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
  const translationInFlightRef = useRef<Set<string>>(new Set())
  const [translations, setTranslations] = useState<Record<string, AuthorityArticleTranslation>>({})
  const [translationFailed, setTranslationFailed] = useState<Record<string, boolean>>({})
  const {
    articles,
    categories,
    tags,
    total,
    page,
    pageSize,
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

  useEffect(() => {
    void fetchCategories()
    void fetchTags()
  }, [fetchCategories, fetchTags])

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
    : '可以先放宽筛选范围，或直接去问题助手提问；新同步的权威内容也会继续补入这里。'
  const errorBannerText = hasNetworkError
    ? `当前设备访问 ${resolvedErrorDetail?.requestUrl || '/articles'} 失败。请优先检查 beihu.me 域名解析、移动网络连通性与 HTTPS 证书配置。`
    : hasHttpError
      ? `服务已响应，但返回了 ${resolvedErrorDetail?.status || '--'} 状态。${error || ''}`
      : error || ''

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

  const renderArticleItem = ({ item }: { item: Article }) => {
    const catColor = item.category
      ? categoryColors[item.category.name] || colors.primary
      : colors.primary
    const showCategoryChip = Boolean(item.category && !shouldHideAuthorityCategoryChip(item))
    const sourceSignal = resolveSourceSignal(item)
    const sourceLabel = formatArticleSource(item)
    const stageLabel = formatArticleStage(item.stage)
    const dateLabel = formatArticleDate(item)
    const previewTags = getArticleDisplayTags(item).slice(0, 2)
    const rawTranslation = translations[item.slug]
    const articleTranslation = rawTranslation && !hasLeakedPrompt(rawTranslation.translatedTitle) && !hasLeakedPrompt(rawTranslation.translatedSummary)
      ? rawTranslation
      : undefined
    const translatedHeadline = getTranslatedHeadline(articleTranslation?.translatedSummary)
    const displayedTitle = articleTranslation?.translatedTitle
      || (isGenericForeignTitle(item.title)
        ? (translatedHeadline || getLocalizedFallbackTitle(item))
        : item.title)
    const displayedSummary = articleTranslation?.translatedSummary || item.summary

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
                style={[styles.categoryChip, { backgroundColor: catColor + '20' }]}
                textStyle={{ fontSize: fontSize.xs, color: catColor }}
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
          {displayedSummary ? (
            <Text style={styles.articleSummary} numberOfLines={2}>
              {displayedSummary}
            </Text>
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

      <FlatList
        data={articles}
        renderItem={renderArticleItem}
        keyExtractor={(item) => item.slug}
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
                <Button
                  mode="outlined"
                  compact
                  textColor={colors.techDark}
                  onPress={() => (navigation as any).navigate('Main', { screen: 'Chat' })}
                  style={styles.emptySecondaryButton}
                >
                  去问题助手
                </Button>
              </View>
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        onRefresh={() => fetchArticles({ reset: true })}
        refreshing={loading && articles.length > 0}
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
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
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
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    overflow: 'hidden',
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
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 250, 245, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
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
    backgroundColor: 'rgba(255, 249, 243, 0.96)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.14)',
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
    borderRadius: borderRadius.lg,
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
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 250, 245, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
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
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.14)',
    elevation: 0,
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 10 },
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
    alignItems: 'center',
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
    gap: spacing.xs,
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
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,249,243,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
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
