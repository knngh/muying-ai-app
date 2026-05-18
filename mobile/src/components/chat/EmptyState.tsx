import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { colors, spacing, borderRadius } from '../../theme'

interface EmptyStateProps {
  title?: string
  subtitle?: string
  quickQuestions: string[]
  onQuickQuestion: (question: string) => void
}

export default function EmptyState({
  title = '可以先从这些问题开始',
  subtitle = '先问一个最具体的问题，更容易得到清晰的参考与下一步建议。',
  quickQuestions,
  onQuickQuestion,
}: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.introCard}>
        <Text style={styles.emptyEyebrow}>建议问题</Text>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySubtitle}>{subtitle}</Text>
      </View>

      <View style={styles.quickList}>
        {quickQuestions.map((question, index) => (
          <Pressable
            key={question}
            style={styles.quickItem}
            onPress={() => onQuickQuestion(question)}
          >
            <View style={styles.quickIndexPill}>
              <Text style={styles.quickIndex}>{index + 1}</Text>
            </View>
            <View style={styles.quickTextWrap}>
              <Text style={styles.quickQuestion}>{question}</Text>
              <Text style={styles.quickHint}>点击后直接提问</Text>
            </View>
            <Text style={styles.quickArrow}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  emptyState: {
    paddingTop: spacing.md,
  },
  introCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyEyebrow: {
    color: colors.techDark,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyTitle: {
    marginTop: spacing.xs,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 25,
  },
  emptySubtitle: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  quickList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  quickItem: {
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 253, 250, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(206, 221, 225, 0.86)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quickIndexPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.techLight,
  },
  quickIndex: {
    color: colors.techDark,
    fontSize: 12,
    fontWeight: '700',
  },
  quickTextWrap: {
    flex: 1,
    gap: 3,
  },
  quickQuestion: {
    color: colors.ink,
    fontWeight: '700',
    lineHeight: 21,
  },
  quickHint: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  quickArrow: {
    color: colors.textLight,
    fontSize: 22,
    fontWeight: '600',
  },
})
