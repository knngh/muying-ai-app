import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  View,
  ScrollView,
  StyleSheet,
  Image,
  Linking,
  Share,
  Dimensions,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Text, Chip, Button, ActivityIndicator } from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { RootStackParamList } from '../navigation/AppNavigator'
import { articleApi, type Article, type AuthorityArticleTranslation } from '../api/modules'
import { ScreenContainer, StandardCard } from '../components/layout'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { colors, spacing, fontSize, categoryColors, borderRadius } from '../theme'
import { buildSafeArticleHtml, getSafeRemoteImageSource, shouldAllowWebViewNavigation } from '../utils/security'

type DetailRouteProp = RouteProp<RootStackParamList, 'KnowledgeDetail'>

const { width: screenWidth } = Dimensions.get('window')

export default function KnowledgeDetailScreen() {
  const route = useRoute<DetailRouteProp>()
  const { slug } = route.params
  const [translation, setTranslation] = useState<AuthorityArticleTranslation | null>(null)
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState('')
  const [showingTranslation, setShowingTranslation] = useState(false)
  const [webViewHeight, setWebViewHeight] = useState(300)

  const {
    currentArticle: article,
    loading,
    error,
    fetchArticleDetail,
    likeArticle,
    favoriteArticle,
  } = useKnowledgeStore()

  useEffect(() => {
    void fetchArticleDetail(slug)
    setTranslation(null)
    setTranslationError('')
    setShowingTranslation(false)
    setWebViewHeight(300)
  }, [fetchArticleDetail, slug])

  const sourceLanguageSample = useMemo(() => stripHtmlTags([
    article?.title || '',
    article?.summary || '',
    article?.content || '',
  ].join(' ')), [article?.content, article?.summary, article?.title])
  const isLikelyChineseSource = useMemo(() => (
    Boolean(translation?.isSourceChinese) || isMostlyChineseText(sourceLanguageSample)
  ), [sourceLanguageSample, translation?.isSourceChinese])
  const displayedTitle = showingTranslation && translation?.translatedTitle ? translation.translatedTitle : article?.title || ''
  const displayedSummary = showingTranslation && translation?.translatedSummary ? translation.translatedSummary : article?.summary || ''
  const displayedSourceUrl = useMemo(() => sanitizeAuthoritySourceUrl(
    article?.sourceUrl,
    article?.sourceOrg || article?.source || '',
  ), [article?.source, article?.sourceOrg, article?.sourceUrl])
  const displayTags = useMemo(() => getDisplayTags(article), [article])
  const displayTopic = useMemo(() => normalizeKnowledgeLabel(article?.topic), [article?.topic])
  const displayedBodyContent = showingTranslation && translation?.translatedContent
    ? translation.translatedContent
    : article?.content || ''
  const isBodyFallback = !stripHtmlTags(displayedBodyContent).replace(/\s+/g, '').trim()
  const displayedContentHtml = useMemo(() => {
    const rawContent = isBodyFallback
      ? formatRichArticleContent(
          displayedSummary || '当前文章暂未同步完整正文，可先查看摘要，再打开机构原文继续阅读。',
        )
      : formatRichArticleContent(displayedBodyContent)
    return buildSafeArticleHtml(rawContent)
  }, [displayedBodyContent, displayedSummary, isBodyFallback])
  useEffect(() => {
    if (!article || isLikelyChineseSource || translation || translating) return

    let cancelled = false
    const prefetch = async () => {
      try {
        const nextTranslation = await articleApi.getTranslation(slug)
        if (!cancelled) {
          setTranslation(nextTranslation)
        }
      } catch {
        // ignore prefetch failure
      }
    }

    void prefetch()
    return () => {
      cancelled = true
    }
  }, [article, isLikelyChineseSource, slug, translation, translating])

  useEffect(() => {
    if (translation && !isLikelyChineseSource && !showingTranslation) {
      setShowingTranslation(true)
    }
  }, [isLikelyChineseSource, showingTranslation, translation])

  const handleShare = async () => {
    if (!article) return
    try {
      const sourceLine = displayedSourceUrl ? `\n\n原文来源：${displayedSourceUrl}` : ''
      await Share.share({
        title: displayedTitle || article.title,
        message: `${displayedTitle || article.title}\n\n${displayedSummary || ''}${sourceLine}`,
      })
    } catch {
      // ignore
    }
  }

  const handleLike = () => {
    if (article) {
      void likeArticle(article.id)
    }
  }

  const handleFavorite = () => {
    if (article) {
      void favoriteArticle(article.id)
    }
  }

  const handleOpenSource = async () => {
    if (!displayedSourceUrl) return

    try {
      const canOpen = await Linking.canOpenURL(displayedSourceUrl)
      if (!canOpen) {
        Alert.alert('提示', '当前无法打开原始来源链接')
        return
      }
      await Linking.openURL(displayedSourceUrl)
    } catch {
      Alert.alert('提示', '打开原始来源失败，请稍后重试')
    }
  }

  const handleToggleTranslation = async () => {
    if (!article || isLikelyChineseSource || translating) return

    if (showingTranslation) {
      setShowingTranslation(false)
      return
    }

    if (!translation) {
      setTranslating(true)
      setTranslationError('')
      try {
        const nextTranslation = await articleApi.getTranslation(slug)
        setTranslation(nextTranslation)
        setShowingTranslation(true)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '翻译失败，请稍后重试'
        setTranslationError(message)
      } finally {
        setTranslating(false)
      }
      return
    }

    setShowingTranslation(true)
  }

  if (loading && !article) {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    )
  }

  if (error && !article) {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </ScreenContainer>
    )
  }

  if (!article) {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>文章不存在</Text>
        </View>
      </ScreenContainer>
    )
  }

  const isAuthorityArticle = article.contentType === 'authority'
  const showCategoryChip = Boolean(article.category && !shouldHideAuthorityCategoryChip(article))
  const supportsFavorite = !isAuthorityArticle
  const catColor = article.category
    ? categoryColors[article.category.name] || colors.primary
    : colors.primary
  const articleFacts = [
    article.author ? { label: '作者', value: article.author } : null,
    article.audience ? { label: '适用人群', value: article.audience } : null,
    article.region ? { label: '地区', value: article.region } : null,
    article.publishedAt
      ? { label: '发布时间', value: new Date(article.publishedAt).toLocaleDateString('zh-CN') }
      : null,
    { label: '阅读量', value: `${article.viewCount || 0}` },
  ].filter(Boolean) as Array<{ label: string; value: string }>
  const heroAssistText = showingTranslation
    ? '已切换到中文辅助阅读版，适合快速提炼权威要点。'
    : isLikelyChineseSource
      ? '已识别为中文原文，可直接阅读完整内容并回看来源。'
      : translation
        ? '已为你准备中文辅助阅读，可随时切换查看原文。'
        : '优先保留权威来源原文，并补充中文辅助阅读。'
  const sourceUpdatedLabel = formatDisplayDate(article.sourceUpdatedAt || article.publishedAt)
  const readingModeLabel = showingTranslation
    ? '中文辅助版'
    : isLikelyChineseSource
      ? '中文原文'
      : '原文模式'
  const sourceStatusItems = [
    { icon: 'book-open-page-variant-outline', text: readingModeLabel },
    sourceUpdatedLabel
      ? {
          icon: 'clock-outline',
          text: `源更新 ${sourceUpdatedLabel}`,
        }
      : null,
    isBodyFallback ? { icon: 'text-box-outline', text: '摘要模式' } : null,
  ].filter(Boolean) as Array<{ icon: string; text: string }>
  const actionGuideText = isAuthorityArticle
    ? (article.isLiked
      ? '已记录你的权威内容偏好。当前支持点赞、分享与打开原文，收藏能力后续接入。'
      : '权威文章当前支持点赞、分享与打开原文回看，收藏能力后续接入。')
    : article.isLiked && article.isFavorited
      ? '已记录为重点内容，后续推荐与回看会优先保留这类主题。'
      : article.isFavorited
        ? '已加入收藏，之后可以在个人页和知识流里快速回看。'
        : article.isLiked
          ? '已记录你的偏好，后续会优先补充同类权威内容。'
          : '喜欢可帮助内容推荐，收藏便于之后集中回看。'

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <StandardCard style={styles.heroCard} elevation={2}>
          <LinearGradient
            colors={['#FAE8DD', '#F0D8C9', '#F8F3EE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroRing} />
            <View style={styles.headerBlock}>
              <View style={styles.heroTopRow}>
                <Text style={styles.headerEyebrow}>权威阅读</Text>
                {article.isVerified ? (
                  <Chip style={styles.verifiedChip} textStyle={styles.verifiedChipText} compact>
                    权威来源
                  </Chip>
                ) : null}
              </View>
              <Text style={styles.title}>{displayedTitle}</Text>
              <Text style={styles.heroAssist}>{heroAssistText}</Text>
            </View>

            {article.sourceOrg || article.source ? (
              <View style={styles.sourceBadgeRow}>
                <View style={styles.sourceBadge}>
                  <Text style={styles.sourceBadgeText}>
                    {normalizeKnowledgeLabel(article.sourceOrg || article.source)}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.badgeRow}>
              {displayTopic ? (
                <Chip style={styles.topicChip} textStyle={styles.topicChipText} compact>
                  {displayTopic}
                </Chip>
              ) : null}
              {showCategoryChip && article.category ? (
                <Chip
                  style={[styles.categoryChip, { backgroundColor: `${catColor}20` }]}
                  textStyle={{ fontSize: fontSize.xs, color: catColor, fontWeight: '700' }}
                  compact
                >
                  {article.category.name}
                </Chip>
              ) : null}
              {displayTags.map((tag) => (
                <Chip
                  key={tag.id}
                  style={styles.tagChip}
                  textStyle={styles.tagChipText}
                  compact
                  mode="outlined"
                >
                  {tag.displayName}
                </Chip>
              ))}
            </View>

            <View style={styles.metaGrid}>
              {articleFacts.map((item) => (
                <View key={`${item.label}-${item.value}`} style={styles.metaCard}>
                  <Text style={styles.metaLabel}>{item.label}</Text>
                  <Text style={styles.metaValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </StandardCard>

        {getSafeRemoteImageSource(article.coverImage) ? (
          <Image
            source={getSafeRemoteImageSource(article.coverImage)}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : null}

        {displayedSummary ? (
          <View style={styles.summaryContainer}>
            <View style={styles.panelHeader}>
              <View style={[styles.panelIconShell, styles.summaryIconShell]}>
                <MaterialCommunityIcons name="text-box-check-outline" size={18} color={colors.primaryDark} />
              </View>
              <View style={styles.panelHeaderBody}>
                <Text style={styles.cardEyebrow}>{showingTranslation ? '中文摘要' : '核心摘要'}</Text>
                <Text style={styles.panelTitle}>{showingTranslation ? '辅助阅读摘要' : '正文前快速了解重点'}</Text>
              </View>
            </View>
            <Text style={styles.summaryText}>{displayedSummary}</Text>
          </View>
        ) : null}

        <View style={styles.quickActionRow}>
          {displayedSourceUrl ? (
            <Button
              mode="contained-tonal"
              icon="open-in-new"
              onPress={() => void handleOpenSource()}
              style={styles.quickActionButton}
              contentStyle={styles.quickActionContent}
              buttonColor="rgba(94,126,134,0.14)"
              textColor={colors.techDark}
            >
              查看原文
            </Button>
          ) : null}
          {!isLikelyChineseSource ? (
            <Button
              mode="contained-tonal"
              icon={showingTranslation ? 'file-document-outline' : 'translate'}
              loading={translating}
              onPress={() => void handleToggleTranslation()}
              style={styles.quickActionButton}
              contentStyle={styles.quickActionContent}
              buttonColor="rgba(184,138,72,0.16)"
              textColor={colors.gold}
            >
              {showingTranslation ? '查看原文' : '切换中文'}
            </Button>
          ) : null}
          <Button
            mode="text"
            icon="share-variant-outline"
            onPress={() => void handleShare()}
            style={styles.quickActionGhostButton}
            contentStyle={styles.quickActionContent}
            textColor={colors.primary}
          >
            分享
          </Button>
        </View>

        {displayedSourceUrl ? (
          <View style={styles.sourceBox}>
            <View style={styles.panelHeader}>
              <View style={[styles.panelIconShell, styles.sourceIconShell]}>
                <MaterialCommunityIcons name="crosshairs-gps" size={18} color={colors.techDark} />
              </View>
              <View style={styles.panelHeaderBody}>
                <Text style={styles.cardEyebrow}>来源追踪</Text>
                <Text style={styles.panelTitle}>原始机构页面</Text>
              </View>
            </View>
            <Text style={styles.sourceLabel}>原文链接</Text>
            <Text style={styles.sourceUrl}>{toReadableUrl(displayedSourceUrl)}</Text>
            {sourceStatusItems.length > 0 ? (
              <View style={styles.sourceStatusRow}>
                {sourceStatusItems.map((item) => (
                  <View key={item.text} style={styles.sourceStatusPill}>
                    <MaterialCommunityIcons name={item.icon} size={14} color={colors.techDark} />
                    <Text style={styles.sourceStatusText}>{item.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Button
              mode="outlined"
              onPress={() => void handleOpenSource()}
              style={styles.sourceButton}
              textColor={colors.techDark}
            >
              查看机构原文
            </Button>
          </View>
        ) : null}

        {!isLikelyChineseSource ? (
          <View style={styles.translationBox}>
            <View style={styles.panelHeader}>
              <View style={[styles.panelIconShell, styles.translationIconShell]}>
                <MaterialCommunityIcons name="translate" size={18} color={colors.gold} />
              </View>
              <View style={styles.panelHeaderBody}>
                <Text style={styles.cardEyebrow}>语言辅助</Text>
                <Text style={styles.panelTitle}>中英切换阅读</Text>
              </View>
            </View>
            <View style={styles.translationHead}>
              <Text style={styles.translationTitle}>中文辅助阅读</Text>
              <Button
                mode="outlined"
                compact
                loading={translating}
                onPress={() => void handleToggleTranslation()}
                textColor={colors.gold}
              >
                {showingTranslation ? '查看原文' : '查看中文'}
              </Button>
            </View>
            <Text style={styles.translationDesc}>
              {showingTranslation ? '中文辅助翻译仅用于帮助阅读理解，医疗判断请以机构原文和医生建议为准。' : '打开文章后会优先准备中文阅读版，生成一次后后续直接读取缓存。'}
            </Text>
          </View>
        ) : null}

        {translationError ? (
          <Text style={styles.translationError}>{translationError}</Text>
        ) : null}

        <StandardCard style={styles.readingShell} elevation={1}>
          <View style={styles.readingHeader}>
            <View style={styles.panelHeader}>
              <View style={[styles.panelIconShell, styles.readingIconShell]}>
                <MaterialCommunityIcons name="book-open-page-variant-outline" size={18} color={colors.techDark} />
              </View>
              <View style={styles.panelHeaderBody}>
                <Text style={styles.cardEyebrow}>正文阅读</Text>
                <Text style={styles.panelTitle}>{showingTranslation ? '中文辅助版正文' : '权威来源正文'}</Text>
              </View>
            </View>
            <Chip style={styles.readingChip} textStyle={styles.readingChipText} compact>
              {showingTranslation ? '中文模式' : '原文模式'}
            </Chip>
          </View>
          <Text style={styles.readingHint}>
            {isBodyFallback
              ? '当前条目暂无完整正文，已自动切换为摘要模式；需要细读时请直接打开机构原文。'
              : '建议先看摘要与来源，再进入正文细读；如有身体异常，请以线下医生建议为准。'}
          </Text>
          {isBodyFallback ? (
            <View style={styles.fallbackBanner}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.fallbackBannerText}>
                当前页面显示的是摘要模式内容，避免出现空白页。
              </Text>
            </View>
          ) : null}
          <View style={styles.webviewFrame}>
            <WebView
              originWhitelist={['about:blank']}
              source={{ html: displayedContentHtml }}
              style={[styles.webview, { height: webViewHeight }]}
              javaScriptEnabled
              domStorageEnabled={false}
              allowFileAccess={false}
              allowingReadAccessToURL={undefined}
              mixedContentMode="never"
              scrollEnabled={false}
              injectedJavaScript={`
                (function() {
                  function sendHeight() {
                    var height = Math.max(
                      document.documentElement.scrollHeight || 0,
                      document.body.scrollHeight || 0
                    );
                    window.ReactNativeWebView.postMessage(String(height));
                  }
                  function bindImageListeners() {
                    var images = document.images || [];
                    for (var index = 0; index < images.length; index += 1) {
                      images[index].addEventListener('load', sendHeight);
                      images[index].addEventListener('error', sendHeight);
                    }
                  }
                  var observer = new MutationObserver(sendHeight);
                  observer.observe(document.body, {
                    subtree: true,
                    childList: true,
                    attributes: true,
                    characterData: true
                  });
                  bindImageListeners();
                  window.addEventListener('load', sendHeight);
                  window.addEventListener('resize', sendHeight);
                  setTimeout(sendHeight, 100);
                  setTimeout(sendHeight, 400);
                  setTimeout(sendHeight, 1200);
                  true;
                })();
              `}
              onShouldStartLoadWithRequest={(request) => shouldAllowWebViewNavigation(request.url)}
              onMessage={(event) => {
                const nextHeight = Number(event.nativeEvent.data)
                if (!Number.isNaN(nextHeight) && nextHeight > 0) {
                  setWebViewHeight(Math.max(nextHeight, 300))
                }
              }}
            />
          </View>
        </StandardCard>
      </ScrollView>

      <View style={styles.actionBar}>
        <View style={styles.actionGuideRow}>
          <View style={styles.actionGuideIcon}>
            <MaterialCommunityIcons name="bookmark-check-outline" size={16} color={colors.techDark} />
          </View>
          <Text style={styles.actionGuideText}>{actionGuideText}</Text>
        </View>
        <View style={styles.actionButtonRow}>
          <Button
            mode={article.isLiked ? 'contained' : 'outlined'}
            icon={article.isLiked ? 'thumb-up' : 'thumb-up-outline'}
            onPress={handleLike}
            style={[styles.actionButton, article.isLiked && styles.actionButtonLiked]}
            contentStyle={styles.actionButtonContent}
            buttonColor={article.isLiked ? colors.primary : undefined}
            textColor={article.isLiked ? colors.white : colors.primaryDark}
          >
            {article.isLiked ? '已点赞' : '点赞'} {article.likeCount || 0}
          </Button>
          {supportsFavorite ? (
            <Button
              mode={article.isFavorited ? 'contained' : 'outlined'}
              icon={article.isFavorited ? 'bookmark' : 'bookmark-outline'}
              onPress={handleFavorite}
              style={[styles.actionButton, article.isFavorited && styles.actionButtonFavorited]}
              contentStyle={styles.actionButtonContent}
              buttonColor={article.isFavorited ? colors.techDark : undefined}
              textColor={article.isFavorited ? colors.white : colors.techDark}
            >
              {article.isFavorited ? '已收藏' : '收藏'} {article.collectCount || 0}
            </Button>
          ) : (
            <Button
              mode="outlined"
              icon="open-in-new"
              onPress={() => void handleOpenSource()}
              style={styles.actionButton}
              contentStyle={styles.actionButtonContent}
              textColor={colors.techDark}
            >
              原文
            </Button>
          )}
          <Button
            mode="outlined"
            icon="share-variant-outline"
            onPress={() => void handleShare()}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
            textColor={colors.primary}
          >
            分享
          </Button>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.red,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2 + 56,
  },
  heroCard: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.xl,
  },
  heroGradient: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    padding: spacing.md,
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -36,
    right: -24,
    backgroundColor: 'rgba(255, 248, 241, 0.54)',
  },
  heroRing: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    top: 18,
    right: 24,
    borderWidth: 1,
    borderColor: 'rgba(53, 88, 98, 0.12)',
  },
  headerBlock: {
    gap: spacing.sm,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
    lineHeight: 34,
  },
  heroAssist: {
    maxWidth: '82%',
    color: colors.inkSoft,
    lineHeight: 21,
  },
  sourceBadgeRow: {
    marginTop: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sourceBadge: {
    backgroundColor: 'rgba(255, 253, 250, 0.92)',
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  sourceBadgeText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    lineHeight: 18,
  },
  topicChip: {
    backgroundColor: 'rgba(220, 236, 238, 0.78)',
  },
  topicChipText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  verifiedChip: {
    backgroundColor: 'rgba(238, 241, 229, 0.92)',
  },
  verifiedChipText: {
    color: colors.green,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  tagChip: {
    backgroundColor: 'rgba(255, 250, 245, 0.9)',
    borderColor: 'rgba(197, 108, 71, 0.2)',
  },
  tagChipText: {
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metaCard: {
    width: '47%',
    padding: spacing.sm,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 252, 248, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(53, 88, 98, 0.08)',
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginBottom: 4,
  },
  metaValue: {
    color: colors.ink,
    fontWeight: '700',
    lineHeight: 20,
  },
  categoryChip: {
    height: 24,
  },
  coverImage: {
    width: screenWidth - spacing.md * 2,
    height: (screenWidth - spacing.md * 2) * 0.56,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  summaryContainer: {
    backgroundColor: 'rgba(255, 250, 246, 0.98)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(197,108,71,0.14)',
    padding: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickActionButton: {
    borderRadius: 18,
  },
  quickActionGhostButton: {
    borderRadius: 18,
    marginLeft: 'auto',
  },
  quickActionContent: {
    height: 40,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  panelIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIconShell: {
    backgroundColor: 'rgba(197,108,71,0.12)',
  },
  sourceIconShell: {
    backgroundColor: 'rgba(94,126,134,0.12)',
  },
  translationIconShell: {
    backgroundColor: 'rgba(184,138,72,0.14)',
  },
  readingIconShell: {
    backgroundColor: 'rgba(94,126,134,0.12)',
  },
  panelHeaderBody: {
    flex: 1,
    gap: 2,
  },
  cardEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  summaryText: {
    fontSize: fontSize.md,
    color: colors.inkSoft,
    lineHeight: 24,
  },
  sourceBox: {
    backgroundColor: 'rgba(247, 251, 251, 0.92)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.16)',
    padding: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
  },
  sourceLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  sourceUrl: {
    color: colors.text,
    lineHeight: 20,
  },
  sourceStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sourceStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(220,236,238,0.68)',
  },
  sourceStatusText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  sourceButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderColor: 'rgba(94,126,134,0.22)',
  },
  translationBox: {
    backgroundColor: 'rgba(255, 248, 239, 0.98)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.18)',
    padding: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
  },
  translationHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  translationTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  translationDesc: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  translationError: {
    color: colors.red,
    marginBottom: spacing.sm,
  },
  readingShell: {
    marginBottom: spacing.md,
  },
  readingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  readingChip: {
    backgroundColor: 'rgba(220, 236, 238, 0.78)',
  },
  readingChipText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  readingHint: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  fallbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: 'rgba(197,108,71,0.10)',
  },
  fallbackBannerText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  webviewFrame: {
    margin: spacing.md,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
    backgroundColor: 'rgba(255, 252, 248, 0.96)',
  },
  webview: {
    width: '100%',
    minHeight: 300,
    backgroundColor: 'rgba(255, 252, 248, 0.96)',
  },
  actionBar: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 249, 243, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(184,138,72,0.14)',
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  actionGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionGuideIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,236,238,0.72)',
  },
  actionGuideText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  actionButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderRadius: 20,
    borderColor: 'rgba(184,138,72,0.18)',
    backgroundColor: 'rgba(255, 253, 249, 0.82)',
  },
  actionButtonLiked: {
    borderColor: colors.primary,
  },
  actionButtonFavorited: {
    borderColor: colors.techDark,
  },
  actionButtonContent: {
    height: 42,
  },
})

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, ' ')
}

function normalizeKnowledgeLabel(label?: string): string {
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

function getDisplayTags(article?: Article | null) {
  if (!article?.tags?.length) return []

  const seen = new Set<string>()
  const sourceKey = normalizeKnowledgeLabel(article.sourceOrg || article.source).toLowerCase()
  const topicKey = normalizeKnowledgeLabel(article.topic).toLowerCase()

  return article.tags
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

function formatDisplayDate(value?: string): string {
  if (!value) {
    return ''
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return ''
  }

  return new Date(timestamp).toLocaleDateString('zh-CN')
}

function toReadableUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/g, '')
    return `${parsed.hostname}${pathname}`.slice(0, 88)
  } catch {
    return url
  }
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
    if (current && candidate.length > 88) {
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
