import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native'
import { Banner, Button, Card, Chip, IconButton, Text, TextInput } from 'react-native-paper'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { getDisclaimer } from '../api/ai'
import type { AIMessage } from '../api/ai'
import UpgradeModal from '../components/UpgradeModal'
import { useChatStore } from '../stores/chatStore'
import { useMembershipStore } from '../stores/membershipStore'
import type { MembershipPlan } from '../stores/membershipStore'
import { colors, fontSize, spacing, borderRadius } from '../theme'

const quickQuestions = [
  '我这周最该注意的三件事是什么？',
  '孕期营养补充怎么安排更稳妥？',
  '宝宝反复夜醒一般先排查什么？',
  '能帮我拆解一次产检前准备吗？',
]

export default function ChatScreen() {
  const navigation = useNavigation<any>()
  const flatListRef = useRef<FlatList>(null)
  const [inputText, setInputText] = useState('')
  const [showBanner, setShowBanner] = useState(true)
  const [upgradeVisible, setUpgradeVisible] = useState(false)

  const { messages, loading, streamingContent, error, initialize, sendMessage, clearMessages } = useChatStore()
  const {
    status,
    currentPlanCode,
    aiUsedToday,
    aiLimit,
    plans,
    ensureFreshQuota,
    consumeAiQuota,
    purchasePlan,
    loading: membershipLoading,
  } = useMembershipStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useFocusEffect(
    useCallback(() => {
      ensureFreshQuota()
    }, [ensureFreshQuota]),
  )

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: '问题助手',
      headerRight: () => (
        <IconButton
          icon="delete-outline"
          iconColor={colors.textSecondary}
          size={22}
          onPress={clearMessages}
        />
      ),
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
    if (error?.includes('额度已用完')) {
      setUpgradeVisible(true)
      ensureFreshQuota()
    }
  }, [ensureFreshQuota, error])

  const activePlan = useMemo(
    () => plans.find((item: MembershipPlan) => item.code === currentPlanCode),
    [currentPlanCode, plans],
  )

  const remainingCount = status === 'active' ? '无限次' : `${Math.max(aiLimit - aiUsedToday, 0)} 次`

  const checkQuota = useCallback(() => {
    const result = consumeAiQuota()
    if (!result.allowed) {
      setUpgradeVisible(true)
      return false
    }
    return true
  }, [consumeAiQuota])

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim()
    if (!trimmed || loading) return
    if (!checkQuota()) return

    setInputText('')
    sendMessage(trimmed)
  }, [checkQuota, inputText, loading, sendMessage])

  const handleQuickQuestion = useCallback((question: string) => {
    if (loading) return
    if (!checkQuota()) return
    sendMessage(question)
  }, [checkQuota, loading, sendMessage])

  const handleUpgrade = async (code: 'monthly' | 'quarterly' | 'yearly') => {
    try {
      await purchasePlan(code)
      setUpgradeVisible(false)
    } catch (_error) {
      setUpgradeVisible(true)
    }
  }

  const renderMessage = ({ item }: { item: AIMessage }) => {
    const isUser = item.role === 'user'
    const reliabilityLabel = item.sourceReliability === 'authoritative'
      ? '权威来源优先'
      : item.sourceReliability === 'mixed'
        ? '权威 + 知识库'
        : item.sourceReliability === 'dataset_only'
          ? '知识库兜底'
          : undefined
    const routeLabel = item.route === 'trusted_rag'
      ? '可信检索'
      : item.route === 'safety_fallback'
        ? '保守兜底'
        : item.route === 'emergency'
          ? '紧急规则'
          : undefined

    return (
      <View style={[styles.messageWrap, isUser ? styles.userWrap : styles.assistantWrap]}>
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
            {item.content}
          </Text>

          {!isUser ? (
            <View style={styles.trustPanel}>
              <View style={styles.trustChipRow}>
                {reliabilityLabel ? (
                  <Chip compact style={styles.trustChip} textStyle={styles.trustChipText}>{reliabilityLabel}</Chip>
                ) : null}
                {item.riskLevel ? (
                  <Chip compact style={styles.trustChip} textStyle={styles.trustChipText}>
                    {item.riskLevel === 'red' ? '红色风险' : item.riskLevel === 'yellow' ? '黄色风险' : '绿色风险'}
                  </Chip>
                ) : null}
                {routeLabel ? (
                  <Chip compact style={styles.trustChip} textStyle={styles.trustChipText}>{routeLabel}</Chip>
                ) : null}
              </View>

              {item.structuredAnswer?.conclusion ? (
                <View style={styles.trustSummaryCard}>
                  <Text style={styles.trustSummaryTitle}>本轮可信判断</Text>
                  <Text style={styles.trustSummaryText}>{item.structuredAnswer.conclusion}</Text>
                  {item.structuredAnswer.actions?.slice(0, 3).map((action) => (
                    <Text key={action} style={styles.trustBullet}>• {action}</Text>
                  ))}
                </View>
              ) : null}

              {item.uncertainty?.message ? (
                <View style={styles.uncertaintyCard}>
                  <Text style={styles.uncertaintyTitle}>不确定性说明</Text>
                  <Text style={styles.uncertaintyText}>{item.uncertainty.message}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {!isUser && item.sources?.length ? (
            <View style={styles.sourcesWrap}>
              <Text style={styles.sourcesTitle}>参考来源</Text>
              {item.sources.map((source: NonNullable<AIMessage['sources']>[number]) => (
                <View key={`${item.id}-${source.title}`} style={styles.sourceCard}>
                  <Text style={styles.sourceName}>{source.title}</Text>
                  <Text style={styles.sourceMeta}>
                    {source.source} · 相关度 {Math.round(source.relevance * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    )
  }

  const renderFooter = () => {
    if (!loading && !streamingContent) return null

    return (
      <View style={[styles.messageWrap, styles.assistantWrap]}>
        <View style={[styles.messageBubble, styles.assistantBubble]}>
          <Text style={styles.messageText}>
            {streamingContent || '正在思考中...'}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.topArea}>
          <Card style={styles.quotaCard}>
            <Card.Content>
              <View style={styles.quotaHeader}>
                <View>
                  <Text style={styles.quotaTitle}>
                    {status === 'active' ? activePlan?.name || '贝护会员' : '今日可用次数'}
                  </Text>
                  <Text style={styles.quotaSubtitle}>
                    {status === 'active'
                      ? '已解锁多轮连续对话和周度报告。'
                      : '免费用户每天可使用 3 次，升级后不限次数。'}
                  </Text>
                </View>
                <Chip style={styles.quotaChip} textStyle={styles.quotaChipText}>
                  剩余 {remainingCount}
                </Chip>
              </View>

              {status !== 'active' ? (
                <Button mode="contained" buttonColor={colors.ink} onPress={() => setUpgradeVisible(true)}>
                  解锁不限次使用
                </Button>
              ) : null}
            </Card.Content>
          </Card>

          {showBanner ? (
            <Banner
              visible={showBanner}
              actions={[{ label: '知道了', onPress: () => setShowBanner(false) }]}
              style={styles.banner}
            >
              {getDisclaimer()}
            </Banner>
          ) : null}

          {error ? (
            <View style={styles.errorBar}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.messageListEmpty,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>今天想先解决什么问题？</Text>
              <Text style={styles.emptySubtitle}>
                先问一个最具体的问题，更容易给到可执行建议。
              </Text>

              <View style={styles.quickWrap}>
                {quickQuestions.map((question) => (
                  <Chip
                    key={question}
                    mode="outlined"
                    style={styles.quickChip}
                    textStyle={styles.quickChipText}
                    onPress={() => handleQuickQuestion(question)}
                  >
                    {question}
                  </Chip>
                ))}
              </View>
            </View>
          }
          ListFooterComponent={renderFooter}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false })
            }
          }}
        />

        <View style={styles.inputWrap}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="输入你的问题，例如：本周产检前我该准备什么？"
            placeholderTextColor={colors.textSecondary}
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <IconButton
            icon="send"
            size={20}
            iconColor={colors.white}
            style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || loading}
          />
        </View>
      </KeyboardAvoidingView>

      <UpgradeModal
        visible={upgradeVisible}
        plans={plans}
        loading={membershipLoading}
        onDismiss={() => setUpgradeVisible(false)}
        onUpgrade={handleUpgrade}
        onViewMembership={() => navigation.navigate('Membership')}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  topArea: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  quotaCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.white,
  },
  quotaHeader: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  quotaTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  quotaSubtitle: {
    marginTop: spacing.xs,
    maxWidth: 220,
    color: colors.textLight,
    lineHeight: 20,
  },
  quotaChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldLight,
    borderRadius: borderRadius.pill,
  },
  quotaChipText: {
    color: colors.gold,
    fontWeight: '700',
  },
  banner: {
    marginTop: spacing.sm,
    backgroundColor: colors.orangeLight,
    borderRadius: borderRadius.lg,
  },
  errorBar: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.redLight,
  },
  errorText: {
    color: colors.red,
  },
  messageList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  messageListEmpty: {
    flexGrow: 1,
  },
  emptyState: {
    paddingTop: spacing.xl,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtitle: {
    marginTop: spacing.sm,
    color: colors.textLight,
    lineHeight: 22,
  },
  quickWrap: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickChip: {
    backgroundColor: colors.primaryLight,
    borderWidth: 0,
    borderRadius: borderRadius.pill,
  },
  quickChipText: {
    color: colors.text,
  },
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
  },
  userBubble: {
    backgroundColor: colors.primaryLight,
    borderBottomRightRadius: 8,
  },
  assistantBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 8,
  },
  messageText: {
    lineHeight: 22,
    color: colors.ink,
  },
  userText: {
    color: colors.white,
  },
  assistantText: {
    color: colors.text,
  },
  trustPanel: {
    marginTop: spacing.sm,
  },
  trustChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  trustChip: {
    backgroundColor: '#f3efe9',
    borderRadius: borderRadius.pill,
  },
  trustChipText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  trustSummaryCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: '#fffaf4',
  },
  trustSummaryTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text,
  },
  trustSummaryText: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.text,
  },
  trustBullet: {
    marginTop: 4,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  uncertaintyCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: '#fff7e8',
  },
  uncertaintyTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#ad6800',
  },
  uncertaintyText: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: '#8c6a00',
  },
  sourcesWrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sourcesTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  sourceCard: {
    padding: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  sourceName: {
    fontWeight: '700',
    color: colors.text,
  },
  sourceMeta: {
    marginTop: spacing.xs,
    color: colors.textLight,
    fontSize: fontSize.sm,
  },
  inputWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.white,
  },
  sendButton: {
    margin: 0,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: colors.textSecondary,
  },
})
