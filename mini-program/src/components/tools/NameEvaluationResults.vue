<template>
  <view class="evaluation-results">
    <text class="result-label">{{ result.source === 'ai' ? 'AI 评测 · 仅供偏好参考' : '资料对比 · 暂无 AI 评分' }}</text>
    <view v-for="candidate in result.candidates" :key="candidate.id" class="candidate-result">
      <view class="candidate-head">
        <view><text class="candidate-name">{{ candidate.fullName }}</text><text class="candidate-pinyin">名字读音 · {{ candidate.pinyin }}</text></view>
        <view class="match"><text class="match-number">{{ candidate.matchLevel === null ? '—' : `${candidate.matchLevel} / 5` }}</text><text class="match-caption">{{ candidate.matchLevel === null ? '暂不评分' : '偏好匹配度' }}</text></view>
      </view>
      <text class="meaning">{{ candidate.meaning }}</text>
      <view class="dimensions">
        <view v-for="dimension in candidate.dimensions" :key="dimension.preference" class="dimension">
          <text>{{ dimension.preference }}</text>
          <view class="level-track"><view v-for="step in 5" :key="step" class="level-step" :class="{ filled: dimension.level !== null && step <= dimension.level }" /></view>
          <text class="level-text">{{ dimension.level === null ? '待评' : `${dimension.level}/5` }}</text>
        </view>
      </view>
      <text class="explanation">{{ candidate.explanation }}</text>
      <text class="fact">名字 {{ candidate.givenNameLength }} 字 · 姓氏连读与方言谐音待家人核对</text>
      <text class="fact">参考资料：{{ candidate.source }}</text>
      <text v-if="candidate.sourceQuote" class="quote">{{ candidate.sourceQuote }}</text>
    </view>
    <text class="result-note">1 较少体现 · 3 部分贴近 · 5 很贴近。综合匹配度为所选风格分的等权平均，四舍五入；任一风格待评时不显示综合分。</text>
    <text class="result-note">{{ result.disclaimer }}</text>
  </view>
</template>

<script setup lang="ts">
import type { NameEvaluationResponse } from '../../../../shared/types/name-library'
defineProps<{ result: NameEvaluationResponse }>()
</script>

<style scoped>
.evaluation-results { margin-top: 24rpx; }
.result-label { display: block; color: #80523c; font-size: 23rpx; font-weight: 700; }
.candidate-result { margin-top: 16rpx; padding: 24rpx; border: 1rpx solid #f0e2d8; border-radius: 20rpx; background: #fff; }
.candidate-head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.candidate-name { display: block; color: #46312a; font-size: 36rpx; font-weight: 800; word-break: break-all; }
.candidate-pinyin { display: block; margin-top: 8rpx; color: #79665b; font-size: 22rpx; }
.match { flex-shrink: 0; text-align: right; }
.match-number { display: block; color: #965338; font-size: 34rpx; font-weight: 800; }
.match-caption { display: block; margin-top: 4rpx; color: #79665b; font-size: 20rpx; }
.meaning, .explanation { display: block; margin-top: 16rpx; color: #5f5048; font-size: 25rpx; line-height: 1.65; }
.dimensions { margin-top: 20rpx; padding: 16rpx; border-radius: 12rpx; background: #fcf6f1; }
.dimension { display: flex; align-items: center; gap: 16rpx; padding: 6rpx 0; color: #6e5a50; font-size: 23rpx; }
.dimension > text:first-child { width: 92rpx; flex-shrink: 0; }
.level-track { display: flex; flex: 1; gap: 6rpx; }
.level-step { flex: 1; height: 10rpx; border-radius: 6rpx; background: #e8dfd8; }
.level-step.filled { background: #b76d4d; }
.level-text { width: 52rpx; text-align: right; }
.fact, .quote, .result-note { display: block; margin-top: 12rpx; color: #766359; font-size: 22rpx; line-height: 1.65; }
.quote { padding-left: 16rpx; border-left: 4rpx solid #e6c7b3; }
.result-note { margin-top: 16rpx; }
</style>
