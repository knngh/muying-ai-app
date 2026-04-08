import React, { useCallback } from 'react'
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { Button, Card, Chip, Text } from 'react-native-paper'
import { useMembershipStore } from '../stores/membershipStore'
import type { WeeklyReport } from '../stores/membershipStore'
import { trackAppEvent } from '../services/analytics'
import { colors, fontSize, spacing } from '../theme'

export default function WeeklyReportScreen() {
  const navigation = useNavigation<any>()
  const { status, weeklyReports, refreshWeeklyReports, loading } = useMembershipStore()

  useFocusEffect(
    useCallback(() => {
      refreshWeeklyReports()
      void trackAppEvent('app_weekly_report_open', {
        page: 'WeeklyReportScreen',
        properties: {
          status,
          reportCount: weeklyReports.length,
          latestReportId: weeklyReports[0]?.id ?? null,
        },
      })
    }, [refreshWeeklyReports, status, weeklyReports]),
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <Card.Content>
            <Chip style={styles.heroChip} textStyle={styles.heroChipText}>
              {status === 'active' ? '会员专属' : '升级后解锁'}
            </Chip>
            <Text style={styles.heroTitle}>周度报告与阶段回顾</Text>
            <Text style={styles.heroSubtitle}>
              每周自动生成一份围绕你当前阶段的重点提醒、节奏建议和回顾摘要。
            </Text>
          </Card.Content>
        </Card>

        {weeklyReports.map((report: WeeklyReport) => (
          <Card key={report.id} style={styles.reportCard}>
            <Card.Content>
              <View style={styles.reportHeader}>
                <View style={styles.reportHeaderText}>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.reportMeta}>
                    {report.stageLabel} · {dayjs(report.createdAt).format('YYYY-MM-DD')}
                  </Text>
                </View>
                <Chip style={styles.reportChip} textStyle={styles.reportChipText}>
                  {status === 'active' ? '已解锁' : '预览'}
                </Chip>
              </View>

              {report.highlights.map((item, index) => (
                <Text key={`${report.id}-${index + 1}`} style={styles.reportItem}>
                  {index + 1}. {status === 'active' || index === 0 ? item : '升级后查看完整周报建议'}
                </Text>
              ))}
            </Card.Content>
          </Card>
        ))}

        {status !== 'active' ? (
          <Button mode="contained" buttonColor={colors.ink} onPress={() => navigation.navigate('Membership')}>
            升级查看完整周报
          </Button>
        ) : (
          <Button mode="outlined" loading={loading} onPress={refreshWeeklyReports}>
            刷新周报列表
          </Button>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    borderRadius: 24,
    backgroundColor: colors.ink,
  },
  heroChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldLight,
  },
  heroChipText: {
    color: colors.gold,
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: spacing.md,
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.white,
  },
  heroSubtitle: {
    marginTop: spacing.sm,
    color: '#dfe7ff',
    lineHeight: 22,
  },
  reportCard: {
    marginTop: spacing.lg,
    borderRadius: 22,
    backgroundColor: colors.white,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  reportHeaderText: {
    flex: 1,
  },
  reportTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  reportMeta: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  reportChip: {
    backgroundColor: colors.primaryLight,
  },
  reportChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  reportItem: {
    marginTop: spacing.md,
    color: colors.text,
    lineHeight: 22,
  },
})
