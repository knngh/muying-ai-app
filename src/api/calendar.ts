import type { CalendarDayItem, UserStage } from './types'

const MOCK_STAGE: UserStage = {
  mode: 'pregnancy',
  pregnancyWeeks: 12,
}

/** 获取今日/指定日期的日历内容（后续对接权威来源+RAG） */
export function getCalendarByDate(date: string, stage?: UserStage): Promise<CalendarDayItem[]> {
  const s = stage || MOCK_STAGE
  return Promise.resolve([
    {
      date,
      title: s.mode === 'pregnancy' ? `孕${s.pregnancyWeeks}周小贴士` : '今日育儿提醒',
      summary: s.mode === 'pregnancy'
        ? '本周宝宝约柠檬大小，可开始听胎心。建议补充叶酸、均衡饮食，避免久站。'
        : '保持规律作息，注意辅食添加顺序与过敏观察。',
      tip: '参考来源：美国儿科学会育儿百科',
      source: '美国儿科学会',
      stage: s.mode === 'pregnancy' ? 'pregnancy' : '0-6m',
    },
  ])
}

/** 获取用户当前阶段（本地/登录后） */
export function getCurrentStage(): Promise<UserStage> {
  return Promise.resolve(MOCK_STAGE)
}
