import React, { useCallback, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { Button, Chip, Snackbar, Text } from 'react-native-paper'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RootStackParamList, TabParamList } from '../navigation/AppNavigator'
import { ScreenContainer, ContentSection, StandardCard } from '../components/layout'
import {
  HeroCard,
  QuickActions,
  InfoGrid,
  WeeklyReportPreview,
  ArticleList,
  UpcomingEvents,
  HomeSkeleton,
  type FeatureEntry,
} from '../components/home'
import { useHomeData } from '../hooks/useHomeData'
import { trackAppEvent } from '../services/analytics'
import { buildHomeChatContext } from '../utils/aiEntryContext'
import { colors, fontSize, spacing, borderRadius } from '../theme'

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  StackNavigationProp<RootStackParamList>
>

const featureEntries: FeatureEntry[] = [
  { title: '知识库', subtitle: '权威内容与中文阅读', icon: 'book-open-page-variant-outline', route: 'Knowledge', type: 'tab' },
  { title: '问题助手', subtitle: '母婴常见问题参考', icon: 'message-question-outline', route: 'Chat', type: 'tab' },
  { title: '孕期档案', subtitle: '集中查看孕周与关键节点', icon: 'file-document-outline', route: 'PregnancyProfile', type: 'stack' },
  { title: '周度报告', subtitle: '每周阶段重点总结', icon: 'chart-box-outline', route: 'WeeklyReport', type: 'stack' },
]
const TAB_SCROLL_BOTTOM_GAP = spacing.xxxl * 4 + spacing.lg

type HomeAction = 'checkin' | 'weekly_report' | 'calendar' | 'chat' | 'membership' | 'growth_archive'

type HomeMomentumItem = {
  key: 'checkin' | 'weekly_report' | 'todo'
  icon: string
  title: string
  description: string
  done: boolean
  actionLabel: string
  action: HomeAction
}

type PostCheckInNextStep = {
  title: string
  description: string
  actionLabel: string
  action: Exclude<HomeAction, 'checkin'>
}

type HomeReturnReason = {
  key: 'streak' | 'weekly_report' | 'todo' | 'event' | 'chat'
  icon: string
  title: string
  description: string
}

type HomeReturnPlan = {
  title: string
  description: string
  badge: string
  actionLabel: string
  action: HomeAction
  reasons: HomeReturnReason[]
}

type HomeMembershipNudge = {
  title: string
  description: string
  highlights: string[]
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>()
  const {
    stage,
    status,
    initialLoading,
    articles,
    upcomingEvents,
    todoStats,
    loadingArticles,
    remainingAiText,
    checkInStreak,
    weeklyCompletionRate,
    weeklyReport,
    statusTags,
    hasCheckedInToday,
    nextCheckInBonus,
    primaryTask,
    suggestedQuestion,
    hasUnreadWeeklyReport,
    handleQuickCheckIn,
    checkInSubmitting,
    refreshing,
    handleRefresh,
  } = useHomeData()
  const [snackMessage, setSnackMessage] = useState('')
  const [postCheckInVisible, setPostCheckInVisible] = useState(false)

  const openCalendar = () => {
    ;(navigation as any).navigate('Main', { screen: 'CalendarTab' })
  }

  const openWeeklyReport = () => {
    navigation.navigate(status === 'active' ? 'WeeklyReport' : 'Membership')
  }

  const postCheckInNextStep = useMemo<PostCheckInNextStep | null>(() => {
    if (!hasCheckedInToday) {
      return null
    }

    if (hasUnreadWeeklyReport) {
      return {
        title: '签到完成，顺手把周报看掉',
        description: '刚完成今天记录时最适合把本周重点浏览一遍，后面更容易继续回来。',
        actionLabel: '查看周报',
        action: 'weekly_report',
      }
    }

    if (upcomingEvents[0]) {
      return {
        title: '签到完成，接着看下一项安排',
        description: `下一条是“${upcomingEvents[0].title}”，现在顺手确认时间最省心。`,
        actionLabel: '去日历',
        action: 'calendar',
      }
    }

    return {
      title: '签到完成，再补一个关键问题',
      description: '继续问一个当前阶段最常见的问题，更容易把今天这次打开用完整。',
      actionLabel: '直接去问',
      action: 'chat',
    }
  }, [hasCheckedInToday, hasUnreadWeeklyReport, upcomingEvents, suggestedQuestion])

  const momentumItems = useMemo<HomeMomentumItem[]>(() => {
    const items: HomeMomentumItem[] = [
      {
        key: 'checkin',
        icon: hasCheckedInToday ? 'check-decagram' : 'calendar-check-outline',
        title: hasCheckedInToday ? '今天已签到' : '补上今天签到',
        description: hasCheckedInToday
          ? `已连续 ${checkInStreak} 天，今天的节奏已经接上了。`
          : nextCheckInBonus
            ? `连续 ${checkInStreak} 天，再坚持到 ${nextCheckInBonus.streak} 天可多拿 ${nextCheckInBonus.bonus} 积分。`
            : '先补一条记录，后面的周报和待办会更有连续感。',
        done: hasCheckedInToday,
        actionLabel: hasCheckedInToday ? '去日历' : '立即签到',
        action: 'checkin',
      },
    ]

    if (status === 'active') {
      items.push({
        key: 'weekly_report',
        icon: hasUnreadWeeklyReport ? 'file-chart-outline' : 'bookmark-check-outline',
        title: hasUnreadWeeklyReport ? '还有新周报没看' : '本周周报已跟进',
        description: hasUnreadWeeklyReport
          ? `${weeklyReport.stageLabel} 的阶段提醒已经生成，现在看最容易接着安排本周重点。`
          : '本周重点已经同步过，后续可以继续补待办或问题助手。',
        done: !hasUnreadWeeklyReport,
        actionLabel: hasUnreadWeeklyReport ? '查看周报' : '再去回顾',
        action: 'weekly_report',
      })
    }

    if (todoStats.total > 0 && todoStats.week) {
      items.push({
        key: 'todo',
        icon: todoStats.completed >= todoStats.total ? 'clipboard-check-outline' : 'clipboard-text-clock-outline',
        title: `孕${todoStats.week}周待办 ${todoStats.completed}/${todoStats.total}`,
        description: todoStats.completed >= todoStats.total
          ? '这周待办已经补齐，保持这个节奏更容易持续回来。'
          : `还差 ${todoStats.total - todoStats.completed} 项，把本周事项补完会更踏实。`,
        done: todoStats.completed >= todoStats.total,
        actionLabel: todoStats.completed >= todoStats.total ? '查看日历' : '继续安排',
        action: 'calendar',
      })
    }

    return items
  }, [
    checkInStreak,
    hasCheckedInToday,
    hasUnreadWeeklyReport,
    nextCheckInBonus,
    status,
    todoStats.completed,
    todoStats.total,
    todoStats.week,
    weeklyReport.stageLabel,
  ])

  const momentumCompletedCount = momentumItems.filter((item) => item.done).length
  const momentumNextStep = momentumItems.find((item) => !item.done) ?? null

  const returnPlan = useMemo<HomeReturnPlan>(() => {
    const reasons: HomeReturnReason[] = []

    if (nextCheckInBonus) {
      reasons.push({
        key: 'streak',
        icon: 'calendar-sync-outline',
        title: `${nextCheckInBonus.streak} 天节点还差一步步`,
        description: `目前连续 ${checkInStreak} 天，再回来签到就更接近 +${nextCheckInBonus.bonus} 积分奖励。`,
      })
    }

    if (hasUnreadWeeklyReport) {
      reasons.push({
        key: 'weekly_report',
        icon: 'file-chart-outline',
        title: '新周报还没消化',
        description: `${weeklyReport.stageLabel} 的重点已经生成，明天回来还能直接接着看。`,
      })
    }

    if (todoStats.total > 0 && todoStats.completed < todoStats.total) {
      reasons.push({
        key: 'todo',
        icon: 'clipboard-text-clock-outline',
        title: '本周待办还没补齐',
        description: `还差 ${todoStats.total - todoStats.completed} 项，把这周节奏接住会更轻松。`,
      })
    }

    if (upcomingEvents[0]) {
      reasons.push({
        key: 'event',
        icon: 'calendar-heart',
        title: `接下来还有「${upcomingEvents[0].title}」`,
        description: '首页已经帮你把下一个关键安排接住了，下次打开就能继续往前推。',
      })
    }

    if (reasons.length === 0) {
      reasons.push({
        key: 'chat',
        icon: 'message-question-outline',
        title: '留一个下次还会打开的问题',
        description: '把当前阶段最想确认的一件事先记住，下次回来会更有目标。',
      })
    }

    if (!hasCheckedInToday) {
      return {
        title: '先把今天接上，明天才不会断档',
        description: '连续记录的核心不是一次做很多，而是今天先不掉线，明天继续回来就会越来越顺。',
        badge: `${weeklyCompletionRate}%`,
        actionLabel: '先去签到',
        action: 'checkin',
        reasons: reasons.slice(0, 3),
      }
    }

    if (momentumNextStep) {
      return {
        title: '这周已经接住一部分，给明天留个继续回来的理由',
        description: '把下一步目标钉在首页，比单次打开后立刻离开更容易形成习惯。',
        badge: `${weeklyCompletionRate}%`,
        actionLabel: momentumNextStep.actionLabel,
        action: momentumNextStep.action,
        reasons: reasons.slice(0, 3),
      }
    }

    return {
      title: '本周节奏已经跟上，继续把陪伴沉淀下来',
      description: '签到、周报、待办和问题助手都已经接起来了，后面更适合做长期积累。',
      badge: `${weeklyCompletionRate}%`,
      actionLabel: '看看成长档案',
      action: 'growth_archive',
      reasons: reasons.slice(0, 3),
    }
  }, [
    checkInStreak,
    hasCheckedInToday,
    hasUnreadWeeklyReport,
    momentumNextStep,
    nextCheckInBonus,
    todoStats.completed,
    todoStats.total,
    upcomingEvents,
    weeklyCompletionRate,
    weeklyReport.stageLabel,
  ])

  const membershipNudge = useMemo<HomeMembershipNudge | null>(() => {
    if (status === 'active') {
      return null
    }

    const highlights = [
      '连续追问不中断',
      weeklyReport.id === 'preview-weekly-report' || weeklyReport.id === 'fallback' ? '完整周报可持续沉淀' : '阶段周报继续累计',
      '成长档案长期回看',
    ]

    if (!hasCheckedInToday) {
      return {
        title: '把签到、周报和问答串成连续陪伴',
        description: `现在还是基础模式，问题助手今日还剩 ${remainingAiText}。开通后，今天的签到和后续周报会接成一条完整时间线。`,
        highlights,
      }
    }

    return {
      title: '别让这周记录停在预览版',
      description: `你已经开始形成节奏了，但周报、连续追问和成长档案还没有完全打通。现在升级，后面的每次打开都会更有反馈。`,
      highlights,
    }
  }, [hasCheckedInToday, remainingAiText, status, weeklyReport.id])

  const handleHomeAction = async (action: HomeAction) => {
    if (action === 'checkin') {
      const message = await handleQuickCheckIn()
      if (message.startsWith('今日已签到')) {
        setPostCheckInVisible(true)
      }
      setSnackMessage(message)
      return
    }

    if (action === 'calendar') {
      openCalendar()
      return
    }

    if (action === 'weekly_report') {
      openWeeklyReport()
      return
    }

    if (action === 'membership') {
      navigation.navigate('Membership', {
        source: 'home_retention',
        entryAction: 'membership',
        highlight: returnPlan.title,
      })
      return
    }

    if (action === 'growth_archive') {
      navigation.navigate('GrowthArchive', {
        source: 'home_retention',
        focus: 'timeline',
      })
      return
    }

    ;(navigation as any).navigate('Main', {
      screen: 'Chat',
      params: {
        prefillQuestion: suggestedQuestion,
        prefillContext: buildHomeChatContext(stage.lifecycleKey),
        autoSend: true,
        source: 'home_suggested_question',
      },
    })
  }

  const handleFeaturePress = (entry: FeatureEntry) => {
    if (entry.type === 'stack') {
      if (entry.route === 'Calendar') {
        openCalendar()
      } else if (entry.route === 'PregnancyProfile') {
        navigation.navigate('PregnancyProfile')
      } else if (entry.route === 'WeeklyReport') {
        navigation.navigate('WeeklyReport')
      } else {
        navigation.navigate('Membership', {
          source: 'home_upgrade',
          entryAction: 'membership',
          highlight: entry.title,
        })
      }
      return
    }
    ;(navigation as any).navigate('Main', { screen: entry.route })
  }

  const handleQuickCheckInPress = async () => {
    void trackAppEvent('app_home_checkin_click', {
      page: 'HomeScreen',
      properties: {
        hasCheckedInToday,
        checkInStreak,
      },
    })

    if (hasCheckedInToday) {
      openCalendar()
      return
    }

    const message = await handleQuickCheckIn()
    if (message.startsWith('今日已签到')) {
      setPostCheckInVisible(true)
    }
    setSnackMessage(message)
  }

  const handlePrimaryTaskPress = async () => {
    void trackAppEvent('app_home_primary_task_click', {
      page: 'HomeScreen',
      properties: {
        action: primaryTask.action,
        hasCheckedInToday,
        hasUnreadWeeklyReport,
      },
    })

    await handleHomeAction(primaryTask.action)
  }

  const handleWeeklyReportPress = () => {
    void trackAppEvent('app_home_weekly_report_click', {
      page: 'HomeScreen',
      properties: {
        status,
        unread: hasUnreadWeeklyReport,
        latestReportId: weeklyReport.id,
      },
    })
    openWeeklyReport()
  }

  const handleSuggestedQuestionPress = () => {
    void trackAppEvent('app_home_suggested_question_click', {
      page: 'HomeScreen',
      properties: {
        status,
        question: suggestedQuestion,
        stage: stage.lifecycleKey,
      },
    })

    ;(navigation as any).navigate('Main', {
      screen: 'Chat',
      params: {
        prefillQuestion: suggestedQuestion,
        prefillContext: buildHomeChatContext(stage.lifecycleKey),
        autoSend: true,
        source: 'home_suggested_question',
      },
    })
  }

  const handlePostCheckInNextPress = () => {
    if (!postCheckInNextStep) {
      return
    }

    void trackAppEvent('app_home_post_checkin_next_click', {
      page: 'HomeScreen',
      properties: {
        action: postCheckInNextStep.action,
        hasUnreadWeeklyReport,
        suggestedQuestion,
      },
    })

    setPostCheckInVisible(false)

    void handleHomeAction(postCheckInNextStep.action)
  }

  const handleMomentumPress = () => {
    const target = momentumNextStep ?? {
      key: 'todo',
      action: 'chat' as HomeAction,
      actionLabel: '直接去问',
      title: '本周节奏已经跟上',
      description: '可以顺手再问一个问题，增加本周再次打开的理由。',
      icon: 'message-question-outline',
      done: true,
    }

    void trackAppEvent('app_home_momentum_click', {
      page: 'HomeScreen',
      properties: {
        action: target.action,
        step: target.key,
        completedCount: momentumCompletedCount,
        totalCount: momentumItems.length,
      },
    })

    void handleHomeAction(target.action)
  }

  const handleReturnPlanPress = () => {
    void trackAppEvent('app_home_return_plan_click', {
      page: 'HomeScreen',
      properties: {
        action: returnPlan.action,
        badge: returnPlan.badge,
        reasonCount: returnPlan.reasons.length,
        hasCheckedInToday,
        hasUnreadWeeklyReport,
      },
    })

    void handleHomeAction(returnPlan.action)
  }

  const handleMembershipNudgePress = () => {
    void trackAppEvent('app_home_membership_nudge_click', {
      page: 'HomeScreen',
      properties: {
        source: 'home_retention',
        hasCheckedInToday,
        weeklyCompletionRate,
        highlightCount: membershipNudge?.highlights.length ?? 0,
      },
    })

    navigation.navigate('Membership', {
      source: 'home_upgrade',
      entryAction: 'membership',
      highlight: membershipNudge?.title,
    })
  }

  const handleGrowthArchivePress = () => {
    void trackAppEvent('app_home_growth_archive_click', {
      page: 'HomeScreen',
      properties: {
        source: membershipNudge ? 'membership_nudge' : 'return_plan',
        status,
        weeklyCompletionRate,
      },
    })

    navigation.navigate('GrowthArchive', {
      source: 'home_retention',
      focus: 'export',
    })
  }

  useFocusEffect(
    useCallback(() => {
      if (initialLoading) {
        return undefined
      }

      void trackAppEvent('app_home_v1_exposure', {
        page: 'HomeScreen',
        properties: {
          status,
          primaryTaskAction: primaryTask.action,
          hasCheckedInToday,
          hasUnreadWeeklyReport,
          latestReportId: weeklyReport.id,
          checkInStreak,
          weeklyCompletionRate,
        },
      })

      void trackAppEvent('app_home_return_plan_exposure', {
        page: 'HomeScreen',
        properties: {
          action: returnPlan.action,
          badge: returnPlan.badge,
          reasonCount: returnPlan.reasons.length,
          hasCheckedInToday,
          hasUnreadWeeklyReport,
        },
      })

      if (membershipNudge) {
        void trackAppEvent('app_home_membership_nudge_exposure', {
          page: 'HomeScreen',
          properties: {
            status,
            hasCheckedInToday,
            weeklyCompletionRate,
            highlightCount: membershipNudge.highlights.length,
          },
        })
      }

      return undefined
    }, [
      checkInStreak,
      hasCheckedInToday,
      hasUnreadWeeklyReport,
      initialLoading,
      membershipNudge,
      primaryTask.action,
      returnPlan.action,
      returnPlan.badge,
      returnPlan.reasons.length,
      status,
      weeklyCompletionRate,
      weeklyReport.id,
    ]),
  )

  if (initialLoading) {
    return (
      <ScreenContainer>
        <HomeSkeleton />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <ContentSection style={styles.heroSection}>
          <HeroCard
            stage={stage}
            status={status}
            remainingAiText={remainingAiText}
            checkInStreak={checkInStreak}
            weeklyCompletionRate={weeklyCompletionRate}
            actionLabel={stage.actionLabel}
            onAction={() =>
              status === 'active'
                ? openCalendar()
                : navigation.navigate('Membership', {
                    source: 'home_upgrade',
                    entryAction: 'membership',
                    highlight: '首页主视觉升级入口',
                  })
            }
          />
        </ContentSection>

        <ContentSection style={styles.compactSection}>
          <StandardCard style={styles.focusCard} elevation={2}>
            <LinearGradient
              colors={['rgba(255, 247, 240, 0.98)', 'rgba(245, 234, 223, 0.98)', 'rgba(220, 236, 238, 0.9)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.focusGradient}
            >
              <View style={styles.focusGlow} />
              <View style={styles.focusTopRow}>
                <View style={styles.focusEyebrowRow}>
                  <View style={styles.focusSignalDot} />
                  <Text style={styles.focusEyebrow}>今日任务</Text>
                </View>
                <Chip compact style={styles.focusChip} textStyle={styles.focusChipText}>
                  {primaryTask.action === 'checkin' ? '优先完成' : '现在去做'}
                </Chip>
              </View>

              <Text style={styles.focusTitle}>{primaryTask.title}</Text>
              <Text style={styles.focusDescription}>{primaryTask.description}</Text>

              {postCheckInVisible && postCheckInNextStep ? (
                <View style={styles.postCheckInPanel}>
                  <View style={styles.postCheckInHeader}>
                    <View style={styles.postCheckInBadge}>
                      <MaterialCommunityIcons name="check-decagram" size={14} color={colors.green} />
                      <Text style={styles.postCheckInBadgeText}>已完成签到</Text>
                    </View>
                    <Text style={styles.postCheckInTitle}>{postCheckInNextStep.title}</Text>
                  </View>
                  <Text style={styles.postCheckInDescription}>{postCheckInNextStep.description}</Text>
                  <Button
                    mode="contained-tonal"
                    onPress={handlePostCheckInNextPress}
                    style={styles.postCheckInButton}
                    textColor={colors.ink}
                  >
                    {postCheckInNextStep.actionLabel}
                  </Button>
                </View>
              ) : null}

              <View style={styles.focusFooter}>
                <View style={styles.focusMeta}>
                  <MaterialCommunityIcons name="radar" size={15} color={colors.techDark} />
                  <Text style={styles.focusMetaText}>先完成这一项，首页和周报会更有反馈</Text>
                </View>
                <Button
                  mode="contained"
                  buttonColor={primaryTask.action === 'checkin' ? colors.techDark : colors.ink}
                  textColor={colors.white}
                  onPress={() => void handlePrimaryTaskPress()}
                  style={styles.focusActionButton}
                  loading={primaryTask.action === 'checkin' ? checkInSubmitting : false}
                >
                  {primaryTask.actionLabel}
                </Button>
              </View>
            </LinearGradient>
          </StandardCard>
        </ContentSection>

        <ContentSection style={styles.compactSection}>
          <StandardCard style={styles.checkInCard}>
            <View style={styles.checkInCardRow}>
              <View style={styles.checkInLead}>
                <View style={[styles.checkInIconShell, hasCheckedInToday && styles.checkInIconShellDone]}>
                  <MaterialCommunityIcons
                    name={hasCheckedInToday ? 'check-decagram' : 'calendar-check-outline'}
                    size={18}
                    color={hasCheckedInToday ? colors.green : colors.techDark}
                  />
                </View>
                <View style={styles.checkInTextWrap}>
                  <Text style={styles.checkInTitle}>{hasCheckedInToday ? '今天已完成签到' : '今天还没签到'}</Text>
                  <Text style={styles.checkInSubtitle}>
                    {hasCheckedInToday
                      ? `已连续 ${checkInStreak} 天，继续保持就会进入下一档奖励`
                      : `连续 ${checkInStreak} 天${nextCheckInBonus ? ` · 下一档 ${nextCheckInBonus.streak} 天 +${nextCheckInBonus.bonus} 积分` : ''}`}
                  </Text>
                </View>
              </View>
              <Button
                mode={hasCheckedInToday ? 'outlined' : 'contained-tonal'}
                onPress={() => void handleQuickCheckInPress()}
                textColor={hasCheckedInToday ? colors.techDark : colors.ink}
                style={styles.checkInActionButton}
                loading={checkInSubmitting}
              >
                {hasCheckedInToday ? '去日历' : '立即签到'}
              </Button>
            </View>
          </StandardCard>
        </ContentSection>

        {momentumItems.length > 1 ? (
          <ContentSection style={styles.compactSection}>
            <StandardCard style={styles.momentumCard}>
              <View style={styles.momentumHeader}>
                <View style={styles.momentumHeaderTextWrap}>
                  <Text style={styles.momentumEyebrow}>本周推进度</Text>
                  <Text style={styles.momentumTitle}>
                    已完成 {momentumCompletedCount}/{momentumItems.length}
                  </Text>
                  <Text style={styles.momentumSubtitle}>
                    {momentumNextStep
                      ? `下一步建议先做「${momentumNextStep.title}」`
                      : '本周关键动作已经跟上，继续保持这个频率即可。'}
                  </Text>
                </View>
                <View style={styles.momentumBadge}>
                  <Text style={styles.momentumBadgeText}>
                    {Math.round((momentumCompletedCount / momentumItems.length) * 100)}%
                  </Text>
                </View>
              </View>

              <View style={styles.momentumBarRow}>
                {momentumItems.map((item) => (
                  <View
                    key={item.key}
                    style={[styles.momentumBarSegment, item.done && styles.momentumBarSegmentDone]}
                  />
                ))}
              </View>

              <View style={styles.momentumList}>
                {momentumItems.map((item) => (
                  <View key={item.key} style={styles.momentumItem}>
                    <View style={[styles.momentumIconShell, item.done && styles.momentumIconShellDone]}>
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={18}
                        color={item.done ? colors.green : colors.techDark}
                      />
                    </View>
                    <View style={styles.momentumItemBody}>
                      <View style={styles.momentumItemTitleRow}>
                        <Text style={styles.momentumItemTitle}>{item.title}</Text>
                        <View style={[styles.momentumStatusChip, item.done && styles.momentumStatusChipDone]}>
                          <Text style={[styles.momentumStatusText, item.done && styles.momentumStatusTextDone]}>
                            {item.done ? '已完成' : '待继续'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.momentumItemDescription}>{item.description}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {momentumNextStep?.action !== 'checkin' ? (
                <Button
                  mode="contained-tonal"
                  onPress={handleMomentumPress}
                  style={styles.momentumActionButton}
                  textColor={colors.ink}
                >
                  {momentumNextStep ? momentumNextStep.actionLabel : '再问个问题'}
                </Button>
              ) : null}
            </StandardCard>
          </ContentSection>
        ) : null}

        <ContentSection style={styles.compactSection}>
          <StandardCard style={styles.returnPlanCard}>
            <View style={styles.returnPlanHeader}>
              <View style={styles.returnPlanHeaderText}>
                <Text style={styles.returnPlanEyebrow}>回访理由</Text>
                <Text style={styles.returnPlanTitle}>{returnPlan.title}</Text>
                <Text style={styles.returnPlanDescription}>{returnPlan.description}</Text>
              </View>
              <View style={styles.returnPlanBadge}>
                <Text style={styles.returnPlanBadgeLabel}>本周完成</Text>
                <Text style={styles.returnPlanBadgeValue}>{returnPlan.badge}</Text>
              </View>
            </View>

            <View style={styles.returnPlanReasonList}>
              {returnPlan.reasons.map((reason) => (
                <View key={reason.key} style={styles.returnPlanReasonItem}>
                  <View style={styles.returnPlanReasonIcon}>
                    <MaterialCommunityIcons name={reason.icon} size={16} color={colors.techDark} />
                  </View>
                  <View style={styles.returnPlanReasonBody}>
                    <Text style={styles.returnPlanReasonTitle}>{reason.title}</Text>
                    <Text style={styles.returnPlanReasonText}>{reason.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.returnPlanFooter}>
              <Text style={styles.returnPlanHint}>把回来的理由写清楚，第二次打开才更容易发生。</Text>
              {returnPlan.action !== 'checkin' ? (
                <Button
                  mode="contained-tonal"
                  onPress={handleReturnPlanPress}
                  style={styles.returnPlanActionButton}
                  textColor={colors.ink}
                >
                  {returnPlan.actionLabel}
                </Button>
              ) : null}
            </View>
          </StandardCard>
        </ContentSection>

        {membershipNudge ? (
          <ContentSection style={styles.compactSection}>
            <StandardCard style={styles.membershipNudgeCard}>
              <LinearGradient
                colors={['rgba(63, 42, 34, 0.96)', 'rgba(99, 66, 54, 0.96)', 'rgba(197, 108, 71, 0.88)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.membershipNudgeGradient}
              >
                <View style={styles.membershipNudgeGlow} />
                <View style={styles.membershipNudgeHeader}>
                  <View style={styles.membershipNudgeBadge}>
                    <Text style={styles.membershipNudgeBadgeText}>v3 陪伴升级</Text>
                  </View>
                  <Text style={styles.membershipNudgeTitle}>{membershipNudge.title}</Text>
                  <Text style={styles.membershipNudgeDescription}>{membershipNudge.description}</Text>
                </View>

                <View style={styles.membershipNudgeChipRow}>
                  {membershipNudge.highlights.map((highlight) => (
                    <Chip
                      key={highlight}
                      compact
                      style={styles.membershipNudgeChip}
                      textStyle={styles.membershipNudgeChipText}
                    >
                      {highlight}
                    </Chip>
                  ))}
                </View>

                <View style={styles.membershipNudgeFooter}>
                  <Button
                    mode="contained"
                    buttonColor={colors.white}
                    textColor={colors.ink}
                    onPress={handleMembershipNudgePress}
                    style={styles.membershipNudgePrimaryButton}
                  >
                    看陪伴方案
                  </Button>
                  <Button
                    mode="text"
                    textColor={colors.white}
                    onPress={handleGrowthArchivePress}
                  >
                    先看成长档案
                  </Button>
                </View>
              </LinearGradient>
            </StandardCard>
          </ContentSection>
        ) : null}

        {status === 'active' ? (
          <ContentSection style={styles.compactSection}>
            <StandardCard onPress={handleWeeklyReportPress} style={styles.reportAlertCard}>
              <View style={styles.reportAlertRow}>
                <View style={styles.reportAlertLead}>
                  <View style={[styles.reportAlertBadge, hasUnreadWeeklyReport && styles.reportAlertBadgeUnread]}>
                    <Text style={[styles.reportAlertBadgeText, hasUnreadWeeklyReport && styles.reportAlertBadgeTextUnread]}>
                      {hasUnreadWeeklyReport ? '本周新报' : '周报中心'}
                    </Text>
                  </View>
                  <Text style={styles.reportAlertTitle}>{weeklyReport.title}</Text>
                  <Text style={styles.reportAlertSubtitle}>
                    {weeklyReport.stageLabel} · {dayjs(weeklyReport.createdAt).format('MM-DD')} 生成
                  </Text>
                </View>
                <View style={styles.reportAlertAction}>
                  <Text style={styles.reportAlertActionText}>{hasUnreadWeeklyReport ? '立即查看' : '去回顾'}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primaryDark} />
                </View>
              </View>
            </StandardCard>
          </ContentSection>
        ) : null}

        <ContentSection style={styles.compactSection}>
          <QuickActions entries={featureEntries} onPress={handleFeaturePress} />
        </ContentSection>

        <ContentSection style={styles.compactSection}>
          <InfoGrid
            focusTitle={stage.focusTitle}
            reminder={stage.reminder}
            todayTip={status === 'active' ? stage.aiTipFull : stage.aiTipPreview}
          />
        </ContentSection>

        <ContentSection style={styles.compactSection}>
          <StandardCard style={styles.questionCard}>
            <View style={styles.questionCardRow}>
              <View style={styles.questionLead}>
                <View style={styles.questionIconShell}>
                  <MaterialCommunityIcons name="message-question-outline" size={18} color={colors.techDark} />
                </View>
                <View style={styles.questionTextWrap}>
                  <Text style={styles.questionEyebrow}>建议你现在问</Text>
                  <Text style={styles.questionTitle}>{suggestedQuestion}</Text>
                </View>
              </View>
              <Button
                mode="contained-tonal"
                onPress={handleSuggestedQuestionPress}
                style={styles.questionActionButton}
                textColor={colors.ink}
              >
                直接问
              </Button>
            </View>
          </StandardCard>
        </ContentSection>

        {statusTags.length > 0 ? (
          <ContentSection>
            <View style={styles.tagRow}>
              {statusTags.map((tag) => (
                <Chip key={tag} compact style={styles.summaryChip} textStyle={styles.summaryChipText}>
                  {tag}
                </Chip>
              ))}
            </View>
          </ContentSection>
        ) : null}

        <ContentSection>
          <WeeklyReportPreview
            report={weeklyReport}
            status={status}
            onViewMore={() => {
              if (status === 'active') {
                navigation.navigate('WeeklyReport')
                return
              }

              navigation.navigate('Membership', {
                source: 'home_upgrade',
                entryAction: 'weekly_report',
                highlight: weeklyReport.title,
              })
            }}
          />
        </ContentSection>

        <ContentSection style={styles.compactSection}>
          <UpcomingEvents
            events={upcomingEvents}
            onViewAll={openCalendar}
          />
        </ContentSection>

        <ContentSection style={styles.compactSection}>
          <ArticleList
            articles={articles}
            loading={loadingArticles}
            readingTopic={stage.readingTopic}
            onPress={(slug) => navigation.navigate('KnowledgeDetail', { slug })}
          />
        </ContentSection>

      </ScrollView>
      <Snackbar visible={Boolean(snackMessage)} onDismiss={() => setSnackMessage('')} duration={2200}>
        {snackMessage}
      </Snackbar>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: TAB_SCROLL_BOTTOM_GAP,
  },
  heroSection: {
    paddingTop: spacing.sm + 2,
    marginBottom: spacing.md + 2,
  },
  compactSection: {
    marginBottom: spacing.md + 2,
  },
  focusCard: {
    backgroundColor: 'transparent',
  },
  focusGradient: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    overflow: 'hidden',
  },
  focusGlow: {
    position: 'absolute',
    top: -18,
    right: -10,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
  },
  focusTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  focusEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  focusSignalDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primaryDark,
  },
  focusEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  focusChip: {
    backgroundColor: 'rgba(255, 253, 249, 0.86)',
  },
  focusChipText: {
    color: colors.techDark,
    fontWeight: '700',
    fontSize: fontSize.xs,
  },
  focusTitle: {
    marginTop: spacing.sm,
    color: colors.ink,
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  focusDescription: {
    marginTop: spacing.xs,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  postCheckInPanel: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(90, 142, 120, 0.14)',
    gap: spacing.xs,
  },
  postCheckInHeader: {
    gap: spacing.xs,
  },
  postCheckInBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(227, 243, 234, 0.95)',
  },
  postCheckInBadgeText: {
    color: colors.green,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  postCheckInTitle: {
    color: colors.ink,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  postCheckInDescription: {
    color: colors.textSecondary,
    lineHeight: 19,
  },
  postCheckInButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(248,227,214,0.92)',
  },
  focusFooter: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  focusMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  focusMetaText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  focusActionButton: {
    borderRadius: borderRadius.pill,
  },
  checkInCard: {
    backgroundColor: 'rgba(255, 251, 247, 0.92)',
  },
  checkInCardRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  checkInLead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkInIconShell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.techLight,
  },
  checkInIconShellDone: {
    backgroundColor: colors.successSoft,
  },
  checkInTextWrap: {
    flex: 1,
    gap: 2,
  },
  checkInTitle: {
    color: colors.ink,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  checkInSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  checkInActionButton: {
    borderRadius: borderRadius.pill,
  },
  momentumCard: {
    backgroundColor: 'rgba(255, 252, 248, 0.95)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  momentumHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  momentumHeaderTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  momentumEyebrow: {
    color: colors.techDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  momentumTitle: {
    color: colors.ink,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  momentumSubtitle: {
    color: colors.textSecondary,
    lineHeight: 19,
  },
  momentumBadge: {
    minWidth: 56,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    backgroundColor: colors.techLight,
  },
  momentumBadgeText: {
    color: colors.techDark,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  momentumBarRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  momentumBarSegment: {
    flex: 1,
    height: 7,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  momentumBarSegmentDone: {
    backgroundColor: colors.green,
  },
  momentumList: {
    gap: spacing.sm,
  },
  momentumItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  momentumIconShell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.techLight,
  },
  momentumIconShellDone: {
    backgroundColor: colors.successSoft,
  },
  momentumItemBody: {
    flex: 1,
    gap: spacing.xs,
  },
  momentumItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  momentumItemTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  momentumStatusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  momentumStatusChipDone: {
    backgroundColor: colors.successSoft,
  },
  momentumStatusText: {
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  momentumStatusTextDone: {
    color: colors.green,
  },
  momentumItemDescription: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  momentumActionButton: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(248,227,214,0.9)',
  },
  returnPlanCard: {
    backgroundColor: 'rgba(252, 248, 243, 0.96)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  returnPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  returnPlanHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  returnPlanEyebrow: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  returnPlanTitle: {
    color: colors.ink,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  returnPlanDescription: {
    color: colors.textSecondary,
    lineHeight: 19,
  },
  returnPlanBadge: {
    minWidth: 72,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.goldLight,
    alignItems: 'center',
    gap: 2,
  },
  returnPlanBadgeLabel: {
    color: colors.gold,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  returnPlanBadgeValue: {
    color: colors.ink,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  returnPlanReasonList: {
    gap: spacing.sm,
  },
  returnPlanReasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  returnPlanReasonIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.techLight,
  },
  returnPlanReasonBody: {
    flex: 1,
    gap: 2,
  },
  returnPlanReasonTitle: {
    color: colors.ink,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  returnPlanReasonText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  returnPlanFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  returnPlanHint: {
    flex: 1,
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  returnPlanActionButton: {
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(248,227,214,0.92)',
  },
  membershipNudgeCard: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  membershipNudgeGradient: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    gap: spacing.md,
  },
  membershipNudgeGlow: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  membershipNudgeHeader: {
    gap: spacing.xs,
  },
  membershipNudgeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  membershipNudgeBadgeText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  membershipNudgeTitle: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: '700',
    lineHeight: 25,
  },
  membershipNudgeDescription: {
    color: 'rgba(255, 249, 244, 0.82)',
    lineHeight: 20,
  },
  membershipNudgeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  membershipNudgeChip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  membershipNudgeChipText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  membershipNudgeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  membershipNudgePrimaryButton: {
    borderRadius: borderRadius.pill,
  },
  reportAlertCard: {
    backgroundColor: 'rgba(255, 251, 247, 0.94)',
  },
  reportAlertRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  reportAlertLead: {
    flex: 1,
  },
  reportAlertBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.xs,
  },
  reportAlertBadgeUnread: {
    backgroundColor: colors.goldLight,
  },
  reportAlertBadgeText: {
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  reportAlertBadgeTextUnread: {
    color: colors.gold,
  },
  reportAlertTitle: {
    color: colors.ink,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  reportAlertSubtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  reportAlertAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportAlertActionText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  questionCard: {
    backgroundColor: 'rgba(255, 250, 245, 0.96)',
  },
  questionCardRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  questionLead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  questionIconShell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,236,238,0.9)',
  },
  questionTextWrap: {
    flex: 1,
    gap: 2,
  },
  questionEyebrow: {
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  questionTitle: {
    color: colors.ink,
    fontSize: fontSize.md,
    fontWeight: '700',
    lineHeight: 20,
  },
  questionActionButton: {
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(248,227,214,0.9)',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  summaryChipText: {
    color: colors.inkSoft,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
})
