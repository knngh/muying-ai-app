<script setup lang="ts">
import { ref } from 'vue'
const stage = ref<'pregnancy' | 'baby' | null>(null)
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">我的</text>
      <text class="subtitle">设置阶段后，日历与推荐更精准</text>
    </view>
    <view class="card">
      <view class="row">
        <text class="label">当前阶段</text>
        <text class="value">{{ stage === 'pregnancy' ? '孕期' : stage === 'baby' ? '育儿期' : '未设置' }}</text>
      </view>
      <view class="row" @click="stage = 'pregnancy'">
        <text class="label">孕期</text>
        <text class="link">设置孕周</text>
      </view>
      <view class="row" @click="stage = 'baby'">
        <text class="label">育儿期</text>
        <text class="link">设置宝宝生日</text>
      </view>
    </view>
    <view class="card">
      <view class="row">
        <text class="label">关于本应用</text>
      </view>
      <text class="desc">母婴AI日历 · 问答内容整理自权威来源并标注参考，产品推荐为场景化推荐，仅供参考。不能替代医生诊断。</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx 24rpx 120rpx;
}
.header {
  margin-bottom: 24rpx;
  .title { display: block; font-size: 36rpx; font-weight: 700; color: #333; }
  .subtitle { font-size: 24rpx; color: #999; }
}
.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  margin-bottom: 24rpx;
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 96rpx;
    border-bottom: 1rpx solid #f0f0f0;
    &:last-child { border-bottom: none; }
    .label { font-size: 28rpx; color: #333; }
    .value { font-size: 28rpx; color: #666; }
    .link { font-size: 26rpx; color: #5b9cff; }
  }
  .desc {
    display: block;
    padding: 16rpx 0 24rpx;
    font-size: 24rpx;
    color: #999;
    line-height: 1.5;
  }
}
</style>
