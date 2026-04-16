import React, { useCallback, useMemo } from 'react'
import { Clipboard, StyleSheet, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { IconButton, Text } from 'react-native-paper'
import type { AIMessage } from '../../api/ai'
import { articleApi, type Article } from '../../api/modules'
import { useAppStore } from '../../stores/appStore'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { getStageSummary, type LifecycleStageKey } from '../../utils/stage'
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

async function findBestKnowledgeArticle(message: AIMessage, fallbackKeyword: string) {
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
      return sourceUrlMatch
    }

    const exactTitleMatch = normalizedSourceTitle
      ? list.find((article) => normalizeSearchText(article.title) === normalizedSourceTitle)
      : undefined
    if (exactTitleMatch) {
      return exactTitleMatch
    }

    const fuzzyTitleMatch = normalizedSourceTitle
      ? list.find((article) => {
          const normalizedTitle = normalizeSearchText(article.title)
          return normalizedTitle.includes(normalizedSourceTitle) || normalizedSourceTitle.includes(normalizedTitle)
        })
      : undefined
    if (fuzzyTitleMatch) {
      return fuzzyTitleMatch
    }

    return list[0] as Article
  }

  return null
}

function MessageBubbleInner({ item, onCopied, onActionNotice }: MessageBubbleProps) {
  const isUser = item.role === 'user'
  const navigation = useNavigation<any>()
  const user = useAppStore((state) => state.user)
  const stage = getStageSummary(user)
  const canShowActionBar = !isUser
  const calendarPrefill = useMemo(
    () => buildSmartCalendarPrefill(item, stage.lifecycleKey),
    [item, stage.lifecycleKey],
  )
  const knowledgeKeyword = useMemo(() => buildKnowledgeKeyword(item), [item])

  const handleLongPress = useCallback(() => {
    Clipboard.setString(item.content)
    onCopied?.()
  }, [item.content, onCopied])

  const handleCopy = useCallback(() => {
    Clipboard.setString(item.content)
    onCopied?.()
  }, [item.content, onCopied])

  const handleOpenCalendar = useCallback(() => {
    navigation.navigate('Calendar', {
      prefillTitle: calendarPrefill.title,
      prefillDescription: calendarPrefill.description,
      prefillEventType: calendarPrefill.eventType,
      targetDate: calendarPrefill.targetDate,
      source: 'chat',
    })
    onActionNotice?.('已按建议生成日历草稿')
  }, [calendarPrefill.description, calendarPrefill.eventType, calendarPrefill.targetDate, calendarPrefill.title, navigation, onActionNotice])

  const handleOpenKnowledge = useCallback(async () => {
    try {
      const matchedArticle = await findBestKnowledgeArticle(item, knowledgeKeyword)
      if (matchedArticle?.slug) {
        navigation.navigate('KnowledgeDetail', { slug: matchedArticle.slug })
        onActionNotice?.('已打开本轮相关权威文章')
        return
      }
    } catch (_error) {
      // Fall through to knowledge search.
    }

    useKnowledgeStore.getState().initializeFilters()
    void useKnowledgeStore.getState().search(knowledgeKeyword)
    navigation.navigate('Main', { screen: 'Knowledge' })
    onActionNotice?.(`已打开“${knowledgeKeyword}”相关知识`)
  }, [item, knowledgeKeyword, navigation, onActionNotice])

  const handleOpenArchive = useCallback(() => {
    if (stage.kind === 'pregnant') {
      navigation.navigate('PregnancyProfile')
      onActionNotice?.('已打开孕期档案')
      return
    }

    navigation.navigate('GrowthArchive')
    onActionNotice?.('已打开成长档案')
  }, [navigation, onActionNotice, stage.kind])

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
        {!isUser && item.sources?.length ? (
          <SourcesList messageId={item.id} sources={item.sources} />
        ) : null}

        {canShowActionBar ? (
          <View style={styles.jumpActionWrap}>
            <Text style={styles.jumpActionTitle}>继续处理</Text>
            <View style={styles.jumpActionRow}>
              <TouchableOpacity activeOpacity={0.88} onPress={handleOpenCalendar} style={styles.jumpActionChip}>
                <Text style={styles.jumpActionChipText}>加入日历</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.88} onPress={handleOpenKnowledge} style={styles.jumpActionChip}>
                <Text style={styles.jumpActionChipText}>相关知识</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.88} onPress={handleOpenArchive} style={styles.jumpActionChip}>
                <Text style={styles.jumpActionChipText}>{stage.kind === 'pregnant' ? '查看档案' : '成长档案'}</Text>
              </TouchableOpacity>
            </View>
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
              iconColor={colors.textLight}
              style={styles.actionButton}
              onPress={() => {}}
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
  },
  jumpActionChipText: {
    color: colors.techDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  referenceNotice: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  actionButton: {
    margin: 0,
    width: 28,
    height: 28,
  },
})
