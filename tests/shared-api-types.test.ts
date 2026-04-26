import type {
  ArticleListParams,
  AuthChangePasswordPayload,
  AuthProfileUpdatePayload,
  CalendarEventDragPayload,
  CalendarEventInput,
  CalendarEventQueryParams,
  FavoriteCreatePayload,
  PaginationParams,
  PregnancyCustomTodoCreatePayload,
  PregnancyDiaryPayload,
  PregnancyTodoProgressUpdatePayload,
  ReadHistoryRecordPayload,
} from '../shared/types/index'

describe('shared api type contracts', () => {
  test('support common request payload shapes across clients', () => {
    const pagination: PaginationParams = { page: 2, pageSize: 20 }
    const articleListParams: ArticleListParams = {
      ...pagination,
      category: 'pregnancy',
      stage: 'trimester-2',
      keyword: '发热',
      sort: 'latest',
      source: 'who',
    }
    const calendarQuery: CalendarEventQueryParams = {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      eventType: 'checkup',
    }
    const eventInput: CalendarEventInput = {
      title: '产检',
      eventDate: '2026-04-28',
      startTime: '09:30',
      reminderEnabled: true,
    }
    const dragPayload: CalendarEventDragPayload = {
      newDate: '2026-04-29',
      newStartTime: '10:00',
    }
    const progressPayload: PregnancyTodoProgressUpdatePayload = {
      week: 24,
      todoKey: 'anatomy-scan',
      completed: true,
    }
    const diaryPayload: PregnancyDiaryPayload = {
      week: 24,
      content: '今天完成了产检。',
    }
    const customTodoPayload: PregnancyCustomTodoCreatePayload = {
      week: 24,
      content: '记得准备待产包清单',
    }
    const favoritePayload: FavoriteCreatePayload = {
      targetId: 101,
      targetType: 'article',
    }
    const readPayload: ReadHistoryRecordPayload = {
      articleId: 101,
      duration: 180,
      progress: 85,
    }
    const profilePayload: AuthProfileUpdatePayload = {
      nickname: '北湖妈妈',
      dueDate: '2026-08-08',
      childNickname: '小北',
      developmentConcerns: '睡眠',
    }
    const passwordPayload: AuthChangePasswordPayload = {
      oldPassword: 'old-secret',
      newPassword: 'new-secret',
    }

    expect(articleListParams.pageSize).toBe(20)
    expect(calendarQuery.eventType).toBe('checkup')
    expect(eventInput.startTime).toBe('09:30')
    expect(dragPayload.newDate).toBe('2026-04-29')
    expect(progressPayload.completed).toBe(true)
    expect(diaryPayload.content).toContain('产检')
    expect(customTodoPayload.week).toBe(24)
    expect(favoritePayload.targetId).toBe(101)
    expect(readPayload.progress).toBe(85)
    expect(profilePayload.childNickname).toBe('小北')
    expect(passwordPayload.newPassword).toBe('new-secret')
  })
})
