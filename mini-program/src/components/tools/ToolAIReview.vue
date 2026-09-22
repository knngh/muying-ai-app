<template>
  <view v-if="inputs.length || saved.length" class="ai-review-card">
    <button class="review-toggle" :aria-expanded="expanded" @tap="expanded = !expanded">
      <view><text class="review-title">记录回顾</text><text class="review-subtitle">{{ inputs.length }} 条可选记录 · 已保存 {{ saved.length }} 份回顾</text></view>
      <text class="review-chevron">{{ expanded ? '收起 −' : '展开 ＋' }}</text>
    </button>
    <view v-if="expanded" class="review-body">
      <text class="review-hint">先选记录，再整理。回顾与原始记录分开保存。</text>
      <view class="review-selection-head"><text>已选 {{ selected.length }} / {{ MAX_REVIEW_RECORDS }} 条</text><button class="review-link" :disabled="busy" @tap="setSelection(selected.length === 0)">{{ selected.length ? '清空选择' : '选择最近 20 条' }}</button></view>
      <scroll-view scroll-y class="review-inputs">
        <button v-for="item in inputs.slice(0, visibleCount)" :key="item.id" class="review-pick" :class="{ 'review-pick--selected': selectedIds.includes(item.id) }" :disabled="busy" @tap="toggle(item.id)">
          <text class="review-check">{{ selectedIds.includes(item.id) ? '✓' : '＋' }}</text>
          <view class="review-preview"><text class="review-date">{{ item.date || '未标日期' }}</text><text class="review-input-text">{{ item.content }}</text></view>
        </button>
        <button v-if="inputs.length > visibleCount" class="review-link review-more" @tap="visibleCount += 20">查看更多记录（已显示 {{ visibleCount }} / {{ inputs.length }}）</button>
      </scroll-view>
      <text class="review-hint">以上即整理正文，长记录仅取前 300 字，以省略号标明。阶段：{{ stage }}。</text>
      <button class="review-action review-action--local" :disabled="busy || !selected.length" @tap="run(false)">生成本机摘要 · 不上传</button>
      <template v-if="TOOL_AI_ENABLED">
        <template v-if="owner !== 'guest'">
          <checkbox-group @change="consent = $event.detail.value.length > 0">
            <label class="review-consent"><checkbox value="consent" :checked="consent" :disabled="busy" color="#287e68" /><text>同意本次将勾选的文字、数字、日期及阶段发送至服务端，由 Jev 和智谱整理。不发送图片，不作医疗判断。</text></label>
          </checkbox-group>
          <button class="review-action" :disabled="busy || !selected.length || !consent" @tap="run(true)">{{ busy ? 'AI 正在整理…' : `发送已选 ${selected.length} 条 · AI 整理` }}</button>
        </template>
        <button v-else class="review-link review-login" @tap="login">登录后可选用 AI 整理 ›</button>
      </template>
      <text v-if="message" class="review-message">{{ message }}</text>
      <view v-if="current" class="ai-result">
        <view class="review-result-head"><text class="review-title">{{ current.result.title }}</text><text class="review-source">{{ reviewSourceLabel(current.origin) }}</text></view>
        <text class="review-hint">{{ current.records.length }} 条 · {{ current.stage }} · {{ formatDate(current.createdAt) }}</text>
        <text class="review-focus">整理重点 · {{ current.result.focus }}</text>
        <text class="review-summary">{{ current.result.summary }}</text>
        <view v-if="current.result.highlights.length" class="review-list"><text class="review-list-label">记录摘录</text><text v-for="(item, index) in current.result.highlights" :key="index" class="review-list-item">{{ item }}</text></view>
        <view v-if="current.result.nextSteps.length" class="review-list"><text class="review-list-label">可以继续</text><text v-for="(item, index) in current.result.nextSteps" :key="index" class="review-list-item">{{ item }}</text></view>
        <text class="review-hint review-disclaimer">{{ current.result.disclaimer }}{{ current.result.model ? ` · ${current.result.model}` : '' }}</text>
        <button class="review-action review-action--local review-save" :disabled="isSaved" @tap="save">{{ isSaved ? '已保存到本机 ✓' : '保存这份回顾' }}</button>
      </view>
      <view v-if="saved.length" class="review-history">
        <text class="review-title">已保存回顾 · {{ saved.length }}</text>
        <text class="review-hint">每个工具保留最近 10 份，仅此设备可见。原记录删除或更改后，对应回顾会清理。</text>
        <view v-for="item in saved" :key="item.id" class="review-history-row">
          <button class="review-history-open" :disabled="busy" @tap="open(item)"><text>{{ formatDate(item.createdAt) }} · {{ item.records.length }} 条</text><text class="review-hint">{{ reviewSourceLabel(item.origin) }} · 查看 ›</text></button>
          <button class="review-delete" :disabled="busy" @tap="remove(item)">删除</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { TOOL_AI_ENABLED } from '@/config/features'
import { useToolReview } from '@/composables/useToolReview'
import type { LocalToolRecord } from '@/utils/tool-records'
import { MAX_REVIEW_RECORDS, reviewSourceLabel } from '@/utils/tool-review'
import { localToolDate } from '@/utils/tool-history'
const props = defineProps<{ toolId: string; records: LocalToolRecord[]; week: number | null; owner: string }>()
const { expanded, busy, consent, message, selectedIds, visibleCount, current, saved, inputs, selected, stage, isSaved, toggle, setSelection, run, save, open, remove, login } = useToolReview(props)
function formatDate(value: string) { const date = new Date(value); return `${localToolDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` }
</script>

<style scoped>
.ai-review-card { margin: 22rpx 28rpx 0; border-radius: 24rpx; background: #f5faf7; border: 1rpx solid #dceee5; overflow: hidden; }
.review-toggle { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin: 0; padding: 26rpx; background: transparent; text-align: left; line-height: 1.5; }
.review-title { display: block; color: #314d43; font-size: 28rpx; font-weight: 700; }
.review-subtitle, .review-hint { display: block; margin-top: 8rpx; color: #65796f; font-size: 22rpx; line-height: 1.65; }
.review-chevron { flex-shrink: 0; color: #287e68; font-size: 22rpx; }
.review-body { padding: 0 26rpx 26rpx; }
.review-selection-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-top: 12rpx; color: #315f51; font-size: 24rpx; }
.review-link { margin: 0; padding: 16rpx 0; background: transparent; color: #287e68; font-size: 22rpx; line-height: 1.6; }
.review-inputs { max-height: 480rpx; border-top: 1rpx solid #dceee5; border-bottom: 1rpx solid #dceee5; }
.review-pick { display: flex; gap: 14rpx; width: 100%; margin: 12rpx 0; padding: 18rpx; border-radius: 16rpx; background: #fffdfb; text-align: left; color: #53675c; line-height: 1.65; }
.review-pick--selected { background: #e7f2ec; }.review-check { flex-shrink: 0; color: #287e68; font-size: 26rpx; }.review-preview { min-width: 0; }.review-date { display: block; font-size: 21rpx; color: #65796f; }.review-input-text { display: block; font-size: 24rpx; white-space: normal; word-break: break-all; }
.review-more, .review-login { width: 100%; text-align: center; }
.review-action { margin: 20rpx 0 0; padding: 20rpx; border-radius: 16rpx; background: #287e68; color: #fff; font-size: 25rpx; font-weight: 700; line-height: 1.6; }.review-action--local { background: #e1efe7; color: #246a54; }.review-action[disabled] { opacity: .5; }
.review-consent { display: flex; align-items: flex-start; gap: 10rpx; margin-top: 22rpx; font-size: 22rpx; color: #53675c; line-height: 1.7; }.review-consent checkbox { flex-shrink: 0; transform: scale(.85); transform-origin: left top; width: 40rpx; }
.review-message { display: block; margin-top: 18rpx; color: #846148; font-size: 23rpx; line-height: 1.65; }
.ai-result, .review-history { margin-top: 24rpx; padding-top: 22rpx; border-top: 1rpx solid #dceee5; }
.review-result-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12rpx; }.review-source { padding: 6rpx 12rpx; border-radius: 8rpx; background: #e1efe7; color: #315f51; font-size: 21rpx; }
.review-focus { display: block; margin-top: 12rpx; color: #567764; font-size: 22rpx; }
.review-summary { display: block; margin-top: 16rpx; color: #314d43; font-size: 26rpx; line-height: 1.75; }
.review-list { margin-top: 20rpx; }.review-list-label { color: #65796f; font-size: 22rpx; font-weight: 700; }.review-list-item { display: block; margin-top: 10rpx; padding-left: 16rpx; border-left: 4rpx solid #bad5c5; color: #435c50; font-size: 24rpx; line-height: 1.7; word-break: break-all; }
.review-disclaimer { padding-top: 16rpx; margin-top: 20rpx; border-top: 1rpx solid #dceee5; }
.review-history-row { display: flex; align-items: center; gap: 12rpx; border-bottom: 1rpx solid #dceee5; }.review-history-open { flex: 1; min-width: 0; margin: 0; padding: 20rpx 0; background: transparent; color: #315f51; text-align: left; font-size: 24rpx; line-height: 1.5; }.review-delete { margin: 0; padding: 20rpx 8rpx; background: transparent; color: #8c665b; font-size: 22rpx; line-height: 1.5; }
button::after { border: 0; }
</style>
