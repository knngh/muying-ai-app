import React from 'react'
import { StyleSheet, View } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { Button, Card, Text } from 'react-native-paper'
import dayjs from 'dayjs'
import type { WeeklyReport } from '../../stores/membershipStore'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface WeeklyReportListProps {
  reports: WeeklyReport[]
  status: string
  onViewMore: () => void
}

export default function WeeklyReportList({ reports, status, onViewMore }: WeeklyReportListProps) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>每周快照</Text>
          <Text style={styles.sectionTitle}>周度报告</Text>
        </View>
        <Text style={styles.sectionMeta}>
          {status === 'active' ? '历史可查看' : '会员专属能力'}
        </Text>
      </View>

      <Button mode="text" textColor={colors.primaryDark} onPress={onViewMore}>
        {status === 'active' ? '查看全部周报' : '升级后查看完整历史'}
      </Button>

      {reports.map((report: WeeklyReport) => (
        <StandardCard key={report.id} style={styles.reportCard}>
          <Card.Content>
            <View style={styles.reportTopRow}>
            <Text style={styles.reportEyebrow}>阶段周报</Text>
              <View style={styles.reportDateBadge}>
                <MaterialCommunityIcons name="calendar-week" size={14} color={colors.techDark} />
                <Text style={styles.reportDateBadgeText}>{dayjs(report.createdAt).format('MM-DD')}</Text>
              </View>
            </View>
            <Text style={styles.reportTitle}>{report.title}</Text>
            <Text style={styles.reportMeta}>
              {report.stageLabel}
            </Text>
            {report.highlights.map((item: string, index: number) => (
              <View key={item} style={styles.reportLine}>
                <View style={styles.reportIndex}>
                  <Text style={styles.reportIndexText}>{index + 1}</Text>
                </View>
                <Text style={styles.reportItem}>
                  {status === 'active' || index === 0 ? item : '升级后查看完整建议'}
                </Text>
              </View>
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
  sectionEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: spacing.xs,
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
    lineHeight: 22,
  },
  reportCard: {
    backgroundColor: colors.surfaceRaised,
  },
  reportTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  reportEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  reportDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(94, 126, 134, 0.1)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reportDateBadgeText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  reportMeta: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  reportLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  reportIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(94,126,134,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  reportIndexText: {
    color: colors.techDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  reportItem: {
    flex: 1,
    color: colors.text,
    lineHeight: 20,
    fontSize: fontSize.md,
  },
})
