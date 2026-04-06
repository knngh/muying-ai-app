import api from './index'
import { config } from '../config'

export type MembershipFeatureCode =
  | 'ai_unlimited'
  | 'continuous_chat'
  | 'weekly_report'
  | 'growth_export'
  | 'stage_circle'
  | 'ad_free'

export interface MembershipPlan {
  id: string
  code: 'monthly' | 'quarterly' | 'yearly'
  name: string
  price: number
  originalPrice?: number
  durationDays: number
  monthlyPriceLabel: string
  badge?: string
  description: string
  features: MembershipFeatureCode[]
}

export interface MembershipStatus {
  status: 'free' | 'active' | 'expired'
  isVip: boolean
  currentPlanCode: MembershipPlan['code'] | null
  expireAt: string | null
  plan: MembershipPlan | null
  aiLimit: number
  aiUsedToday: number
  remainingToday: number
  checkInStreak: number
  weeklyCompletionRate: number
}

export interface DailyQuota {
  date: string
  aiUsedToday: number
  aiLimit: number
  remainingToday: number
  isUnlimited: boolean
}

export interface WeeklyReport {
  id: string
  title: string
  stageLabel: string
  createdAt: string
  highlights: string[]
}

export interface PaymentOrder {
  orderNo: string
  amount: number
  payChannel: 'wechat' | 'alipay'
  status: string
  createdAt: string
  paidAt: string | null
  planCode: MembershipPlan['code']
  planName: string
  mockPaymentPayload?: {
    orderNo: string
    payChannel: 'wechat' | 'alipay'
    autoConfirm: boolean
  }
}

export const subscriptionApi = {
  getPlans: () =>
    api.get<{ list: MembershipPlan[] }>('/subscription/plans').then(res => (res as { list: MembershipPlan[] }).list),
  getStatus: () => api.get<MembershipStatus>('/subscription/status'),
  checkFeature: (feature: MembershipFeatureCode) => api.post('/subscription/check-feature', { feature }),
}

export const quotaApi = {
  getToday: () => api.get<DailyQuota>('/quota/today'),
}

export const reportApi = {
  getLatest: () => api.get<WeeklyReport>('/report/weekly/latest'),
  getList: () =>
    api.get<{ list: WeeklyReport[] }>('/report/weekly/list').then(res => (res as { list: WeeklyReport[] }).list),
  generate: () => api.post<WeeklyReport>('/report/weekly/generate'),
}

export const paymentApi = {
  createOrder: (data: { planCode: MembershipPlan['code']; payChannel: 'wechat' | 'alipay' }) =>
    api.post<PaymentOrder>('/payment/create-order', data),
  getOrder: (orderNo: string) => api.get<PaymentOrder>(`/payment/order/${orderNo}`),
  hasMockPaymentsEnabled: () => config.enableMockPayments,
}
