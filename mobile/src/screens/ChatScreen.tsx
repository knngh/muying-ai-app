import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { Snackbar, Text } from 'react-native-paper'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { StackNavigationProp } from '@react-navigation/stack'
import { getDisclaimer } from '../api/ai'
import type { AIMessage } from '../api/ai'
import UpgradeModal from '../components/UpgradeModal'
import { MessageBubble, EmptyState, ChatInput, TypingIndicator, ChatSkeleton } from '../components/chat'
import { ScreenContainer } from '../components/layout'
import { useChatLogic } from '../hooks/useChatLogic'
import { trackAppEvent } from '../services/analytics'
import { getVoiceInputErrorMessage, transcribeVoiceQuestion } from '../services/voiceInput'
import { useAppStore } from '../stores/appStore'
import { useChatStore } from '../stores/chatStore'
import { config } from '../config'
import { v4 as uuidv4 } from '../utils'
import { getStageSummary } from '../utils/stage'
import { getQuickQuestions } from '../utils/chatPrompts'
import { colors, spacing, borderRadius } from '../theme'
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator'

type RoutedChatEntrySource = 'weekly_report' | 'home_suggested_question' | 'knowledge_detail' | 'knowledge_recent_ai'
type ChatEntrySource = RoutedChatEntrySource | 'native'

type PendingResponseMeta = {
  source: ChatEntrySource
  trigger: 'auto_prefill' | 'manual_input' | 'quick_question'
  questionLength: number
  clientRequestId: string
  entrySource?: string
  articleSlug?: string
  reportId?: string
}

type ChatEntryContextRecord = Record<string, string | number | boolean | null>
type ChatEntryContext = string | ChatEntryContextRecord

function isChatEntryContextRecord(context: ChatEntryContext | undefined): context is ChatEntryContextRecord {
  return Boolean(context && typeof context === 'object' && !Array.isArray(context))
}

function buildRequestEntryContext(
  context: ChatEntryContext | undefined,
  source: ChatEntrySource,
  stageKey: string,
  activeEntryMeta: AIMessage['entryMeta'] | null,
): ChatEntryContext | undefined {
  if (isChatEntryContextRecord(context)) {
    const hasEntrySource = typeof context.entrySource === 'string' && context.entrySource.trim().length > 0
    const hasStage = typeof context.stage === 'string' && context.stage.trim().length > 0

    if (hasEntrySource && hasStage) {
      return context
    }

    return {
      ...context,
      ...(!hasEntrySource ? { entrySource: activeEntryMeta?.entrySource ?? source } : {}),
      ...(!hasStage ? { stage: activeEntryMeta?.stage ?? stageKey } : {}),
    }
  }

  if (context !== undefined) {
    return context
  }

  return {
    entrySource: activeEntryMeta?.entrySource ?? source,
    stage: activeEntryMeta?.stage ?? stageKey,
  }
}

function getTrackingEntryMeta(
  context: ChatEntryContext | undefined,
  activeEntryMeta: AIMessage['entryMeta'] | null,
) {
  if (isChatEntryContextRecord(context)) {
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

const CHAT_SOURCE_LABEL: Record<RoutedChatEntrySource, { title: string; subtitle: string }> = {
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
  const [entrySource, setEntrySource] = useState<RoutedChatEntrySource | null>(null)
  const [pendingInputContext, setPendingInputContext] = useState<ChatEntryContext | undefined>(undefined)
  const [pendingResponseMeta, setPendingResponseMeta] = useState<PendingResponseMeta | null>(null)
  const [voiceInputLoading, setVoiceInputLoading] = useState(false)
  const stage = getStageSummary(user)
  const quickQuestions = getQuickQuestions(stage.lifecycleKey, user?.caregiverRole)

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
        clientRequestId: pendingResponseMeta.clientRequestId,
        questionLength: pendingResponseMeta.questionLength,
        stage: stage.lifecycleKey,
        route: lastMessage.route,
        provider: lastMessage.provider,
        model: lastMessage.model,
        entrySource: lastMessage.entryMeta?.entrySource ?? pendingResponseMeta.entrySource ?? pendingResponseMeta.source,
        articleSlug: lastMessage.entryMeta?.articleSlug ?? pendingResponseMeta.articleSlug,
        reportId: lastMessage.entryMeta?.reportId ?? pendingResponseMeta.reportId,
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
    const requestContext = buildRequestEntryContext(context, source, stage.lifecycleKey, activeEntryMeta)
    const trackingEntryMeta = getTrackingEntryMeta(requestContext, activeEntryMeta)
    const clientRequestId = uuidv4()
    const sent = trigger === 'manual_input'
      ? sendFromHook(trimmed, requestContext, { clientRequestId })
      : handleQuickQuestion(trimmed, requestContext, { clientRequestId })

    if (!sent) {
      return false
    }

    void trackAppEvent('app_chat_message_send', {
      page: 'ChatScreen',
      properties: {
        source,
        trigger,
        clientRequestId,
        stage: stage.lifecycleKey,
        questionLength: trimmed.length,
        contextEntrySource: isChatEntryContextRecord(requestContext)
          ? requestContext.entrySource
          : undefined,
        entrySource: trackingEntryMeta.entrySource,
        articleSlug: trackingEntryMeta.articleSlug,
        reportId: trackingEntryMeta.reportId,
      },
    })

    setPendingResponseMeta({
      source,
      trigger,
      clientRequestId,
      questionLength: trimmed.length,
      entrySource: trackingEntryMeta.entrySource,
      articleSlug: trackingEntryMeta.articleSlug,
      reportId: trackingEntryMeta.reportId,
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

  const handleVoicePress = useCallback(async () => {
    if (voiceInputLoading || loading) {
      return
    }

    setVoiceInputLoading(true)
    try {
      const transcript = await transcribeVoiceQuestion({ locale: 'zh-CN', timeoutMs: 18000 })
      setInputText((current) => {
        const prefix = current.trim()
        return prefix ? `${prefix} ${transcript}` : transcript
      })
      setSnackText('已识别语音，可编辑后发送')
      setSnackVisible(true)
      void trackAppEvent('app_chat_voice_input_result', {
        page: 'ChatScreen',
        properties: {
          stage: stage.lifecycleKey,
          questionLength: transcript.length,
        },
      })
    } catch (err) {
      setSnackText(getVoiceInputErrorMessage(err))
      setSnackVisible(true)
      void trackAppEvent('app_chat_voice_input_error', {
        page: 'ChatScreen',
        properties: {
          stage: stage.lifecycleKey,
          code: typeof err === 'object' && err && 'code' in err ? String(err.code) : 'unknown',
        },
      })
    } finally {
      setVoiceInputLoading(false)
    }
  }, [loading, stage.lifecycleKey, voiceInputLoading])

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
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerEyebrow}>贝护妈妈助手</Text>
              <Text style={styles.headerTitle}>把问题拆清楚，再给可执行下一步</Text>
            </View>
          </View>

          <View style={styles.headerMetaRow}>
            <View style={styles.stagePill}>
              <Text style={styles.stagePillText}>{stage.lifecycleLabel}</Text>
            </View>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, status === 'active' ? styles.statusDotActive : styles.statusDotFree]} />
              <Text style={styles.statusPillText}>{status === 'active' ? '会员模式' : '基础模式'}</Text>
            </View>
          </View>

          <View style={styles.quotaRow}>
            <View>
              <Text style={styles.quotaLabel}>今日问答</Text>
              <Text style={styles.quotaValue}>{status === 'active' ? '不限次连续追问' : `剩余 ${remainingCount} 次回答`}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={clearMessages}
              style={styles.newChatButton}
            >
              <Text style={styles.newChatButtonText}>清空对话</Text>
            </Pressable>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {entrySource ? (
          <View style={styles.sourceNotice}>
            <View style={styles.sourceNoticeAccent} />
            <View style={styles.sourceNoticeBody}>
              <Text style={styles.sourceTitle}>{CHAT_SOURCE_LABEL[entrySource].title}</Text>
              <Text style={styles.sourceSubtitle}>{CHAT_SOURCE_LABEL[entrySource].subtitle}</Text>
            </View>
          </View>
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
          voiceInputEnabled={config.enableVoiceInput}
          voiceInputLoading={voiceInputLoading}
          onVoicePress={handleVoicePress}
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
  headerCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 253, 250, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(196, 216, 221, 0.64)',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  headerEyebrow: {
    color: colors.techDark,
    fontSize: 12,
    fontWeight: '700',
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 27,
  },
  headerMetaRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stagePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.techLight,
  },
  stagePillText: {
    color: colors.techDark,
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: borderRadius.pill,
  },
  statusDotActive: {
    backgroundColor: colors.green,
  },
  statusDotFree: {
    backgroundColor: colors.orange,
  },
  statusPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  quotaRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  quotaLabel: {
    color: colors.textLight,
    fontSize: 11,
    fontWeight: '700',
  },
  quotaValue: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  newChatButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  newChatButtonText: {
    color: colors.techDark,
    fontSize: 12,
    fontWeight: '700',
  },
  sourceNotice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sourceNoticeAccent: {
    width: 3,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.tech,
  },
  sourceNoticeBody: {
    flex: 1,
  },
  sourceTitle: {
    color: colors.ink,
    fontWeight: '700',
  },
  sourceSubtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    lineHeight: 19,
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl * 4 + spacing.lg,
  },
  messageListEmpty: {
    flexGrow: 1,
  },
  messageListView: {
    flex: 1,
  },
})
