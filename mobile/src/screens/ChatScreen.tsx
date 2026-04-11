import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native'
import { Chip, IconButton, Snackbar, Text } from 'react-native-paper'
import { useNavigation } from '@react-navigation/native'
import LinearGradient from 'react-native-linear-gradient'
import { getDisclaimer } from '../api/ai'
import type { AIMessage } from '../api/ai'
import UpgradeModal from '../components/UpgradeModal'
import { QuotaCard, MessageBubble, EmptyState, ChatInput, TypingIndicator, ChatSkeleton } from '../components/chat'
import { ScreenContainer, StandardCard } from '../components/layout'
import { useChatLogic } from '../hooks/useChatLogic'
import { useAppStore } from '../stores/appStore'
import { getStageSummary, type LifecycleStageKey } from '../utils/stage'
import { colors, spacing, borderRadius } from '../theme'

const QUICK_QUESTION_MAP: Record<LifecycleStageKey, string[]> = {
  preparing: [
    '备孕阶段这周最该先做的三件事是什么？',
    '孕前检查一般先安排哪些项目？',
    '叶酸、作息和饮食怎么调整更稳妥？',
    '能帮我列一个 7 天备孕准备清单吗？',
  ],
  pregnant_early: [
    '孕早期这周最该注意的三件事是什么？',
    '建档前我需要先准备什么？',
    '早孕反应和饮食怎么安排更稳妥？',
    '能帮我拆解一次产检前准备吗？',
  ],
  pregnant_mid: [
    '孕中期这周最该注意的三件事是什么？',
    '胎动、糖耐和睡眠要先抓哪一项？',
    '孕中期营养补充怎么安排更稳妥？',
    '可以帮我排一个产检和日常节奏吗？',
  ],
  pregnant_late: [
    '孕晚期这周最该注意的三件事是什么？',
    '待产包和住院前准备怎么拆解？',
    '宫缩、见红、破水分别怎么判断？',
    '可以帮我列一个分娩前家庭协作清单吗？',
  ],
  postpartum_newborn: [
    '月子和新生儿阶段今天先盯哪三件事？',
    '黄疸、吃奶和排便怎么一起观察？',
    '妈妈恢复和宝宝照护怎么同步安排？',
    '能帮我梳理一个新生儿观察清单吗？',
  ],
  postpartum_recovery: [
    '产后恢复期这周最该注意的三件事是什么？',
    '恶露、伤口、喂养和睡眠要怎么排序？',
    '产后复查前要先准备什么？',
    '可以帮我排一个恢复期家庭节奏吗？',
  ],
  infant_0_6: [
    '0-6月宝宝这周最该关注什么？',
    '反复夜醒一般先排查什么？',
    '喂养、湿疹和疫苗怎么一起安排？',
    '能帮我列一个本周喂养观察清单吗？',
  ],
  infant_6_12: [
    '6-12月宝宝这周最该关注什么？',
    '辅食添加顺序怎么安排更稳妥？',
    '睡眠倒退一般先排查什么？',
    '可以帮我列一个辅食和作息计划吗？',
  ],
  toddler_1_3: [
    '1-3岁孩子这周最该关注什么？',
    '如厕训练卡住了先排查什么？',
    '挑食、睡眠和情绪问题怎么一起看？',
    '能帮我做一个语言发展观察清单吗？',
  ],
  child_3_plus: [
    '3岁以上孩子这周最该关注什么？',
    '入园适应一般先看哪些信号？',
    '语言、情绪和睡眠边界怎么一起梳理？',
    '能帮我列一个行为观察清单吗？',
  ],
}

export default function ChatScreen() {
  const navigation = useNavigation<any>()
  const user = useAppStore((state) => state.user)
  const flatListRef = useRef<FlatList>(null)
  const [inputText, setInputText] = useState('')
  const [snackVisible, setSnackVisible] = useState(false)
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
    activePlan,
    remainingCount,
    upgradeVisible,
    setUpgradeVisible,
    handleSend: sendFromHook,
    handleQuickQuestion,
    handleUpgrade,
    clearMessages,
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

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim()
    if (!trimmed) return
    setInputText('')
    sendFromHook(trimmed)
  }, [inputText, sendFromHook])

  const handleCopied = useCallback(() => {
    setSnackVisible(true)
  }, [])

  const renderMessage = useCallback(
    ({ item }: { item: AIMessage }) => (
      <MessageBubble item={item} onCopied={handleCopied} />
    ),
    [handleCopied],
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
            colors={['rgba(248, 227, 214, 0.6)', 'rgba(238, 203, 183, 0.4)', 'rgba(248, 241, 233, 0.6)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroRing} />
            <View style={styles.headerRow}>
              <View style={styles.headerBlock}>
                <View style={styles.headerChipRow}>
                  <Chip compact style={styles.heroChip} textStyle={styles.heroChipText}>
                    {stage.lifecycleLabel}
                  </Chip>
                  <Chip compact style={styles.heroAssistChip} textStyle={styles.heroAssistChipText}>
                    一般知识参考
                  </Chip>
                </View>
                <Text style={styles.headerEyebrow}>问题助手</Text>
                <Text style={styles.headerTitle}>先把最具体的问题问清</Text>
                <Text style={styles.headerSubtitle}>
                  先锁定一个问题，再追问执行顺序和观察信号。
                </Text>
              </View>

              <IconButton
                icon="delete-outline"
                iconColor={colors.primaryDark}
                containerColor="rgba(255, 250, 245, 0.92)"
                size={18}
                style={styles.clearButton}
                onPress={clearMessages}
              />
            </View>

            <View style={styles.signalRow}>
              <Chip compact style={styles.signalChip} textStyle={styles.signalChipText}>
                当前阶段 · {stage.lifecycleLabel}
              </Chip>
              <Chip compact style={styles.signalChip} textStyle={styles.signalChipText}>
                支持连续追问
              </Chip>
            </View>
          </LinearGradient>
        </StandardCard>

        <QuotaCard
          status={status}
          planName={activePlan?.name}
          remainingCount={remainingCount}
          subtitle={
            status === 'active'
              ? `${stage.lifecycleLabel}可继续沉淀长期记录与周报。`
              : `${stage.lifecycleLabel}建议优先把最关键的问题问清，升级后可不限次连续追问。`
          }
          onUpgrade={() => setUpgradeVisible(true)}
        />

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
    ),
    [activePlan?.name, clearMessages, error, remainingCount, setUpgradeVisible, stage.lifecycleLabel, status],
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
                onQuickQuestion={handleQuickQuestion}
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
        已复制到剪贴板
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
  heroCard: {
    backgroundColor: 'transparent',
  },
  heroGradient: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    padding: spacing.md,
  },
  heroGlow: {
    position: 'absolute',
    top: -28,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,248,242,0.48)',
  },
  heroRing: {
    position: 'absolute',
    top: 18,
    right: 22,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
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
  headerChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  heroChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
  },
  heroChipText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  heroAssistChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
  },
  heroAssistChipText: {
    color: colors.techDark,
    fontSize: 11,
    fontWeight: '700',
  },
  headerEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  headerTitle: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 27,
  },
  headerSubtitle: {
    marginTop: 6,
    color: colors.inkSoft,
    lineHeight: 19,
  },
  clearButton: {
    margin: 0,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  signalChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
  },
  signalChipText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '600',
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
    paddingBottom: spacing.md,
  },
  messageListEmpty: {
    flexGrow: 1,
  },
  messageListView: {
    flex: 1,
  },
})
