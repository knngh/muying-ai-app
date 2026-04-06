import React, { useMemo } from 'react'
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { Button, Card, Chip, ProgressBar, Text } from 'react-native-paper'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { useAppStore } from '../stores/appStore'
import { useMembershipStore } from '../stores/membershipStore'
import { trackAppEvent } from '../services/analytics'
import { colors, fontSize, spacing } from '../theme'
import { getStageSummary } from '../utils/stage'

type ArchiveMetric = {
  label: string
  value: string
  hint: string
}

type TimelineItem = {
  label: string
  value: string
  detail: string
}

type InsightBar = {
  label: string
  value: string
  progress: number
  tone: 'gold' | 'blue' | 'green' | 'pink'
  helper: string
}

type MilestoneCard = {
  title: string
  detail: string
  status: 'done' | 'focus' | 'next'
}

function buildProgress(user: ReturnType<typeof useAppStore.getState>['user']) {
  if (user?.pregnancyStatus === 2 && user.dueDate) {
    const dueDate = dayjs(user.dueDate)
    const daysLeft = Math.max(dueDate.diff(dayjs(), 'day'), 0)
    const passedDays = Math.max(280 - daysLeft, 0)

    return {
      title: '孕育进度',
      valueLabel: `已进入第 ${Math.max(Math.floor(passedDays / 7) + 1, 1)} 周`,
      detail: `距离预产期还有 ${daysLeft} 天`,
      progress: Math.min(passedDays / 280, 1),
    }
  }

  if (user?.pregnancyStatus === 3 && user.babyBirthday) {
    const ageDays = Math.max(dayjs().diff(dayjs(user.babyBirthday), 'day'), 0)
    const months = Math.floor(ageDays / 30)
    const days = ageDays % 30

    return {
      title: '成长进度',
      valueLabel: `宝宝 ${months} 月 ${days} 天`,
      detail: '持续记录作息、喂养和成长变化会更有价值。',
      progress: Math.min(ageDays / 365, 1),
    }
  }

  const joinedDays = user?.createdAt ? Math.max(dayjs().diff(dayjs(user.createdAt), 'day'), 0) : 0
  return {
    title: '陪伴进度',
    valueLabel: `已记录 ${joinedDays} 天`,
    detail: '从备孕开始建立自己的节奏和档案。',
    progress: Math.min(joinedDays / 90, 1),
  }
}

function getInsightToneColor(tone: InsightBar['tone']) {
  if (tone === 'gold') return colors.gold
  if (tone === 'green') return colors.green
  if (tone === 'pink') return colors.pink
  return colors.primary
}

function buildMilestones(stageKind: ReturnType<typeof getStageSummary>['communityStage'], timelineCount: number): MilestoneCard[] {
  const base = [
    { title: '阶段资料已建立', detail: '账号、阶段信息和关键日期已经纳入成长档案。', status: 'done' as const },
    { title: '本周重点持续沉淀', detail: '结合 AI 周报、打卡和时间轴，逐步形成连续记录。', status: 'focus' as const },
    { title: '准备下一个阶段交接', detail: '把下一阶段的提醒、物品和注意事项提前整理给家人。', status: 'next' as const },
  ]

  if (stageKind === 'preparing') {
    base[1] = { title: '备孕节律正在形成', detail: '优先稳定作息、叶酸补充和基础检查记录。', status: 'focus' }
    base[2] = { title: '为孕早期做准备', detail: '把检查结果、用药信息和关键问题提前归档。', status: 'next' }
  }

  if (stageKind === 'pregnant_early') {
    base[1] = { title: '孕早期重点追踪', detail: '适合记录早孕反应、建档、NT 和基础营养补充。', status: 'focus' }
    base[2] = { title: '为孕中期建立节奏', detail: '逐步开始沉淀产检节点和身体变化趋势。', status: 'next' }
  }

  if (stageKind === 'pregnant_mid') {
    base[1] = { title: '孕中期进入稳定期', detail: '适合持续记录胎动、糖耐、体力和睡眠变化。', status: 'focus' }
    base[2] = { title: '为孕晚期待产做准备', detail: '可以提前整理待产包、分娩偏好和家人分工。', status: 'next' }
  }

  if (stageKind === 'pregnant_late') {
    base[1] = { title: '待产准备进入关键期', detail: '优先沉淀宫缩、产检、睡眠和待产包检查结果。', status: 'focus' }
    base[2] = { title: '准备切换到产后档案', detail: '把住院物品、喂养计划和家人协作信息提前归档。', status: 'next' }
  }

  if (stageKind === 'postpartum_recovery') {
    base[1] = { title: '产后恢复持续观察', detail: '记录伤口、恶露、情绪和开奶节奏，更容易快速回看。', status: 'focus' }
    base[2] = { title: '准备进入育儿节奏', detail: '把喂养、睡眠和宝宝变化整理成可共享摘要。', status: 'next' }
  }

  if (stageKind === 'parenting') {
    base[1] = { title: '育儿档案持续积累', detail: '优先沉淀喂养、夜醒、疫苗和成长关键节点。', status: 'focus' }
    base[2] = { title: '建立长期回看能力', detail: `当前已累计 ${timelineCount} 个关键节点，继续记录会更有价值。`, status: 'next' }
  }

  return base
}

export default function GrowthArchiveScreen() {
  const navigation = useNavigation<any>()
  const user = useAppStore(state => state.user)
  const {
    status,
    aiUsedToday,
    aiLimit,
    checkInStreak,
    weeklyCompletionRate,
    weeklyReports,
  } = useMembershipStore()
  const stage = useMemo(() => getStageSummary(user), [user])

  const progress = useMemo(() => buildProgress(user), [user])
  const isVip = status === 'active'

  const metrics = useMemo<ArchiveMetric[]>(() => ([
    {
      label: '连续打卡',
      value: `${checkInStreak} 天`,
      hint: '越稳定的记录，后续周报越精准。',
    },
    {
      label: '本周完成率',
      value: `${weeklyCompletionRate}%`,
      hint: '可以结合日历待办回看执行节奏。',
    },
    {
      label: 'AI 使用',
      value: isVip ? `${aiUsedToday} 次` : `${aiUsedToday} / ${aiLimit} 次`,
      hint: isVip ? '会员已解锁深度问答。' : '升级后可解锁无限次咨询。',
    },
    {
      label: '周报沉淀',
      value: `${weeklyReports.length} 份`,
      hint: isVip ? '可继续累积阶段回顾。' : '会员可查看完整历史档案。',
    },
  ]), [aiLimit, aiUsedToday, checkInStreak, isVip, weeklyCompletionRate, weeklyReports.length])

  const insightBars = useMemo<InsightBar[]>(() => {
    const quotaBase = isVip ? Math.max(aiUsedToday, 1) : Math.max(aiLimit, 1)

    return [
      {
        label: '记录连续性',
        value: `${checkInStreak} 天`,
        progress: Math.min(checkInStreak / 14, 1),
        tone: 'gold',
        helper: '连续记录越稳定，档案回看价值越高。',
      },
      {
        label: '本周执行度',
        value: `${weeklyCompletionRate}%`,
        progress: Math.min(weeklyCompletionRate / 100, 1),
        tone: 'green',
        helper: '可结合日历完成率看近期节奏是否失衡。',
      },
      {
        label: '周报沉淀',
        value: `${weeklyReports.length} 份`,
        progress: Math.min(weeklyReports.length / 8, 1),
        tone: 'blue',
        helper: '周报越完整，越适合做阶段交接与分享。',
      },
      {
        label: 'AI 参与度',
        value: isVip ? `${aiUsedToday} 次` : `${aiUsedToday}/${aiLimit}`,
        progress: Math.min(aiUsedToday / quotaBase, 1),
        tone: 'pink',
        helper: isVip ? '会员已解锁深度陪伴，可把关键问题沉淀进档案。' : '升级后可不限次补充关键记录与解释。',
      },
    ]
  }, [aiLimit, aiUsedToday, checkInStreak, isVip, weeklyCompletionRate, weeklyReports.length])

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = []

    if (user?.createdAt) {
      items.push({
        label: '加入贝护妈妈',
        value: dayjs(user.createdAt).format('YYYY-MM-DD'),
        detail: '开始建立你的个人孕育档案。',
      })
    }

    if (user?.dueDate) {
      items.push({
        label: '预产期',
        value: dayjs(user.dueDate).format('YYYY-MM-DD'),
        detail: '可结合日历和周报安排每阶段重点。',
      })
    }

    if (user?.babyBirthday) {
      items.push({
        label: '宝宝生日',
        value: dayjs(user.babyBirthday).format('YYYY-MM-DD'),
        detail: '后续更适合积累喂养、睡眠和发育记录。',
      })
    }

    if (weeklyReports[0]) {
      items.push({
        label: '最近一份周报',
        value: dayjs(weeklyReports[0].createdAt).format('YYYY-MM-DD'),
        detail: weeklyReports[0].title,
      })
    }

    return items
  }, [user, weeklyReports])

  const milestones = useMemo(
    () => buildMilestones(stage.communityStage, timeline.length),
    [stage.communityStage, timeline.length],
  )

  const exportPreviewLines = useMemo(() => {
    const firstHighlight = weeklyReports[0]?.highlights?.[0]
    return [
      `阶段：${stage.title}`,
      `${progress.title}：${progress.valueLabel}`,
      `连续打卡：${checkInStreak} 天`,
      `本周完成率：${weeklyCompletionRate}%`,
      `最近周报：${weeklyReports[0]?.title ?? '暂无周报'}`,
      firstHighlight ? `阶段提醒：${firstHighlight}` : '阶段提醒：持续补充记录后会生成更完整摘要',
    ]
  }, [checkInStreak, progress.title, progress.valueLabel, stage.title, weeklyCompletionRate, weeklyReports])

  const handleShareArchive = async () => {
    if (!isVip) {
      navigation.navigate('Membership')
      return
    }

    const summary = ['贝护妈妈成长档案摘要', ...exportPreviewLines].join('\n')

    try {
      await Share.share({
        title: '贝护妈妈成长档案摘要',
        message: summary,
      })
      void trackAppEvent('app_growth_archive_share', {
        page: 'GrowthArchiveScreen',
        properties: {
          stage: stage.communityStage,
          weeklyReportCount: weeklyReports.length,
          isVip,
        },
      })
    } catch (_error) {
      Alert.alert('提示', '分享失败，请稍后再试。')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <Card.Content>
            <View style={styles.heroTop}>
              <Chip style={styles.heroChip} textStyle={styles.heroChipText}>
                {isVip ? '会员成长档案' : '成长档案预览'}
              </Chip>
              <Text style={styles.heroTitle}>把阶段变化沉淀成一份可回看的记录</Text>
              <Text style={styles.heroSubtitle}>
                {isVip
                  ? '这里汇总你的阶段进度、周报沉淀和执行节奏，可直接分享给家人。'
                  : '升级后可查看完整阶段档案、连续记录摘要和可分享导出内容。'}
              </Text>
            </View>

            <View style={styles.progressPanel}>
              <Text style={styles.progressLabel}>{progress.title}</Text>
              <Text style={styles.progressValue}>{progress.valueLabel}</Text>
              <Text style={styles.progressHint}>{progress.detail}</Text>
              <ProgressBar progress={progress.progress} color={colors.gold} style={styles.progressBar} />
            </View>

            <View style={styles.heroActions}>
              <Button
                mode="contained"
                buttonColor={isVip ? colors.white : colors.gold}
                textColor={isVip ? colors.ink : colors.ink}
                onPress={handleShareArchive}
              >
                {isVip ? '导出并分享摘要' : '升级解锁完整档案'}
              </Button>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.metricGrid}>
          {metrics.map((item) => (
            <Card key={item.label} style={styles.metricCard}>
              <Card.Content>
                <Text style={styles.metricLabel}>{item.label}</Text>
                <Text style={styles.metricValue}>{item.value}</Text>
                <Text style={styles.metricHint}>{isVip ? item.hint : '会员可查看更完整趋势和导出摘要。'}</Text>
              </Card.Content>
            </Card>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>档案图谱</Text>
            <Text style={styles.sectionMeta}>{isVip ? '实时概览' : '会员查看完整趋势'}</Text>
          </View>

          <Card style={styles.insightCard}>
            <Card.Content>
              {insightBars.map((item) => (
                <View key={item.label} style={styles.insightRow}>
                  <View style={styles.insightHeader}>
                    <Text style={styles.insightLabel}>{item.label}</Text>
                    <Text style={styles.insightValue}>{item.value}</Text>
                  </View>
                  <View style={styles.insightTrack}>
                    <View
                      style={[
                        styles.insightFill,
                        {
                          width: `${Math.max(item.progress * 100, 8)}%`,
                          backgroundColor: getInsightToneColor(item.tone),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.insightHelper}>
                    {isVip ? item.helper : '升级后可查看更完整趋势图和阶段导出摘要。'}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>阶段时间轴</Text>
            <Text style={styles.sectionMeta}>{stage.title}</Text>
          </View>

          {timeline.map((item, index) => (
            <View key={`${item.label}-${item.value}`} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={styles.timelineDot} />
                {index < timeline.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <Card style={styles.timelineCard}>
                <Card.Content>
                  <Text style={styles.timelineLabel}>{item.label}</Text>
                  <Text style={styles.timelineValue}>{item.value}</Text>
                  <Text style={styles.timelineDetail}>
                    {isVip || index === 0 ? item.detail : '升级后查看完整阶段记录和档案备注。'}
                  </Text>
                </Card.Content>
              </Card>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>阶段里程碑</Text>
            <Text style={styles.sectionMeta}>{stage.communityStageLabel}</Text>
          </View>

          {milestones.map((item) => (
            <Card key={item.title} style={styles.milestoneCard}>
              <Card.Content style={styles.milestoneContent}>
                <View
                  style={[
                    styles.milestoneBadge,
                    item.status === 'done' && styles.milestoneBadgeDone,
                    item.status === 'focus' && styles.milestoneBadgeFocus,
                    item.status === 'next' && styles.milestoneBadgeNext,
                  ]}
                >
                  <Text
                    style={[
                      styles.milestoneBadgeText,
                      item.status === 'done' && styles.milestoneBadgeTextDone,
                      item.status === 'focus' && styles.milestoneBadgeTextFocus,
                      item.status === 'next' && styles.milestoneBadgeTextNext,
                    ]}
                  >
                    {item.status === 'done' ? '已建立' : item.status === 'focus' ? '当前重点' : '下一步'}
                  </Text>
                </View>
                <View style={styles.milestoneBody}>
                  <Text style={styles.milestoneTitle}>{item.title}</Text>
                  <Text style={styles.milestoneDetail}>
                    {isVip || item.status === 'done' ? item.detail : '升级后查看完整阶段行动建议和共享摘要。'}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>导出摘要预览</Text>
            <Text style={styles.sectionMeta}>{isVip ? '可直接分享' : '会员可导出分享'}</Text>
          </View>

          <Card style={styles.exportCard}>
            <Card.Content>
              <View style={styles.exportTop}>
                <Chip style={styles.exportChip} textStyle={styles.exportChipText}>
                  {isVip ? '家人共享版' : '预览'}
                </Chip>
                <Text style={styles.exportTitle}>成长档案摘要</Text>
                <Text style={styles.exportSubtitle}>
                  {isVip
                    ? '适合直接分享给家人或留作阶段交接记录。'
                    : '升级后可导出完整摘要并直接分享给家人。'}
                </Text>
              </View>

              {exportPreviewLines.map((line) => (
                <View key={line} style={styles.exportLine}>
                  <View style={styles.exportDot} />
                  <Text style={styles.exportText}>{isVip ? line : '升级后查看完整摘要内容'}</Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>档案建议</Text>
            <Text style={styles.sectionMeta}>MVP 版</Text>
          </View>
          {[
            '每周至少完成 1 次日历打卡，周报会更完整。',
            '遇到关键身体变化时，可以结合 AI 问答和社区经验做记录。',
            '阶段快切换时，建议回看最近 2 份周报，整理重点提醒给家人。',
          ].map((item) => (
            <TouchableOpacity key={item} activeOpacity={0.9}>
              <Card style={styles.tipCard}>
                <Card.Content>
                  <Text style={styles.tipText}>{isVip ? item : '升级后查看完整档案建议与导出内容。'}</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
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
    borderRadius: 26,
    backgroundColor: colors.ink,
  },
  heroTop: {
    gap: spacing.sm,
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
    color: colors.white,
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: '#d1dcff',
    lineHeight: 22,
  },
  progressPanel: {
    marginTop: spacing.lg,
    borderRadius: 22,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressLabel: {
    color: '#c6d3f7',
    marginBottom: spacing.xs,
  },
  progressValue: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '700',
  },
  progressHint: {
    marginTop: spacing.xs,
    color: '#afbcdf',
  },
  progressBar: {
    marginTop: spacing.md,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroActions: {
    marginTop: spacing.lg,
  },
  metricGrid: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    width: '47%',
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  metricLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  metricValue: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  metricHint: {
    marginTop: spacing.sm,
    color: colors.textLight,
    lineHeight: 20,
  },
  insightCard: {
    borderRadius: 22,
    backgroundColor: colors.white,
  },
  insightRow: {
    marginBottom: spacing.lg,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  insightLabel: {
    color: colors.text,
    fontWeight: '700',
  },
  insightValue: {
    color: colors.ink,
    fontWeight: '700',
  },
  insightTrack: {
    marginTop: spacing.sm,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  insightFill: {
    height: '100%',
    borderRadius: 999,
  },
  insightHelper: {
    marginTop: spacing.sm,
    color: colors.textLight,
    lineHeight: 20,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  sectionMeta: {
    color: colors.textSecondary,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'stretch',
    marginBottom: spacing.md,
  },
  timelineRail: {
    alignItems: 'center',
    width: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: 14,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: spacing.xs,
    backgroundColor: colors.primaryLight,
  },
  timelineCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  timelineLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  timelineValue: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  timelineDetail: {
    marginTop: spacing.sm,
    color: colors.textLight,
    lineHeight: 20,
  },
  milestoneCard: {
    marginBottom: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  milestoneContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  milestoneBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
  },
  milestoneBadgeDone: {
    backgroundColor: colors.greenLight,
  },
  milestoneBadgeFocus: {
    backgroundColor: colors.goldLight,
  },
  milestoneBadgeNext: {
    backgroundColor: colors.primaryLight,
  },
  milestoneBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  milestoneBadgeTextDone: {
    color: colors.green,
  },
  milestoneBadgeTextFocus: {
    color: colors.gold,
  },
  milestoneBadgeTextNext: {
    color: colors.primaryDark,
  },
  milestoneBody: {
    flex: 1,
  },
  milestoneTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  milestoneDetail: {
    marginTop: spacing.sm,
    color: colors.textLight,
    lineHeight: 21,
  },
  exportCard: {
    borderRadius: 22,
    backgroundColor: colors.inkSoft,
  },
  exportTop: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  exportChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  exportChipText: {
    color: colors.white,
    fontWeight: '700',
  },
  exportTitle: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  exportSubtitle: {
    color: '#dbe4ff',
    lineHeight: 20,
  },
  exportLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  exportDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
    backgroundColor: colors.gold,
  },
  exportText: {
    flex: 1,
    color: colors.white,
    lineHeight: 21,
  },
  tipCard: {
    marginBottom: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  tipText: {
    color: colors.text,
    lineHeight: 22,
  },
})
