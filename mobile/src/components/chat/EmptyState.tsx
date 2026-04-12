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
        colors={['#24434F', '#3E6772', '#E8D6C8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroGlow} />
        <View style={styles.heroRing} />
        <View style={styles.heroGrid} />
        <View style={styles.heroBeam} />
        <View style={styles.heroRail} />
        <Text style={styles.emptyEyebrow}>试试这些问题</Text>
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
              colors={['rgba(248,252,253,0.96)', 'rgba(232,241,243,0.96)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickCardGradient}
            >
              <View style={styles.quickCardBeam} />
              <View style={styles.quickCardTopRow}>
                <View style={styles.quickIndexPill}>
                  <Text style={styles.quickIndex}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <Text style={styles.quickArrow}>↗</Text>
              </View>
              <Text style={styles.quickQuestion}>{question}</Text>
              <View style={styles.quickHintRow}>
                <View style={styles.quickHintLine} />
                <Text style={styles.quickHint}>点击即可提问</Text>
              </View>
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
    padding: spacing.md + 1,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(220, 239, 243, 0.26)',
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -36,
    right: -20,
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroRing: {
    position: 'absolute',
    top: 16,
    right: 18,
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(223, 244, 248, 0.2)',
  },
  heroGrid: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: 'rgba(232, 246, 248, 0.12)',
    opacity: 0.42,
  },
  heroBeam: {
    position: 'absolute',
    left: -24,
    top: 56,
    width: 174,
    height: 64,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255, 216, 183, 0.16)',
    transform: [{ rotate: '-10deg' }],
  },
  heroRail: {
    width: 72,
    height: 3,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255, 230, 204, 0.54)',
    marginBottom: spacing.sm,
  },
  emptyEyebrow: {
    color: '#F2FBFC',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  emptyTitle: {
    marginTop: spacing.xs,
    fontSize: 21,
    fontWeight: '700',
    color: colors.white,
    lineHeight: 28,
    letterSpacing: 0.15,
  },
  emptySubtitle: {
    marginTop: spacing.sm,
    color: 'rgba(246, 252, 253, 0.84)',
    lineHeight: 19,
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
    minHeight: 138,
    padding: spacing.md - 1,
    borderRadius: borderRadius.lg,
    borderColor: 'rgba(170, 203, 210, 0.22)',
    borderWidth: 1,
    shadowColor: colors.inkSoft,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    overflow: 'hidden',
  },
  quickCardBeam: {
    position: 'absolute',
    top: -18,
    right: -12,
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(221, 239, 243, 0.42)',
  },
  quickCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickIndexPill: {
    minWidth: 34,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(210, 230, 235, 0.7)',
  },
  quickIndex: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  quickArrow: {
    color: colors.techDark,
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.42,
  },
  quickQuestion: {
    marginTop: spacing.sm,
    color: colors.techDark,
    fontWeight: '700',
    lineHeight: 21,
    minHeight: 64,
  },
  quickHintRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  quickHintLine: {
    width: 16,
    height: 2,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(197,108,71,0.3)',
  },
  quickHint: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
})
