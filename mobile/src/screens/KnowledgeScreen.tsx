import React, { useEffect, useCallback, useRef, useState } from 'react'
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
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RootStackParamList } from '../navigation/AppNavigator'
import { ScreenContainer } from '../components/layout'
import { useAppStore } from '../stores/appStore'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { getStageSummary, type LifecycleStageKey } from '../utils/stage'
import { colors, spacing, fontSize, categoryColors, borderRadius } from '../theme'
import { articleApi, type Article, type AuthorityArticleTranslation } from '../api/modules'

type KnowledgeNavProp = StackNavigationProp<RootStackParamList>

const stageOptions = [
  { label: '全部阶段', value: null },
  { label: '备孕期', value: 'preparation' },
  { label: '孕早期', value: 'first-trimester' },
  { label: '孕中期', value: 'second-trimester' },
  { label: '孕晚期', value: 'third-trimester' },
  { label: '月子/0-6月', value: '0-6-months' },
  { label: '6-12月', value: '6-12-months' },
  { label: '1-3岁', value: '1-3-years' },
  { label: '3岁+', value: '3-years-plus' },
]

const lifecycleStageMap: Record<LifecycleStageKey, string> = {
  preparing: 'preparation',
  pregnant_early: 'first-trimester',
  pregnant_mid: 'second-trimester',
  pregnant_late: 'third-trimester',
  postpartum_newborn: '0-6-months',
  postpartum_recovery: '0-6-months',
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
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export default function KnowledgeScreen() {
  const navigation = useNavigation<KnowledgeNavProp>()
  const user = useAppStore((state) => state.user)
  const stageSummary = getStageSummary(user)
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
    fetchArticles,
    fetchCategories,
    fetchTags,
    setCategory,
    setTag,
    setStage,
    setKeyword,
    search,
    reset,
  } = useKnowledgeStore()

  useEffect(() => {
    fetchCategories()
    fetchTags()
    const initialStage = lifecycleStageMap[stageSummary.lifecycleKey]
    if (initialStage) {
      setStage(initialStage)
      return
    }
    fetchArticles({ reset: true })
  }, [])

  useEffect(() => {
    const candidates = articles
      .filter((item) => !isChineseArticle(item))
      .filter((item) => !translations[item.slug] && !translationFailed[item.slug])
      .filter((item) => !translationInFlightRef.current.has(item.slug))
      .slice(0, 3)

    if (candidates.length === 0) return

    let cancelled = false

    candidates.forEach((item) => {
      translationInFlightRef.current.add(item.slug)
      void articleApi.getTranslation(item.slug)
        .then((nextTranslation) => {
          if (cancelled) return
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

  const renderArticleItem = ({ item }: { item: Article }) => {
    const catColor = item.category
      ? categoryColors[item.category.name] || colors.primary
      : colors.primary
    const sourceSignal = resolveSourceSignal(item)
    const sourceLabel = formatArticleSource(item)
    const stageLabel = formatArticleStage(item.stage)
    const dateLabel = formatArticleDate(item)
    const previewTags = getArticleDisplayTags(item).slice(0, 2)
    const articleTranslation = translations[item.slug]
    const displayedTitle = articleTranslation?.translatedTitle || item.title
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
          <Text style={styles.articleSourceLine} numberOfLines={1}>
            {sourceLabel} · {dateLabel}
          </Text>
          <View style={styles.articleMeta}>
            <Chip compact style={styles.stageChip} textStyle={styles.stageChipText}>
              {stageLabel}
            </Chip>
            {item.category && (
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
        <Text style={styles.filterPanelEyebrow}>筛选面板</Text>
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
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.stageScroll}
        contentContainerStyle={styles.stageScrollContent}
      >
        {stageOptions.map((option) => (
          <TouchableOpacity
            key={option.label}
            style={[
              styles.stageButton,
              selectedStage === option.value && styles.stageButtonActive,
            ]}
            onPress={() => setStage(option.value)}
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
      </ScrollView>

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
        <Text style={styles.headerEyebrow}>知识库导航</Text>
        <Text style={styles.headerTitle}>按阶段找到更贴近当前周期的权威内容</Text>
        <Text style={styles.headerSubtitle}>
          默认优先展示更贴近 {stageSummary.lifecycleLabel} 的内容，可继续按分类、标签与来源收窄。
        </Text>
      </LinearGradient>

      <Searchbar
        placeholder={`搜索${stageSummary.lifecycleLabel}相关内容`}
        value={keyword}
        onChangeText={setKeyword}
        onSubmitEditing={handleSearch}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
      />

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
        keyExtractor={(item) => String(item.id)}
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
              <Text style={styles.emptyTitle}>当前筛选下还没有文章</Text>
              <Text style={styles.emptyText}>
                可以先放宽筛选范围，或直接去问题助手提问；新同步的权威内容也会继续补入这里。
              </Text>
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
    paddingBottom: 132,
  },
  stageScroll: {
    marginBottom: spacing.sm,
  },
  stageScrollContent: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  stageButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255, 249, 243, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.14)',
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
    marginBottom: spacing.xs,
    lineHeight: 24,
  },
  articleSourceLine: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
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
  emptyPrimaryButton: {
    borderRadius: borderRadius.pill,
  },
  emptySecondaryButton: {
    borderRadius: borderRadius.pill,
    borderColor: 'rgba(94,126,134,0.18)',
  },
})
