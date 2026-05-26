import { NativeModules, PermissionsAndroid, Platform } from 'react-native'
import { buildHomeSuggestedQuestion } from '../utils/aiEntryPrompts'
import type { LifecycleStageKey } from '../utils/stage'

type ReminderScheduleItem = {
  requestId: string
  title: string
  body: string
  question: string
  timestampMs: number
}

type DailyQuestionReminderNativeModule = {
  scheduleDailyQuestionReminders: (items: ReminderScheduleItem[]) => Promise<number>
  consumePendingDailyQuestion: () => Promise<string | null>
}

type DailyQuestionReminderDependencies = {
  platformOS: typeof Platform.OS
  nativeModule?: DailyQuestionReminderNativeModule
  requestNotificationPermission: () => Promise<boolean>
}

const nativeReminderModule = NativeModules.BeihuDailyQuestionReminder as DailyQuestionReminderNativeModule | undefined

async function requestNotificationPermission() {
  if (Platform.OS !== 'android') {
    return true
  }

  const version = typeof Platform.Version === 'number'
    ? Platform.Version
    : Number.parseInt(String(Platform.Version), 10)
  if (!Number.isFinite(version) || version < 33) {
    return true
  }

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  if (!permission) {
    return true
  }

  const result = await PermissionsAndroid.request(permission)
  return result === PermissionsAndroid.RESULTS.GRANTED
}

const defaultDependencies: DailyQuestionReminderDependencies = {
  platformOS: Platform.OS,
  nativeModule: nativeReminderModule,
  requestNotificationPermission,
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildDailyQuestionReminderCopy(question: string) {
  return {
    title: '今天可以问 AI 的一件小事',
    body: question.trim(),
  }
}

export function buildDailyQuestionReminderSchedule(
  stageKey: LifecycleStageKey,
  options: {
    caregiverRole?: string | number | null
    days?: number
    hour?: number
    minute?: number
    now?: Date
  } = {},
) {
  const days = Math.max(1, Math.min(options.days ?? 14, 30))
  const hour = Math.max(0, Math.min(options.hour ?? 8, 23))
  const minute = Math.max(0, Math.min(options.minute ?? 0, 59))
  const now = options.now || new Date()
  const firstDate = new Date(now)
  firstDate.setHours(hour, minute, 0, 0)
  if (firstDate.getTime() <= now.getTime()) {
    firstDate.setDate(firstDate.getDate() + 1)
  }

  return Array.from({ length: days }, (_item, index) => {
    const date = new Date(firstDate)
    date.setDate(firstDate.getDate() + index)
    const question = buildHomeSuggestedQuestion(stageKey, {
      caregiverRole: options.caregiverRole,
      date,
    })
    const copy = buildDailyQuestionReminderCopy(question)

    return {
      requestId: `daily-question-${formatDateKey(date)}`,
      title: copy.title,
      body: copy.body,
      question,
      timestampMs: date.getTime(),
    }
  })
}

export function getDailyQuestionReminderErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : ''

  if (code === 'DAILY_QUESTION_REMINDER_PERMISSION_DENIED') {
    return '需要开启通知权限后才能设置每日提醒'
  }

  if (code === 'DAILY_QUESTION_REMINDER_UNAVAILABLE') {
    return '当前设备暂不支持每日提醒'
  }

  return '每日提醒设置失败，请稍后再试'
}

export async function scheduleDailyQuestionReminder(
  stageKey: LifecycleStageKey,
  options: {
    caregiverRole?: string | number | null
    days?: number
    hour?: number
    minute?: number
  } = {},
  dependencies: DailyQuestionReminderDependencies = defaultDependencies,
) {
  if (!dependencies.nativeModule) {
    throw Object.assign(new Error('Daily question reminder native module is unavailable'), {
      code: 'DAILY_QUESTION_REMINDER_UNAVAILABLE',
    })
  }

  if (dependencies.platformOS === 'android') {
    const granted = await dependencies.requestNotificationPermission()
    if (!granted) {
      throw Object.assign(new Error('Notification permission denied'), {
        code: 'DAILY_QUESTION_REMINDER_PERMISSION_DENIED',
      })
    }
  }

  const items = buildDailyQuestionReminderSchedule(stageKey, {
    caregiverRole: options.caregiverRole,
    days: options.days,
    hour: options.hour,
    minute: options.minute,
  })

  return dependencies.nativeModule.scheduleDailyQuestionReminders(items)
}

export async function consumePendingDailyQuestion(
  dependencies: Pick<DailyQuestionReminderDependencies, 'nativeModule'> = defaultDependencies,
) {
  if (!dependencies.nativeModule) {
    return null
  }

  const question = await dependencies.nativeModule.consumePendingDailyQuestion()
  return question?.trim() || null
}
