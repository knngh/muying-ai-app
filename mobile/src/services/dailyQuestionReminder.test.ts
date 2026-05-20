import {
  buildDailyQuestionReminderCopy,
  buildDailyQuestionReminderSchedule,
  scheduleDailyQuestionReminder,
} from './dailyQuestionReminder'

describe('dailyQuestionReminder', () => {
  it('uses the concrete question as the notification body', () => {
    expect(buildDailyQuestionReminderCopy('孕中期这周要注意什么？')).toEqual({
      title: '今天可以问 AI 的一件小事',
      body: '孕中期这周要注意什么？',
    })
  })

  it('builds rolling 8:00 reminders from the next available day', () => {
    const items = buildDailyQuestionReminderSchedule('pregnant_mid', {
      now: new Date('2026-05-20T09:10:00+08:00'),
      days: 2,
      hour: 8,
      minute: 0,
    })

    expect(items).toHaveLength(2)
    expect(items[0].requestId).toBe('daily-question-2026-05-21')
    expect(new Date(items[0].timestampMs).getHours()).toBe(8)
    expect(items[0].body).toBe(items[0].question)
    expect(items[0].question).not.toBe(items[1].question)
  })

  it('requests Android notification permission before scheduling', async () => {
    const nativeModule = {
      scheduleDailyQuestionReminders: jest.fn().mockResolvedValue(14),
      consumePendingDailyQuestion: jest.fn(),
    }
    const requestNotificationPermission = jest.fn().mockResolvedValue(true)

    await expect(scheduleDailyQuestionReminder('pregnant_mid', {}, {
      platformOS: 'android',
      nativeModule,
      requestNotificationPermission,
    })).resolves.toBe(14)

    expect(requestNotificationPermission).toHaveBeenCalledTimes(1)
    expect(nativeModule.scheduleDailyQuestionReminders).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        title: '今天可以问 AI 的一件小事',
      }),
    ]))
  })
})
