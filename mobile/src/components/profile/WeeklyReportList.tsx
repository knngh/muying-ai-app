import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Card, Text } from 'react-native-paper'
import dayjs from 'dayjs'
import type { WeeklyReport } from '../../stores/membershipStore'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing } from '../../theme'

interface WeeklyReportListProps {
  reports: WeeklyReport[]
  status: string
  onViewMore: () => void
}

export default function WeeklyReportList({ reports, status, onViewMore }: WeeklyReportListProps) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>周度报告</Text>
        <Text style={styles.sectionMeta}>
          {status === 'active' ? '历史可查看' : '会员专属能力'}
        </Text>
      </View>

      <Button mode="text" onPress={onViewMore}>
        {status === 'active' ? '查看全部周报' : '升级后查看完整历史'}
      </Button>

      {reports.map((report: WeeklyReport) => (
        <StandardCard key={report.id}>
          <Card.Content>
            <Text style={styles.reportTitle}>{report.title}</Text>
            <Text style={styles.reportMeta}>
              {report.stageLabel} {'\u00B7'} {dayjs(report.createdAt).format('MM-DD')}
            </Text>
            {report.highlights.map((item: string, index: number) => (
              <Text key={item} style={styles.reportItem}>
                {index + 1}.{' '}
                {status === 'active' || index === 0 ? item : '升级后查看完整建议'}
              </Text>
            ))}
          </Card.Content>
        </StandardCard>
      ))}
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
    fontWeight: 'bold',
    color: colors.text,
  },
  sectionMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  reportTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.text,
  },
  reportMeta: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  reportItem: {
    marginBottom: spacing.xs,
    color: colors.text,
    lineHeight: 20,
    fontSize: fontSize.md,
  },
})
