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
import { MessageBubble, EmptyState, ChatInput, TypingIndicator, ChatSkeleton } from '../components/chat'
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
      </View>
    ),
    [clearMessages, error, remainingCount, status],
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
