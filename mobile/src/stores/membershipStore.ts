import { create } from 'zustand'
import dayjs from 'dayjs'
import {
  paymentApi,
  quotaApi,
  reportApi,
  subscriptionApi,
  type MembershipPlan,
  type MembershipStatus,
  type WeeklyReport,
} from '../api/membership'

export type { MembershipPlan, WeeklyReport }

type MembershipState = {
  status: MembershipStatus['status']
  currentPlanCode: MembershipPlan['code'] | null
  expireAt: string | null
  aiUsedToday: number
  aiLimit: number
  remainingToday: number
  lastQuotaDate: string
  checkInStreak: number
  weeklyCompletionRate: number
  plans: MembershipPlan[]
  weeklyReports: WeeklyReport[]
  loading: boolean
  hydrated: boolean
  resetState: () => void
  ensureFreshQuota: () => Promise<void>
  refreshWeeklyReports: () => Promise<void>
  consumeAiQuota: () => { allowed: boolean; remaining: number }
  purchasePlan: (code: MembershipPlan['code']) => Promise<void>
}

const FREE_AI_LIMIT = 3
const MEMBER_AI_LIMIT = 9999

const fallbackPlans: MembershipPlan[] = [
  {
    id: 'monthly',
    code: 'monthly',
    name: '连续包月',
    price: 19.9,
    originalPrice: 29.9,
    durationDays: 30,
    monthlyPriceLabel: '¥19.9 / 月',
    description: '适合先体验阅读问答不限次和生命周期周报。',
    features: ['ai_unlimited', 'continuous_chat', 'weekly_report'],
  },
  {
    id: 'quarterly',
    code: 'quarterly',
    name: '季度会员',
    price: 49.9,
    originalPrice: 59.7,
    durationDays: 90,
    monthlyPriceLabel: '折合 ¥16.6 / 月',
    badge: '省 17%',
    description: '适合跨阶段连续使用，把成长节奏和周报持续沉淀。',
    features: ['ai_unlimited', 'continuous_chat', 'weekly_report', 'growth_export'],
  },
  {
    id: 'yearly',
    code: 'yearly',
    name: '年度会员',
    price: 148,
    originalPrice: 238.8,
    durationDays: 365,
    monthlyPriceLabel: '折合 ¥12.3 / 月',
    badge: '最划算',
    description: '覆盖备孕、孕期、育儿与更长期的完整周期。',
    features: ['ai_unlimited', 'continuous_chat', 'weekly_report', 'growth_export', 'ad_free'],
  },
]

const previewReports: WeeklyReport[] = [
  {
    id: 'preview-weekly-report',
    title: '个性化周度报告',
    stageLabel: '生命周期预览',
    createdAt: dayjs().subtract(1, 'day').toISOString(),
    highlights: [
      '系统会结合你的阶段信息给出本周重点提醒。',
      '会员可查看完整饮食、作息和日历建议。',
      '升级后还能保留历史周报回顾。',
    ],
  },
]

function getDefaultMembershipState() {
  return {
    status: 'free' as MembershipStatus['status'],
    currentPlanCode: null,
    expireAt: null,
    aiUsedToday: 0,
    aiLimit: FREE_AI_LIMIT,
    remainingToday: FREE_AI_LIMIT,
    lastQuotaDate: dayjs().format('YYYY-MM-DD'),
    checkInStreak: 0,
    weeklyCompletionRate: 0,
    plans: fallbackPlans,
    weeklyReports: previewReports,
    loading: false,
    hydrated: false,
  }
}

async function loadRemoteMembershipState() {
  const [plans, status, quota] = await Promise.all([
    subscriptionApi.getPlans(),
    subscriptionApi.getStatus(),
    quotaApi.getToday(),
  ])

  let weeklyReports = previewReports
  if (status.isVip) {
    try {
      weeklyReports = await reportApi.getList()
    } catch (_error) {
      weeklyReports = previewReports
    }
  }

  return {
    plans: plans.length > 0 ? plans : fallbackPlans,
    weeklyReports,
    status: status.status,
    currentPlanCode: status.currentPlanCode,
    expireAt: status.expireAt,
    aiUsedToday: quota.aiUsedToday,
    aiLimit: quota.aiLimit,
    remainingToday: quota.isUnlimited ? MEMBER_AI_LIMIT : quota.remainingToday,
    lastQuotaDate: quota.date,
    checkInStreak: status.checkInStreak,
    weeklyCompletionRate: status.weeklyCompletionRate,
  }
}

export const useMembershipStore = create<MembershipState>((set, get) => ({
  ...getDefaultMembershipState(),

  resetState: () => {
    set(getDefaultMembershipState())
  },

  ensureFreshQuota: async () => {
    try {
      set({ loading: true })
      const nextState = await loadRemoteMembershipState()
      set({
        ...nextState,
        loading: false,
        hydrated: true,
      })
    } catch (_error) {
      set({ loading: false, hydrated: true })
    }
  },

  refreshWeeklyReports: async () => {
    try {
      const reports = await reportApi.getList()
      set({ weeklyReports: reports.length > 0 ? reports : previewReports })
    } catch (_error) {
      const state = get()
      if (state.status !== 'active') {
        set({ weeklyReports: previewReports })
      }
    }
  },

  consumeAiQuota: () => {
    const state = get()
    const today = dayjs().format('YYYY-MM-DD')

    if (state.lastQuotaDate !== today) {
      set({
        aiUsedToday: 0,
        remainingToday: state.status === 'active' ? MEMBER_AI_LIMIT : FREE_AI_LIMIT,
        aiLimit: state.status === 'active' ? MEMBER_AI_LIMIT : FREE_AI_LIMIT,
        lastQuotaDate: today,
      })
    }

    const nextState = get()
    if (nextState.status === 'active') {
      return { allowed: true, remaining: MEMBER_AI_LIMIT }
    }

    const remaining = Math.max(nextState.aiLimit - nextState.aiUsedToday, 0)
    if (remaining <= 0) {
      return { allowed: false, remaining: 0 }
    }

    return { allowed: true, remaining }
  },

  purchasePlan: async (code) => {
    set({ loading: true })
    try {
      if (!paymentApi.hasMockPaymentsEnabled()) {
        throw new Error('当前移动端未接入真实支付，请使用受控测试环境完成会员开通')
      }

      await paymentApi.createOrder({ planCode: code, payChannel: 'wechat' })
      const nextState = await loadRemoteMembershipState()
      set({
        ...nextState,
        loading: false,
        hydrated: true,
      })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
}))
