import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Image,
  Linking,
  Share,
  Dimensions,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Text, Chip, IconButton, Button, ActivityIndicator } from 'react-native-paper'
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { RootStackParamList } from '../navigation/AppNavigator'
import { articleApi, type AuthorityArticleTranslation } from '../api/modules'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { colors, spacing, fontSize, categoryColors } from '../theme'
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
  const displayedContentHtml = useMemo(() => {
    const rawContent = showingTranslation && translation?.translatedContent
      ? formatRichArticleContent(translation.translatedContent)
      : formatRichArticleContent(article?.content || '')
    return buildSafeArticleHtml(rawContent)
  }, [article?.content, showingTranslation, translation?.translatedContent])
  const translationNoticeText = translation?.translationNotice
    || '以下内容由系统基于权威机构原文辅助翻译，仅用于阅读理解，不替代医疗建议。请以原始来源和线下医生意见为准。'

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

  const handleShare = async () => {
    if (!article) return
    try {
      await Share.share({
        title: displayedTitle || article.title,
        message: `${displayedTitle || article.title}\n\n${displayedSummary || ''}`,
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (error && !article) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!article) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>文章不存在</Text>
        </View>
      </SafeAreaView>
    )
  }

  const catColor = article.category
    ? categoryColors[article.category.name] || colors.primary
    : colors.primary

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{displayedTitle}</Text>

        <View style={styles.badgeRow}>
          {article.sourceOrg || article.source ? (
            <Chip style={styles.sourceChip} textStyle={styles.sourceChipText} compact>
              {article.sourceOrg || article.source}
            </Chip>
          ) : null}
          {article.topic ? (
            <Chip style={styles.topicChip} textStyle={styles.topicChipText} compact>
              {article.topic}
            </Chip>
          ) : null}
          {article.isVerified ? (
            <Chip style={styles.verifiedChip} textStyle={styles.verifiedChipText} compact>
              权威来源
            </Chip>
          ) : null}
        </View>

        {article.tags && article.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {article.tags.map((tag) => (
              <Chip
                key={tag.id}
                style={styles.tagChip}
                textStyle={styles.tagChipText}
                compact
                mode="outlined"
              >
                {tag.name}
              </Chip>
            ))}
          </View>
        ) : null}

        <View style={styles.metaRow}>
          {article.author ? (
            <Text style={styles.metaText}>{article.author}</Text>
          ) : null}
          {article.audience ? (
            <Text style={styles.metaText}>{article.audience}</Text>
          ) : null}
          {article.region ? (
            <Text style={styles.metaText}>{article.region}</Text>
          ) : null}
          {article.publishedAt ? (
            <Text style={styles.metaText}>
              {new Date(article.publishedAt).toLocaleDateString('zh-CN')}
            </Text>
          ) : null}
          <View style={styles.metaViewCount}>
            <IconButton icon="eye-outline" size={14} iconColor={colors.textSecondary} style={styles.metaIcon} />
            <Text style={styles.metaText}>{article.viewCount || 0}</Text>
          </View>
          {article.category ? (
            <Chip
              style={[styles.categoryChip, { backgroundColor: `${catColor}20` }]}
              textStyle={{ fontSize: fontSize.xs, color: catColor }}
              compact
            >
              {article.category.name}
            </Chip>
          ) : null}
        </View>

        {getSafeRemoteImageSource(article.coverImage) ? (
          <Image
            source={getSafeRemoteImageSource(article.coverImage)}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : null}

        {displayedSummary ? (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryLabel}>{showingTranslation ? '中文摘要' : '核心摘要'}</Text>
            <Text style={styles.summaryText}>{displayedSummary}</Text>
          </View>
        ) : null}

        {displayedSourceUrl ? (
          <View style={styles.sourceBox}>
            <Text style={styles.sourceLabel}>原始来源</Text>
            <Text style={styles.sourceUrl}>{displayedSourceUrl}</Text>
            <Button mode="outlined" onPress={() => void handleOpenSource()} style={styles.sourceButton}>
              查看机构原文
            </Button>
          </View>
        ) : null}

        {!isLikelyChineseSource ? (
          <View style={styles.translationBox}>
            <View style={styles.translationHead}>
              <Text style={styles.translationTitle}>中文辅助阅读</Text>
              <Button
                mode="outlined"
                compact
                loading={translating}
                onPress={() => void handleToggleTranslation()}
              >
                {showingTranslation ? '查看原文' : '查看中文'}
              </Button>
            </View>
            <Text style={styles.translationDesc}>
              {showingTranslation ? translationNoticeText : '打开文章后会优先准备中文阅读版，生成一次后后续直接读取缓存。'}
            </Text>
          </View>
        ) : null}

        {translationError ? (
          <Text style={styles.translationError}>{translationError}</Text>
        ) : null}

        <WebView
          originWhitelist={['about:blank']}
          source={{ html: displayedContentHtml }}
          style={{ width: '100%', height: webViewHeight }}
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
              window.addEventListener('load', sendHeight);
              setTimeout(sendHeight, 100);
              setTimeout(sendHeight, 400);
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
      </ScrollView>

      <View style={styles.actionBar}>
        <Button
          mode="outlined"
          icon="thumb-up-outline"
          onPress={handleLike}
          style={styles.actionButton}
          textColor={colors.pink}
        >
          {article.likeCount || 0}
        </Button>
        <Button
          mode="outlined"
          icon="bookmark-outline"
          onPress={handleFavorite}
          style={styles.actionButton}
          textColor={colors.orange}
        >
          {article.collectCount || 0}
        </Button>
        <Button
          mode="outlined"
          icon="share-variant-outline"
          onPress={() => void handleShare()}
          style={styles.actionButton}
          textColor={colors.primary}
        >
          分享
        </Button>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
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
    paddingBottom: spacing.xl * 2,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
    lineHeight: 34,
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  sourceChip: {
    backgroundColor: colors.primaryLight,
  },
  sourceChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  topicChip: {
    backgroundColor: colors.background,
  },
  topicChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  verifiedChip: {
    backgroundColor: colors.greenLight,
  },
  verifiedChipText: {
    color: colors.green,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tagChip: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tagChipText: {
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  metaViewCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    margin: 0,
    width: 18,
    height: 18,
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
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  summaryText: {
    fontSize: fontSize.md,
    color: colors.textLight,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  sourceBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
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
  sourceButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  translationBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
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
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    borderRadius: 20,
    borderColor: colors.border,
  },
})

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
