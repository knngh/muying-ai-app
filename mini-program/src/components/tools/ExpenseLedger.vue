<template>
  <view class="expense-ledger">
    <view class="tool-panel expense-overview">
      <view class="month-navigation">
        <button class="month-step" aria-label="上个月" :disabled="month <= '1900-01'" @tap="moveMonth(-1)">‹</button>
        <picker class="month-picker" mode="date" fields="month" :value="month" start="1900-01" :end="currentMonth" @change="month = $event.detail.value.slice(0, 7)"><view>{{ month.replace('-', ' 年 ') }} 月⌄</view></picker>
        <button class="month-step" aria-label="下个月" :disabled="month >= currentMonth" @tap="moveMonth(1)">›</button>
      </view>
      <text class="expense-eyebrow">已记录净支出 · 元</text>
      <text class="expense-net">{{ money(summary.netCents) }}</text>
      <view class="expense-totals">
        <view><text class="total-label">支出</text><text class="total-value">{{ money(summary.expenseCents) }}</text></view>
        <view><text class="total-label">退款</text><text class="total-value">{{ money(summary.refundCents) }}</text></view>
        <view><text class="total-label">转账 · 单列</text><text class="total-value">{{ money(summary.transferCents) }}</text></view>
      </view>
      <text class="panel-hint">净支出＝支出－退款。退款按到账日归入月份，转账不计入净支出。</text>
      <view class="month-actions"><text>{{ summary.entries.length }} 笔有效账目</text><button v-if="month !== currentMonth" class="back-to-month" @tap="month = currentMonth">回到本月</button></view>
      <button v-if="summary.categories.length" class="distribution-toggle" :aria-expanded="showDistribution" @tap="showDistribution = !showDistribution">支出分类分布 <text>{{ showDistribution ? '收起' : '展开 ›' }}</text></button>
      <view v-if="showDistribution && summary.categories.length" class="expense-distribution">
        <view v-for="category in summary.categories" :key="category.id" class="expense-category-row">
          <view class="category-labels"><text>{{ category.label }}</text><text>{{ money(category.cents) }} 元 · {{ category.percent }}%</text></view>
          <view class="category-track"><view class="category-fill" :style="{ width: category.percent + '%' }" /></view>
        </view>
        <text class="panel-hint">占比按支出计算，退款和转账单列；四舍五入后合计可能略有差异。</text>
      </view>
    </view>

    <view class="tool-panel expense-entry">
      <button class="entry-toggle" :aria-expanded="showEntry" @tap="showEntry = !showEntry"><text class="panel-title">记一笔账</text><text>{{ showEntry ? '收起' : '＋ 添加' }}</text></button>
      <form v-if="showEntry" @submit="save">
        <view class="expense-choices direction-choices"><button v-for="item in EXPENSE_DIRECTIONS" :key="item.value" :class="{ selected: direction === item.value }" @tap="direction = item.value">{{ item.label }}</button></view>
        <text class="panel-label">{{ direction === 'refund' ? '退款到账日期' : direction === 'transfer' ? '转账日期' : '支出日期' }}</text>
        <picker class="expense-date" mode="date" :value="date" :end="currentDay" @change="date = $event.detail.value"><view class="panel-input">{{ date }}</view></picker>
        <text class="panel-label">金额（元）</text><input v-model="amount" name="amount" class="panel-input expense-amount" type="digit" maxlength="16" aria-label="账目金额" placeholder="0.00" />
        <text class="panel-label">分类</text><view class="expense-choices category-choices"><button v-for="item in EXPENSE_CATEGORIES" :key="item.value" :class="{ selected: category === item.value }" @tap="category = item.value">{{ item.label }}</button></view>
        <text class="panel-label">备注（选填）</text><input v-model="note" name="note" class="panel-input" maxlength="60" aria-label="账目备注" :placeholder="direction === 'refund' ? '例如：奶粉退货，原购买日期' : '例如：奶粉一罐'" />
        <text v-if="message" class="expense-message" role="alert">{{ message }}</text>
        <button class="panel-button expense-submit" form-type="submit" :disabled="busy">保存{{ directionLabel }}</button>
        <text class="panel-hint">填写实际发生的金额，最多两位小数。{{ direction === 'transfer' ? '只记录资金转移，不代表收入或消费。' : direction === 'refund' ? '退款单独记一笔，原支出记录保留。' : '预算或未付款订单请等实际支付后再记。' }}</text>
      </form>
    </view>

    <view class="tool-panel expense-month-entries">
      <view class="panel-head"><text class="panel-title">{{ month.slice(5) }} 月明细</text><text class="panel-badge">{{ filtered.length }} 笔</text></view>
      <view class="expense-filters">
        <picker :range="filterDirections" range-key="label" :value="directionIndex" @change="directionIndex = Number($event.detail.value)"><view>{{ filterDirections[directionIndex].label }}⌄</view></picker>
        <picker :range="filterCategories" range-key="label" :value="categoryIndex" @change="categoryIndex = Number($event.detail.value)"><view>{{ filterCategories[categoryIndex].label }}⌄</view></picker>
      </view>
      <view v-if="!filtered.length" class="expense-empty"><text>{{ summary.entries.length ? '这个筛选下还没有账目' : '这个月还没有有效账目' }}</text><text class="panel-hint">{{ summary.entries.length ? '换个分类或类型看看。' : '记下实际花费，月底可以回来核对。' }}</text></view>
      <button v-for="item in filtered.slice(0, limit)" :key="item.record.id" class="expense-record" @tap="emit('viewRecord', item.record.id)">
        <view class="record-heading"><text>{{ expenseCategoryLabel(item.record.payload.category) }}</text><text class="record-amount">{{ money(item.cents) }} 元</text></view>
        <view class="record-meta"><text>{{ item.date }} · {{ expenseDirectionLabel(item.record) }}</text><text>详情 ›</text></view>
        <text v-if="item.record.payload.note" class="record-note">{{ item.record.payload.note }}</text>
      </button>
      <button v-if="filtered.length > limit" class="panel-button panel-button--secondary expense-more" @tap="limit += 20">查看更多（还有 {{ filtered.length - limit }} 笔）</button>
      <text class="panel-hint">仅汇总此账号在本机保留的账目，不代表家庭全部收支。点击明细可核对原记录。</text>
      <view v-if="summary.excludedRecords.length" class="excluded-expenses">
        <button class="excluded-toggle" :aria-expanded="showExcluded" @tap="showExcluded = !showExcluded">待核对旧账 · {{ summary.excludedRecords.length }} 笔 <text>{{ showExcluded ? '收起' : '查看 ›' }}</text></button>
        <template v-if="showExcluded">
          <text class="panel-hint">以下旧账缺少可用的日期、金额或类型，暂未计入任何月账。请核对原记录，补记正确信息后移除旧账。</text>
          <button v-for="record in summary.excludedRecords.slice(0, excludedLimit)" :key="record.id" class="excluded-record" @tap="emit('viewRecord', record.id)">{{ historyTitle(record) }} ›</button>
          <button v-if="summary.excludedRecords.length > excludedLimit" class="panel-button panel-button--quiet" @tap="excludedLimit += 20">查看更多旧账</button>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { EXPENSE_CATEGORIES, EXPENSE_DIRECTIONS, expenseCategoryLabel, expenseDirectionLabel, formatExpenseCents as money, isExpenseDate, parseExpenseCents, summarizeExpenseMonth, type ExpenseDirection } from '@/utils/expense-ledger'
import { historyTitle, localToolDate } from '@/utils/tool-history'
import { reportOwner } from '@/utils/report-drafts'
import { saveToolRecord, type LocalToolRecord } from '@/utils/tool-records'
const props = defineProps<{ records: LocalToolRecord[]; owner: string }>()
const emit = defineEmits<{ saved: [record: LocalToolRecord]; viewRecord: [id: string] }>()
const currentDay = ref(localToolDate()), currentMonth = computed(() => currentDay.value.slice(0, 7))
const month = ref(currentMonth.value), date = ref(currentDay.value)
const amount = ref(''), category = ref('checkup'), note = ref(''), direction = ref<ExpenseDirection>('expense')
const showEntry = ref(!props.records.length), showDistribution = ref(false), showExcluded = ref(false), message = ref(''), busy = ref(false)
const directionLabel = computed(() => EXPENSE_DIRECTIONS.find(item => item.value === direction.value)?.label || '支出')
const filterDirections = [{ value: 'all', label: '全部类型' }, ...EXPENSE_DIRECTIONS]
const filterCategories = [{ value: 'all', label: '全部分类' }, ...EXPENSE_CATEGORIES]
const directionIndex = ref(0), categoryIndex = ref(0), limit = ref(10), excludedLimit = ref(10)
const summary = computed(() => summarizeExpenseMonth(props.records, month.value))
const filtered = computed(() => summary.value.entries.filter(item => (!directionIndex.value || item.direction === filterDirections[directionIndex.value].value) && (!categoryIndex.value || item.category === filterCategories[categoryIndex.value].value)))
watch([month, directionIndex, categoryIndex], () => { limit.value = 10 })
watch(month, () => { directionIndex.value = 0; categoryIndex.value = 0 })
watch(() => props.owner, () => {
  currentDay.value = localToolDate(); month.value = currentMonth.value; date.value = currentDay.value
  amount.value = ''; category.value = 'checkup'; note.value = ''; direction.value = 'expense'; message.value = ''
  directionIndex.value = 0; categoryIndex.value = 0; limit.value = 10
  showEntry.value = !props.records.length; showDistribution.value = false; showExcluded.value = false; excludedLimit.value = 10
})
onShow(() => {
  const previous = currentDay.value, next = localToolDate()
  currentDay.value = next
  if (month.value === previous.slice(0, 7)) month.value = next.slice(0, 7)
  if (date.value === previous) date.value = next
})
function moveMonth(step: number) {
  const value = new Date(month.value + '-01T12:00:00')
  value.setMonth(value.getMonth() + step)
  const next = localToolDate(value).slice(0, 7)
  if (next >= '1900-01' && next <= currentMonth.value) month.value = next
}
function save(event: Event) {
  if (busy.value) return
  busy.value = true; message.value = ''
  try {
    if (reportOwner() !== props.owner) throw new Error('账号已变化，请重新打开工具')
    // Read the submitted fields, since model updates may still be throttled while typing.
    const fields = (event as unknown as { detail: { value: { amount: string; note: string } } }).detail.value
    const cents = parseExpenseCents(fields.amount)
    if (cents === null) throw new Error('请填写 0.01–1,000,000 元，最多两位小数')
    if (!isExpenseDate(date.value) || date.value > localToolDate()) throw new Error('请选择实际发生日期，不能晚于今天')
    const record = saveToolRecord('expenses', 'entry', { amount: cents / 100, direction: direction.value, category: category.value, date: date.value, note: fields.note.trim() || null })
    month.value = date.value.slice(0, 7); directionIndex.value = 0; categoryIndex.value = 0
    amount.value = ''; note.value = ''; showEntry.value = false; emit('saved', record)
  } catch (error) { message.value = error instanceof Error ? error.message : '未能保存，请检查本机空间后重试' }
  finally { busy.value = false }
}
</script>

<style scoped lang="scss">
@use './tool-panel.scss';
button::after { border: none; }
.expense-overview { background: #fbf0e5; box-shadow: none; }.month-navigation { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }.month-step { width: 88rpx; min-height: 88rpx; margin: 0; padding: 0; font-size: 42rpx; line-height: 88rpx; background: transparent; color: #805639; }.month-step[disabled] { opacity: .35; }.month-picker { color: #69492f; font-size: 30rpx; font-weight: 700; padding: 20rpx 8rpx; }
.expense-eyebrow { display: block; margin-top: 20rpx; color: #815f45; font-size: 25rpx; }.expense-net { display: block; margin: 12rpx 0 28rpx; color: #69492f; font-size: 52rpx; font-weight: 700; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.expense-totals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16rpx; padding-bottom: 20rpx; border-bottom: 1rpx solid #e9d9ca; }.total-label, .total-value { display: block; }.total-label { color: #815f45; font-size: 23rpx; }.total-value { margin-top: 8rpx; color: #69492f; font-size: 28rpx; font-weight: 600; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.month-actions { display: flex; align-items: center; justify-content: space-between; margin-top: 16rpx; color: #815f45; font-size: 23rpx; }.back-to-month { padding: 16rpx 8rpx; margin: 0; font-size: 24rpx; line-height: 1.8; background: transparent; color: #166c5b; }
.distribution-toggle, .entry-toggle, .excluded-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 20rpx 0; margin: 0; text-align: left; background: transparent; font-size: 26rpx; line-height: 1.8; color: #69492f; }.distribution-toggle { margin-top: 12rpx; border-top: 1rpx solid #e9d9ca; }.entry-toggle { padding: 8rpx 0; min-height: 88rpx; }.entry-toggle > text:last-child { font-size: 25rpx; color: #166c5b; }
.expense-category-row { margin-top: 18rpx; }.category-labels { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8rpx; font-size: 24rpx; color: #69492f; }.category-track { height: 10rpx; margin-top: 12rpx; background: #ead9c7; border-radius: 8rpx; overflow: hidden; }.category-fill { height: 100%; background: #af7449; border-radius: 8rpx; }
.expense-choices { display: flex; gap: 12rpx; flex-wrap: wrap; }.expense-choices button { margin: 0; padding: 20rpx 12rpx; min-height: 88rpx; border-radius: 16rpx; font-size: 25rpx; line-height: 1.8; background: #f6f1ee; color: #625650; }.direction-choices { margin-top: 20rpx; }.direction-choices button { flex: 1; }.category-choices button { flex: 1 1 28%; }.expense-choices .selected { color: #fff; background: #9a6441; font-weight: 600; }.expense-amount { font-size: 38rpx; height: 104rpx; }.expense-submit { width: 100%; margin-top: 26rpx; background: #9a6441; }.expense-message { display: block; margin-top: 20rpx; color: #965238; font-size: 24rpx; line-height: 1.7; }
.expense-filters { display: flex; gap: 12rpx; margin-top: 20rpx; }.expense-filters picker { flex: 1; min-width: 0; padding: 20rpx 12rpx; background: #faf6f3; border-radius: 14rpx; color: #625650; font-size: 25rpx; line-height: 1.8; }.expense-empty { padding: 36rpx 0; text-align: center; color: #766b67; font-size: 27rpx; }
.expense-record { width: 100%; margin: 0; padding: 24rpx 0; border-bottom: 1rpx solid #eee7e1; text-align: left; background: transparent; line-height: 1.7; border-radius: 0; }.record-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8rpx 16rpx; color: #514743; font-size: 28rpx; font-weight: 600; overflow-wrap: anywhere; }.record-amount { color: #805639; font-variant-numeric: tabular-nums; }.record-meta { display: flex; justify-content: space-between; gap: 12rpx; margin-top: 8rpx; color: #766b67; font-size: 23rpx; }.record-meta text:last-child { color: #166c5b; }.record-note { display: block; margin-top: 6rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #766b67; font-size: 24rpx; }.expense-more { width: 100%; margin-top: 20rpx; }
.excluded-expenses { margin-top: 24rpx; border-top: 1rpx solid #eee7e1; }.excluded-record { width: 100%; padding: 20rpx 0; margin: 0; text-align: left; background: transparent; color: #805639; font-size: 24rpx; line-height: 1.7; overflow-wrap: anywhere; }
</style>
