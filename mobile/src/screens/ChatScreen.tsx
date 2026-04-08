import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native'
import { Banner, IconButton, Snackbar, Text } from 'react-native-paper'
import { useNavigation } from '@react-navigation/native'
import { getDisclaimer } from '../api/ai'
import type { AIMessage } from '../api/ai'
import UpgradeModal from '../components/UpgradeModal'
import { QuotaCard, MessageBubble, EmptyState, ChatInput, TypingIndicator, ChatSkeleton } from '../components/chat'
import { useChatLogic } from '../hooks/useChatLogic'
import { colors, spacing, borderRadius } from '../theme'

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
  const [snackVisible, setSnackVisible] = useState(false)

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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.topArea}>
          <QuotaCard
            status={status}
            planName={activePlan?.name}
            remainingCount={remainingCount}
            onUpgrade={() => setUpgradeVisible(true)}
          />

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

        {loadingHistory ? (
          <ChatSkeleton />
        ) : (
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
            <EmptyState
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
})
