import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native'
import { Chip, IconButton, Snackbar, Text } from 'react-native-paper'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { StackNavigationProp } from '@react-navigation/stack'
import LinearGradient from 'react-native-linear-gradient'
import { getDisclaimer } from '../api/ai'
import type { AIMessage } from '../api/ai'
import UpgradeModal from '../components/UpgradeModal'
import { MessageBubble, EmptyState, ChatInput, TypingIndicator, ChatSkeleton } from '../components/chat'
import { ScreenContainer, StandardCard } from '../components/layout'
import { useChatLogic } from '../hooks/useChatLogic'
import { trackAppEvent } from '../services/analytics'
import { useAppStore } from '../stores/appStore'
import { useChatStore } from '../stores/chatStore'
import { getStageSummary } from '../utils/stage'
import { QUICK_QUESTION_MAP } from '../utils/chatPrompts'
import { colors, spacing, borderRadius } from '../theme'
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator'

type ChatEntrySource = 'weekly_report' | 'home_suggested_question' | 'knowledge_detail' | 'knowledge_recent_ai'

type PendingResponseMeta = {
  source: ChatEntrySource | 'native'
  trigger: 'auto_prefill' | 'manual_input' | 'quick_question'
  questionLength: number
}

type ChatEntryContext = string | Record<string, string | number | boolean | null>

function getTrackingEntryMeta(
  context: ChatEntryContext | undefined,
  activeEntryMeta: AIMessage['entryMeta'] | null,
) {
  if (context && typeof context === 'object' && !Array.isArray(context)) {
    return {
      entrySource: typeof context.entrySource === 'string' ? context.entrySource : activeEntryMeta?.entrySource,
      articleSlug: typeof context.articleSlug === 'string' ? context.articleSlug : activeEntryMeta?.articleSlug,
      reportId: typeof context.reportId === 'string' ? context.reportId : activeEntryMeta?.reportId,
    }
  }

  return {
    entrySource: activeEntryMeta?.entrySource,
    articleSlug: activeEntryMeta?.articleSlug,
    reportId: activeEntryMeta?.reportId,
  }
}

const CHAT_SOURCE_LABEL: Record<ChatEntrySource, { title: string; subtitle: string }> = {
  weekly_report: {
    title: '来自周报提醒',
    subtitle: '这条问题由本周重点自动带入，继续追问会更容易落到具体安排。',
  },
  home_suggested_question: {
    title: '来自首页建议提问',
    subtitle: '这是按当前阶段推荐的问题，先问这一句通常最容易打开后续对话。',
  },
  knowledge_detail: {
    title: '来自权威知识库',
    subtitle: '这条问题由当前阅读内容带入，继续追问会保留文章主题和来源线索。',
  },
  knowledge_recent_ai: {
    title: '来自最近阅读线索',
    subtitle: '这条问题由最近命中的文章、主题或机构带入，方便直接沿着上次线索继续问。',
  },
}

export default function ChatScreen() {
  const navigation = useNavigation<CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Chat'>,
    StackNavigationProp<RootStackParamList>
  >>()
  const route = useRoute<RouteProp<TabParamList, 'Chat'>>()
  const user = useAppStore((state) => state.user)
  const activeEntryMeta = useChatStore((state) => state.activeEntryMeta)
  const flatListRef = useRef<FlatList>(null)
  const [inputText, setInputText] = useState('')
  const [snackVisible, setSnackVisible] = useState(false)
  const [snackText, setSnackText] = useState('已复制到剪贴板')
  const [entrySource, setEntrySource] = useState<ChatEntrySource | null>(null)
  const [pendingInputContext, setPendingInputContext] = useState<ChatEntryContext | undefined>(undefined)
  const [pendingResponseMeta, setPendingResponseMeta] = useState<PendingResponseMeta | null>(null)
  const stage = getStageSummary(user)
  const quickQuestions = QUICK_QUESTION_MAP[stage.lifecycleKey]

  const {
    messages,
    loading,
    loadingHistory,
    streamingContent,
    error,
    status,
    plans,
    membershipLoading,
    remainingCount,
    upgradeVisible,
    setUpgradeVisible,
    handleSend: sendFromHook,
    handleQuickQuestion,
    handleUpgrade,
    clearMessages,
    startFreshSession,
  } = useChatLogic()

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    })
  }, [clearMessages, navigation])

  useEffect(() => {
    if (messages.length > 0 || streamingContent) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 120)
    }
  }, [messages, streamingContent])

  useEffect(() => {
    if (!pendingResponseMeta) {
      return
    }

    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'assistant') {
      return
    }

    void trackAppEvent('app_chat_response_receive', {
      page: 'ChatScreen',
      properties: {
        source: pendingResponseMeta.source,
        trigger: pendingResponseMeta.trigger,
        questionLength: pendingResponseMeta.questionLength,
        stage: stage.lifecycleKey,
        route: lastMessage.route,
        provider: lastMessage.provider,
        model: lastMessage.model,
        entrySource: lastMessage.entryMeta?.entrySource,
        articleSlug: lastMessage.entryMeta?.articleSlug,
        reportId: lastMessage.entryMeta?.reportId,
        sourcesCount: lastMessage.sources?.length ?? 0,
        actionCardsCount: lastMessage.actionCards?.length ?? 0,
        degraded: Boolean(lastMessage.degraded),
        sourceReliability: lastMessage.sourceReliability,
        riskLevel: lastMessage.riskLevel,
        triageCategory: lastMessage.triageCategory,
      },
    })

    setPendingResponseMeta(null)
  }, [messages, pendingResponseMeta, stage.lifecycleKey])

  const sendTrackedQuestion = useCallback((
    question: string,
    trigger: PendingResponseMeta['trigger'],
    sourceOverride?: ChatEntrySource | 'native',
    context?: ChatEntryContext,
  ) => {
    const trimmed = question.trim()
    if (!trimmed) {
      return false
    }

    const source = sourceOverride ?? entrySource ?? 'native'
    const trackingEntryMeta = getTrackingEntryMeta(context, activeEntryMeta)
    const sent = trigger === 'manual_input'
      ? sendFromHook(trimmed, context)
      : handleQuickQuestion(trimmed, context)

    if (!sent) {
      return false
    }

    void trackAppEvent('app_chat_message_send', {
      page: 'ChatScreen',
      properties: {
        source,
        trigger,
        stage: stage.lifecycleKey,
        questionLength: trimmed.length,
        contextEntrySource: typeof context === 'object' && context && !Array.isArray(context)
          ? context.entrySource
          : undefined,
        entrySource: trackingEntryMeta.entrySource,
        articleSlug: trackingEntryMeta.articleSlug,
        reportId: trackingEntryMeta.reportId,
      },
    })

    setPendingResponseMeta({
      source,
      trigger,
      questionLength: trimmed.length,
    })

    if (sourceOverride !== undefined || trigger !== 'auto_prefill') {
      setEntrySource(null)
    }

    return true
  }, [activeEntryMeta, entrySource, handleQuickQuestion, sendFromHook, stage.lifecycleKey])

  useEffect(() => {
    const params = route.params

    if (!params?.prefillQuestion) {
      return
    }

    const nextQuestion = params.prefillQuestion.trim()
    if (!nextQuestion) {
      navigation.setParams({
        prefillQuestion: undefined,
        prefillContext: undefined,
        autoSend: undefined,
        source: undefined,
      })
      return
    }

    setEntrySource(params.source ?? null)
    void trackAppEvent('app_chat_prefill_entry', {
      page: 'ChatScreen',
      properties: {
        source: params.source ?? 'native',
        autoSend: Boolean(params.autoSend),
        stage: stage.lifecycleKey,
        entrySource: params.prefillContext?.entrySource,
        articleSlug: params.prefillContext?.articleSlug,
        reportId: params.prefillContext?.reportId,
        questionLength: nextQuestion.length,
      },
    })

    if (params.autoSend) {
      startFreshSession()
      setInputText('')
      setPendingInputContext(undefined)
      sendTrackedQuestion(nextQuestion, 'auto_prefill', params.source ?? 'native', params.prefillContext)
    } else {
      setInputText(nextQuestion)
      setPendingInputContext(params.prefillContext)
    }

    navigation.setParams({
      prefillQuestion: undefined,
      prefillContext: undefined,
      autoSend: undefined,
      source: undefined,
    })
  }, [navigation, route.params, sendTrackedQuestion, stage.lifecycleKey, startFreshSession])

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim()
    if (!trimmed) return
    setInputText('')
    sendTrackedQuestion(trimmed, 'manual_input', undefined, pendingInputContext)
    setPendingInputContext(undefined)
  }, [inputText, pendingInputContext, sendTrackedQuestion])

  const handleQuickQuestionPress = useCallback((question: string) => {
    setEntrySource(null)
    sendTrackedQuestion(question, 'quick_question')
  }, [sendTrackedQuestion])

  const handleCopied = useCallback(() => {
    setSnackText('已复制到剪贴板')
    setSnackVisible(true)
  }, [])

  const handleActionNotice = useCallback((message: string) => {
    setSnackText(message)
    setSnackVisible(true)
  }, [])

  const renderMessage = useCallback(
    ({ item }: { item: AIMessage }) => (
      <MessageBubble item={item} onCopied={handleCopied} onActionNotice={handleActionNotice} />
    ),
    [handleActionNotice, handleCopied],
  )

  const renderFooter = useCallback(() => {
    if (!loading && !streamingContent) return null
    return <TypingIndicator streamingContent={streamingContent} />
  }, [loading, streamingContent])

  const renderHeader = useCallback(
    () => (
      <View style={styles.listHeader}>
        <StandardCard style={styles.heroCard} elevation={2}>
          <LinearGradient
            colors={['#254652', '#3B6670', '#E7D5C7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroRing} />
            <View style={styles.heroGrid} />
            <View style={styles.heroBeam} />
            <View style={styles.heroBottomLine} />
            <View pointerEvents="none" style={styles.heroFrame}>
              <View style={styles.heroCornerTop} />
              <View style={styles.heroCornerBottom} />
            </View>
            <View style={[styles.statusStrip, status === 'active' ? styles.statusStripActive : styles.statusStripFree]}>
              <View style={styles.statusMeta}>
                <View style={[styles.statusSignalDot, status === 'active' ? styles.statusSignalDotActive : styles.statusSignalDotFree]} />
                <Text style={[styles.statusStripLabel, status === 'active' ? styles.statusStripLabelActive : styles.statusStripLabelFree]}>
                  {status === 'active' ? '会员已开通' : '非会员模式'}
                </Text>
              </View>
              <Text style={[styles.statusStripValue, status === 'active' ? styles.statusStripValueActive : styles.statusStripValueFree]}>
                {status === 'active' ? '不限次连续追问' : `今日剩余 ${remainingCount} 次回答`}
              </Text>
            </View>

            <View style={styles.headerTopRow}>
              <View style={styles.headerChipRow}>
                <Chip compact style={styles.heroChip} textStyle={styles.heroChipText}>
                  {stage.lifecycleLabel}
                </Chip>
                <Chip compact style={styles.heroAssistChip} textStyle={styles.heroAssistChipText}>
                  知识参考
                </Chip>
              </View>

              <IconButton
                icon="delete-outline"
                iconColor="#F2FBFC"
                containerColor="rgba(8, 26, 32, 0.08)"
                size={15}
                style={styles.clearButton}
                onPress={clearMessages}
              />
            </View>

            <View style={styles.headerTitleRow}>
              <View style={styles.headerTitleAccent} />
              <Text numberOfLines={1} style={styles.headerTitle}>围绕当前阶段，把需要优先确认的问题和线索先梳理清楚</Text>
            </View>
          </LinearGradient>
        </StandardCard>

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {entrySource ? (
          <StandardCard style={styles.sourceCard}>
            <View style={styles.sourceCardHeader}>
              <Chip compact style={styles.sourceChip} textStyle={styles.sourceChipText}>
                推荐入口
              </Chip>
              <Text style={styles.sourceTitle}>{CHAT_SOURCE_LABEL[entrySource].title}</Text>
            </View>
            <Text style={styles.sourceSubtitle}>{CHAT_SOURCE_LABEL[entrySource].subtitle}</Text>
          </StandardCard>
        ) : null}
      </View>
    ),
    [clearMessages, entrySource, error, remainingCount, stage.lifecycleLabel, status],
  )

  return (
    <ScreenContainer style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loadingHistory ? (
          <ChatSkeleton />
        ) : (
          <FlatList
            ref={flatListRef}
            style={styles.messageListView}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.messageList,
              messages.length === 0 && styles.messageListEmpty,
            ]}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={
              <EmptyState
                title={`${stage.lifecycleLabel}可以先问这些`}
                subtitle={`结合你当前的${stage.lifecycleLabel}，先从一个最具体的问题开始，再继续追问细节与安排。`}
                quickQuestions={quickQuestions}
                onQuickQuestion={handleQuickQuestionPress}
              />
            }
            ListFooterComponent={renderFooter}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false })
              }
            }}
          />
        )}

        <ChatInput
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSend}
          loading={loading}
          hint={getDisclaimer()}
        />
      </KeyboardAvoidingView>

      <UpgradeModal
        visible={upgradeVisible}
        plans={plans}
        loading={membershipLoading}
        onDismiss={() => setUpgradeVisible(false)}
        onUpgrade={handleUpgrade}
        onViewMembership={() => navigation.navigate('Membership')}
      />

      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={2000}
      >
        {snackText}
      </Snackbar>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  listHeader: {
    gap: spacing.md,
  },
  sourceCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    backgroundColor: 'rgba(255, 249, 243, 0.95)',
  },
  sourceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sourceChip: {
    backgroundColor: 'rgba(220,236,238,0.9)',
  },
  sourceChipText: {
    color: colors.techDark,
    fontWeight: '700',
  },
  sourceTitle: {
    flex: 1,
    color: colors.ink,
    fontWeight: '700',
  },
  sourceSubtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  heroCard: {
    backgroundColor: 'transparent',
    marginHorizontal: -4,
  },
  heroGradient: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm + 2,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.md + 4,
  },
  heroGlow: {
    position: 'absolute',
    top: -54,
    right: -18,
    width: 196,
    height: 196,
    borderRadius: 98,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroRing: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 1,
    borderColor: 'rgba(223, 244, 248, 0.22)',
  },
  heroGrid: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.4,
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(229, 245, 248, 0.16)',
  },
  heroBeam: {
    position: 'absolute',
    left: -26,
    top: 54,
    width: 186,
    height: 70,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 210, 176, 0.16)',
    transform: [{ rotate: '-10deg' }],
  },
  heroBottomLine: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 14,
    height: 1,
    backgroundColor: 'rgba(228, 244, 247, 0.2)',
  },
  heroFrame: {
    position: 'absolute',
    top: 10,
    right: 10,
    bottom: 10,
    left: 10,
    justifyContent: 'space-between',
  },
  heroCornerTop: {
    width: 72,
    height: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(233, 246, 248, 0.38)',
    borderTopLeftRadius: borderRadius.md,
  },
  heroCornerBottom: {
    width: 72,
    height: 20,
    alignSelf: 'flex-end',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 223, 193, 0.38)',
    borderBottomRightRadius: borderRadius.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerBlock: {
    flex: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 6,
  },
  headerChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flex: 1,
  },
  heroChip: {
    minHeight: 25,
    backgroundColor: 'rgba(242, 252, 255, 0.12)',
    borderColor: 'rgba(223, 244, 248, 0.22)',
    borderWidth: 1,
  },
  heroChipText: {
    color: '#F6FCFD',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  heroAssistChip: {
    minHeight: 25,
    backgroundColor: 'rgba(255, 231, 211, 0.1)',
    borderColor: 'rgba(255, 228, 205, 0.2)',
    borderWidth: 1,
  },
  heroAssistChipText: {
    color: '#FFE7D2',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  headerTitleRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitleAccent: {
    width: 3,
    height: 16,
    borderRadius: borderRadius.pill,
    backgroundColor: '#FFE0BC',
    shadowColor: '#FFE0BC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 4,
  },
  headerTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(18, 33, 37, 0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  clearButton: {
    margin: 0,
    width: 28,
    height: 28,
    alignSelf: 'flex-end',
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(235, 247, 249, 0.18)',
    backgroundColor: 'rgba(14, 38, 46, 0.18)',
  },
  statusStrip: {
    marginBottom: spacing.sm,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  statusStripActive: {
    backgroundColor: 'rgba(10, 31, 39, 0.3)',
    borderColor: 'rgba(255, 219, 174, 0.24)',
  },
  statusStripFree: {
    backgroundColor: 'rgba(10, 31, 39, 0.28)',
    borderColor: 'rgba(214, 234, 237, 0.2)',
  },
  statusMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusSignalDot: {
    width: 7,
    height: 7,
    borderRadius: borderRadius.pill,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  statusSignalDotActive: {
    backgroundColor: '#FFD38B',
    shadowColor: '#FFD38B',
  },
  statusSignalDotFree: {
    backgroundColor: '#9EDCE4',
    shadowColor: '#9EDCE4',
  },
  statusStripLabel: {
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.45,
  },
  statusStripLabelActive: {
    color: '#FFE7C7',
  },
  statusStripLabelFree: {
    color: '#D9EEF0',
  },
  statusStripValue: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
    letterSpacing: 0.3,
  },
  statusStripValueActive: {
    color: '#FFF8E7',
  },
  statusStripValueFree: {
    color: '#F6FCFD',
  },
  errorBar: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.redLight,
  },
  errorText: {
    color: colors.red,
  },
  messageList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl * 4 + spacing.lg,
  },
  messageListEmpty: {
    flexGrow: 1,
  },
  messageListView: {
    flex: 1,
  },
})
