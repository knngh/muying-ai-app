import React, { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import LinearGradient from 'react-native-linear-gradient'
import { ActivityIndicator, Button, Chip, Text } from 'react-native-paper'
import { userApi, type PregnancyProfile } from '../api/modules'
import { ScreenContainer, StandardCard } from '../components/layout'
import { borderRadius, colors, fontSize, spacing } from '../theme'

const fallbackPhase = {
  label: '孕期未完善',
  title: '先完善孕期资料',
  subtitle: '补充预产期后，这里会自动生成当前孕周、关键节点和阶段重点。',
  focusTitle: '当前还不能生成孕期档案',
  focusText: '先去完善预产期和孕期状态，档案页会再自动同步当前阶段。',
}

const fallbackSnapshot = {
  completedTodoCount: 0,
  customTodoCount: 0,
  hasWeeklyDiary: false,
  weeklyDiaryDate: null,
  weeklyDiaryPreview: null,
}

const fallbackNextMilestoneText = '补充预产期后，这里会自动生成关键孕期节点。'

type LoosePregnancyProfile = Partial<PregnancyProfile> & {
  phase?: Partial<PregnancyProfile['phase']> | null
  snapshot?: Partial<PregnancyProfile['snapshot']> | null
  milestones?: PregnancyProfile['milestones'] | null
  heroTags?: string[] | null
}

function normalizeProfilePayload(value: LoosePregnancyProfile | null | undefined): PregnancyProfile | null {
  if (!value || typeof value !== 'object') return null

  return {
    isPregnancyReady: Boolean(value.isPregnancyReady),
    currentWeek: typeof value.currentWeek === 'number' ? value.currentWeek : null,
    dueDate: typeof value.dueDate === 'string' ? value.dueDate : null,
    daysUntilDue: typeof value.daysUntilDue === 'number' ? value.daysUntilDue : null,
    progressPercent: typeof value.progressPercent === 'number' ? value.progressPercent : 0,
    heroTags: Array.isArray(value.heroTags) ? value.heroTags.filter((item): item is string => typeof item === 'string') : [],
    phase: {
      ...fallbackPhase,
      ...(value.phase || {}),
    },
    snapshot: {
      ...fallbackSnapshot,
      ...(value.snapshot || {}),
    },
    milestones: Array.isArray(value.milestones) ? value.milestones : [],
    nextMilestoneText: typeof value.nextMilestoneText === 'string' ? value.nextMilestoneText : fallbackNextMilestoneText,
  }
}

export default function PregnancyProfileScreen() {
  const navigation = useNavigation<any>()
  const openCalendar = () => navigation.navigate('Main', { screen: 'CalendarTab' })
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<PregnancyProfile | null>(null)
  const [error, setError] = useState('')

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await userApi.getPregnancyProfile()
      const normalizedProfile = normalizeProfilePayload(result)
      if (!normalizedProfile) {
        throw new Error('孕期档案数据格式异常，请稍后再试')
      }
      setProfile(normalizedProfile)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '加载孕期档案失败'
      setError(message)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadProfile()
    }, [loadProfile]),
  )

  if (loading && !profile) {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingTitle}>正在整理孕期档案</Text>
          <Text style={styles.loadingText}>同步当前孕周、关键节点和本周记录。</Text>
        </View>
      </ScreenContainer>
    )
  }

  if (!profile) {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingTitle}>孕期档案暂时不可用</Text>
          <Text style={styles.loadingText}>{error || '请稍后重试。'}</Text>
          <Button mode="contained" buttonColor={colors.ink} onPress={() => void loadProfile()}>
            重新加载
          </Button>
        </View>
      </ScreenContainer>
    )
  }

  if (!profile.isPregnancyReady) {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingTitle}>先完善预产期，再生成你的孕期档案</Text>
          <Text style={styles.loadingText}>档案页会围绕当前孕周、关键产检节点和本周记录形成一个集中入口。</Text>
          <Button
            mode="contained"
            buttonColor={colors.ink}
            onPress={() => navigation.navigate('Main', { screen: 'Profile', params: { autoOpenEdit: true } })}
          >
            去完善资料
          </Button>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <StandardCard style={styles.heroCard} elevation={2}>
          <LinearGradient
            colors={['#FBE8DB', '#F5D7C5', '#FFF8F2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroTop}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>孕期档案</Text>
                <Text style={styles.heroTitle}>{profile.phase.title}</Text>
                <Text style={styles.heroSubtitle}>{profile.phase.subtitle}</Text>
              </View>
              <Chip style={styles.heroChip} textStyle={styles.heroChipText}>
                {profile.phase.label}
              </Chip>
            </View>

            <View style={styles.heroTagRow}>
              {profile.heroTags.map((tag) => (
                <Chip key={tag} compact style={styles.statusChip} textStyle={styles.statusChipText}>
                  {tag}
                </Chip>
              ))}
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>第 {profile.currentWeek} 周</Text>
                <Text style={styles.heroStatLabel}>当前孕周</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{profile.dueDate}</Text>
                <Text style={styles.heroStatLabel}>预产期</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{profile.daysUntilDue} 天</Text>
                <Text style={styles.heroStatLabel}>距离预产期</Text>
              </View>
            </View>

            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>孕期进度</Text>
              <Text style={styles.progressValue}>{profile.progressPercent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${profile.progressPercent}%` }]} />
            </View>
          </LinearGradient>
        </StandardCard>

        <StandardCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>本阶段重点</Text>
          <Text style={styles.focusTitle}>{profile.phase.focusTitle}</Text>
          <Text style={styles.focusText}>{profile.phase.focusText}</Text>
        </StandardCard>

        <StandardCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>本周快照</Text>
            {loading ? <Text style={styles.sectionMeta}>同步中...</Text> : null}
          </View>

          <View style={styles.snapshotRow}>
            <View style={styles.snapshotCard}>
              <Text style={styles.snapshotValue}>{profile.snapshot.completedTodoCount}</Text>
              <Text style={styles.snapshotLabel}>已完成待办</Text>
            </View>
            <View style={styles.snapshotCard}>
              <Text style={styles.snapshotValue}>{profile.snapshot.customTodoCount}</Text>
              <Text style={styles.snapshotLabel}>自定义待办</Text>
            </View>
            <View style={styles.snapshotCard}>
              <Text style={styles.snapshotValue}>{profile.snapshot.hasWeeklyDiary ? '已记录' : '未记录'}</Text>
              <Text style={styles.snapshotLabel}>本周记录</Text>
            </View>
          </View>

          <View style={styles.tipBanner}>
            <Text style={styles.tipBannerText}>{profile.nextMilestoneText}</Text>
          </View>
        </StandardCard>

        <StandardCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>关键节点时间轴</Text>
            <Text style={styles.sectionMeta}>按孕周整理</Text>
          </View>

          <View style={styles.milestoneList}>
            {profile.milestones.map((item) => (
              <View key={item.title} style={styles.milestoneRow}>
                <View style={styles.milestoneRail}>
                  <View
                    style={[
                      styles.milestoneDot,
                      item.status === 'done'
                        ? styles.milestoneDotDone
                        : item.status === 'active'
                          ? styles.milestoneDotActive
                          : styles.milestoneDotUpcoming,
                    ]}
                  />
                  <View style={styles.milestoneLine} />
                </View>
                <View
                  style={[
                    styles.milestoneCard,
                    item.status === 'active' ? styles.milestoneCardActive : null,
                  ]}
                >
                  <View style={styles.milestoneHeader}>
                    <Text style={styles.milestoneTitle}>{item.title}</Text>
                    <Chip compact style={styles.milestoneChip} textStyle={styles.milestoneChipText}>
                      {item.statusText}
                    </Chip>
                  </View>
                  <Text style={styles.milestoneMeta}>{item.windowText} · {item.anchorDateText}</Text>
                  <Text style={styles.milestoneText}>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </StandardCard>

        <StandardCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>我的记录</Text>
            <Text style={styles.sectionMeta}>来自成长日历</Text>
          </View>

          {profile.snapshot.hasWeeklyDiary ? (
            <View style={styles.diaryCard}>
              <Text style={styles.diaryDate}>{profile.snapshot.weeklyDiaryDate}</Text>
              <Text style={styles.diaryText}>{profile.snapshot.weeklyDiaryPreview}</Text>
            </View>
          ) : (
            <View style={styles.diaryCard}>
              <Text style={styles.diaryTitle}>这周还没有留下记录</Text>
              <Text style={styles.diaryText}>可以把本周感受、产检结果或重点提醒先记进成长日历。</Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <Button mode="contained" buttonColor={colors.ink} onPress={openCalendar} style={styles.actionButton}>
              去写本周记录
            </Button>
            <Button mode="outlined" textColor={colors.techDark} onPress={() => navigation.navigate('Main', { screen: 'Profile', params: { autoOpenEdit: true } })} style={styles.actionButton}>
              编辑资料
            </Button>
          </View>
        </StandardCard>
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
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  loadingTitle: {
    color: colors.ink,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  heroCard: {
    backgroundColor: 'transparent',
  },
  heroGradient: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroCopy: {
    flex: 1,
  },
  heroEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    marginTop: spacing.sm,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: colors.inkDeep,
  },
  heroSubtitle: {
    marginTop: spacing.sm,
    color: colors.inkSoft,
    lineHeight: 22,
  },
  heroChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  heroChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  heroTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statusChip: {
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  statusChipText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  heroStat: {
    flex: 1,
  },
  heroStatValue: {
    color: colors.ink,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  heroStatLabel: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  heroDivider: {
    width: 1,
    backgroundColor: 'rgba(63,42,34,0.08)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  progressLabel: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  progressValue: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  progressTrack: {
    height: 12,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primary,
  },
  sectionCard: {
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  sectionMeta: {
    color: colors.textLight,
    fontSize: fontSize.xs,
  },
  focusTitle: {
    marginTop: spacing.md,
    color: colors.primaryDark,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  focusText: {
    marginTop: spacing.sm,
    color: colors.inkSoft,
    lineHeight: 24,
  },
  snapshotRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  snapshotCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundSoft,
  },
  snapshotValue: {
    color: colors.ink,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  snapshotLabel: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  tipBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.techLight,
  },
  tipBannerText: {
    color: colors.techDark,
    lineHeight: 22,
  },
  milestoneList: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  milestoneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  milestoneRail: {
    alignItems: 'center',
  },
  milestoneDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
  },
  milestoneDotDone: {
    backgroundColor: colors.green,
  },
  milestoneDotActive: {
    backgroundColor: colors.primary,
  },
  milestoneDotUpcoming: {
    backgroundColor: colors.textLight,
  },
  milestoneLine: {
    flex: 1,
    width: 2,
    marginTop: spacing.sm,
    backgroundColor: colors.border,
  },
  milestoneCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceRaised,
  },
  milestoneCardActive: {
    backgroundColor: colors.backgroundSoft,
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'center',
  },
  milestoneTitle: {
    flex: 1,
    color: colors.ink,
    fontWeight: '700',
    fontSize: fontSize.lg,
  },
  milestoneChip: {
    backgroundColor: colors.primaryLight,
  },
  milestoneChipText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '700',
  },
  milestoneMeta: {
    marginTop: spacing.xs,
    color: colors.textLight,
    fontSize: fontSize.xs,
  },
  milestoneText: {
    marginTop: spacing.sm,
    color: colors.inkSoft,
    lineHeight: 22,
  },
  diaryCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundSoft,
  },
  diaryDate: {
    color: colors.textLight,
    fontSize: fontSize.xs,
  },
  diaryTitle: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: fontSize.lg,
  },
  diaryText: {
    marginTop: spacing.sm,
    color: colors.inkSoft,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
})
