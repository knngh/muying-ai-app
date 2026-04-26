import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import dayjs from 'dayjs'
import { articleApi, calendarApi, checkinApi } from '../api/modules'
import type {
  Article,
  CalendarEvent,
  CheckinStatus,
  PaginatedResponse,
  PregnancyCustomTodo,
  PregnancyTodoProgress,
} from '../api/modules'
import { useAppStore } from '../stores/appStore'
import { useMembershipStore } from '../stores/membershipStore'
import type { WeeklyReport } from '../stores/membershipStore'
import { eventTypeLabels } from '../theme'
import { buildHomeSuggestedQuestion } from '../utils/aiEntryPrompts'
import { getStageSummary } from '../utils/stage'
import { getLastSeenWeeklyReportId } from '../utils/weeklyReportRead'
import {
  getKnowledgeStagePriorityMapFromStages,
  getKnowledgeStageQueryFromStages,
} from '../utils/knowledgeStage'
import { calculatePregnancyWeekFromDueDate } from '../utils'
import pregnancyWeekGuide from '../../../shared/data/pregnancy-week-guide.json'
import { isChineseKnowledgeSource } from '../../../shared/utils/knowledge-source'

type PregnancyWeekGuideItem = {
  week: number
  content?: {
    todo?: Array<{
      type?: string
      title: string
      desc: string
    }>
  }
}

type HomePrimaryTaskAction = 'checkin' | 'calendar' | 'weekly_report' | 'chat'

type HomePrimaryTask = {
  title: string
  description: string
  actionLabel: string
  action: HomePrimaryTaskAction
}

const CHECKIN_BONUS_TIERS = [
  { streak: 3, bonus: 5 },
  { streak: 7, bonus: 10 },
  { streak: 14, bonus: 15 },
  { streak: 30, bonus: 25 },
] as const

function getNextCheckinBonus(streak: number) {
  return CHECKIN_BONUS_TIERS.find((tier) => streak < tier.streak) ?? null
}

function getSourcePriority(article: Article): number {
  if (isChineseKnowledgeSource(article)) {
    return 0
  }

  if (article.sourceLanguage?.startsWith('en') || article.sourceLocale?.startsWith('en')) {
    return 1
  }

  return 2
}

export function useHomeData() {
  const user = useAppStore((state) => state.user)
  const {
    status,
    aiUsedToday,
    aiLimit,
    weeklyCompletionRate,
    checkInStreak,
    weeklyReports,
    hydrated,
    ensureFreshQuota,
  } = useMembershipStore()

  const [articles, setArticles] = useState<Article[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [todoStats, setTodoStats] = useState<{ week: number | null; total: number; completed: number }>({
    week: null,
    total: 0,
    completed: 0,
  })
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [latestSeenWeeklyReportId, setLatestSeenWeeklyReportId] = useState<string | null>(null)
  const [checkInSubmitting, setCheckInSubmitting] = useState(false)
  const [checkinStatus, setCheckinStatus] = useState<CheckinStatus | null>(null)

  const stage = useMemo(() => getStageSummary(user), [user])
  const currentPregnancyWeek = useMemo(
    () => (user?.dueDate ? calculatePregnancyWeekFromDueDate(user.dueDate) : null),
    [user?.dueDate],
  )
  const currentWeekGuide = useMemo(
    () => (pregnancyWeekGuide as PregnancyWeekGuideItem[]).find((item) => item.week === currentPregnancyWeek) ?? null,
    [currentPregnancyWeek],
  )

  const loadArticles = useCallback(async () => {
    setLoadingArticles(true)
    try {
      let nextArticles: Article[] = []
      const stageQuery = getKnowledgeStageQueryFromStages(stage.knowledgeStages)
      const stagePriority = getKnowledgeStagePriorityMapFromStages(stage.knowledgeStages)

      const sortStageArticles = (list: Article[]) => [...list].sort((left, right) => {
        const leftPriority = stagePriority.get(left.stage || '') ?? Number.MAX_SAFE_INTEGER
        const rightPriority = stagePriority.get(right.stage || '') ?? Number.MAX_SAFE_INTEGER
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority
        }

        const sourceDiff = getSourcePriority(left) - getSourcePriority(right)
        if (sourceDiff !== 0) {
          return sourceDiff
        }

        const leftTime = new Date(left.publishedAt || left.createdAt || 0).getTime() || 0
        const rightTime = new Date(right.publishedAt || right.createdAt || 0).getTime() || 0
        return rightTime - leftTime
      })

      if (stageQuery) {
        const response = (await articleApi.getList({
          pageSize: 4,
          contentType: 'authority',
          sort: 'latest',
          stage: stageQuery,
        })) as PaginatedResponse<Article>
        if ((response.list || []).length > 0) {
          nextArticles = sortStageArticles(response.list || []).slice(0, 4)
        }
      }

      if (nextArticles.length === 0) {
        for (const keyword of stage.knowledgeKeywords) {
          const response = (await articleApi.getList({
            pageSize: 4,
            contentType: 'authority',
            sort: 'latest',
            keyword,
          })) as PaginatedResponse<Article>
          if ((response.list || []).length > 0) {
            nextArticles = response.list || []
            break
          }
        }
      }

      if (nextArticles.length === 0) {
        const fallbackResponse = (await articleApi.getList({
          pageSize: 4,
          contentType: 'authority',
          sort: 'latest',
        })) as PaginatedResponse<Article>
        nextArticles = fallbackResponse.list || []
      }

      setArticles(nextArticles)
    } catch (_error) {
      setArticles([])
    } finally {
      setLoadingArticles(false)
    }
  }, [stage.knowledgeKeywords, stage.knowledgeStages])

  const loadHomeCalendar = useCallback(async () => {
    try {
      const startDate = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 7)
      const todayString = dayjs().format('YYYY-MM-DD')

      const [events, customTodos, progress] = await Promise.all([
        calendarApi.getEvents({
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
        }) as Promise<CalendarEvent[]>,
        stage.kind === 'pregnant' && currentPregnancyWeek
          ? (calendarApi.getCustomTodos({ week: currentPregnancyWeek }) as Promise<PregnancyCustomTodo[]>)
          : Promise.resolve([] as PregnancyCustomTodo[]),
        stage.kind === 'pregnant' && currentPregnancyWeek
          ? (calendarApi.getTodoProgress({ week: currentPregnancyWeek }) as Promise<PregnancyTodoProgress[]>)
          : Promise.resolve([] as PregnancyTodoProgress[]),
      ])

      const sortedEvents = [...events].sort((left, right) => {
        const leftTime = dayjs(`${left.eventDate} ${left.startTime || '23:59'}`).valueOf()
        const rightTime = dayjs(`${right.eventDate} ${right.startTime || '23:59'}`).valueOf()
        return leftTime - rightTime
      })
      setUpcomingEvents(sortedEvents.slice(0, 3))
      setTodayEvents(sortedEvents.filter((event) => event.eventDate === todayString))
      const defaultTodoKeys = (currentWeekGuide?.content?.todo || []).map((_, index) => `todo-${index}`)
      const customTodoKeys = customTodos.map((item) => `custom-${item.id}`)
      const validTodoKeys = new Set([...defaultTodoKeys, ...customTodoKeys])
      setTodoStats({
        week: currentPregnancyWeek,
        total: validTodoKeys.size,
        completed: progress.filter(
          (item) => item.week === currentPregnancyWeek && validTodoKeys.has(item.todoKey),
        ).length,
      })
    } catch (_error) {
      setUpcomingEvents([])
      setTodayEvents([])
      setTodoStats({ week: currentPregnancyWeek, total: 0, completed: 0 })
    }
  }, [currentPregnancyWeek, currentWeekGuide, stage.kind])

  const loadWeeklyReportReadState = useCallback(async () => {
    const latestId = await getLastSeenWeeklyReportId()
    setLatestSeenWeeklyReportId(latestId)
  }, [])

  const loadCheckinStatus = useCallback(async () => {
    try {
      const nextStatus = await checkinApi.getStatus()
      setCheckinStatus((current) => {
        if (current?.checkedInToday && !nextStatus.checkedInToday) {
          return current
        }

        return nextStatus
      })
    } catch (_error) {
      setCheckinStatus((current) => current)
    }
  }, [])

  useEffect(() => {
    void loadArticles()
    void loadHomeCalendar()
    void loadWeeklyReportReadState()
    void loadCheckinStatus()
  }, [loadArticles, loadHomeCalendar, loadWeeklyReportReadState, loadCheckinStatus])

  useFocusEffect(
    useCallback(() => {
      ensureFreshQuota()
      void loadHomeCalendar()
      void loadWeeklyReportReadState()
      void loadCheckinStatus()
    }, [ensureFreshQuota, loadHomeCalendar, loadWeeklyReportReadState, loadCheckinStatus]),
  )

  const remainingAiText = status === 'active' ? '无限次' : `${Math.max(aiLimit - aiUsedToday, 0)} 次`
  const resolvedCheckInStreak = checkinStatus?.currentStreak ?? checkInStreak
  const hasCheckedInToday = checkinStatus?.checkedInToday ?? todayEvents.some((event) => event.isCompleted)
  const pendingTodayEvent = todayEvents.find((event) => !event.isCompleted)
  const nextCheckInBonus = checkinStatus?.nextBonusAt && checkinStatus?.nextBonusPoints
    ? {
        streak: checkinStatus.nextBonusAt,
        bonus: checkinStatus.nextBonusPoints,
      }
    : getNextCheckinBonus(resolvedCheckInStreak)

  const weeklyReport = (weeklyReports[0] || {
    id: 'fallback',
    title: '个性化周度报告',
    stageLabel: '本周预览',
    createdAt: new Date().toISOString(),
    highlights: ['会员可查看完整的阶段重点与建议。'],
  }) as WeeklyReport
  const hasUnreadWeeklyReport = status === 'active'
    && weeklyReport.id !== 'preview-weekly-report'
    && weeklyReport.id !== 'fallback'
    && weeklyReport.id !== latestSeenWeeklyReportId

  const primaryTask = useMemo<HomePrimaryTask>(() => {
    if (!hasCheckedInToday) {
      return {
        title: '先完成今天签到',
        description: pendingTodayEvent
          ? `把“${pendingTodayEvent.title}”完成掉，连续打卡会自动累计。`
          : '今天还没有完成记录，现在补一条最容易保持连续节奏。',
        actionLabel: '立即签到',
        action: 'checkin',
      }
    }

    if (hasUnreadWeeklyReport) {
      return {
        title: '本周新周报已生成',
        description: '先看本周重点提醒，再决定日历和阅读问答要补哪一块。',
        actionLabel: '查看周报',
        action: 'weekly_report',
      }
    }

    if (todoStats.total > 0 && todoStats.completed < todoStats.total) {
      return {
        title: '补齐本周阶段待办',
        description: `当前已完成 ${todoStats.completed}/${todoStats.total}，继续补一项更容易把周报做完整。`,
        actionLabel: '去日历安排',
        action: 'calendar',
      }
    }

    if (upcomingEvents[0]) {
      return {
        title: '确认接下来的安排',
        description: `${eventTypeLabels[upcomingEvents[0].eventType] || '提醒'} · ${upcomingEvents[0].title}`,
        actionLabel: '查看日历',
        action: 'calendar',
      }
    }

    return {
      title: '补一个本周关键问题',
      description: '把你现在最关心的一件事问清楚，后续周报和档案会更有价值。',
      actionLabel: '继续提问',
      action: 'chat',
    }
  }, [hasCheckedInToday, hasUnreadWeeklyReport, pendingTodayEvent, todoStats.completed, todoStats.total, upcomingEvents])
  const suggestedQuestion = useMemo(() => buildHomeSuggestedQuestion(stage.lifecycleKey), [stage.lifecycleKey])

  const handleQuickCheckIn = useCallback(async () => {
    if (checkInSubmitting) {
      return '正在处理中，请稍候'
    }

    setCheckInSubmitting(true)

    try {
      if (hasCheckedInToday) {
        return '今天已经签到，继续完成其他安排也会计入周完成度'
      }

      const result = await checkinApi.checkin()
      setCheckinStatus((current) => ({
        checkedInToday: true,
        currentStreak: result.streakCount,
        totalPoints: result.totalPoints,
        monthlyCheckins: current?.monthlyCheckins ?? [],
        nextBonusAt: result.nextBonusAt,
        nextBonusPoints: result.nextBonusPoints,
      }))

      await Promise.all([
        ensureFreshQuota(),
        loadHomeCalendar(),
        loadCheckinStatus(),
      ])

      if (pendingTodayEvent) {
        return `今日已签到，已连续 ${result.streakCount} 天，获得 ${result.pointsAwarded} 积分。接下来可以继续处理“${pendingTodayEvent.title}”。`
      }

      return `今日已签到，已连续 ${result.streakCount} 天，获得 ${result.pointsAwarded} 积分。`
    } catch (error) {
      if (error instanceof Error && error.message.includes('今日已签到')) {
        await Promise.all([
          ensureFreshQuota(),
          loadHomeCalendar(),
          loadCheckinStatus(),
        ])
        return '今天已经签到，继续完成其他安排也会计入周完成度'
      }
      return error instanceof Error ? error.message : '签到失败，请稍后重试'
    } finally {
      setCheckInSubmitting(false)
    }
  }, [checkInSubmitting, ensureFreshQuota, hasCheckedInToday, loadCheckinStatus, loadHomeCalendar, pendingTodayEvent])

  const statusTags = [
    ...stage.statusTags,
    `连续打卡 ${resolvedCheckInStreak} 天`,
    `本周完成 ${weeklyCompletionRate}%`,
    todoStats.total > 0 && todoStats.week ? `孕${todoStats.week}周待办 ${todoStats.completed}/${todoStats.total}` : null,
    upcomingEvents[0] ? `${eventTypeLabels[upcomingEvents[0].eventType] || '提醒'} · ${upcomingEvents[0].title}` : null,
  ].filter(Boolean) as string[]

  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        loadArticles(),
        loadHomeCalendar(),
        loadWeeklyReportReadState(),
        loadCheckinStatus(),
      ])
      ensureFreshQuota()
    } finally {
      setRefreshing(false)
    }
  }, [loadArticles, loadHomeCalendar, loadWeeklyReportReadState, loadCheckinStatus, ensureFreshQuota])

  const initialLoading = !hydrated || loadingArticles

  return {
    stage,
    status,
    initialLoading,
    articles,
    upcomingEvents,
    todoStats,
    loadingArticles,
    remainingAiText,
    checkInStreak: resolvedCheckInStreak,
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
  }
}
