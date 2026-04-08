import React, { useCallback } from 'react'
import { Clipboard, StyleSheet, View } from 'react-native'
import { IconButton, Text } from 'react-native-paper'
import type { AIMessage } from '../../api/ai'
import { colors, fontSize, spacing, borderRadius } from '../../theme'
import MarkdownText from './MarkdownText'
import TrustPanel from './TrustPanel'
import SourcesList from './SourcesList'

interface MessageBubbleProps {
  item: AIMessage
  onCopied?: () => void
}

function MessageBubbleInner({ item, onCopied }: MessageBubbleProps) {
  const isUser = item.role === 'user'

  const handleLongPress = useCallback(() => {
    Clipboard.setString(item.content)
    onCopied?.()
  }, [item.content, onCopied])

  const handleCopy = useCallback(() => {
    Clipboard.setString(item.content)
    onCopied?.()
  }, [item.content, onCopied])

  return (
    <View
      style={[styles.messageWrap, isUser ? styles.userWrap : styles.assistantWrap]}
    >
      <View
        style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}
        onStartShouldSetResponder={() => true}
        onResponderRelease={() => {}}
      >
        {isUser ? (
          <Text
            style={[styles.messageText, styles.userText]}
            onLongPress={handleLongPress}
          >
            {item.content}
          </Text>
        ) : (
          <View>
            <MarkdownText>{item.content}</MarkdownText>
          </View>
        )}

        {!isUser ? <TrustPanel message={item} /> : null}
        {!isUser && item.sources?.length ? (
          <SourcesList messageId={item.id} sources={item.sources} />
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
  return prev.item.id === next.item.id && prev.item.content === next.item.content
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
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.sm,
  },
  assistantBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: borderRadius.sm,
  },
  messageText: {
    lineHeight: 22,
    color: colors.ink,
  },
  userText: {
    color: colors.white,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    marginLeft: -spacing.sm,
  },
  actionButton: {
    margin: 0,
    width: 28,
    height: 28,
  },
})
