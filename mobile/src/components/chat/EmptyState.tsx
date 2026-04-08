import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Chip, Text } from 'react-native-paper'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface EmptyStateProps {
  quickQuestions: string[]
  onQuickQuestion: (question: string) => void
}

export default function EmptyState({ quickQuestions, onQuickQuestion }: EmptyStateProps) {
  return (
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
            onPress={() => onQuickQuestion(question)}
          >
            {question}
          </Chip>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  emptyState: {
    paddingTop: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.heroTitle,
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
})
