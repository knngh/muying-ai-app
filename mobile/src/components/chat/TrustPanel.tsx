import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Chip, Text } from 'react-native-paper'
import type { AIMessage } from '../../api/ai'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface TrustPanelProps {
  message: AIMessage
}

function getReliabilityLabel(sourceReliability?: string): string | undefined {
  if (sourceReliability === 'authoritative') return '权威来源优先'
  if (sourceReliability === 'mixed') return '权威 + 知识库'
  if (sourceReliability === 'dataset_only') return '知识库兜底'
  return undefined
}

function getRouteLabel(route?: string): string | undefined {
  if (route === 'trusted_rag') return '可信检索'
  if (route === 'safety_fallback') return '保守兜底'
  if (route === 'emergency') return '紧急规则'
  return undefined
}

export default function TrustPanel({ message }: TrustPanelProps) {
  const reliabilityLabel = getReliabilityLabel(message.sourceReliability)
  const routeLabel = getRouteLabel(message.route)

  const hasChips = reliabilityLabel || message.riskLevel || routeLabel
  const hasConclusion = message.structuredAnswer?.conclusion
  const hasUncertainty = message.uncertainty?.message

  if (!hasChips && !hasConclusion && !hasUncertainty) return null

  return (
    <View style={styles.trustPanel}>
      {hasChips ? (
        <View style={styles.trustChipRow}>
          {reliabilityLabel ? (
            <Chip compact style={styles.trustChip} textStyle={styles.trustChipText}>{reliabilityLabel}</Chip>
          ) : null}
          {message.riskLevel ? (
            <Chip compact style={styles.trustChip} textStyle={styles.trustChipText}>
              {message.riskLevel === 'red' ? '红色风险' : message.riskLevel === 'yellow' ? '黄色风险' : '绿色风险'}
            </Chip>
          ) : null}
          {routeLabel ? (
            <Chip compact style={styles.trustChip} textStyle={styles.trustChipText}>{routeLabel}</Chip>
          ) : null}
        </View>
      ) : null}

      {hasConclusion ? (
        <View style={styles.trustSummaryCard}>
          <Text style={styles.trustSummaryTitle}>本轮可信判断</Text>
          <Text style={styles.trustSummaryText}>{message.structuredAnswer!.conclusion}</Text>
          {message.structuredAnswer!.actions?.slice(0, 3).map((action) => (
            <Text key={action} style={styles.trustBullet}>{'\u2022'} {action}</Text>
          ))}
        </View>
      ) : null}

      {hasUncertainty ? (
        <View style={styles.uncertaintyCard}>
          <Text style={styles.uncertaintyTitle}>不确定性说明</Text>
          <Text style={styles.uncertaintyText}>{message.uncertainty!.message}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  trustPanel: {
    marginTop: spacing.sm,
  },
  trustChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  trustChip: {
    backgroundColor: colors.trustChipBg,
    borderRadius: borderRadius.pill,
  },
  trustChipText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  trustSummaryCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.trustSummaryBg,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.1)',
  },
  trustSummaryTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text,
  },
  trustSummaryText: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.text,
  },
  trustBullet: {
    marginTop: 4,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  uncertaintyCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.uncertaintyBg,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.1)',
  },
  uncertaintyTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.uncertaintyTitle,
  },
  uncertaintyText: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.uncertaintyText,
  },
})
