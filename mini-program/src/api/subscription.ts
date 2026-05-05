import api from './request'

export interface SubscriptionPlan {
  id: string
  code: 'monthly' | 'quarterly' | 'yearly'
  name: string
  price: number
  originalPrice?: number
  durationDays: number
  monthlyPriceLabel?: string
  badge?: string
  description?: string
  features: string[]
}

export interface MembershipInfo {
  status: 'free' | 'active' | 'expired'
  currentPlanCode: SubscriptionPlan['code'] | null
  plan: SubscriptionPlan | null
  expireAt: string | null
  isVip: boolean
  aiLimit: number
  aiUsedToday: number
  remainingToday: number
  checkInStreak: number
  weeklyCompletionRate: number
}

export interface PaymentOrder {
  orderNo: string
  amount: number
  payChannel: 'wechat' | 'alipay'
  status: string
  createdAt: string
  paidAt: string | null
  planCode: SubscriptionPlan['code']
  planName: string
  mockPaymentPayload?: {
    orderNo: string
    payChannel: 'wechat' | 'alipay'
    autoConfirm: boolean
  }
}

export const subscriptionApi = {
  getPlans: () =>
    api.get<{ list: SubscriptionPlan[] }>('/subscription/plans')
      .then(res => (res as { list: SubscriptionPlan[] }).list),

  getMembership: () =>
    api.get<MembershipInfo>('/subscription/status'),

  createOrder: (planCode: string) =>
    api.post<PaymentOrder>('/payment/create-order', { planCode, payChannel: 'wechat' }),
}
