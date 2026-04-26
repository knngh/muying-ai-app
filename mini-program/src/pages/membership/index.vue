<template>
  <view class="membership-page">
    <!-- 当前会员状态 -->
    <view class="status-card" :class="membership?.isVip ? 'vip' : 'free'">
      <text class="status-label">{{ membership?.isVip ? 'VIP 会员' : '免费版' }}</text>
      <text v-if="membership?.expireAt" class="status-expire">
        有效期至 {{ formatDate(membership.expireAt) }}
      </text>
      <text v-else class="status-desc">升级 VIP 解锁更多功能</text>
    </view>

    <!-- 功能对比 -->
    <view class="feature-list">
      <text class="feature-section-title">VIP 专属功能</text>
      <view v-for="feature in vipFeatures" :key="feature" class="feature-item">
        <text class="feature-check">✓</text>
        <text class="feature-text">{{ feature }}</text>
      </view>
    </view>

    <!-- 套餐列表 -->
    <view class="plan-section">
      <text class="plan-section-title">选择套餐</text>
      <SkeletonCard v-if="loadingPlans" :rows="3" />

      <view class="plan-grid">
        <view
          v-for="plan in plans"
          :key="plan.id"
          class="plan-card"
          :class="{ selected: selectedPlan?.id === plan.id }"
          @tap="selectedPlan = plan"
        >
          <text class="plan-name">{{ plan.name }}</text>
          <view class="plan-price-row">
            <text class="plan-price">¥{{ plan.price }}</text>
            <text v-if="plan.originalPrice" class="plan-original-price">¥{{ plan.originalPrice }}</text>
          </view>
          <text class="plan-duration">{{ plan.durationDays }} 天</text>
        </view>
      </view>

      <view
        v-if="selectedPlan"
        class="subscribe-btn"
        :class="{ disabled: subscribing }"
        @tap="onSubscribe"
      >
        <text class="subscribe-btn-text">
          {{ subscribing ? '处理中...' : `立即开通 ¥${selectedPlan.price}` }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { subscriptionApi, type SubscriptionPlan, type MembershipInfo } from '@/api/subscription'
import SkeletonCard from '@/components/SkeletonCard.vue'
import dayjs from 'dayjs'

const membership = ref<MembershipInfo | null>(null)
const plans = ref<SubscriptionPlan[]>([])
const selectedPlan = ref<SubscriptionPlan | null>(null)
const loadingPlans = ref(false)
const subscribing = ref(false)

const vipFeatures = [
  '无限 AI 对话次数',
  '多轮连续对话',
  'AI 个性化周报',
  '成长档案导出',
  '阶段圈子',
  '无广告体验',
]

function formatDate(dateStr: string) {
  return dayjs(dateStr).format('YYYY-MM-DD')
}

async function loadData() {
  loadingPlans.value = true
  try {
    const [memberRes, planRes] = await Promise.all([
      subscriptionApi.getMembership(),
      subscriptionApi.getPlans(),
    ])
    membership.value = memberRes
    plans.value = planRes.plans || []
  } catch (e) {
    console.error('[Membership] 加载失败:', e)
  } finally {
    loadingPlans.value = false
  }
}

async function onSubscribe() {
  if (!selectedPlan.value || subscribing.value) return
  if (!uni.getStorageSync('token')) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => uni.navigateTo({ url: '/pages/login/index' }), 900)
    return
  }
  subscribing.value = true
  try {
    const res = await subscriptionApi.createOrder(selectedPlan.value.code)
    if (res.paymentParams) {
      // 调用微信支付
      uni.requestPayment({
        ...res.paymentParams,
        success: () => {
          uni.showToast({ title: '开通成功', icon: 'success' })
          loadData()
        },
        fail: () => {
          uni.showToast({ title: '支付取消', icon: 'none' })
        },
      } as any)
    } else {
      uni.showToast({ title: '订单已创建', icon: 'success' })
      loadData()
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '开通失败', icon: 'none' })
  } finally {
    subscribing.value = false
  }
}

onShow(() => { loadData() })
</script>

<style scoped>
.membership-page { min-height: 100vh; background: #f5f7fa; padding: 24rpx; }
.status-card { padding: 40rpx 32rpx; border-radius: 24rpx; margin-bottom: 24rpx; }
.status-card.vip { background: linear-gradient(135deg, #f6d365, #fda085); }
.status-card.free { background: linear-gradient(135deg, #e0e0e0, #f5f5f5); }
.status-label { display: block; font-size: 36rpx; font-weight: 700; color: #333; margin-bottom: 8rpx; }
.status-expire, .status-desc { display: block; font-size: 24rpx; color: #666; }
.feature-list { background: #fff; border-radius: 20rpx; padding: 28rpx; margin-bottom: 24rpx; }
.feature-section-title { display: block; font-size: 30rpx; font-weight: 700; color: #333; margin-bottom: 20rpx; }
.feature-item { display: flex; gap: 12rpx; align-items: center; padding: 12rpx 0; }
.feature-check { color: #52c41a; font-size: 28rpx; font-weight: 700; }
.feature-text { font-size: 26rpx; color: #555; }
.plan-section { background: #fff; border-radius: 20rpx; padding: 28rpx; }
.plan-section-title { display: block; font-size: 30rpx; font-weight: 700; color: #333; margin-bottom: 20rpx; }
.plan-grid { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.plan-card { flex: 1; padding: 24rpx; border: 2rpx solid #e8e8e8; border-radius: 16rpx; text-align: center; transition: border-color 0.2s; }
.plan-card.selected { border-color: #ff6b9d; background: #fff0f5; }
.plan-name { display: block; font-size: 26rpx; font-weight: 600; color: #333; margin-bottom: 12rpx; }
.plan-price-row { display: flex; align-items: baseline; justify-content: center; gap: 8rpx; }
.plan-price { font-size: 36rpx; font-weight: 800; color: #ff6b9d; }
.plan-original-price { font-size: 22rpx; color: #bbb; text-decoration: line-through; }
.plan-duration { display: block; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.subscribe-btn { margin-top: 24rpx; background: linear-gradient(135deg, #ff6b9d, #ff8a65); padding: 24rpx; border-radius: 24rpx; text-align: center; }
.subscribe-btn.disabled { opacity: 0.6; }
.subscribe-btn-text { color: #fff; font-size: 30rpx; font-weight: 700; }
</style>
