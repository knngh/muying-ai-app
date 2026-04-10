import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Card, Chip, Text } from 'react-native-paper'
import type { WeeklyReport } from '../../stores/membershipStore'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface WeeklyReportPreviewProps {
  report: WeeklyReport
  status: string
  onViewMore: () => void
}

export default function WeeklyReportPreview({ report, status, onViewMore }: WeeklyReportPreviewProps) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>本周周报</Text>
        <Button mode="text" textColor={colors.primaryDark} onPress={onViewMore} compact>
          {status === 'active' ? '查看历史' : '查看方案'}
        </Button>
      </View>
      <StandardCard style={styles.reportCard}>
        <Card.Content style={styles.reportContent}>
          <View style={styles.reportWash} />
          <View style={styles.reportHeader}>
            <View>
              <Text style={styles.reportTitle}>{report.title}</Text>
              <Text style={styles.reportMeta}>{report.stageLabel}</Text>
            </View>
            <Chip style={styles.reportChip} textStyle={styles.reportChipText} compact>
              {status === 'active' ? '持续更新' : '预览中'}
            </Chip>
          </View>

          {report.highlights.map((highlight: string, index: number) => (
            <Text key={highlight} style={styles.reportItem}>
              {index + 1}.{' '}
              {status === 'active' || index === 0
                ? highlight
                : '会员可查看完整亮点与建议'}
            </Text>
          ))}
        </Card.Content>
      </StandardCard>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  reportCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: 'rgba(184,138,72,0.14)',
  },
  reportContent: {
    gap: spacing.xs,
    overflow: 'hidden',
  },
  reportWash: {
    position: 'absolute',
    top: -14,
    right: -8,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(248, 230, 213, 0.28)',
  },
  reportTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  reportMeta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.6,
  },
  reportChip: {
    backgroundColor: 'rgba(248, 230, 213, 0.92)',
    borderRadius: borderRadius.pill,
  },
  reportChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  reportItem: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 21,
    marginBottom: spacing.xs,
  },
})
