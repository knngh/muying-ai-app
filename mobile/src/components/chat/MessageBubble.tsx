import React, { useCallback } from 'react'
import { Clipboard, StyleSheet, View } from 'react-native'
import { IconButton, Text } from 'react-native-paper'
import type { AIMessage } from '../../api/ai'
import { colors, fontSize, spacing, borderRadius } from '../../theme'
import MarkdownText from './MarkdownText'
import TrustPanel from './TrustPanel'
import SourcesList from './SourcesList'

const ASSISTANT_REFERENCE_NOTICE = '以上内容仅供一般信息参考，请结合实际情况判断。'

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
