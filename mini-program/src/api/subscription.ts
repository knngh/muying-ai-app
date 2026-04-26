import api from './request'

export interface SubscriptionPlan {
  id: string
  code: string
  name: string
  price: number
  originalPrice?: number
  durationDays: number
  features: string[]
}

export interface MembershipInfo {
  status: 'free' | 'active' | 'expired'
  plan?: SubscriptionPlan
  expireAt?: string
  isVip: boolean
}

export const subscriptionApi = {
  getPlans: () =>
    api.get<{ plans: SubscriptionPlan[] }>('/subscription/plans'),

  getMembership: () =>
    api.get<MembershipInfo>('/subscription/membership'),

  createOrder: (planCode: string) =>
    api.post<{ orderId: string; paymentParams?: Record<string, string> }>('/subscription/orders', { planCode }),
}
