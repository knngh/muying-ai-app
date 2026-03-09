import type { CalendarDayItem, UserStage } from './types'
import config from './config'

const API_BASE = config.baseURL

/**
 * 获取今日/指定日期的日历内容
 */
export function getCalendarByDate(date: string, stage?: UserStage): Promise<CalendarDayItem[]> {
  const params = new URLSearchParams()
  params.append('date', date)
  if (stage) {
    params.append('mode', stage.mode)
    if (stage.pregnancyWeeks) {
      params.append('pregnancyWeeks', String(stage.pregnancyWeeks))
    }
    if (stage.babyMonths) {
      params.append('babyMonths', String(stage.babyMonths))
    }
  }

  return fetch(`${API_BASE}/calendar?${params.toString()}`)
    .then(res => res.json())
    .then(data => {
      if (data.code === 0) {
        return data.data
      }
      console.error('API Error:', data.message)
      return getMockCalendar(date, stage)
    })
    .catch(err => {
      console.error('Fetch error:', err)
      return getMockCalendar(date, stage)
    })
}

/**
 * 获取用户当前阶段
 */
export function getCurrentStage(): Promise<UserStage> {
  return fetch(`${API_BASE}/calendar/stage`)
    .then(res => res.json())
    .then(data => {
      if (data.code === 0) {
        return data.data
      }
      return getMockStage()
    })
    .catch(() => getMockStage())
}

/**
 * 更新用户阶段
 */
export function updateStage(stage: UserStage): Promise<UserStage> {
  return fetch(`${API_BASE}/calendar/stage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(stage)
  })
    .then(res => res.json())
    .then(data => {
      if (data.code === 0) {
        return data.data
      }
      throw new Error(data.message)
    })
}

// Mock 数据（备用）
function getMockCalendar(date: string, stage?: UserStage): CalendarDayItem[] {
  const s = stage || { mode: 'pregnancy', pregnancyWeeks: 12 }
  return [
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
  ]
}

function getMockStage(): UserStage {
  return {
    mode: 'pregnancy',
    pregnancyWeeks: 12,
  }
}
