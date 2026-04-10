import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

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
      <LinearGradient
        colors={['rgba(255,252,248,0.98)', 'rgba(246,232,221,0.94)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroGlow} />
        <View style={styles.heroRing} />
        <View style={styles.heroRail} />
        <Text style={styles.emptyEyebrow}>推荐问题</Text>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySubtitle}>{subtitle}</Text>
      </LinearGradient>

      <View style={styles.quickGrid}>
        {quickQuestions.map((question, index) => (
          <Pressable
            key={question}
            style={styles.quickCard}
            onPress={() => onQuickQuestion(question)}
          >
            <LinearGradient
              colors={['rgba(255,249,243,0.98)', 'rgba(246,236,228,0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickCardGradient}
            >
              <Text style={styles.quickIndex}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={styles.quickQuestion}>{question}</Text>
              <Text style={styles.quickHint}>点击即可提问</Text>
            </LinearGradient>
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
  heroCard: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.14)',
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -24,
    right: -18,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,248,242,0.46)',
  },
  heroRing: {
    position: 'absolute',
    top: 18,
    right: 20,
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  heroRail: {
    width: 62,
    height: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(197,108,71,0.3)',
    marginBottom: spacing.sm,
  },
  emptyEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  emptyTitle: {
    marginTop: spacing.xs,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 30,
  },
  emptySubtitle: {
    marginTop: spacing.sm,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  quickGrid: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickCard: {
    width: '48.5%',
  },
  quickCardGradient: {
    minHeight: 146,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderColor: 'rgba(184,138,72,0.14)',
    borderWidth: 1,
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
  },
  quickIndex: {
    color: colors.textLight,
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  quickQuestion: {
    marginTop: spacing.sm,
    color: colors.primaryDark,
    fontWeight: '700',
    lineHeight: 22,
  },
  quickHint: {
    marginTop: 'auto',
    paddingTop: spacing.md,
    color: colors.techDark,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
})
