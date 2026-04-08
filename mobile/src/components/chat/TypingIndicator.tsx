import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import MarkdownText from './MarkdownText'
import { colors, spacing, borderRadius } from '../../theme'

interface TypingIndicatorProps {
  streamingContent: string
}

function Dot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [delay, opacity])

  return <Animated.View style={[styles.dot, { opacity }]} />
}

export default function TypingIndicator({ streamingContent }: TypingIndicatorProps) {
  if (streamingContent) {
    return (
      <View style={[styles.messageWrap, styles.assistantWrap]}>
        <View style={[styles.messageBubble, styles.assistantBubble]}>
          <MarkdownText>{streamingContent}</MarkdownText>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.messageWrap, styles.assistantWrap]}>
      <View style={[styles.messageBubble, styles.assistantBubble]}>
        <View style={styles.dotRow}>
          <Dot delay={0} />
          <Dot delay={150} />
          <Dot delay={300} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  messageWrap: {
    marginBottom: spacing.md,
    flexDirection: 'row',
  },
  assistantWrap: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '84%',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
  },
  assistantBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: borderRadius.sm,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 22,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
  },
})
