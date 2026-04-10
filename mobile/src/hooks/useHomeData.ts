import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { articleApi, calendarApi } from '../api/modules'
import type { Article, CalendarEvent, PaginatedResponse, PregnancyCustomTodo, PregnancyTodoProgress } from '../api/modules'
import { useAppStore } from '../stores/appStore'
import { useMembershipStore } from '../stores/membershipStore'
import type { WeeklyReport } from '../stores/membershipStore'
import { eventTypeLabels } from '../theme'
import { getStageSummary } from '../utils/stage'
import { calculatePregnancyWeekFromDueDate } from '../utils'
import pregnancyWeekGuide from '../../../shared/data/pregnancy-week-guide.json'

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
  const [todoStats, setTodoStats] = useState<{ week: number | null; total: number; completed: number }>({
    week: null,
    total: 0,
    completed: 0,
  })
  const [loadingArticles, setLoadingArticles] = useState(false)

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

      for (const stageKey of stage.knowledgeStages) {
        const response = (await articleApi.getList({
          pageSize: 4,
          contentType: 'authority',
          sort: 'latest',
          stage: stageKey,
        })) as PaginatedResponse<Article>
        if ((response.list || []).length > 0) {
          nextArticles = response.list || []
          break
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

      setUpcomingEvents(events.slice(0, 3))
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
      setTodoStats({ week: currentPregnancyWeek, total: 0, completed: 0 })
    }
  }, [currentPregnancyWeek, currentWeekGuide, stage.kind])

  useEffect(() => {
    void loadArticles()
    void loadHomeCalendar()
  }, [loadArticles, loadHomeCalendar])

  useFocusEffect(
    useCallback(() => {
      ensureFreshQuota()
      void loadHomeCalendar()
    }, [ensureFreshQuota, loadHomeCalendar]),
  )

  const remainingAiText = status === 'active' ? '无限次' : `${Math.max(aiLimit - aiUsedToday, 0)} 次`

  const weeklyReport = (weeklyReports[0] || {
    id: 'fallback',
    title: '个性化周度报告',
    stageLabel: '本周预览',
    createdAt: new Date().toISOString(),
    highlights: ['会员可查看完整的阶段重点与建议。'],
  }) as WeeklyReport

  const statusTags = [
    ...stage.statusTags,
    `连续打卡 ${checkInStreak} 天`,
    `本周完成 ${weeklyCompletionRate}%`,
    todoStats.total > 0 && todoStats.week ? `孕${todoStats.week}周待办 ${todoStats.completed}/${todoStats.total}` : null,
    upcomingEvents[0] ? `${eventTypeLabels[upcomingEvents[0].eventType] || '提醒'} · ${upcomingEvents[0].title}` : null,
  ].filter(Boolean) as string[]

  const initialLoading = !hydrated || loadingArticles

  return {
    stage,
    status,
    initialLoading,
    articles,
    upcomingEvents,
    loadingArticles,
    remainingAiText,
    checkInStreak,
    weeklyCompletionRate,
    weeklyReport,
    statusTags,
  }
}
