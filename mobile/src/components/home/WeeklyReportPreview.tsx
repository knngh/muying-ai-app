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
        <Text style={styles.sectionTitle}>周度报告预览</Text>
        <Button mode="text" onPress={onViewMore} compact>
          {status === 'active' ? '查看历史' : '升级解锁'}
        </Button>
      </View>
      <StandardCard>
        <Card.Content>
          <View style={styles.reportHeader}>
            <View>
              <Text style={styles.reportTitle}>{report.title}</Text>
              <Text style={styles.reportMeta}>{report.stageLabel}</Text>
            </View>
            <Chip style={styles.reportChip} textStyle={styles.reportChipText} compact>
              {status === 'active' ? '会员专属' : '升级解锁'}
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
  },
  reportChip: {
    backgroundColor: colors.primaryLight,
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
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
})
