<template>
  <view class="care-tracker">
    <view class="tool-panel care-overview">
      <view class="panel-head"><text class="panel-title">今天的照护</text><text class="panel-badge">{{ day }}</text></view>
      <view class="care-stats">
        <view><text class="stat-value">{{ summary.feedingCount }}<text class="stat-unit"> 次</text></text><text class="stat-label">喂奶 · {{ summary.knownAmountCount ? `${summary.feedingAmountMl} ml 已记录` : '奶量未记录' }}</text></view>
        <view><text class="stat-value">{{ summary.diaperCount }}<text class="stat-unit"> 次</text></text><text class="stat-label">换尿布</text></view>
        <view class="sleep-stat"><text class="stat-value">{{ summary.sleepCount ? formatCareDuration(summary.sleepSeconds) : '—' }}</text><text class="stat-label">睡眠 · {{ summary.sleepCount }} 条含时长记录</text></view>
      </view>
      <text class="panel-hint">仅统计已保存记录；未知奶量不计入总量，跨日睡眠按当天时段计算。</text>
      <text v-if="summary.untimedSleepCount" class="panel-hint">另有 {{ summary.untimedSleepCount }} 条早期睡眠记录没有结束时间。</text>
    </view>
    <view class="tool-panel care-entry">
      <view class="care-kinds">
        <button v-for="item in kinds" :key="item.value" :class="{ selected: kind === item.value }" :disabled="!!session && kind !== item.value" @tap="kind = item.value">{{ item.label }}</button>
      </view>
      <view v-if="kind !== 'diaper' && !session" class="entry-modes"><button :class="{ selected: mode === 'timer' }" @tap="mode = 'timer'">即时计时</button><button :class="{ selected: mode === 'manual' }" @tap="mode = 'manual'">补记一笔</button></view>
      <view v-if="kind !== 'diaper' && mode === 'timer'" class="care-clock">
        <text class="clock-label">{{ session ? `${kind === 'feeding' ? '喂奶' : '睡眠'}进行中` : '准备好就开始' }}</text>
        <text class="clock-value">{{ elapsed }}</text>
        <text class="panel-hint">{{ session ? `开始于 ${displayStart} · 退出后可继续` : '开始时会保存起点，结束后进入历史记录' }}</text>
      </view>
      <template v-else>
        <text class="panel-label">{{ kind === 'diaper' ? '记录时间' : '开始时间' }}</text>
        <view class="date-fields"><picker mode="date" :value="date" :end="day" @change="date = $event.detail.value"><view class="panel-input">{{ date }}</view></picker><picker mode="time" :value="time" @change="time = $event.detail.value"><view class="panel-input">{{ time }}</view></picker></view>
        <template v-if="kind !== 'diaper'"><text class="panel-label">持续分钟{{ kind === 'feeding' ? '（选填）' : '' }}</text><input v-model="minutes" class="panel-input" type="number" aria-label="持续分钟" placeholder="例如 20" /></template>
      </template>
      <template v-if="kind === 'feeding'">
        <text class="panel-label">喂养方式（选填）</text>
        <view class="care-options"><button v-for="item in sides" :key="item.value" :class="{ selected: side === item.value }" @tap="side = side === item.value ? '' : item.value">{{ item.label }}</button></view>
        <text class="panel-label">奶量 ml（未知可留空）</text><input v-model="amount" class="panel-input" type="number" aria-label="奶量 ml" placeholder="亲喂无需估算奶量" />
      </template>
      <template v-if="kind === 'diaper'">
        <text class="panel-label">尿布类型（选填）</text><view class="care-options"><button v-for="item in diaperTypes" :key="item.value" :class="{ selected: diaperType === item.value }" @tap="diaperType = diaperType === item.value ? '' : item.value">{{ item.label }}</button></view>
      </template>
      <text class="panel-label">备注（选填）</text><input v-model="note" class="panel-input" maxlength="60" aria-label="照护备注" placeholder="留下方便家人交接的一句话" />
      <text v-if="message" class="care-message" role="alert">{{ message }}</text>
      <button class="panel-button care-submit" :disabled="busy" @tap="submit">{{ session ? '结束并保存' : kind !== 'diaper' && mode === 'timer' ? `开始${kind === 'feeding' ? '喂奶' : '睡眠'}计时` : '保存这笔照护' }}</button>
      <button v-if="session" class="panel-button panel-button--quiet care-cancel" @tap="cancel">取消本次计时</button>
      <text class="panel-hint">只记录实际情况，不评价奶量、睡眠或排便是否正常。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { reportOwner } from '@/utils/report-drafts'
import { localToolDate } from '@/utils/tool-history'
import { saveToolRecord, type LocalToolRecord } from '@/utils/tool-records'
import { formatCareDuration, summarizeCareRecords, type CareKind } from '@/utils/care-summary'
import { carePayload, readCareSession, writeCareSession, startCareSession, finishCareSession, discardCareSession, type CareSession } from '@/utils/care-session'

const props = defineProps<{ records: LocalToolRecord[]; owner: string }>()
const emit = defineEmits<{ saved: [record: LocalToolRecord] }>()
const kinds: Array<{ value: CareKind; label: string }> = [{ value: 'feeding', label: '喂奶' }, { value: 'diaper', label: '尿布' }, { value: 'sleep', label: '睡眠' }]
const sides = [{ value: 'left', label: '左侧' }, { value: 'right', label: '右侧' }, { value: 'bottle', label: '奶瓶' }, { value: 'mixed', label: '混合' }]
const diaperTypes = [{ value: 'wet', label: '尿湿' }, { value: 'stool', label: '便便' }, { value: 'both', label: '尿湿＋便便' }]
const kind = ref<CareKind>('feeding'), mode = ref<'timer' | 'manual'>('timer')
const session = ref<CareSession | null>(null), now = ref(Date.now()), busy = ref(false), message = ref('')
const side = ref(''), amount = ref(''), note = ref(''), diaperType = ref(''), minutes = ref('')
const date = ref(localToolDate()), time = ref('')
const day = computed(() => localToolDate(new Date(now.value)))
const summary = computed(() => summarizeCareRecords(props.records, day.value))
const displayStart = computed(() => session.value ? new Date(session.value.startedAt).toLocaleString('zh-CN', { hour12: false }) : '')
const elapsed = computed(() => {
  const seconds = session.value ? Math.max(0, Math.floor((now.value - Date.parse(session.value.startedAt)) / 1000)) : 0
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
})
let ticker: ReturnType<typeof setInterval> | undefined
function resetTime() { const d = new Date(); date.value = localToolDate(d); time.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
function stopTick() { if (ticker) clearInterval(ticker); ticker = undefined }
function refresh() {
  stopTick(); now.value = Date.now()
  try {
    session.value = readCareSession(props.owner)
    if (session.value) {
      kind.value = session.value.kind; mode.value = 'timer'
      side.value = session.value.side; amount.value = session.value.amount; note.value = session.value.note
    }
  } catch { message.value = '未能读取进行中的计时，请重新打开工具'; return }
  ticker = setInterval(() => { now.value = Date.now() }, 1000)
}
watch(() => props.owner, () => { session.value = null; side.value = ''; amount.value = ''; note.value = ''; diaperType.value = ''; minutes.value = ''; kind.value = 'feeding'; mode.value = 'timer'; message.value = ''; resetTime(); refresh() })
watch([side, amount, note], () => {
  if (!session.value || reportOwner() !== props.owner) return
  const next = { ...session.value, side: side.value, amount: amount.value, note: note.value }
  try { writeCareSession(props.owner, next); session.value = next }
  catch { message.value = '本次填写未能保存，请检查本机空间后重试；计时起点仍保留。' }
})
watch([kind, mode], () => { if (!session.value) { resetTime(); message.value = '' } })
function submit() {
  if (busy.value) return
  busy.value = true; message.value = ''; now.value = Date.now()
  try {
    if (reportOwner() !== props.owner) throw new Error('账号已变化，请重新打开工具')
    if (!session.value && mode.value === 'timer' && kind.value !== 'diaper') {
      session.value = startCareSession(props.owner, kind.value)
      session.value = { ...session.value, side: side.value, amount: amount.value, note: note.value }
      writeCareSession(props.owner, session.value)
      return
    }
    let record: LocalToolRecord
    if (session.value) {
      record = finishCareSession(props.owner, { ...session.value, side: side.value, amount: amount.value, note: note.value })
      session.value = null
    } else {
      const start = new Date(`${date.value}T${time.value}:00`)
      if (!Number.isFinite(start.getTime()) || localToolDate(start) !== date.value) throw new Error('请选择有效的日期和时间')
      const duration = minutes.value.trim() ? Number(minutes.value) : null
      if (kind.value !== 'diaper' && ((duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 1440)) || (kind.value === 'sleep' && duration === null))) throw new Error('请填写 1–1440 分钟的实际时长')
      const end = kind.value !== 'diaper' && duration !== null ? new Date(start.getTime() + duration * 60000).toISOString() : null
      record = saveToolRecord('care', 'log', carePayload(kind.value, start.toISOString(), end, { side: side.value, amount: amount.value, diaperType: diaperType.value, note: note.value }))
    }
    amount.value = ''; note.value = ''; minutes.value = ''; resetTime(); emit('saved', record)
  } catch (error) { message.value = error instanceof Error ? error.message : '保存未完成，请重试' }
  finally { busy.value = false }
}
function cancel() {
  const owner = props.owner, id = session.value?.id
  uni.showModal({ title: '取消本次计时？', content: '这次计时不会保存成记录，已保存的历史不受影响。', success: result => {
    if (!result.confirm || owner !== props.owner || id !== session.value?.id) return
    try { discardCareSession(owner); session.value = null; message.value = ''; amount.value = ''; note.value = '' }
    catch { message.value = '取消未完成，请重试' }
  } })
}
resetTime(); refresh()
onShow(refresh); onHide(stopTick); onBeforeUnmount(stopTick)
</script>

<style scoped lang="scss">
@use './tool-panel.scss';
.care-overview { background: #eef6f1; box-shadow: none; }
.care-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24rpx; margin-top: 28rpx; }
.stat-value, .stat-label { display: block; }.stat-value { color: #205e4b; font-size: 38rpx; font-weight: 700; }.stat-unit { font-size: 24rpx; font-weight: 400; }.stat-label { margin-top: 8rpx; color: #586c62; font-size: 23rpx; line-height: 1.6; }
.sleep-stat { grid-column: 1 / -1; border-top: 1rpx solid #d5e7dc; padding-top: 20rpx; }
.care-kinds, .entry-modes, .care-options, .date-fields { display: flex; gap: 12rpx; }
.care-kinds button, .entry-modes button, .care-options button { flex: 1; min-width: 0; margin: 0; padding: 20rpx 8rpx; min-height: 88rpx; line-height: 1.8; font-size: 26rpx; border-radius: 16rpx; background: #f6f1ee; color: #625650; }
button::after { border: none; }.care-kinds .selected, .care-options .selected { color: #fff; background: #287e68; font-weight: 700; }.care-kinds button[disabled] { opacity: .5; }
.entry-modes { margin-top: 20rpx; border-bottom: 1rpx solid #eee7e1; }.entry-modes button { background: transparent; font-size: 24rpx; }.entry-modes .selected { color: #166c5b; font-weight: 700; border-bottom: 4rpx solid #287e68; border-radius: 0; }
.care-clock { text-align: center; padding: 32rpx 0 8rpx; }.clock-label { font-size: 25rpx; color: #596c61; }.clock-value { display: block; margin-top: 14rpx; color: #246a54; font-size: 66rpx; font-weight: 700; font-variant-numeric: tabular-nums; }
.care-options { flex-wrap: wrap; }.care-options button { font-size: 24rpx; min-width: 100rpx; }.date-fields picker { flex: 1; min-width: 0; }.date-fields picker:first-child { flex: 1.6; }
.care-submit { margin-top: 28rpx; width: 100%; background: #287e68; }.care-cancel { width: 100%; margin-top: 8rpx; }.care-message { display: block; margin-top: 20rpx; font-size: 24rpx; line-height: 1.65; color: #965238; }
</style>
