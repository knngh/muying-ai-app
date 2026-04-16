import React, { useCallback, useEffect } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { Button, Chip, Text } from 'react-native-paper'
import LinearGradient from 'react-native-linear-gradient'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useMembershipStore } from '../stores/membershipStore'
import { useAppStore } from '../stores/appStore'
import type { WeeklyReport } from '../stores/membershipStore'
import { trackAppEvent } from '../services/analytics'
import { ScreenContainer, StandardCard } from '../components/layout'
import { getStageSummary } from '../utils/stage'
import { markWeeklyReportSeen } from '../utils/weeklyReportRead'
import { colors, fontSize, spacing, borderRadius } from '../theme'

function buildWeeklyReportCalendarPrefill(report: WeeklyReport, highlight: string, index: number) {
  const normalizedHighlight = highlight.replace(/\s+/g, ' ').trim()
  const shortTitle = normalizedHighlight.length <= 18
    ? normalizedHighlight
    : `${report.stageLabel}重点 ${index + 1}`

  return {
    title: shortTitle,
    description: `${report.title}\n${normalizedHighlight}`,
    eventType: 'reminder' as const,
    targetDate: dayjs().format('YYYY-MM-DD'),
  }
}

function buildWeeklyReportQuestion(report: WeeklyReport, highlight: string) {
  const normalizedHighlight = highlight.replace(/\s+/g, ' ').trim()
  return `我在${report.stageLabel}的周报里看到这条提醒：“${normalizedHighlight}”。请结合当前阶段帮我详细解释这句话是什么意思，我应该重点观察什么、怎么安排接下来几天？`
}

export default function WeeklyReportScreen() {
  const navigation = useNavigation<any>()
  const user = useAppStore((state) => state.user)
  const { status, weeklyReports, refreshWeeklyReports, loading } = useMembershipStore()
  const stage = getStageSummary(user)

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
    }, [refreshWeeklyReports, status]),
  )

  const latestReportDate = weeklyReports[0]?.createdAt
    ? dayjs(weeklyReports[0].createdAt).format('MM-DD')
    : '--'

  useEffect(() => {
    if (status !== 'active' || !weeklyReports[0]?.id) {
      return
    }

    void markWeeklyReportSeen(weeklyReports[0].id)
  }, [status, weeklyReports])

  const handleAddToCalendar = useCallback((report: WeeklyReport, highlight: string, index: number) => {
    const prefill = buildWeeklyReportCalendarPrefill(report, highlight, index)

    void trackAppEvent('app_weekly_report_add_calendar_click', {
      page: 'WeeklyReportScreen',
      properties: {
        status,
        reportId: report.id,
        highlightIndex: index + 1,
      },
    })

    navigation.navigate('Calendar', {
      prefillTitle: prefill.title,
      prefillDescription: prefill.description,
      prefillEventType: prefill.eventType,
      targetDate: prefill.targetDate,
      source: 'weekly_report',
    })
  }, [navigation, status])

  const handleAskAi = useCallback((report: WeeklyReport, highlight: string, index: number) => {
    const question = buildWeeklyReportQuestion(report, highlight)

    void trackAppEvent('app_weekly_report_ask_ai_click', {
      page: 'WeeklyReportScreen',
      properties: {
        status,
        reportId: report.id,
        highlightIndex: index + 1,
      },
    })

    navigation.navigate('Main', {
      screen: 'Chat',
      params: {
        prefillQuestion: question,
        autoSend: true,
        source: 'weekly_report',
      },
    })
  }, [navigation, status])

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <StandardCard style={styles.heroCard} elevation={2}>
          <LinearGradient
            colors={['#F7E3D6', '#EDC9B6', '#F8EFE6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroRing} />
            <View style={styles.heroContent}>
              <View style={styles.heroChipRow}>
                <Chip style={styles.heroChip} textStyle={styles.heroChipText}>
                  {status === 'active' ? '会员专属' : '升级后解锁'}
                </Chip>
                <Chip style={styles.heroStageChip} textStyle={styles.heroStageChipText}>
                  {stage.lifecycleLabel}
                </Chip>
              </View>
              <Text style={styles.heroEyebrow}>周报中心</Text>
              <Text style={styles.heroTitle}>{stage.lifecycleLabel}周报与阶段回顾</Text>
              <Text style={styles.heroSubtitle}>
                每周自动汇总你当前阶段的重点提醒、执行节奏和阶段摘要，适合做复盘与家庭协作。
              </Text>

              <View style={styles.heroSignalPanel}>
                <View style={styles.heroSignalItem}>
                  <Text style={styles.heroSignalValue}>{weeklyReports.length}</Text>
                  <Text style={styles.heroSignalLabel}>周报数量</Text>
                </View>
                <View style={styles.heroSignalDivider} />
                <View style={styles.heroSignalItem}>
                  <Text style={styles.heroSignalValue}>{latestReportDate}</Text>
                  <Text style={styles.heroSignalLabel}>最近生成</Text>
                </View>
                <View style={styles.heroSignalDivider} />
                <View style={styles.heroSignalItem}>
                  <Text style={styles.heroSignalValue}>{status === 'active' ? '完整' : '预览'}</Text>
                  <Text style={styles.heroSignalLabel}>查看权限</Text>
                </View>
              </View>

              <View style={styles.heroSignalRow}>
                <Chip compact style={styles.heroSignalChip} textStyle={styles.heroSignalChipText}>
                  日历与问答记录自动汇总
                </Chip>
                <Chip compact style={styles.heroSignalChip} textStyle={styles.heroSignalChipText}>
                  适合做阶段复盘与家庭协作
                </Chip>
              </View>
            </View>
          </LinearGradient>
        </StandardCard>

        {weeklyReports.length === 0 ? (
          <StandardCard style={styles.emptyCard} elevation={1}>
            <View style={styles.emptyIconShell}>
              <MaterialCommunityIcons name="file-document-outline" size={22} color={colors.techDark} />
            </View>
            <Text style={styles.reportEyebrow}>周报预览</Text>
            <Text style={styles.reportTitle}>当前还没有周报</Text>
            <Text style={styles.reportItem}>
              持续使用成长日历、问题助手和阶段记录后，这里会逐步形成更完整的生命周期周报。
            </Text>
            <Text style={styles.emptyHint}>
              先把日历安排和关键问题记录连续起来，周报的价值会明显提升。
            </Text>
          </StandardCard>
        ) : weeklyReports.map((report: WeeklyReport) => {
          const visibleHighlights = status === 'active' ? report.highlights : report.highlights.slice(0, 1)

          return (
            <StandardCard key={report.id} style={styles.reportCard} elevation={1}>
              <View style={styles.reportHeader}>
                <View style={styles.reportHeaderText}>
                  <Text style={styles.reportEyebrow}>阶段周报</Text>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.reportMeta}>
                    {report.stageLabel} · {dayjs(report.createdAt).format('YYYY-MM-DD')}
                  </Text>
                </View>
                <Chip style={styles.reportChip} textStyle={styles.reportChipText}>
                  {status === 'active' ? '完整周报' : '预览'}
                </Chip>
              </View>

              <View style={styles.reportDivider} />

              {visibleHighlights.map((item, index) => (
                <View key={`${report.id}-${index + 1}`} style={styles.reportLine}>
                  <View style={styles.reportLineMain}>
                    <View style={styles.reportLineIndex}>
                      <Text style={styles.reportLineIndexText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.reportItem}>{item}</Text>
                  </View>
                  <View style={styles.reportLineActions}>
                    <Button
                      mode="outlined"
                      compact
                      onPress={() => handleAddToCalendar(report, item, index)}
                      style={styles.reportLineAction}
                      textColor={colors.techDark}
                    >
                      加入日历
                    </Button>
                    <Button
                      mode="contained-tonal"
                      compact
                      onPress={() => handleAskAi(report, item, index)}
                      style={[styles.reportLineAction, styles.reportLineActionFilled]}
                      textColor={colors.ink}
                    >
                      问 AI
                    </Button>
                  </View>
                </View>
              ))}

              {status !== 'active' && report.highlights.length > 1 ? (
                <View style={styles.lockedLine}>
                  <MaterialCommunityIcons name="lock-outline" size={16} color={colors.techDark} />
                  <Text style={styles.lockedLineText}>升级后查看完整周报建议与阶段交接摘要</Text>
                </View>
              ) : null}

              <View style={styles.reportFooter}>
                <MaterialCommunityIcons name="radar" size={16} color={colors.techDark} />
                <Text style={styles.reportFooterText}>
                  {status === 'active'
                    ? '建议结合日历完成情况一起回看，更容易发现阶段节奏问题。'
                    : '当前展示首条重点提醒，可作为周报能力预览。'}
                </Text>
              </View>
            </StandardCard>
          )
        })}

        {status !== 'active' ? (
          <Button
            mode="contained"
            buttonColor={colors.ink}
            style={styles.actionButton}
            onPress={() => navigation.navigate('Membership')}
          >
            升级查看完整周报
          </Button>
        ) : (
          <Button mode="outlined" loading={loading} style={styles.actionButton} onPress={refreshWeeklyReports}>
            刷新周报列表
          </Button>
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 132,
  },
  heroCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: 'transparent',
  },
  heroGradient: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    right: -34,
    top: -28,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 248, 242, 0.48)',
  },
  heroRing: {
    position: 'absolute',
    right: 24,
    top: 24,
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: 'rgba(94,126,134,0.12)',
  },
  heroContent: {
    padding: spacing.md,
  },
  heroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  heroChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 253, 249, 0.9)',
  },
  heroChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  heroStageChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(220, 236, 238, 0.72)',
  },
  heroStageChipText: {
    color: colors.techDark,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.ink,
  },
  heroSubtitle: {
    marginTop: spacing.sm,
    color: colors.inkSoft,
    lineHeight: 22,
  },
  heroSignalPanel: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 252, 249, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.1)',
  },
  heroSignalItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroSignalValue: {
    color: colors.ink,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  heroSignalLabel: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  heroSignalDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.divider,
  },
  heroSignalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroSignalChip: {
    backgroundColor: 'rgba(255, 249, 243, 0.92)',
    borderColor: 'rgba(184,138,72,0.14)',
  },
  heroSignalChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  emptyCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  emptyIconShell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94,126,134,0.12)',
    marginBottom: spacing.md,
  },
  emptyHint: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  reportCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
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
  reportEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
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
    backgroundColor: colors.accentLight,
  },
  reportChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  reportDivider: {
    height: 1,
    marginTop: spacing.md,
    backgroundColor: 'rgba(184,138,72,0.12)',
  },
  reportLine: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  reportLineMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  reportLineIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(217,144,122,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  reportLineIndexText: {
    color: colors.primaryDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  reportItem: {
    flex: 1,
    color: colors.text,
    lineHeight: 22,
  },
  reportLineAction: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    borderColor: 'rgba(94,126,134,0.2)',
    backgroundColor: 'rgba(255, 251, 247, 0.92)',
  },
  reportLineActions: {
    marginLeft: 34,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reportLineActionFilled: {
    backgroundColor: 'rgba(220,236,238,0.88)',
  },
  lockedLine: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(220,236,238,0.16)',
  },
  lockedLineText: {
    flex: 1,
    color: colors.techDark,
    lineHeight: 20,
  },
  reportFooter: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(184,138,72,0.12)',
  },
  reportFooterText: {
    flex: 1,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionButton: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.pill,
  },
})
