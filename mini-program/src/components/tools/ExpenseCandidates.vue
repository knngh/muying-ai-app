<template>
  <view v-if="TOOL_AI_ENABLED" class="tool-panel expense-candidates">
    <view class="candidate-head">
      <view><text class="panel-title">一句话记账</text><text class="panel-hint">把多笔花费整理成待核对草稿，确认后才写入月账。</text></view>
    </view>
    <form @submit="submit">
      <textarea v-model="text" name="text" class="candidate-input" maxlength="500" placeholder="例如：奶粉 268，尿布 89" />
      <view class="candidate-actions">
        <text class="candidate-consent" v-if="owner === 'guest'">登录后可整理；也可以继续使用上面的手工记账。</text>
        <checkbox-group v-else @change="consent = $event.detail.value.length > 0"><label class="candidate-consent"><checkbox value="consent" :checked="consent" :disabled="busy" color="#287e68" /><text>同意把这段文字发送至服务端进行分类。金额只取原文，日期由我确认。</text></label></checkbox-group>
        <button class="panel-button candidate-submit" form-type="submit" :disabled="busy || owner === 'guest' || !text.trim() || !consent">{{ busy ? '正在整理…' : '整理成待核对账目' }}</button>
      </view>
    </form>
    <text v-if="message" class="candidate-message" role="alert">{{ message }}</text>

    <form v-for="candidate in candidates" :key="candidate.id" class="candidate-row" :class="{ 'candidate-row--saved': savedIds.includes(candidate.id) }" @submit="saveCandidate(candidate, $event)">
      <view class="candidate-fragment"><text class="candidate-index">{{ savedIds.includes(candidate.id) ? '✓' : '待核对' }}</text><text>{{ candidate.fragment }}</text></view>
      <text v-if="candidate.status === 'not_recordable'" class="candidate-warning">{{ candidate.warnings.join(' ') }}</text>
      <template v-else>
        <text class="candidate-label">金额（原文候选，可修改）</text>
        <input v-model="amounts[candidate.id]" name="amount" class="panel-input candidate-amount" type="digit" maxlength="16" :disabled="savedIds.includes(candidate.id)" />
        <text class="candidate-label">类型</text>
        <view class="candidate-choices"><button v-for="item in EXPENSE_DIRECTIONS" :key="item.value" form-type="button" :class="{ selected: directions[candidate.id] === item.value }" :disabled="savedIds.includes(candidate.id)" @tap="directions[candidate.id] = item.value">{{ item.label }}</button></view>
        <text class="candidate-label">分类</text>
        <view class="candidate-choices"><button v-for="item in EXPENSE_CATEGORIES" :key="item.value" form-type="button" :class="{ selected: categories[candidate.id] === item.value }" :disabled="savedIds.includes(candidate.id)" @tap="categories[candidate.id] = item.value">{{ item.label }}</button></view>
        <text class="candidate-label">实际发生日期</text>
        <picker mode="date" :value="pickerDate(candidate.id)" :end="currentDay" :disabled="savedIds.includes(candidate.id)" @change="dates[candidate.id] = $event.detail.value"><view class="panel-input candidate-date">{{ dates[candidate.id] || '请选择日期' }}</view></picker>
        <text v-if="candidate.warnings.length" class="candidate-warning">{{ candidate.warnings.join(' ') }}</text>
        <button v-if="!savedIds.includes(candidate.id)" class="panel-button candidate-save" form-type="submit" :disabled="busy">确认并保存到月账</button>
        <text v-else class="candidate-saved">已保存，可在下方明细核对</text>
      </template>
    </form>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { TOOL_AI_ENABLED } from '@/config/features'
import { toolRecordApi } from '@/api/modules'
import { EXPENSE_CATEGORIES, EXPENSE_DIRECTIONS, parseExpenseCents, isExpenseDate, type ExpenseDirection } from '@/utils/expense-ledger'
import { readToolRecords, saveToolRecord, type LocalToolRecord } from '@/utils/tool-records'
import { reportOwner } from '@/utils/report-drafts'
import type { ExpenseCandidate } from '../../../../shared/types/expense-candidates'

const props = defineProps<{ records: LocalToolRecord[]; owner: string }>()
const emit = defineEmits<{ saved: [record: LocalToolRecord] }>()
const text = ref(''), consent = ref(false), busy = ref(false), message = ref('')
const candidates = ref<ExpenseCandidate[]>([]), savedIds = ref<string[]>([])
const candidateRunId = ref('')
const amounts = ref<Record<string, string>>({}), directions = ref<Record<string, ExpenseDirection | null>>({}), categories = ref<Record<string, string | null>>({}), dates = ref<Record<string, string>>({})
const currentDay = ref(localDate())
function localDate() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }
function pickerDate(id: string) { return dates.value[id] || currentDay.value }
watch(() => props.owner, () => { text.value = ''; consent.value = false; busy.value = false; message.value = ''; candidates.value = []; savedIds.value = []; amounts.value = {}; directions.value = {}; categories.value = {}; dates.value = {}; currentDay.value = localDate() })
function setup(items: ExpenseCandidate[]) {
  candidates.value = items; savedIds.value = []; candidateRunId.value = `candidate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; amounts.value = {}; directions.value = {}; categories.value = {}; dates.value = {}
  for (const item of items) { amounts.value[item.id] = item.amountCents === null ? '' : String(item.amountCents / 100); directions.value[item.id] = item.direction; categories.value[item.id] = item.category }
}
async function submit(event: Event) {
  if (busy.value || props.owner === 'guest' || reportOwner() !== props.owner || !consent.value) return
  const fields = (event as unknown as { detail: { value: { text?: string } } }).detail.value
  const input = String(fields.text ?? text.value).trim()
  if (!input) return
  const owner = props.owner; busy.value = true; message.value = ''
  try {
    const response = await toolRecordApi.expenseCandidates({ text: input, consent: true })
    if (owner !== props.owner || reportOwner() !== owner) return
    setup(response.candidates); text.value = input
    message.value = response.source === 'ai' ? '已整理，请逐笔核对金额、类型、分类和日期。' : 'AI 暂不可用，已保留原话；请使用手工记账。'
  } catch { if (owner === props.owner) message.value = '整理未完成，原话已保留；请稍后重试或使用手工记账。' }
  finally { if (owner === props.owner) busy.value = false }
}
function saveCandidate(candidate: ExpenseCandidate, event: Event) {
  if (busy.value || savedIds.value.includes(candidate.id)) return
  const owner = props.owner
  if (owner !== props.owner || reportOwner() !== owner) { message.value = '账号已变化，请重新打开工具'; return }
  const fields = (event as unknown as { detail: { value: { amount?: string } } }).detail.value
  const submittedAmount = String(fields.amount ?? amounts.value[candidate.id] ?? '')
  amounts.value[candidate.id] = submittedAmount
  const cents = parseExpenseCents(submittedAmount), direction = directions.value[candidate.id], category = categories.value[candidate.id], date = dates.value[candidate.id]
  if (cents === null || !direction || !category || !isExpenseDate(date) || date > currentDay.value) { message.value = '请补全有效金额、类型、分类和实际发生日期。'; return }
  const sourceCandidateId = `${candidateRunId.value}:${candidate.id}`
  const existing = readToolRecords().find(record => record.toolId === 'expenses' && record.recordType === 'entry' && record.payload.sourceCandidateId === sourceCandidateId)
  if (existing) { savedIds.value = [...savedIds.value, candidate.id]; message.value = '这笔已经保存过了，请继续核对其他账目。'; return }
  busy.value = true; message.value = ''
  try {
    const record = saveToolRecord('expenses', 'entry', { amount: cents / 100, direction, category, date, note: null, sourceCandidateId, sourceCandidateText: text.value })
    if (owner !== props.owner || owner !== reportOwner()) return
    savedIds.value = [...savedIds.value, candidate.id]; emit('saved', record); message.value = '已写入月账，原话保留在来源记录中。'
  } catch { message.value = '保存未完成，请检查本机空间后重试。' }
  finally { busy.value = false }
}
</script>

<style scoped lang="scss">
@use './tool-panel.scss';
.expense-candidates { background: #f2f8f5; border: 1rpx solid #dceee5; box-shadow: none; }.candidate-head { display: flex; gap: 16rpx; }.candidate-input { width: 100%; min-height: 148rpx; margin-top: 18rpx; padding: 18rpx; box-sizing: border-box; border-radius: 16rpx; background: #fffdfb; color: #435c50; font-size: 27rpx; line-height: 1.7; }.candidate-actions { margin-top: 16rpx; }.candidate-consent { display: flex; align-items: flex-start; gap: 8rpx; color: #53675c; font-size: 22rpx; line-height: 1.65; }.candidate-consent checkbox { flex-shrink: 0; transform: scale(.85); transform-origin: left top; }.candidate-submit { width: 100%; margin-top: 16rpx; }.candidate-message, .candidate-warning, .candidate-saved { display: block; margin-top: 14rpx; color: #846148; font-size: 23rpx; line-height: 1.65; }.candidate-row { margin-top: 22rpx; padding-top: 20rpx; border-top: 1rpx solid #dceee5; }.candidate-row--saved { opacity: .72; }.candidate-fragment { display: flex; gap: 10rpx; color: #314d43; font-size: 26rpx; font-weight: 700; line-height: 1.6; word-break: break-all; }.candidate-index { flex-shrink: 0; color: #287e68; }.candidate-label { display: block; margin-top: 16rpx; color: #65796f; font-size: 22rpx; }.candidate-amount { margin-top: 8rpx; font-size: 32rpx; }.candidate-choices { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 8rpx; }.candidate-choices button { flex: 1 1 28%; min-height: 72rpx; margin: 0; padding: 12rpx 8rpx; border-radius: 12rpx; background: #fffdfb; color: #53675c; font-size: 22rpx; line-height: 1.5; }.candidate-choices .selected { background: #287e68; color: #fff; }.candidate-date { margin-top: 8rpx; }.candidate-save { width: 100%; margin-top: 20rpx; }.candidate-row button[disabled], .candidate-row input[disabled] { opacity: .62; } button::after { border: 0; }
</style>
