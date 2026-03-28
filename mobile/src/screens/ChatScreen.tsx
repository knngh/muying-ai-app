import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  View,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Text, TextInput, IconButton, Chip, Banner } from 'react-native-paper'
import { useNavigation } from '@react-navigation/native'
import { useChatStore } from '../stores/chatStore'
import { getDisclaimer } from '../api/ai'
import type { AIMessage } from '../api/ai'
import { colors, spacing, fontSize } from '../theme'

const quickQuestions = [
  '孕早期有哪些注意事项？',
  '宝宝发烧怎么办？',
  '孕期营养应该怎么补充？',
  '新生儿护理要点有哪些？',
]

export default function ChatScreen() {
  const navigation = useNavigation()
  const flatListRef = useRef<FlatList>(null)
  const [inputText, setInputText] = useState('')
  const [showBanner, setShowBanner] = useState(true)

  const { messages, loading, streamingContent, error, initialize, sendMessage, clearMessages } = useChatStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'AI智能问答',
      headerRight: () => (
        <IconButton
          icon="delete-outline"
          iconColor={colors.textSecondary}
          size={22}
          onPress={clearMessages}
        />
      ),
    })
  }, [navigation, clearMessages])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages, streamingContent])

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim()
    if (!trimmed || loading) return
    setInputText('')
    sendMessage(trimmed)
  }, [inputText, loading, sendMessage])

  const handleQuickQuestion = useCallback((question: string) => {
    sendMessage(question)
  }, [sendMessage])

  const renderMessage = ({ item }: { item: AIMessage }) => {
    const isUser = item.role === 'user'
    const isEmergency = item.isEmergency

    return (
      <View
        style={[
          styles.messageBubbleWrapper,
          isUser ? styles.userWrapper : styles.assistantWrapper,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
            isEmergency && styles.emergencyBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userText : styles.assistantText,
              isEmergency && styles.emergencyText,
            ]}
            selectable
          >
            {item.content}
          </Text>

          {!isUser && item.sources?.length ? (
            <View style={styles.sourcesWrap}>
              <Text style={styles.sourcesTitle}>参考来源</Text>
              {item.sources.map((source) => (
                <View key={`${item.id}-${source.title}`} style={styles.sourceCard}>
                  <Text style={styles.sourceName}>{source.title}</Text>
                  <Text style={styles.sourceMeta}>
                    {source.source} · 相关度 {Math.round(source.relevance * 100)}%
                  </Text>
                  {source.excerpt ? (
                    <Text style={styles.sourceExcerpt}>{source.excerpt}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    )
  }

  const renderStreamingMessage = () => {
    if (!loading || !streamingContent) return null
    return (
      <View style={[styles.messageBubbleWrapper, styles.assistantWrapper]}>
        <View style={[styles.messageBubble, styles.assistantBubble]}>
          <Text style={[styles.messageText, styles.assistantText]}>
            {streamingContent}
          </Text>
        </View>
      </View>
    )
  }

  const renderLoadingIndicator = () => {
    if (!loading || streamingContent) return null
    return (
      <View style={[styles.messageBubbleWrapper, styles.assistantWrapper]}>
        <View style={[styles.messageBubble, styles.assistantBubble]}>
          <Text style={styles.thinkingText}>正在思考中...</Text>
        </View>
      </View>
    )
  }

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>有什么可以帮助您的？</Text>
      <Text style={styles.emptySubtitle}>
        您可以问我关于孕期、育儿、营养等方面的问题
      </Text>
      <View style={styles.quickQuestionsContainer}>
        {quickQuestions.map((question) => (
          <Chip
            key={question}
            style={styles.quickChip}
            textStyle={styles.quickChipText}
            onPress={() => handleQuickQuestion(question)}
            mode="outlined"
          >
            {question}
          </Chip>
        ))}
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {showBanner && (
          <Banner
            visible={showBanner}
            actions={[{ label: '知道了', onPress: () => setShowBanner(false) }]}
            style={styles.banner}
          >
            {getDisclaimer()}
          </Banner>
        )}

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messagesList,
            messages.length === 0 && styles.messagesListEmpty,
          ]}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={
            <>
              {renderStreamingMessage()}
              {renderLoadingIndicator()}
            </>
          }
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false })
            }
          }}
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="输入您的问题..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            mode="outlined"
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            dense
          />
          <IconButton
            icon="send"
            iconColor={colors.white}
            size={22}
            style={[
              styles.sendButton,
              (!inputText.trim() || loading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || loading}
          />
        </View>
      </KeyboardAvoidingView>
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
  banner: {
    backgroundColor: colors.orangeLight,
  },
  errorBar: {
    backgroundColor: colors.redLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    color: colors.red,
    fontSize: fontSize.sm,
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  messagesListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  messageBubbleWrapper: {
    marginVertical: spacing.xs,
    maxWidth: '80%',
  },
  userWrapper: {
    alignSelf: 'flex-end',
  },
  assistantWrapper: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
  },
  emergencyBubble: {
    borderWidth: 2,
    borderColor: colors.red,
    backgroundColor: colors.redLight,
  },
  messageText: {
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  userText: {
    color: colors.white,
  },
  assistantText: {
    color: colors.text,
  },
  emergencyText: {
    color: colors.red,
  },
  thinkingText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontStyle: 'italic',
  },
  sourcesWrap: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E7EBF3',
  },
  sourcesTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  sourceCard: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: '#F5F7FD',
  },
  sourceName: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  sourceMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  sourceExcerpt: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  quickQuestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  quickChip: {
    backgroundColor: colors.white,
    borderColor: colors.primary,
    marginBottom: spacing.xs,
  },
  quickChipText: {
    color: colors.primary,
    fontSize: fontSize.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.white,
    fontSize: fontSize.md,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    marginLeft: spacing.xs,
    marginBottom: 4,
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
})
