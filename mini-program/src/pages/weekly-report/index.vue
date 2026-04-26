<template>
  <view class="report-page">
    <SkeletonCard v-if="loading" :rows="5" />

    <view v-else-if="report" class="report-card">
      <view class="report-header">
        <text class="report-title">{{ report.title }}</text>
        <text class="report-stage">{{ report.stageLabel }}</text>
        <text class="report-date">{{ formatDate(report.createdAt) }}</text>
      </view>

      <view class="report-highlights">
        <view
          v-for="(item, index) in report.highlights"
          :key="item.key || index"
          class="highlight-item"
        >
          <view class="highlight-index">
            <text>{{ index + 1 }}</text>
          </view>
          <view class="highlight-content">
            <text class="highlight-label">{{ item.label }}</text>
            <text v-if="item.value" class="highlight-value">{{ item.value }}</text>
          </view>
        </view>
      </view>

      <view class="report-footer">
        <text class="report-disclaimer">本报告由 AI 辅助生成，仅供参考，不构成医疗建议。</text>
      </view>
    </view>

    <view v-else class="empty-state">
      <text class="empty-text">暂无周报</text>
      <text class="empty-desc">周报仅对 VIP 会员开放</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/api/request'
import SkeletonCard from '@/components/SkeletonCard.vue'
import dayjs from 'dayjs'

interface WeeklyReport {
  id: string
  title: string
  stageLabel: string
  createdAt: string
  highlights: Array<{ key: string; label: string; value: string }>
}

const report = ref<WeeklyReport | null>(null)
const loading = ref(false)

function formatDate(dateStr: string) {
  return dayjs(dateStr).format('YYYY-MM-DD')
}

async function loadReport() {
  loading.value = true
  try {
    const res = await api.get<WeeklyReport>('/subscription/weekly-report/latest')
    report.value = res
  } catch (_e) {
    report.value = null
  } finally {
    loading.value = false
  }
}

onShow(() => { loadReport() })
</script>

<style scoped>
.report-page { min-height: 100vh; background: #f5f7fa; padding: 24rpx; }
.report-card { background: #fff; border-radius: 24rpx; padding: 32rpx; box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06); }
.report-header { margin-bottom: 32rpx; }
.report-title { display: block; font-size: 36rpx; font-weight: 700; color: #333; margin-bottom: 12rpx; }
.report-stage { display: inline-block; font-size: 22rpx; color: #1890ff; background: #e6f7ff; padding: 6rpx 16rpx; border-radius: 8rpx; margin-right: 12rpx; }
.report-date { font-size: 22rpx; color: #bbb; }
.report-highlights { display: flex; flex-direction: column; gap: 20rpx; }
.highlight-item { display: flex; gap: 16rpx; align-items: flex-start; }
.highlight-index { width: 48rpx; height: 48rpx; border-radius: 50%; background: linear-gradient(135deg, #ff6b9d, #ff8a65); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24rpx; font-weight: 700; flex-shrink: 0; }
.highlight-content { flex: 1; }
.highlight-label { display: block; font-size: 28rpx; color: #333; line-height: 1.6; }
.highlight-value { display: block; font-size: 24rpx; color: #666; margin-top: 6rpx; }
.report-footer { margin-top: 32rpx; padding-top: 20rpx; border-top: 1rpx solid #f0f0f0; }
.report-disclaimer { font-size: 20rpx; color: #ccc; line-height: 1.5; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 120rpx 0; }
.empty-text { font-size: 30rpx; color: #666; margin-bottom: 8rpx; }
.empty-desc { font-size: 24rpx; color: #bbb; }
</style>
