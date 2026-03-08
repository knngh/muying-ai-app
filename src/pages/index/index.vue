<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getCalendarByDate, getCurrentStage } from '@/api/calendar'
import type { CalendarDayItem, UserStage } from '@/api/types'
import CalendarCard from '@/components/CalendarCard.vue'

const today = new Date().toISOString().slice(0, 10)
const list = ref<CalendarDayItem[]>([])
const stage = ref<UserStage | null>(null)
const loading = ref(true)

onMounted(async () => {
  stage.value = await getCurrentStage()
  list.value = await getCalendarByDate(today, stage.value)
  loading.value = false
})

function formatStage(s: UserStage) {
  if (s.mode === 'pregnancy' && s.pregnancyWeeks) return `孕 ${s.pregnancyWeeks} 周`
  if (s.mode === 'baby' && s.babyBirthday) return `宝宝 ${s.babyBirthday}`
  return '未设置'
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">今日母婴日历</text>
      <text class="subtitle">{{ today }}</text>
      <view v-if="stage" class="stage">当前：{{ formatStage(stage) }}</view>
    </view>
    <view v-if="loading" class="loading">加载中...</view>
    <view v-else class="content">
      <CalendarCard v-for="(item, i) in list" :key="i" :item="item" />
    </view>
    <view class="entry-qa" @click="uni.navigateTo({ url: '/pages/qa/qa' })">
      <text>有疑问？去 AI 育儿问答</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #ffe8f0 0%, #f8f8f8 120rpx);
  padding: 24rpx 24rpx 120rpx;
}
.header {
  margin-bottom: 24rpx;
  .title {
    display: block;
    font-size: 40rpx;
    font-weight: 700;
    color: #333;
  }
  .subtitle {
    font-size: 26rpx;
    color: #666;
  }
  .stage {
    margin-top: 8rpx;
    font-size: 24rpx;
    color: #ff6b9d;
  }
}
.loading {
  text-align: center;
  padding: 60rpx;
  color: #999;
}
.content {
  margin-bottom: 32rpx;
}
.entry-qa {
  position: fixed;
  bottom: 120rpx;
  left: 24rpx;
  right: 24rpx;
  height: 88rpx;
  background: linear-gradient(90deg, #5b9cff, #7eb8ff);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 30rpx;
  box-shadow: 0 8rpx 24rpx rgba(91, 156, 255, 0.35);
}
</style>
