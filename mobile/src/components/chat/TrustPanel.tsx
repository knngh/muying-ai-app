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
  const disclosure = message.aiDisclosure

  const hasChips = reliabilityLabel || message.riskLevel || routeLabel
  const hasConclusion = message.structuredAnswer?.conclusion
  const hasUncertainty = message.uncertainty?.message
  const hasDisclosure = Boolean(disclosure)

  if (!hasChips && !hasConclusion && !hasUncertainty && !hasDisclosure) return null

  return (
    <View style={styles.trustPanel}>
      {hasDisclosure ? (
        <View style={styles.disclosureCard}>
          <Text style={styles.disclosureTitle}>AI 服务公示</Text>
          <Text style={styles.disclosureText}>
            {disclosure!.serviceName} · {disclosure!.providerName} · {disclosure!.companyName}
          </Text>
          <Text style={styles.disclosureMeta}>
            模型：{disclosure!.modelName}
            {disclosure!.filingCode ? ` · 备案/上线编号：${disclosure!.filingCode}` : ''}
          </Text>
          <Text style={styles.disclosureHint}>{disclosure!.disclaimer}</Text>
        </View>
      ) : null}

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
  disclosureCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  disclosureTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text,
  },
  disclosureText: {
    marginTop: 4,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  disclosureMeta: {
    marginTop: 2,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textLight,
  },
  disclosureHint: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textLight,
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
