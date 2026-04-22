import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import { useNavigation } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { RootStackParamList } from '../navigation/AppNavigator'
import {
  articleApi,
  isTranslationPendingError,
  userApi,
  type Article,
  type AuthorityArticleTranslation,
} from '../api/modules'
import { ScreenContainer, StandardCard } from '../components/layout'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { trackAppEvent } from '../services/analytics'
import { colors, spacing, fontSize, categoryColors, borderRadius } from '../theme'
import { buildSafeArticleHtml, getSafeRemoteImageSource, shouldAllowWebViewNavigation } from '../utils/security'
import { buildKnowledgeDetailChatContext } from '../utils/aiEntryContext'
import { buildKnowledgeDetailQuestion } from '../utils/aiEntryPrompts'
import { buildKnowledgeAiAssist } from '../utils/aiAssist'
import { useAppStore } from '../stores/appStore'
import { getStageSummary } from '../utils/stage'

type DetailRouteProp = RouteProp<RootStackParamList, 'KnowledgeDetail'>

const { width: screenWidth } = Dimensions.get('window')

export default function KnowledgeDetailScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<DetailRouteProp>()
  const user = useAppStore((state) => state.user)
  const stage = getStageSummary(user)
  const { slug, source, aiContext } = route.params
  const [translation, setTranslation] = useState<AuthorityArticleTranslation | null>(null)
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState('')
  const [showingTranslation, setShowingTranslation] = useState(false)
  const [webViewHeight, setWebViewHeight] = useState(120)
  const articleOpenedAtRef = useRef(Date.now())
  const reportedReadKeyRef = useRef<string | null>(null)
  const aiHitTrackedRef = useRef<string | null>(null)

  const {
    currentArticle: article,
    loading,
    error,
    fetchArticleDetail,
    recordAiHitArticle,
    likeArticle,
    favoriteArticle,
  } = useKnowledgeStore()

  useEffect(() => {
    void fetchArticleDetail(slug)
    setTranslation(null)
    setTranslationError('')
    setShowingTranslation(false)
    setWebViewHeight(120)
    articleOpenedAtRef.current = Date.now()
    reportedReadKeyRef.current = null
  }, [fetchArticleDetail, slug])

  useEffect(() => {
    if (!article?.id) return

    const readKey = `${slug}:${article.id}`
    const reportRead = async (progress: number) => {
      if (reportedReadKeyRef.current === readKey) {
        return
      }

      reportedReadKeyRef.current = readKey
      try {
        const durationSeconds = Math.max(
          5,
          Math.round((Date.now() - articleOpenedAtRef.current) / 1000),
        )
        await userApi.recordRead({
          articleId: article.id,
          duration: durationSeconds,
          progress,
        })
      } catch {
        reportedReadKeyRef.current = null
      }
    }

    const timer = setTimeout(() => {
      void reportRead(45)
    }, 2500)

    return () => {
      clearTimeout(timer)
      if (reportedReadKeyRef.current !== readKey) {
        void reportRead(15)
      }
    }
  }, [article?.id, slug])

  useEffect(() => {
    if (!article || source !== 'chat_hit') {
      return
    }

    const trackKey = `${slug}:${aiContext?.qaId || 'unknown'}:${aiContext?.trigger || 'unknown'}`
    if (aiHitTrackedRef.current === trackKey) {
      return
    }

    aiHitTrackedRef.current = trackKey
    void recordAiHitArticle(article, {
      qaId: aiContext?.qaId,
      trigger: aiContext?.trigger,
      matchReason: aiContext?.matchReason,
      originEntrySource: aiContext?.originEntrySource,
      originReportId: aiContext?.originReportId,
    })
    void trackAppEvent('app_knowledge_detail_ai_hit_open', {
      page: 'KnowledgeDetailScreen',
      properties: {
        slug,
        articleId: article.id,
        qaId: aiContext?.qaId || null,
        trigger: aiContext?.trigger || null,
        matchReason: aiContext?.matchReason || null,
        sourceOrg: article.sourceOrg || article.source || null,
        topic: article.topic || null,
        entrySource: aiContext?.originEntrySource || null,
        articleSlug: slug,
        reportId: aiContext?.originReportId || null,
      },
    })
  }, [aiContext?.matchReason, aiContext?.originEntrySource, aiContext?.originReportId, aiContext?.qaId, aiContext?.trigger, article, recordAiHitArticle, slug, source])

  const sourceLanguageSample = useMemo(() => stripHtmlTags([
    article?.title || '',
    article?.summary || '',
    article?.content || '',
  ].join(' ')), [article?.content, article?.summary, article?.title])
  const isLikelyChineseSource = useMemo(() => (
    Boolean(translation?.isSourceChinese) || isMostlyChineseText(sourceLanguageSample)
  ), [sourceLanguageSample, translation?.isSourceChinese])
  const localizedFallbackTitle = useMemo(() => {
    if (!article || isLikelyChineseSource || translation?.translatedTitle) {
      return ''
    }

    return isGenericForeignTitle(article.title)
      ? getLocalizedFallbackTitle(article)
      : ''
  }, [article, isLikelyChineseSource, translation?.translatedTitle])
  const localizedFallbackSummary = useMemo(() => {
    if (!article || isLikelyChineseSource || translation?.translatedSummary) {
      return ''
    }

    return isMostlyChineseText(stripHtmlTags(article.summary || ''))
      ? ''
      : getLocalizedFallbackSummary(article)
  }, [article, isLikelyChineseSource, translation?.translatedSummary])
  const translatedTitleText = useMemo(
    () => sanitizeTranslationText(translation?.translatedTitle, 'title'),
    [translation?.translatedTitle],
  )
  const translatedSummaryText = useMemo(
    () => sanitizeTranslationText(translation?.translatedSummary, 'summary'),
    [translation?.translatedSummary],
  )
  const translatedContentText = useMemo(
    () => sanitizeTranslationText(translation?.translatedContent, 'content'),
    [translation?.translatedContent],
  )
  const displayedTitle = showingTranslation && translatedTitleText
    ? translatedTitleText
    : localizedFallbackTitle || article?.title || ''
  const displayedSummary = showingTranslation && translatedSummaryText
    ? translatedSummaryText
    : localizedFallbackSummary || article?.summary || ''
  const displayedSourceUrl = useMemo(() => sanitizeAuthoritySourceUrl(
    article?.sourceUrl,
    article?.sourceOrg || article?.source || '',
  ), [article?.source, article?.sourceOrg, article?.sourceUrl])
  const displayTags = useMemo(() => getDisplayTags(article), [article])
  const displayTopic = useMemo(() => normalizeKnowledgeLabel(article?.topic), [article?.topic])
  const aiAssist = useMemo(() => buildKnowledgeAiAssist(article), [article])
  const displayedBodyContent = showingTranslation && translatedContentText
    ? translatedContentText
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
  const riskAlert = useMemo(() => {
    const plainText = stripHtmlTags([
      article?.title || '',
      article?.summary || '',
      article?.content || '',
    ].join(' ')).replace(/\s+/g, ' ').trim()

    if (!plainText) {
      return null
    }

    if (/出血|腹痛|规律宫缩|破水|胎动(明显)?减少|胎动异常/u.test(plainText)) {
      return {
        title: '出现孕期急性信号时优先线下就医',
        desc: '如果当前内容涉及出血、腹痛、规律宫缩、破水或胎动明显变化，请不要只依赖页面信息，优先联系医生或尽快线下就医。',
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
        desc: '如果涉及黄疸加重、吃奶明显变差、嗜睡或反应异常，应优先到医院评估，再结合权威资料理解原因和处理方式。',
      }
    }

    if (/用药|药物|剂量|处方|治疗方案/u.test(plainText)) {
      return {
        title: '用药与治疗方案请以医生判断为准',
        desc: '权威资料和中文辅助阅读只用于帮助理解背景信息；涉及药物选择、剂量调整或治疗方案时，请优先咨询医生。',
      }
    }

    return null
  }, [article?.content, article?.summary, article?.title])
  useEffect(() => {
    if (!article || isLikelyChineseSource || translation || translating) return

    let cancelled = false
    const prefetch = async () => {
      try {
        const nextTranslation = await articleApi.kickoffTranslation(slug)
        if (!cancelled && nextTranslation) {
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

  const handleAskAi = () => {
    if (!article) return

    const question = buildKnowledgeDetailQuestion({
      title: displayedTitle || article.title,
      summary: displayedSummary || article.summary,
      sourceOrg: article.sourceOrg || article.source,
      topic: article.topic,
    })

    void trackAppEvent('app_knowledge_detail_ask_ai_click', {
      page: 'KnowledgeDetailScreen',
      properties: {
        slug,
        articleId: article.id,
        sourceOrg: article.sourceOrg || article.source || null,
        topic: article.topic || null,
        entrySource: 'knowledge_detail',
        articleSlug: slug,
        reportId: aiContext?.originReportId || null,
        originSource: source || null,
        originQaId: aiContext?.qaId || null,
        originEntrySource: aiContext?.originEntrySource || null,
      },
    })

    navigation.navigate('Main', {
      screen: 'Chat',
      params: {
        prefillQuestion: question,
        prefillContext: buildKnowledgeDetailChatContext({
          slug,
          title: displayedTitle || article.title,
          summary: displayedSummary || article.summary,
          sourceOrg: article.sourceOrg || article.source,
          topic: article.topic,
          stageKey: stage.lifecycleKey,
        }),
        autoSend: true,
        source: 'knowledge_detail',
      },
    })
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
        const message = isTranslationPendingError(error)
          ? '中文辅助阅读正在准备中，请稍后再试'
          : error instanceof Error
            ? error.message
            : '翻译失败，请稍后重试'
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
      : localizedFallbackSummary
        ? '翻译未就绪时会先展示中文导读，避免首屏直接出现外文阅读门槛。'
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

        {riskAlert ? (
          <View style={styles.riskAlertCard}>
            <View style={styles.panelHeader}>
              <View style={[styles.panelIconShell, styles.riskAlertIconShell]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.red} />
              </View>
              <View style={styles.panelHeaderBody}>
                <Text style={styles.cardEyebrow}>高风险提示</Text>
                <Text style={styles.panelTitle}>{riskAlert.title}</Text>
              </View>
            </View>
            <Text style={styles.riskAlertText}>{riskAlert.desc}</Text>
          </View>
        ) : null}

        {source === 'chat_hit' ? (
          <View style={styles.aiHitContextCard}>
            <View style={styles.panelHeader}>
              <View style={[styles.panelIconShell, styles.aiHitIconShell]}>
                <MaterialCommunityIcons name="message-badge-outline" size={18} color={colors.techDark} />
              </View>
              <View style={styles.panelHeaderBody}>
                <Text style={styles.cardEyebrow}>来自阅读问答</Text>
                <Text style={styles.panelTitle}>这篇文章命中了刚才的回答</Text>
              </View>
            </View>
            <Text style={styles.aiHitContextText}>
              {buildAiHitContextText(aiContext?.trigger, aiContext?.matchReason, aiContext?.originEntrySource)}
            </Text>
            <Button
              mode="contained-tonal"
              icon="message-question-outline"
              onPress={handleAskAi}
              style={styles.aiHitContextButton}
              contentStyle={styles.quickActionContent}
              buttonColor="rgba(54,92,104,0.14)"
              textColor={colors.techDark}
            >
              继续追问这篇文章
            </Button>
          </View>
        ) : null}

        <View style={styles.aiAssistCard}>
          <View style={styles.panelHeader}>
            <View style={[styles.panelIconShell, styles.aiAssistIconShell]}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={colors.primaryDark} />
            </View>
            <View style={styles.panelHeaderBody}>
              <Text style={styles.cardEyebrow}>阅读整理</Text>
              <Text style={styles.panelTitle}>先抓住这 3 个重点</Text>
            </View>
            <Chip compact style={styles.aiAssistBadge} textStyle={styles.aiAssistBadgeText}>
              {aiAssist.focusLabel}
            </Chip>
          </View>

          <View style={styles.aiAssistMetaRow}>
            <View style={styles.aiAssistMetaCard}>
              <Text style={styles.aiAssistMetaLabel}>适合谁看</Text>
              <Text style={styles.aiAssistMetaValue}>{aiAssist.audienceLabel}</Text>
            </View>
            <View style={styles.aiAssistMetaCard}>
              <Text style={styles.aiAssistMetaLabel}>主题焦点</Text>
              <Text style={styles.aiAssistMetaValue}>{aiAssist.focusLabel}</Text>
            </View>
          </View>

          <View style={styles.aiAssistPointList}>
            {aiAssist.points.map((item) => (
              <View key={item} style={styles.aiAssistPointRow}>
                <View style={styles.aiAssistPointDot} />
                <Text style={styles.aiAssistPointText}>{item}</Text>
              </View>
            ))}
          </View>

          {aiAssist.terms.length ? (
            <View style={styles.aiAssistTermsBox}>
              <Text style={styles.aiAssistTermsTitle}>术语解释</Text>
              {aiAssist.terms.map((term) => (
                <View key={term.term} style={styles.aiAssistTermCard}>
                  <Text style={styles.aiAssistTermName}>{term.term}</Text>
                  <Text style={styles.aiAssistTermText}>{term.explanation}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.aiAssistNote}>{aiAssist.safetyNote}</Text>
        </View>

        <View style={styles.quickActionRow}>
          <Button
            mode="contained-tonal"
            icon="message-question-outline"
            onPress={handleAskAi}
            style={styles.quickActionButton}
            contentStyle={styles.quickActionContent}
            buttonColor="rgba(54,92,104,0.14)"
            textColor={colors.techDark}
          >
            继续提问
          </Button>
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
              {showingTranslation ? '查看原文' : translation ? '切换中文' : '生成中文'}
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
                {showingTranslation ? '查看原文' : translation ? '查看中文' : '生成中文'}
              </Button>
            </View>
            <Text style={styles.translationDesc}>
              {showingTranslation ? '中文辅助阅读仅用于帮助理解，医疗判断请以机构原文和医生建议为准。' : '进入详情后会优先准备中文阅读版；翻译未完成前，首屏会先给出中文导读，避免直接看到外文原文。'}
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
                      document.documentElement.offsetHeight || 0,
                      document.body.scrollHeight || 0,
                      document.body.offsetHeight || 0,
                      document.body.getBoundingClientRect().height || 0,
                      document.documentElement.getBoundingClientRect().height || 0,
                      (document.body.lastElementChild && (document.body.lastElementChild.getBoundingClientRect().bottom + window.scrollY)) || 0
                    );
                    window.ReactNativeWebView.postMessage(String(Math.ceil(height)));
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
                  setWebViewHeight(Math.max(nextHeight + 2, 120))
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
  riskAlertCard: {
    backgroundColor: 'rgba(255, 246, 243, 0.98)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(224,112,83,0.18)',
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  riskAlertIconShell: {
    backgroundColor: 'rgba(224,112,83,0.12)',
  },
  riskAlertText: {
    color: colors.inkSoft,
    lineHeight: 22,
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
  aiHitIconShell: {
    backgroundColor: 'rgba(94,126,134,0.12)',
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
  aiAssistIconShell: {
    backgroundColor: 'rgba(197,108,71,0.12)',
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
  aiHitContextCard: {
    backgroundColor: 'rgba(247, 251, 251, 0.94)',
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
  aiHitContextText: {
    color: colors.inkSoft,
    lineHeight: 22,
  },
  aiHitContextButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    borderRadius: 18,
  },
  aiAssistCard: {
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
  aiAssistBadge: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  aiAssistBadgeText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  aiAssistMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  aiAssistMetaCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.76)',
  },
  aiAssistMetaLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  aiAssistMetaValue: {
    marginTop: 6,
    color: colors.ink,
    fontWeight: '700',
    lineHeight: 20,
  },
  aiAssistPointList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  aiAssistPointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  aiAssistPointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    backgroundColor: colors.primary,
  },
  aiAssistPointText: {
    flex: 1,
    color: colors.inkSoft,
    lineHeight: 22,
  },
  aiAssistTermsBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,108,71,0.12)',
    gap: spacing.sm,
  },
  aiAssistTermsTitle: {
    color: colors.ink,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  aiAssistTermCard: {
    padding: spacing.sm,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  aiAssistTermName: {
    color: colors.primaryDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  aiAssistTermText: {
    marginTop: 6,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  aiAssistNote: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 18,
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
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|section|article|div)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
}

function stripCodeFence(text: string): string {
  const matched = text.trim().match(/^```(?:xml|json|markdown|md|text)?\s*([\s\S]*?)\s*```$/i)
  return matched?.[1]?.trim() || text.trim()
}

function sanitizeTranslationText(
  input: string | null | undefined,
  type: 'title' | 'summary' | 'content',
): string {
  if (!input) return ''

  const labelPattern = type === 'title'
    ? /^(?:[-*•·]\s*)?(?:translated_title|title|标题)\s*[:：]\s*/i
    : type === 'summary'
      ? /^(?:[-*•·]\s*)?(?:translated_summary|summary|摘要)\s*[:：]\s*/i
      : /^(?:[-*•·]\s*)?(?:translated_content|content|正文|内容)\s*[:：]\s*/i

  let normalized = stripCodeFence(input)
    .replace(/<\/?translated_(title|summary|content)>/gi, '')
    .replace(/^\s*#{1,6}\s*/g, '')
    .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, '')
    .trim()

  if (/<translated_(title|summary|content)>/i.test(normalized) || /Be accurate and faithful to the original/i.test(normalized)) {
    return ''
  }

  normalized = normalized
    .replace(/^(?:好的[，,]?\s*)/u, '')
    .replace(/^(?:以下(?:是|为)|下面(?:是|为)|这是)(?:本篇|这篇|当前)?(?:文章|原文|内容)?(?:的)?(?:中文)?(?:辅助)?(?:翻译|译文|中文版)?\s*[：:。.]?\s*/u, '')
    .replace(labelPattern, '')
    .trim()

  return normalized
}

function formatArticleStage(stage?: string) {
  if (!stage) return '全阶段'

  const stageMap: Record<string, string> = {
    preparation: '备孕期',
    'first-trimester': '孕早期',
    'second-trimester': '孕中期',
    'third-trimester': '孕晚期',
    newborn: '新生儿期',
    postpartum: '产后恢复',
    '0-6-months': '0-6个月',
    '6-12-months': '6-12个月',
    '1-3-years': '1-3岁',
    '3-years-plus': '3岁以上',
  }

  return stageMap[stage] || stage
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

function getLocalizedFallbackTitle(article: Article) {
  const topic = normalizeKnowledgeLabel(article.topic)
  const category = article.category ? normalizeKnowledgeLabel(article.category.name) : ''
  const stage = formatArticleStage(article.stage)
  const primary = topic || category || (stage !== '全阶段' ? stage : '权威')
  return `${primary}参考`
}

function getLocalizedFallbackSummary(article: Article) {
  const source = normalizeKnowledgeLabel(article.sourceOrg || article.source) || '权威机构'
  const stage = formatArticleStage(article.stage)
  const topic = normalizeKnowledgeLabel(article.topic)
  const audience = normalizeKnowledgeLabel(article.audience)
  const category = article.category ? normalizeKnowledgeLabel(article.category.name) : ''
  const focus = topic || audience || category || '当前阶段重点'
  const stagePrefix = stage && stage !== '全阶段' ? `${stage}阶段` : '当前阶段'
  return `${source}相关原文正在准备中文辅助阅读，这篇内容聚焦${stagePrefix}的${focus}，可先查看导读要点，再按需打开机构原文。`
}

function buildAiHitContextText(
  trigger?: 'hit_card' | 'knowledge_action',
  matchReason?: 'entry_meta' | 'source_url' | 'source_title' | 'source_keyword',
  originEntrySource?: string,
) {
  const triggerText = trigger === 'knowledge_action'
    ? '你是从回答里的“相关知识”动作继续打开的。'
    : '你是从回答里的命中文章卡片继续打开的。'

  const matchReasonText = {
    entry_meta: '这次命中直接沿用了当前会话绑定的文章上下文。',
    source_url: '这次命中优先对齐了回答来源里的原始链接。',
    source_title: '这次命中根据回答来源标题做了精确匹配。',
    source_keyword: '这次命中根据回答主题关键词做了兜底匹配。',
  }[matchReason || 'source_keyword']

  const originText = originEntrySource === 'weekly_report'
    ? '最初的问题入口来自周报。'
    : originEntrySource === 'knowledge_detail'
      ? '最初的问题入口来自知识详情页。'
      : originEntrySource === 'home_suggested_question'
        ? '最初的问题入口来自首页建议提问。'
        : ''

  return [triggerText, matchReasonText, originText].filter(Boolean).join('')
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
    { tag: 'div', style: 'margin:0 0 1.1em;line-height:1.9;display:block;' },
    { tag: 'section', style: 'margin:0 0 1.1em;line-height:1.9;display:block;' },
    { tag: 'article', style: 'margin:0 0 1.1em;line-height:1.9;display:block;' },
    { tag: 'li', style: 'margin:0 0 0.7em;line-height:1.9;' },
    { tag: 'ul', style: 'margin:0 0 1em 1.2em;padding:0;' },
    { tag: 'ol', style: 'margin:0 0 1em 1.2em;padding:0;' },
    { tag: 'h1', style: 'margin:0 0 0.9em;line-height:1.5;font-weight:700;' },
    { tag: 'h2', style: 'margin:0 0 0.9em;line-height:1.55;font-weight:700;' },
    { tag: 'h3', style: 'margin:0 0 0.8em;line-height:1.6;font-weight:700;' },
    { tag: 'blockquote', style: 'margin:0 0 1em;padding-left:0.9em;border-left:4px solid #f4c7d7;color:#6b7785;' },
  ]

  return blockStyles.reduce((result, item) => (
    result.replace(new RegExp(`<${item.tag}(\\s[^>]*)?>`, 'gi'), (_match, attrs?: string) => (
      `<${item.tag}${appendInlineStyle(attrs, item.style)}>`
    ))
  ), html)
}

function normalizeBlock(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false

  if (trimmed.length <= 24 && !/[。！？!?；;]$/.test(trimmed)) {
    return /^(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|附件|附：|提示|建议|结论|原因|措施|何时就医|不确定性说明|参考来源)/u.test(trimmed)
  }

  return false
}

function splitHeadingPrefix(line: string): { heading?: string; remainder?: string } {
  const trimmed = line.trim()
  const match = trimmed.match(/^(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|附件|附：|提示|建议|结论|原因|措施|何时就医|不确定性说明|参考来源)(.*)$/u)
  if (!match) return {}

  const heading = match[1]?.trim()
  const remainder = match[2]?.trim()
  if (!heading) return {}
  if (!remainder) return { heading }

  const headingTextMatch = remainder.match(/^([\u4e00-\u9fa5A-Za-z0-9]{2,12}?)(?=(如果|请|应|需|可|先|要|做|保持|观察|出现|及时|立即|继续|尽快|按照|根据|对于|将|建议|注意))/u)
  if (headingTextMatch?.[1]) {
    const headingText = headingTextMatch[1].trim()
    return {
      heading: `${heading}${headingText}`,
      remainder: remainder.slice(headingText.length).trim(),
    }
  }

  if (remainder.length <= 12 && !/[。！？!?；;]$/.test(remainder)) {
    return { heading: `${heading}${remainder}` }
  }

  return {
    heading: `${heading}${remainder.replace(/[。！？!?；;].*$/u, '').trim()}`.trim(),
    remainder,
  }
}

function splitIntoSentences(text: string): string[] {
  const normalized = text.trim()
  if (!normalized) return []

  const matched = normalized.match(/[^。！？!?；;]+[。！？!?；;]?/gu)
  if (!matched) return [normalized]
  return matched.map((item) => item.trim()).filter(Boolean)
}

function chunkSentences(sentences: string[], maxChars = 88, maxSentences = 2): string[] {
  const chunks: string[] = []
  let current = ''
  let currentCount = 0

  for (const sentence of sentences) {
    const candidate = `${current}${sentence}`.trim()
    if (current && (candidate.length > maxChars || currentCount >= maxSentences)) {
      chunks.push(current.trim())
      current = sentence
      currentCount = 1
      continue
    }

    current = candidate
    currentCount += 1
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks
}

function expandDenseParagraph(paragraph: string): string[] {
  const trimmed = paragraph.trim()
  if (!trimmed) return []

  if (trimmed.length <= 80 && splitIntoSentences(trimmed).length <= 2) {
    return [trimmed]
  }

  const sentences = splitIntoSentences(trimmed)
  if (sentences.length <= 2) {
    return [trimmed]
  }

  return chunkSentences(sentences)
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
  const normalized = normalizeBlock(
    text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/([。！？!?；;])(?=(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|附件|附：|提示|建议|结论|原因|措施|何时就医|不确定性说明|参考来源))/gu, '$1\n')
      .replace(/([^\n])(第[一二三四五六七八九十百千万0-9]+[章节部分篇条])/gu, '$1\n$2')
      .replace(/([^\n])([一二三四五六七八九十]+[、.．])/gu, '$1\n$2')
      .replace(/([^\n])(（[一二三四五六七八九十0-9]+）)/gu, '$1\n$2'),
  )

  const rawBlocks = normalized.split(/\n{2,}/).map(line => line.trim()).filter(Boolean)
  const paragraphs: string[] = []

  rawBlocks.forEach((block) => {
    const lines = block.split(/\n+/).map(line => line.trim()).filter(Boolean)
    let buffer = ''

    lines.forEach((line) => {
      const splitHeading = splitHeadingPrefix(line)
      if (splitHeading.heading) {
        if (buffer.trim()) {
          paragraphs.push(...expandDenseParagraph(buffer))
          buffer = ''
        }
        paragraphs.push(splitHeading.heading)
        if (splitHeading.remainder) {
          buffer = splitHeading.remainder
        }
        return
      }

      if (/^[-*•·]\s+/.test(line) || isLikelyHeading(line)) {
        if (buffer.trim()) {
          paragraphs.push(...expandDenseParagraph(buffer))
          buffer = ''
        }
        paragraphs.push(line)
        return
      }

      buffer = buffer ? `${buffer} ${line}` : line
    })

    if (buffer.trim()) {
      paragraphs.push(...expandDenseParagraph(buffer))
    }
  })

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
    const sanitizedHtml = trimmed
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<(?:nav|footer|header|aside)[\s\S]*?<\/(?:nav|footer|header|aside)>/gi, '')
      .replace(/<(?:p|div|section|article)[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/(?:p|div|section|article)>/gi, '')
      .trim()

    if (/<(?:p|div|section|article|li|ul|ol|h[1-6]|blockquote)\b/i.test(sanitizedHtml)) {
      return addBlockSpacingToHtml(sanitizedHtml)
    }

    return convertTextToRichHtml(stripHtmlTags(sanitizedHtml))
  }

  return convertTextToRichHtml(trimmed)
}
