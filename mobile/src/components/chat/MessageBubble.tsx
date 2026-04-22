import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Clipboard, StyleSheet, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { IconButton, Text } from 'react-native-paper'
import { aiApi, type AIActionCard, type AIMessage } from '../../api/ai'
import { articleApi, type Article } from '../../api/modules'
import { useAppStore } from '../../stores/appStore'
import { useChatStore } from '../../stores/chatStore'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { getStageSummary, type LifecycleStageKey } from '../../utils/stage'
import { trackAppEvent } from '../../services/analytics'
import { colors, fontSize, spacing, borderRadius } from '../../theme'
import MarkdownText from './MarkdownText'
import TrustPanel from './TrustPanel'
import SourcesList from './SourcesList'

const ASSISTANT_REFERENCE_NOTICE = '以上内容仅供一般信息参考，请结合实际情况判断。'

interface MessageBubbleProps {
  item: AIMessage
  onCopied?: () => void
  onActionNotice?: (message: string) => void
}

type CalendarPrefill = {
  title: string
  description: string
  eventType: 'checkup' | 'vaccine' | 'reminder' | 'exercise' | 'diet' | 'other'
  targetDate: string
}

type FeedbackValue = 'helpful' | 'not_helpful'
type KnowledgeHitReason = 'entry_meta' | 'source_url' | 'source_title' | 'source_keyword'

type KnowledgeArticleMatch = {
  article: Article
  reason: KnowledgeHitReason
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function resolveSuggestedOffsetDays(text: string, lifecycleKey: LifecycleStageKey) {
  const compact = text.replace(/\s+/g, '')

  const rangeDayMatch = compact.match(/(\d+)[-~至](\d+)天内/u)
  if (rangeDayMatch) return Math.max(Number(rangeDayMatch[1]), 0)

  const singleDayMatch = compact.match(/(\d+)天内/u)
  if (singleDayMatch) return Math.max(Number(singleDayMatch[1]), 0)

  const hourMatch = compact.match(/(\d+)(小时|h)内/iu)
  if (hourMatch) {
    const hours = Number(hourMatch[1])
    return hours <= 24 ? 0 : 1
  }

  const weekRangeMatch = compact.match(/(\d+)[-~至](\d+)(周|星期)内/u)
  if (weekRangeMatch) return Math.max(Number(weekRangeMatch[1]) * 7, 0)

  const weekMatch = compact.match(/(\d+)(周|星期)内/u)
  if (weekMatch) return Math.max(Number(weekMatch[1]) * 7, 0)

  if (/今天|今日|今晚|现在|立即|尽快/u.test(compact)) return 0
  if (/明天|次日/u.test(compact)) return 1
  if (/后天/u.test(compact)) return 2
  if (/本周|这周/u.test(compact)) return 2
  if (/下周/u.test(compact)) return 7
  if (/本月/u.test(compact)) return 10

  if (lifecycleKey === 'pregnant_late' && /待产|宫缩|见红|破水/u.test(compact)) return 1
  if (/产检|检查|复查|建档|四维|糖耐|nt\b/iu.test(compact)) return 3
  if (/疫苗|接种/u.test(compact)) return 5
  return 1
}

function inferEventType(text: string): CalendarPrefill['eventType'] {
  const compact = text.replace(/\s+/g, '')

  if (/疫苗|接种|补种/u.test(compact)) return 'vaccine'
  if (/产检|检查|复查|建档|nt\b|四维|糖耐|b超|超声|门诊/u.test(compact)) return 'checkup'
  if (/运动|散步|瑜伽|锻炼/u.test(compact)) return 'exercise'
  if (/饮食|营养|补剂|叶酸|铁剂|钙剂|饮水/u.test(compact)) return 'diet'
  return 'reminder'
}

function buildCalendarPrefill(message: AIMessage) {
  const primaryAction = message.structuredAnswer?.actions?.[0]?.trim()
  const title = primaryAction && primaryAction.length > 0
    ? primaryAction.slice(0, 24)
    : '根据本轮问答补充提醒'
  const description = (
    message.structuredAnswer?.conclusion
    || message.structuredAnswer?.actions?.slice(0, 2).join('；')
    || message.content
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

  return {
    title,
    description,
  }
}

function buildSmartCalendarPrefill(message: AIMessage, lifecycleKey: LifecycleStageKey): CalendarPrefill {
  const base = buildCalendarPrefill(message)
  const combinedText = [
    base.title,
    base.description,
    message.structuredAnswer?.actions?.join('；') || '',
    message.sources?.map((source) => source.title).join('；') || '',
  ].join('；')
  const offsetDays = resolveSuggestedOffsetDays(combinedText, lifecycleKey)

  return {
    title: base.title,
    description: base.description,
    eventType: inferEventType(combinedText),
    targetDate: new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }
}

function buildKnowledgeKeyword(message: AIMessage) {
  const candidates = [
    message.structuredAnswer?.actions?.[0],
    message.structuredAnswer?.conclusion,
    message.sources?.[0]?.title,
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const compact = candidate
      .replace(/^[\d\-\.\s\u2022]+/u, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!compact) continue

    const firstSegment = compact.split(/[，。；：:,.!?！？]/u)[0]?.trim() || compact
    if (firstSegment) {
      return firstSegment.slice(0, 20)
    }
  }

  return '孕期重点提醒'
}

async function resolveKnowledgeArticleMatch(
  message: AIMessage,
  fallbackKeyword: string,
): Promise<KnowledgeArticleMatch | null> {
  if (message.entryMeta?.articleSlug) {
    try {
      const article = await articleApi.getBySlug(message.entryMeta.articleSlug)
      return article ? { article, reason: 'entry_meta' } : null
    } catch {
      // Fall through to source/title matching.
    }
  }

  const primarySource = message.sources?.[0]
  const attempts = [
    primarySource?.title,
    fallbackKeyword,
  ].filter(Boolean) as string[]

  const normalizedSourceTitle = normalizeSearchText(primarySource?.title || '')

  for (const keyword of attempts) {
    const response = await articleApi.getList({
      page: 1,
      pageSize: 5,
      contentType: 'authority',
      keyword,
      sort: 'latest',
    })

    const list = response.list || []
    if (list.length === 0) {
      continue
    }

    const sourceUrlMatch = primarySource?.url
      ? list.find((article) => article.sourceUrl && article.sourceUrl === primarySource.url)
      : undefined
    if (sourceUrlMatch) {
      return { article: sourceUrlMatch, reason: 'source_url' }
    }

    const exactTitleMatch = normalizedSourceTitle
      ? list.find((article) => normalizeSearchText(article.title) === normalizedSourceTitle)
      : undefined
    if (exactTitleMatch) {
      return { article: exactTitleMatch, reason: 'source_title' }
    }

    const fuzzyTitleMatch = normalizedSourceTitle
      ? list.find((article) => {
          const normalizedTitle = normalizeSearchText(article.title)
          return normalizedTitle.includes(normalizedSourceTitle) || normalizedSourceTitle.includes(normalizedTitle)
        })
      : undefined
    if (fuzzyTitleMatch) {
      return { article: fuzzyTitleMatch, reason: 'source_title' }
    }

    return { article: list[0] as Article, reason: 'source_keyword' }
  }

  return null
}

function MessageBubbleInner({ item, onCopied, onActionNotice }: MessageBubbleProps) {
  const isUser = item.role === 'user'
  const navigation = useNavigation<any>()
  const user = useAppStore((state) => state.user)
  const conversationId = useChatStore((state) => state.conversationId)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const stage = getStageSummary(user)
  const hasServerActionCards = (item.actionCards?.length || 0) > 0
  const canShowActionBar = !isUser
  const [feedbackValue, setFeedbackValue] = useState<FeedbackValue | null>(null)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [knowledgeHit, setKnowledgeHit] = useState<KnowledgeArticleMatch | null>(null)
  const calendarPrefill = useMemo(
    () => buildSmartCalendarPrefill(item, stage.lifecycleKey),
    [item, stage.lifecycleKey],
  )
  const knowledgeKeyword = useMemo(() => buildKnowledgeKeyword(item), [item])
  const entryMetaProps = useMemo(() => ({
    entrySource: item.entryMeta?.entrySource,
    articleSlug: item.entryMeta?.articleSlug,
    reportId: item.entryMeta?.reportId,
  }), [item.entryMeta?.articleSlug, item.entryMeta?.entrySource, item.entryMeta?.reportId])
  const knowledgeHitArticle = knowledgeHit?.article || null

  useEffect(() => {
    if (isUser) {
      setKnowledgeHit(null)
      return
    }

    if (!item.entryMeta?.articleSlug && !item.sources?.length) {
      setKnowledgeHit(null)
      return
    }

    let cancelled = false
    const loadKnowledgeHit = async () => {
      try {
        const nextHit = await resolveKnowledgeArticleMatch(item, knowledgeKeyword)
        if (!cancelled) {
          setKnowledgeHit(nextHit)
        }
      } catch {
        if (!cancelled) {
          setKnowledgeHit(null)
        }
      }
    }

    void loadKnowledgeHit()
    return () => {
      cancelled = true
    }
  }, [isUser, item, knowledgeKeyword])

  const handleLongPress = useCallback(() => {
    Clipboard.setString(item.content)
    onCopied?.()
  }, [item.content, onCopied])

  const handleCopy = useCallback(() => {
    Clipboard.setString(item.content)
    onCopied?.()
  }, [item.content, onCopied])

  const handleOpenCalendar = useCallback((card?: AIActionCard) => {
    const payload = card?.payload
    void trackAppEvent('app_chat_add_calendar_click', {
      page: 'ChatScreen',
      properties: {
        stage: stage.lifecycleKey,
        qaId: item.id,
        actionCardId: card?.id,
        riskLevel: item.riskLevel,
        sourceReliability: item.sourceReliability,
        route: item.route,
        provider: item.provider,
        model: item.model,
        ...entryMetaProps,
      },
    })
    navigation.navigate('Calendar', {
      prefillTitle: payload?.eventTitle || calendarPrefill.title,
      prefillDescription: payload?.eventDescription || calendarPrefill.description,
      prefillEventType: payload?.eventType || calendarPrefill.eventType,
      targetDate: payload?.targetDate || calendarPrefill.targetDate,
      source: 'chat',
    })
    onActionNotice?.(card?.title ? `已按“${card.title}”生成日历草稿` : '已按建议生成日历草稿')
  }, [calendarPrefill.description, calendarPrefill.eventType, calendarPrefill.targetDate, calendarPrefill.title, item.id, item.model, item.provider, item.riskLevel, item.route, item.sourceReliability, navigation, onActionNotice, stage.lifecycleKey])

  const handleOpenKnowledge = useCallback(async (card?: AIActionCard) => {
    const payload = card?.payload
    void trackAppEvent('app_chat_open_knowledge_click', {
      page: 'ChatScreen',
      properties: {
        stage: stage.lifecycleKey,
        qaId: item.id,
        actionCardId: card?.id,
        riskLevel: item.riskLevel,
        sourceReliability: item.sourceReliability,
        route: item.route,
        provider: item.provider,
        model: item.model,
        ...entryMetaProps,
      },
    })
    try {
      const matchedArticle = knowledgeHit || await resolveKnowledgeArticleMatch(item, payload?.knowledgeKeyword || knowledgeKeyword)
      if (matchedArticle?.article.slug) {
        navigation.navigate('KnowledgeDetail', {
          slug: matchedArticle.article.slug,
          source: 'chat_hit',
          aiContext: {
            qaId: item.id,
            trigger: 'knowledge_action',
            matchReason: matchedArticle.reason,
            originEntrySource: item.entryMeta?.entrySource,
            originReportId: item.entryMeta?.reportId,
          },
        })
        onActionNotice?.('已打开本轮相关权威文章')
        return
      }
    } catch (_error) {
      // Fall through to knowledge search.
    }

    useKnowledgeStore.getState().initializeFilters()
    void useKnowledgeStore.getState().search(payload?.knowledgeKeyword || knowledgeKeyword)
    navigation.navigate('Main', { screen: 'Knowledge' })
    onActionNotice?.(`已打开“${payload?.knowledgeKeyword || knowledgeKeyword}”相关知识`)
  }, [entryMetaProps, item, knowledgeHit, knowledgeKeyword, navigation, onActionNotice, stage.lifecycleKey])

  const handleOpenKnowledgeHit = useCallback((match: KnowledgeArticleMatch) => {
    void trackAppEvent('app_chat_open_hit_article_click', {
      page: 'ChatScreen',
      properties: {
        stage: stage.lifecycleKey,
        qaId: item.id,
        matchedArticleSlug: match.article.slug,
        matchedArticleId: match.article.id,
        matchedSourceOrg: match.article.sourceOrg || match.article.source || null,
        matchedTopic: match.article.topic || null,
        matchReason: match.reason,
        riskLevel: item.riskLevel,
        sourceReliability: item.sourceReliability,
        route: item.route,
        provider: item.provider,
        model: item.model,
        ...entryMetaProps,
      },
    })
    navigation.navigate('KnowledgeDetail', {
      slug: match.article.slug,
      source: 'chat_hit',
      aiContext: {
        qaId: item.id,
        trigger: 'hit_card',
        matchReason: match.reason,
        originEntrySource: item.entryMeta?.entrySource,
        originReportId: item.entryMeta?.reportId,
      },
    })
    onActionNotice?.('已打开本轮命中的权威文章')
  }, [entryMetaProps, item.id, item.model, item.provider, item.riskLevel, item.route, item.sourceReliability, navigation, onActionNotice, stage.lifecycleKey])

  const handleOpenArchive = useCallback((card?: AIActionCard) => {
    void trackAppEvent('app_chat_open_archive_click', {
      page: 'ChatScreen',
      properties: {
        stage: stage.lifecycleKey,
        qaId: item.id,
        actionCardId: card?.id,
        riskLevel: item.riskLevel,
        sourceReliability: item.sourceReliability,
        route: item.route,
        provider: item.provider,
        model: item.model,
        ...entryMetaProps,
      },
    })
    if (stage.kind === 'pregnant') {
      navigation.navigate('PregnancyProfile')
      onActionNotice?.('已打开孕期档案')
      return
    }

    const focus = card?.payload?.archiveFocus
    navigation.navigate('GrowthArchive', focus ? { source: 'chat', focus } : { source: 'chat' })
    onActionNotice?.('已打开成长档案')
  }, [item.id, item.model, item.provider, item.riskLevel, item.route, item.sourceReliability, navigation, onActionNotice, stage.kind, stage.lifecycleKey])

  const handleFollowUp = useCallback(async (card?: AIActionCard) => {
    const question = card?.payload?.prefillQuestion?.trim()
    if (!question) {
      return
    }

    void trackAppEvent('app_chat_message_send', {
      page: 'ChatScreen',
      properties: {
        source: 'action_card',
        trigger: 'action_card_follow_up',
        stage: stage.lifecycleKey,
        questionLength: question.length,
        qaId: item.id,
        actionCardId: card?.id,
        ...entryMetaProps,
      },
    })

    await sendMessage(question)
    onActionNotice?.('已按建议继续追问')
  }, [item.id, onActionNotice, sendMessage, stage.lifecycleKey])

  const handleFollowUpQuestion = useCallback(async (question: string, index: number) => {
    const trimmed = question.trim()
    if (!trimmed) {
      return
    }

    void trackAppEvent('app_chat_message_send', {
      page: 'ChatScreen',
      properties: {
        source: 'follow_up_question',
        trigger: 'follow_up_chip',
        stage: stage.lifecycleKey,
        questionLength: trimmed.length,
        qaId: item.id,
        followUpIndex: index + 1,
        ...entryMetaProps,
      },
    })

    await sendMessage(trimmed)
    onActionNotice?.('已按建议继续追问')
  }, [item.id, onActionNotice, sendMessage, stage.lifecycleKey])

  const handleActionCardPress = useCallback((card: AIActionCard) => {
    if (card.type === 'calendar') {
      handleOpenCalendar(card)
      return
    }
    if (card.type === 'knowledge') {
      void handleOpenKnowledge(card)
      return
    }
    if (card.type === 'archive') {
      handleOpenArchive(card)
      return
    }
    if (card.type === 'follow_up') {
      void handleFollowUp(card)
    }
  }, [handleFollowUp, handleOpenArchive, handleOpenCalendar, handleOpenKnowledge])

  const handleFeedback = useCallback(async (value: FeedbackValue) => {
    if (feedbackSubmitting || feedbackValue === value) {
      return
    }

    setFeedbackSubmitting(true)
    try {
      await aiApi.submitFeedback({
        qaId: item.id,
        messageId: item.id,
        conversationId: conversationId || undefined,
        feedback: value,
        reason: value === 'not_helpful' ? (item.sources?.length ? 'too_generic' : 'missing_sources') : undefined,
        triageCategory: item.triageCategory,
        riskLevel: item.riskLevel,
        sourceReliability: item.sourceReliability,
        route: item.route,
        provider: item.provider,
        model: item.model,
        entrySource: item.entryMeta?.entrySource,
        articleSlug: item.entryMeta?.articleSlug,
        reportId: item.entryMeta?.reportId,
      })
      setFeedbackValue(value)
      onActionNotice?.(value === 'helpful' ? '已记录这条回答对你有帮助' : '已记录这条回答还不够好')
    } catch {
      onActionNotice?.('反馈提交失败，请稍后再试')
    } finally {
      setFeedbackSubmitting(false)
    }
  }, [conversationId, entryMetaProps, feedbackSubmitting, feedbackValue, item.entryMeta?.articleSlug, item.entryMeta?.entrySource, item.entryMeta?.reportId, item.id, item.model, item.provider, item.riskLevel, item.route, item.sourceReliability, item.sources, item.triageCategory, onActionNotice])

  return (
    <View
      style={[styles.messageWrap, isUser ? styles.userWrap : styles.assistantWrap]}
    >
      <View
        style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}
        onStartShouldSetResponder={() => true}
        onResponderRelease={() => {}}
      >
        <View style={[styles.bubbleGlow, isUser ? styles.userBubbleGlow : styles.assistantBubbleGlow]} />
        {isUser ? (
          <Text
            style={[styles.messageText, styles.userText]}
            onLongPress={handleLongPress}
          >
            {item.content}
          </Text>
        ) : (
          <View>
            <View style={styles.assistantHeader}>
              <View style={styles.assistantBadge}>
                <Text style={styles.assistantBadgeText}>参考答复</Text>
              </View>
              {item.sources?.length ? (
                <Text style={styles.assistantMeta}>已关联 {item.sources.length} 条来源</Text>
              ) : null}
            </View>
            <MarkdownText>{item.content}</MarkdownText>
            <Text style={styles.referenceNotice}>{ASSISTANT_REFERENCE_NOTICE}</Text>
          </View>
        )}

        {!isUser ? <TrustPanel message={item} /> : null}
        {!isUser && knowledgeHitArticle ? (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => knowledgeHit ? handleOpenKnowledgeHit(knowledgeHit) : undefined}
            style={styles.knowledgeHitCard}
          >
            <View style={styles.knowledgeHitHeader}>
              <Text style={styles.knowledgeHitEyebrow}>命中的权威文章</Text>
              <Text style={styles.knowledgeHitLink}>打开全文</Text>
            </View>
            <Text style={styles.knowledgeHitTitle}>{knowledgeHitArticle.title}</Text>
            <Text style={styles.knowledgeHitMeta}>
              {knowledgeHitArticle.sourceOrg || knowledgeHitArticle.source || '权威机构'}
              {knowledgeHitArticle.topic ? ` · ${knowledgeHitArticle.topic}` : ''}
            </Text>
          </TouchableOpacity>
        ) : null}
        {!isUser && item.sources?.length ? (
          <SourcesList messageId={item.id} sources={item.sources} />
        ) : null}

        {canShowActionBar ? (
          <View style={styles.jumpActionWrap}>
            <Text style={styles.jumpActionTitle}>继续处理</Text>
            <View style={styles.jumpActionRow}>
              {hasServerActionCards ? item.actionCards!.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  activeOpacity={0.88}
                  onPress={() => handleActionCardPress(card)}
                  style={[styles.jumpActionChip, card.priority === 'primary' ? styles.jumpActionChipPrimary : null]}
                >
                  <Text style={[styles.jumpActionChipText, card.priority === 'primary' ? styles.jumpActionChipTextPrimary : null]}>
                    {card.label}
                  </Text>
                  <Text style={[styles.jumpActionChipTitle, card.priority === 'primary' ? styles.jumpActionChipTitlePrimary : null]}>
                    {card.title}
                  </Text>
                  {card.description ? (
                    <Text style={[styles.jumpActionChipDesc, card.priority === 'primary' ? styles.jumpActionChipDescPrimary : null]}>
                      {card.description}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              )) : (
                <>
                  <TouchableOpacity activeOpacity={0.88} onPress={() => handleOpenCalendar()} style={styles.jumpActionChip}>
                    <Text style={styles.jumpActionChipText}>加入日历</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.88} onPress={() => void handleOpenKnowledge()} style={styles.jumpActionChip}>
                    <Text style={styles.jumpActionChipText}>相关知识</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.88} onPress={() => handleOpenArchive()} style={styles.jumpActionChip}>
                    <Text style={styles.jumpActionChipText}>{stage.kind === 'pregnant' ? '查看档案' : '成长档案'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ) : null}

        {!isUser && item.followUpQuestions?.length ? (
          <View style={styles.followUpWrap}>
            <Text style={styles.followUpTitle}>还可以继续问</Text>
            {item.followUpQuestions.slice(0, 3).map((question, index) => (
              <TouchableOpacity
                key={`${item.id}-follow-up-${index}`}
                activeOpacity={0.86}
                onPress={() => void handleFollowUpQuestion(question, index)}
                style={styles.followUpChip}
              >
                <Text style={styles.followUpChipText}>{question}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {!isUser ? (
          <View style={styles.actionRow}>
            <IconButton
              icon="content-copy"
              size={16}
              iconColor={colors.textLight}
              style={styles.actionButton}
              onPress={handleCopy}
            />
            <IconButton
              icon="thumb-up-outline"
              size={16}
              iconColor={feedbackValue === 'helpful' ? colors.techDark : colors.textLight}
              style={styles.actionButton}
              disabled={feedbackSubmitting}
              onPress={() => void handleFeedback('helpful')}
            />
            <IconButton
              icon="thumb-down-outline"
              size={16}
              iconColor={feedbackValue === 'not_helpful' ? colors.techDark : colors.textLight}
              style={styles.actionButton}
              disabled={feedbackSubmitting}
              onPress={() => void handleFeedback('not_helpful')}
            />
          </View>
        ) : null}
      </View>
    </View>
  )
}

const MessageBubble = React.memo(MessageBubbleInner, (prev, next) => {
  return prev.item.id === next.item.id
    && prev.item.content === next.item.content
    && prev.onCopied === next.onCopied
    && prev.onActionNotice === next.onActionNotice
})

export default MessageBubble

const styles = StyleSheet.create({
  messageWrap: {
    marginBottom: spacing.md,
    flexDirection: 'row',
  },
  userWrap: {
    justifyContent: 'flex-end',
  },
  assistantWrap: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '84%',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  userBubble: {
    backgroundColor: '#FFF3EA',
    borderBottomRightRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 233, 219, 0.94)',
    shadowColor: 'rgba(185, 104, 66, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  assistantBubble: {
    backgroundColor: '#F2F9FB',
    borderBottomLeftRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(224, 239, 243, 0.92)',
    shadowColor: 'rgba(100, 130, 150, 0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  bubbleGlow: {
    position: 'absolute',
    top: -22,
    right: -12,
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  userBubbleGlow: {
    backgroundColor: 'rgba(255, 255, 255, 0.36)',
  },
  assistantBubbleGlow: {
    backgroundColor: 'rgba(223, 241, 245, 0.52)',
  },
  messageText: {
    lineHeight: 22,
    color: colors.ink,
  },
  userText: {
    color: colors.ink,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  assistantBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(213, 233, 238, 0.72)',
  },
  assistantBadgeText: {
    color: colors.techDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  assistantMeta: {
    color: colors.textLight,
    fontSize: fontSize.sm,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    marginLeft: -spacing.sm,
  },
  jumpActionWrap: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(94,126,134,0.12)',
    gap: spacing.xs,
  },
  jumpActionTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  jumpActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  jumpActionChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(220,236,238,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
    minWidth: 120,
    maxWidth: 220,
    gap: 2,
  },
  jumpActionChipPrimary: {
    backgroundColor: colors.techDark,
    borderColor: colors.techDark,
  },
  jumpActionChipText: {
    color: colors.techDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  jumpActionChipTextPrimary: {
    color: '#F7FAFB',
  },
  jumpActionChipTitle: {
    color: colors.ink,
    fontSize: fontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
  jumpActionChipTitlePrimary: {
    color: '#FFFFFF',
  },
  jumpActionChipDesc: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  jumpActionChipDescPrimary: {
    color: 'rgba(255,255,255,0.82)',
  },
  followUpWrap: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  followUpTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  followUpChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(248, 244, 238, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(208, 188, 170, 0.22)',
  },
  followUpChipText: {
    color: colors.ink,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  referenceNotice: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  knowledgeHitCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 249, 240, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.18)',
    gap: spacing.xs,
  },
  knowledgeHitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  knowledgeHitEyebrow: {
    color: colors.gold,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  knowledgeHitLink: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  knowledgeHitTitle: {
    color: colors.ink,
    fontSize: fontSize.sm,
    fontWeight: '800',
    lineHeight: 20,
  },
  knowledgeHitMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  actionButton: {
    margin: 0,
    width: 28,
    height: 28,
  },
})
