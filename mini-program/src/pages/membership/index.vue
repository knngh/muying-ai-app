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

    <!-- 权益对比 -->
    <view class="feature-list">
      <text class="feature-section-kicker">权益对比</text>
      <text class="feature-section-title">开通后具体多了什么</text>
      <text class="feature-section-desc">不是简单多几个入口，而是把问答、周报和成长档案连成持续使用的流程。</text>

      <view class="compare-summary">
        <view class="compare-summary-card">
          <text class="summary-value">3 次</text>
          <text class="summary-label">基础版每日问答</text>
        </view>
        <view class="compare-summary-card vip-summary">
          <text class="summary-value">不限次</text>
          <text class="summary-label">VIP 连续追问</text>
        </view>
      </view>

      <view v-for="feature in vipFeatures" :key="feature.title" class="feature-item">
        <view class="feature-header">
          <text class="feature-title">{{ feature.title }}</text>
          <text class="feature-impact">{{ feature.impact }}</text>
        </view>
        <view class="feature-compare-row">
          <view class="feature-compare-cell free-cell">
            <text class="compare-label">基础版</text>
            <text class="compare-title">{{ feature.free }}</text>
            <text class="compare-desc">{{ feature.freeDetail }}</text>
          </view>
          <view class="feature-compare-cell vip-cell">
            <text class="compare-label vip-label">开通后</text>
            <text class="compare-title vip-title">{{ feature.vip }}</text>
            <text class="compare-desc">{{ feature.vipDetail }}</text>
          </view>
        </view>
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
  {
    title: '阅读问答',
    free: '每天 3 次',
    freeDetail: '适合偶尔查一个问题，用完当天要等刷新。',
    vip: '不限次连续追问',
    vipDetail: '同一个症状、检查或喂养问题可以继续问清楚。',
    impact: '一次问透',
  },
  {
    title: '周度报告',
    free: '只看预览',
    freeDetail: '只能看到部分亮点，完整建议不会持续沉淀。',
    vip: '完整周报持续生成',
    vipDetail: '整合问答、签到、日历完成度和阶段重点。',
    impact: '每周复盘',
  },
  {
    title: '成长档案',
    free: '基础记录',
    freeDetail: '可以查看阶段资料，但长期趋势和摘要有限。',
    vip: '长期沉淀 + 导出',
    vipDetail: '把关键变化、周报结论和阶段记录整理成时间线。',
    impact: '方便回看',
  },
  {
    title: '阶段陪伴',
    free: '单点使用',
    freeDetail: '每次打开解决一个点，离开后上下文容易断。',
    vip: '全阶段联动',
    vipDetail: '备孕、孕期、育儿都用同一套日历、问答和档案。',
    impact: '持续陪伴',
  },
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
.feature-section-kicker { display: block; font-size: 22rpx; font-weight: 800; color: #a95a3b; letter-spacing: 2rpx; margin-bottom: 8rpx; }
.feature-section-title { display: block; font-size: 32rpx; font-weight: 800; color: #333; margin-bottom: 10rpx; }
.feature-section-desc { display: block; font-size: 24rpx; line-height: 36rpx; color: #777; margin-bottom: 22rpx; }
.compare-summary { display: flex; gap: 16rpx; margin-bottom: 22rpx; }
.compare-summary-card { flex: 1; padding: 20rpx; border-radius: 18rpx; background: #f7f4ee; border: 2rpx solid #eee4d8; }
.vip-summary { background: #fff3e8; border-color: #f0c8aa; }
.summary-value { display: block; font-size: 34rpx; font-weight: 900; color: #3d2a25; margin-bottom: 6rpx; }
.summary-label { display: block; font-size: 22rpx; color: #7a6a63; font-weight: 700; }
.feature-item { padding: 22rpx 0; border-top: 2rpx solid #f3eee8; }
.feature-header { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-bottom: 14rpx; }
.feature-title { font-size: 28rpx; font-weight: 800; color: #333; }
.feature-impact { padding: 6rpx 14rpx; border-radius: 999rpx; background: #fff0db; color: #a95a3b; font-size: 20rpx; font-weight: 800; }
.feature-compare-row { display: flex; gap: 14rpx; }
.feature-compare-cell { flex: 1; padding: 18rpx; border-radius: 18rpx; border: 2rpx solid #eee; }
.free-cell { background: #fafafa; }
.vip-cell { background: #fff8ef; border-color: #f0c8aa; }
.compare-label { display: block; font-size: 20rpx; color: #aaa; font-weight: 800; margin-bottom: 6rpx; }
.vip-label { color: #a95a3b; }
.compare-title { display: block; font-size: 25rpx; font-weight: 800; color: #555; margin-bottom: 6rpx; }
.vip-title { color: #a95a3b; }
.compare-desc { display: block; font-size: 22rpx; line-height: 32rpx; color: #777; }
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
