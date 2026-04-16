import React, { useCallback, useMemo } from 'react'
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native'
import { Button, Card, Chip, ProgressBar, Text } from 'react-native-paper'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import dayjs from 'dayjs'
import LinearGradient from 'react-native-linear-gradient'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useAppStore } from '../stores/appStore'
import { useMembershipStore } from '../stores/membershipStore'
import { trackAppEvent } from '../services/analytics'
import { ScreenContainer, StandardCard } from '../components/layout'
import { borderRadius, colors, fontSize, spacing } from '../theme'
import { getStageSummary, type LifecycleStageKey, type StageSummary } from '../utils/stage'
import type { RootStackParamList } from '../navigation/AppNavigator'

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

type ArchiveContextCard = {
  title: string
  description: string
  highlights: string[]
}

function buildProgress(user: ReturnType<typeof useAppStore.getState>['user'], stage: StageSummary) {
  if (stage.kind === 'pregnant' && user?.dueDate) {
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

  if (user?.babyBirthday) {
    const ageDays = Math.max(dayjs().diff(dayjs(user.babyBirthday), 'day'), 0)
    const months = Math.max(dayjs().diff(dayjs(user.babyBirthday), 'month'), 0)
    const years = Math.floor(months / 12)
    const phaseProgress =
      stage.lifecycleKey === 'infant_0_6'
        ? Math.min(months / 6, 1)
        : stage.lifecycleKey === 'infant_6_12'
          ? Math.min(Math.max(months - 6, 0) / 6, 1)
          : stage.lifecycleKey === 'toddler_1_3'
            ? Math.min(Math.max(months - 12, 0) / 24, 1)
            : Math.min(months / 72, 1)

    return {
      title: '成长进度',
      valueLabel: stage.title,
      detail:
        stage.lifecycleKey === 'child_3_plus'
          ? `已进入 ${years} 岁阶段，适合长期记录语言、行为、社交和体检变化。`
          : '持续记录作息、喂养、行为和成长变化会更有价值。',
      progress: Math.max(Math.min(phaseProgress, 1), Math.min(ageDays / 365, 1) * 0.2),
    }
  }

  if (stage.kind === 'postpartum') {
    return {
      title: '恢复进度',
      valueLabel: stage.title,
      detail: '补充宝宝生日后，档案会自动切到更细的育儿阶段。',
      progress: 0.35,
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

function getMetricIcon(label: string) {
  if (label.includes('打卡')) return 'calendar-check-outline'
  if (label.includes('完成率')) return 'pulse'
  if (label.includes('今日使用')) return 'robot-excited-outline'
  return 'file-chart-outline'
}

function getMetricTone(label: string) {
  if (label.includes('打卡')) return { shell: 'rgba(184,138,72,0.14)', icon: colors.gold }
  if (label.includes('完成率')) return { shell: 'rgba(158,171,132,0.14)', icon: colors.green }
  if (label.includes('今日使用')) return { shell: 'rgba(94,126,134,0.14)', icon: colors.techDark }
  return { shell: 'rgba(217,144,122,0.14)', icon: colors.primaryDark }
}

function buildMilestones(stageKey: LifecycleStageKey, timelineCount: number): MilestoneCard[] {
  const base = [
    { title: '阶段资料已建立', detail: '账号、阶段信息和关键日期已经纳入成长档案。', status: 'done' as const },
    { title: '本周重点持续沉淀', detail: '结合周度报告、打卡和时间轴，逐步形成连续记录。', status: 'focus' as const },
    { title: '准备下一个阶段交接', detail: '把下一阶段的提醒、物品和注意事项提前整理给家人。', status: 'next' as const },
  ]

  if (stageKey === 'preparing') {
    base[1] = { title: '备孕节律正在形成', detail: '优先稳定作息、叶酸补充和基础检查记录。', status: 'focus' }
    base[2] = { title: '为孕早期做准备', detail: '把检查结果、用药信息和关键问题提前归档。', status: 'next' }
  }

  if (stageKey === 'pregnant_early') {
    base[1] = { title: '孕早期重点追踪', detail: '适合记录早孕反应、建档、NT 和基础营养补充。', status: 'focus' }
    base[2] = { title: '为孕中期建立节奏', detail: '逐步开始沉淀产检节点和身体变化趋势。', status: 'next' }
  }

  if (stageKey === 'pregnant_mid') {
    base[1] = { title: '孕中期进入稳定期', detail: '适合持续记录胎动、糖耐、体力和睡眠变化。', status: 'focus' }
    base[2] = { title: '为孕晚期待产做准备', detail: '可以提前整理待产包、分娩偏好和家人分工。', status: 'next' }
  }

  if (stageKey === 'pregnant_late') {
    base[1] = { title: '待产准备进入关键期', detail: '优先沉淀宫缩、产检、睡眠和待产包检查结果。', status: 'focus' }
    base[2] = { title: '准备切换到产后档案', detail: '把住院物品、喂养计划和家人协作信息提前归档。', status: 'next' }
  }

  if (stageKey === 'postpartum_newborn') {
    base[1] = { title: '母婴节奏正在建立', detail: '优先记录喂养、黄疸、排便、睡眠和妈妈恢复。', status: 'focus' }
    base[2] = { title: '为产后恢复期做交接', detail: '把复诊、喂养节奏和家人协作固定下来。', status: 'next' }
  }

  if (stageKey === 'postpartum_recovery') {
    base[1] = { title: '产后恢复持续观察', detail: '记录伤口、恶露、情绪和开奶节奏，更容易快速回看。', status: 'focus' }
    base[2] = { title: '准备进入育儿节奏', detail: '把喂养、睡眠和宝宝变化整理成可共享摘要。', status: 'next' }
  }

  if (stageKey === 'infant_0_6') {
    base[1] = { title: '婴儿照护进入连续记录期', detail: '优先沉淀喂养、夜醒、皮肤、儿保和疫苗变化。', status: 'focus' }
    base[2] = { title: '为辅食与作息转换做准备', detail: '把 6 月后的辅食和作息节律提前留出位置。', status: 'next' }
  }

  if (stageKey === 'infant_6_12') {
    base[1] = { title: '辅食与发育里程碑并行', detail: '适合持续记录辅食、睡眠倒退、爬行和体检节点。', status: 'focus' }
    base[2] = { title: '为幼儿期做准备', detail: '把 1 岁后的作息、习惯和体检安排提前归档。', status: 'next' }
  }

  if (stageKey === 'toddler_1_3') {
    base[1] = { title: '行为与语言档案持续积累', detail: '优先沉淀语言、如厕、睡眠、挑食和情绪模式。', status: 'focus' }
    base[2] = { title: '建立长期陪伴视角', detail: `当前已累计 ${timelineCount} 个关键节点，继续记录会更有价值。`, status: 'next' }
  }

  if (stageKey === 'child_3_plus') {
    base[1] = { title: '长期成长档案开始成形', detail: '适合持续记录语言、行为、社交、睡眠和年度体检。', status: 'focus' }
    base[2] = { title: '建立家庭长期回看能力', detail: `当前已累计 ${timelineCount} 个关键节点，可继续扩展为年度成长档案。`, status: 'next' }
  }

  return base
}

export default function GrowthArchiveScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<RootStackParamList, 'GrowthArchive'>>()
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
  const source = route.params?.source
  const focus = route.params?.focus

  const progress = useMemo(() => buildProgress(user, stage), [stage, user])
  const isVip = status === 'active'
  const contextCard = useMemo<ArchiveContextCard | null>(() => {
    if (isVip) {
      return null
    }

    if (source === 'membership') {
      return {
        title: '你刚从陪伴方案页回来',
        description: '现在看到的是成长档案预览版。真正有价值的是把周报、连续记录和导出摘要打通，而不只是零散看一眼。',
        highlights: ['导出摘要可分享给家人', '周报与时间轴持续累计', '关键变化能做长期回看'],
      }
    }

    return {
      title: '先看到了档案，再决定要不要把它做完整',
      description: '你是从首页的回访链路进入的。只要档案还停在预览，后面很多“为什么明天还要回来”都接不住。',
      highlights: ['连续记录不会断在首页', '周报和档案会形成时间线', '问题助手内容能沉淀成复盘材料'],
    }
  }, [isVip, source])

  const heroSubtitle = useMemo(() => {
    if (isVip) {
      return '这里会按当前阶段汇总进度、周报和执行节奏，长期陪伴不再只停在孕期。'
    }

    if (source === 'membership') {
      return '你刚从陪伴方案页回来，这里展示的是档案预览。开通后，时间轴、周报沉淀和导出摘要会真正连起来。'
    }

    return '升级后可查看完整生命周期档案、连续记录摘要和可分享导出内容。'
  }, [isVip, source])

  useFocusEffect(
    useCallback(() => {
      if (!contextCard) {
        return undefined
      }

      void trackAppEvent('app_growth_archive_context_exposure', {
        page: 'GrowthArchiveScreen',
        properties: {
          source,
          focus,
          highlightCount: contextCard.highlights.length,
        },
      })

      return undefined
    }, [contextCard, focus, source]),
  )

  const metrics = useMemo<ArchiveMetric[]>(() => ([
    {
      label: '连续打卡',
      value: `${checkInStreak} 天`,
      hint: '越稳定的记录，后续周度报告越完整。',
    },
    {
      label: '本周完成率',
      value: `${weeklyCompletionRate}%`,
      hint: '可以结合日历待办回看执行节奏。',
    },
    {
      label: '今日使用',
      value: isVip ? `${aiUsedToday} 次` : `${aiUsedToday} / ${aiLimit} 次`,
      hint: isVip ? '会员已解锁更完整的问题助手服务。' : '升级后可不限次使用问题助手。',
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
        label: '问题助手使用度',
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
        detail: '后续会根据年龄自动切到更细的育儿与成长记录。',
      })
    }

    if (weeklyReports[0]) {
      items.push({
        label: '最近一份周度报告',
        value: dayjs(weeklyReports[0].createdAt).format('YYYY-MM-DD'),
        detail: weeklyReports[0].title,
      })
    }

    return items
  }, [user, weeklyReports])

  const milestones = useMemo(
    () => buildMilestones(stage.lifecycleKey, timeline.length),
    [stage.lifecycleKey, timeline.length],
  )
  const archiveGuides = useMemo(() => ([
    '每周至少完成 1 次日历记录，周报与成长档案会更连续。',
    '遇到关键身体变化或行为变化时，尽量同步补一条原因和处理结果。',
    `当前处于${stage.lifecycleLabel}，建议把最近 2 次重点提醒整理给家人共享。`,
  ]), [stage.lifecycleLabel])

  const exportPreviewLines = useMemo(() => {
    const firstHighlight = weeklyReports[0]?.highlights?.[0]
    return [
      `阶段：${stage.lifecycleLabel}`,
      `${progress.title}：${progress.valueLabel}`,
      `连续打卡：${checkInStreak} 天`,
      `本周完成率：${weeklyCompletionRate}%`,
      `最近周度报告：${weeklyReports[0]?.title ?? '暂无周度报告'}`,
      firstHighlight ? `阶段提醒：${firstHighlight}` : '阶段提醒：持续补充记录后会生成更完整摘要',
    ]
  }, [checkInStreak, progress.title, progress.valueLabel, stage.lifecycleLabel, weeklyCompletionRate, weeklyReports])

  const handleShareArchive = async () => {
    if (!isVip) {
      navigation.navigate('Membership', {
        source: 'growth_archive',
        entryAction: 'growth_archive',
        highlight: '成长档案摘要分享',
      })
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
          stage: stage.lifecycleKey,
          weeklyReportCount: weeklyReports.length,
          isVip,
        },
      })
    } catch (_error) {
      Alert.alert('提示', '分享失败，请稍后再试。')
    }
  }

  const handleContextUpgrade = () => {
    if (!contextCard) {
      return
    }

    void trackAppEvent('app_growth_archive_context_click', {
      page: 'GrowthArchiveScreen',
      properties: {
        source,
        focus,
        highlightCount: contextCard.highlights.length,
      },
    })

    navigation.navigate('Membership', {
      source: 'growth_archive',
      entryAction: 'growth_archive',
      highlight: contextCard.title,
    })
  }

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <StandardCard style={styles.heroCard} elevation={2}>
          <LinearGradient
            colors={['#392C28', '#5E4A43', '#83685D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroRing} />
            <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={styles.heroChipRow}>
                <Chip style={styles.heroChip} textStyle={styles.heroChipText}>
                  {isVip ? '会员成长档案' : '成长档案预览'}
                </Chip>
                <Chip style={styles.heroStageChip} textStyle={styles.heroStageChipText}>
                  {stage.lifecycleLabel}
                </Chip>
              </View>
              <Text style={styles.heroTitle}>把全生命周期变化沉淀成一份可回看的记录</Text>
              <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
            </View>

            <View style={styles.heroSignalRow}>
              <View style={styles.heroSignal}>
                <Text style={styles.heroSignalValue}>{timeline.length}</Text>
                <Text style={styles.heroSignalLabel}>关键节点</Text>
              </View>
              <View style={styles.heroSignalDivider} />
              <View style={styles.heroSignal}>
                <Text style={styles.heroSignalValue}>{weeklyReports.length}</Text>
                <Text style={styles.heroSignalLabel}>周报沉淀</Text>
              </View>
              <View style={styles.heroSignalDivider} />
              <View style={styles.heroSignal}>
                <Text style={styles.heroSignalValue}>{checkInStreak}天</Text>
                <Text style={styles.heroSignalLabel}>连续记录</Text>
              </View>
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
                style={styles.heroActionButton}
              >
                {isVip ? '导出并分享摘要' : '升级解锁完整档案'}
              </Button>
            </View>
            </View>
          </LinearGradient>
        </StandardCard>

        {contextCard ? (
          <Card style={styles.contextCard}>
            <Card.Content>
              <Text style={styles.contextEyebrow}>当前缺口</Text>
              <Text style={styles.contextTitle}>{contextCard.title}</Text>
              <Text style={styles.contextDescription}>{contextCard.description}</Text>
              <View style={styles.contextChipRow}>
                {contextCard.highlights.map((item) => (
                  <Chip
                    key={item}
                    compact
                    style={styles.contextChip}
                    textStyle={styles.contextChipText}
                  >
                    {item}
                  </Chip>
                ))}
              </View>
              <Button
                mode="contained-tonal"
                onPress={handleContextUpgrade}
                style={styles.contextButton}
                textColor={colors.ink}
              >
                去看陪伴方案
              </Button>
            </Card.Content>
          </Card>
        ) : null}

        <View style={styles.metricGrid}>
          {metrics.map((item) => (
            <Card key={item.label} style={styles.metricCard}>
              <Card.Content>
                <View style={[styles.metricIconShell, { backgroundColor: getMetricTone(item.label).shell }]}>
                  <MaterialCommunityIcons
                    name={getMetricIcon(item.label)}
                    size={18}
                    color={getMetricTone(item.label).icon}
                  />
                </View>
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
              <View style={styles.insightHeaderBar}>
                <Text style={styles.insightHeaderTitle}>阶段信号强度</Text>
                <Text style={styles.insightHeaderMeta}>围绕记录、执行和周报同步更新</Text>
              </View>
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
                  <View style={styles.timelineCardTop}>
                    <Text style={styles.timelineLabel}>{item.label}</Text>
                    <View style={styles.timelineDateChip}>
                      <Text style={styles.timelineDateChipText}>{item.value}</Text>
                    </View>
                  </View>
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
            <Text style={styles.sectionMeta}>{stage.lifecycleLabel}</Text>
          </View>

          {milestones.map((item) => (
            <Card key={item.title} style={styles.milestoneCard}>
              <Card.Content style={styles.milestoneContent}>
                <View style={styles.milestoneLead}>
                  <View
                    style={[
                      styles.milestoneIconShell,
                      item.status === 'done' && styles.milestoneBadgeDone,
                      item.status === 'focus' && styles.milestoneBadgeFocus,
                      item.status === 'next' && styles.milestoneBadgeNext,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.status === 'done' ? 'check-bold' : item.status === 'focus' ? 'radar' : 'arrow-top-right'}
                      size={16}
                      color={
                        item.status === 'done'
                          ? colors.green
                          : item.status === 'focus'
                            ? colors.gold
                            : colors.primaryDark
                      }
                    />
                  </View>
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

          <StandardCard style={styles.exportCard} elevation={2}>
            <LinearGradient
              colors={['#4A403B', '#69544C', '#8B7468']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.exportGradient}
            >
            <View style={styles.exportGlow} />
            <View style={styles.exportContent}>
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
            </View>
            </LinearGradient>
          </StandardCard>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>持续建议</Text>
            <Text style={styles.sectionMeta}>长期陪伴</Text>
          </View>
          {archiveGuides.map((item, index) => (
            <View key={item}>
              <Card style={styles.tipCard}>
                <Card.Content style={styles.tipContent}>
                  <View style={styles.tipIconShell}>
                    <MaterialCommunityIcons
                      name={index === 0 ? 'calendar-clock-outline' : index === 1 ? 'stethoscope' : 'account-group-outline'}
                      size={18}
                      color={index === 1 ? colors.techDark : colors.primaryDark}
                    />
                  </View>
                  <Text style={styles.tipText}>{isVip ? item : '升级后查看完整档案建议与导出内容。'}</Text>
                </Card.Content>
              </Card>
            </View>
          ))}
        </View>
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
    paddingBottom: spacing.xl,
  },
  heroCard: {
    borderRadius: 26,
    backgroundColor: 'transparent',
  },
  heroGradient: {
    borderRadius: 26,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -44,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroRing: {
    position: 'absolute',
    top: 28,
    right: 22,
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1,
    borderColor: 'rgba(220,236,238,0.18)',
  },
  heroContent: {
    padding: spacing.md,
  },
  heroTop: {
    gap: spacing.sm,
  },
  heroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  heroStageChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(220,236,238,0.18)',
  },
  heroStageChipText: {
    color: '#dcecee',
    fontWeight: '700',
  },
  heroTitle: {
    color: colors.white,
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: '#eadfd8',
    lineHeight: 22,
  },
  heroSignalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220,236,238,0.08)',
  },
  heroSignal: {
    flex: 1,
    alignItems: 'center',
  },
  heroSignalValue: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  heroSignalLabel: {
    marginTop: 4,
    color: '#d7cbc4',
    fontSize: fontSize.xs,
  },
  heroSignalDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  progressPanel: {
    marginTop: spacing.lg,
    borderRadius: 22,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220,236,238,0.08)',
  },
  progressLabel: {
    color: '#dbcfc7',
    marginBottom: spacing.xs,
  },
  progressValue: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '700',
  },
  progressHint: {
    marginTop: spacing.xs,
    color: '#e7d7cd',
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
  heroActionButton: {
    borderRadius: borderRadius.pill,
  },
  contextCard: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contextEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  contextTitle: {
    marginTop: spacing.xs,
    color: colors.ink,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  contextDescription: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  contextChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  contextChip: {
    backgroundColor: colors.goldLight,
  },
  contextChipText: {
    color: colors.gold,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  contextButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(248,227,214,0.92)',
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
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  metricIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
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
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
  },
  insightHeaderBar: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(184,138,72,0.12)',
  },
  insightHeaderTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  insightHeaderMeta: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
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
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
  },
  timelineCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  timelineLabel: {
    flex: 1,
    color: colors.text,
    fontWeight: '700',
  },
  timelineDateChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(94,126,134,0.1)',
  },
  timelineDateChipText: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  timelineDetail: {
    color: colors.textLight,
    lineHeight: 20,
  },
  milestoneCard: {
    marginBottom: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
  },
  milestoneContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  milestoneLead: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  milestoneIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'transparent',
  },
  exportGradient: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  exportGlow: {
    position: 'absolute',
    top: -20,
    right: -16,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  exportContent: {
    padding: spacing.md,
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
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(184,138,72,0.12)',
  },
  tipContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  tipIconShell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(217,144,122,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    color: colors.text,
    lineHeight: 22,
  },
})
