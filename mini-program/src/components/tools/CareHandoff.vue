<template>
  <view class="tool-panel care-handoff">
    <button class="handoff-toggle" :aria-expanded="expanded" @tap="toggle">
      <view class="handoff-heading"><text class="panel-title">照护交接单</text><text class="panel-hint">整理一天的记录，方便家人接着照护</text></view>
      <text class="handoff-action">{{ expanded ? '收起' : '展开 ›' }}</text>
    </button>
    <view v-if="expanded" class="handoff-body">
      <view class="handoff-date-row">
        <picker class="handoff-date" mode="date" :value="selectedDay" :end="today" @change="selectedDay = $event.detail.value"><view class="panel-input">{{ selectedDay }}<text>选择日期⌄</text></view></picker>
        <button v-if="selectedDay !== today" class="handoff-today" @tap="selectedDay = today">今天</button>
      </view>
      <view class="handoff-note-option"><text>附上原始备注</text><switch :checked="includeNotes" color="#287e68" aria-label="附上原始备注" @change="changeNotes" /></view>
      <text class="preview-caption">复制内容预览 · {{ handoff.entries.length }} 条记录</text>
      <scroll-view scroll-y class="handoff-paper" :scroll-top="previewScrollTop">
        <view class="paper-content">
          <text class="paper-title">贝护 · 照护交接单 · {{ selectedDay }}</text>
          <text class="paper-generated">{{ handoff.generated }}</text>
          <view class="handoff-totals"><text v-for="line in handoff.summaryLines" :key="line">{{ line }}</text></view>
          <text v-if="handoff.ongoing" class="handoff-ongoing">{{ handoff.ongoing }}</text>
          <text v-if="!handoff.entries.length" class="handoff-empty">当天暂无已保存记录</text>
          <button v-for="entry in handoff.entries" :key="entry.id" class="handoff-record" :aria-label="entry.time + ' ' + entry.detail + '，查看原记录'" @tap="emit('viewRecord', entry.id)">
            <view class="handoff-record-head"><text class="handoff-time">{{ entry.time }}</text><text class="handoff-source">核对原记录 ›</text></view>
            <text class="handoff-detail">{{ entry.detail }}</text>
            <text v-if="entry.note" class="handoff-note">备注：{{ entry.note }}</text>
          </button>
          <text class="paper-footer">{{ handoff.footer }}</text>
        </view>
      </scroll-view>
      <text class="panel-hint">上下滑动可核对全部内容。原记录修改或移除后，交接单会重新整理。</text>
      <text v-if="message" class="handoff-message" role="alert">{{ message }}</text>
      <button class="panel-button handoff-copy" :disabled="copying || (!handoff.entries.length && !handoff.ongoing)" @tap="copy">{{ copying ? '正在复制…' : '复制交接单' }}</button>
      <text class="panel-hint">复制后，可自行粘贴给家人。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { buildCareHandoff } from '@/utils/care-handoff'
import { readCareSession, type CareSession } from '@/utils/care-session'
import { reportOwner } from '@/utils/report-drafts'
import { readToolRecords, type LocalToolRecord } from '@/utils/tool-records'

const props = defineProps<{ records: LocalToolRecord[]; owner: string; today: string; session: CareSession | null }>()
const emit = defineEmits<{ viewRecord: [id: string]; refresh: [] }>()
const expanded = ref(false), selectedDay = ref(props.today), includeNotes = ref(false)
const generatedAt = ref(Date.now()), copying = ref(false), message = ref(''), previewScrollTop = ref(0)
const handoff = computed(() => buildCareHandoff(props.records, selectedDay.value, includeNotes.value, props.session, generatedAt.value))
function toggle() { expanded.value = !expanded.value; generatedAt.value = Date.now(); message.value = '' }
function changeNotes(event: Event) { includeNotes.value = (event as unknown as { detail: { value: boolean } }).detail.value }
watch(() => props.owner, () => { expanded.value = false; includeNotes.value = false; selectedDay.value = props.today; message.value = ''; copying.value = false })
watch(() => props.today, (today, previous) => { if (selectedDay.value === previous) selectedDay.value = today })
watch([() => props.records, () => props.session?.id, selectedDay, includeNotes], () => { generatedAt.value = Date.now() }, { deep: true })
watch([selectedDay, includeNotes], () => { message.value = '' })
// Toggle the scroll target so changing date always returns the preview to its heading.
watch(selectedDay, () => { previewScrollTop.value = previewScrollTop.value === 0 ? 1 : 0 })
function copy() {
  if (copying.value) return
  const owner = props.owner
  message.value = ''
  try {
    if (reportOwner() !== owner) throw new Error('账号已变化，请重新打开工具')
    const latest = buildCareHandoff(readToolRecords(), selectedDay.value, includeNotes.value, readCareSession(owner), generatedAt.value)
    if (latest.text !== handoff.value.text) {
      emit('refresh')
      message.value = '记录已变化，请核对更新后的预览再复制。'
      return
    }
    if (!latest.entries.length && !latest.ongoing) return
    copying.value = true
    uni.setClipboardData({
      data: latest.text,
      success: () => { if (owner === props.owner && owner === reportOwner()) message.value = '交接单已复制，可粘贴给家人。' },
      fail: () => { if (owner === props.owner && owner === reportOwner()) message.value = '复制未完成，请重试。' },
      complete: () => { if (owner === props.owner) copying.value = false },
    })
  } catch (error) { copying.value = false; message.value = error instanceof Error ? error.message : '暂时无法复制，请重试。' }
}
</script>

<style scoped lang="scss">
@use './tool-panel.scss';
.handoff-toggle { display: flex; align-items: center; gap: 16rpx; padding: 0; width: 100%; background: transparent; text-align: left; line-height: 1.5; }
button::after { border: none; }.handoff-heading { flex: 1; min-width: 0; }.handoff-heading .panel-hint { margin-top: 8rpx; font-size: 23rpx; }.handoff-action { flex-shrink: 0; color: #166c5b; font-size: 24rpx; }
.handoff-body { margin-top: 24rpx; }.handoff-date-row { display: flex; align-items: center; gap: 12rpx; }.handoff-date { flex: 1; min-width: 0; }.handoff-date .panel-input { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }.handoff-date .panel-input text { font-size: 22rpx; color: #766b67; }.handoff-today { margin: 0; padding: 20rpx 12rpx; line-height: 1.8; background: transparent; font-size: 24rpx; color: #166c5b; }
.handoff-note-option { display: flex; align-items: center; justify-content: space-between; min-height: 96rpx; gap: 16rpx; color: #5f5450; font-size: 25rpx; }.preview-caption { display: block; margin: 8rpx 0 16rpx; font-size: 24rpx; font-weight: 600; color: #5f5450; }
.handoff-paper { height: 620rpx; border: 1rpx solid #dce8df; border-radius: 18rpx; background: #f4f8f3; box-sizing: border-box; }.paper-content { padding: 24rpx; }.paper-title { display: block; color: #205e4b; font-size: 27rpx; font-weight: 700; line-height: 1.6; }.paper-generated { display: block; margin-top: 8rpx; color: #647469; font-size: 22rpx; }
.handoff-totals { padding: 20rpx 0; }.handoff-totals text { display: block; color: #345745; font-size: 25rpx; line-height: 1.8; }.handoff-ongoing { display: block; padding: 16rpx; margin-bottom: 16rpx; border-radius: 12rpx; background: #fff5e5; color: #805c2e; font-size: 24rpx; line-height: 1.7; }
.handoff-record { width: 100%; padding: 20rpx 0; border-top: 1rpx solid #dce8df; border-radius: 0; background: transparent; text-align: left; line-height: 1.7; }.handoff-record-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }.handoff-time { font-size: 25rpx; font-weight: 600; color: #345745; font-variant-numeric: tabular-nums; }.handoff-source { flex-shrink: 0; font-size: 22rpx; color: #166c5b; }.handoff-detail { display: block; margin-top: 6rpx; color: #4b554e; font-size: 25rpx; }.handoff-note { display: block; margin-top: 8rpx; color: #647469; font-size: 24rpx; overflow-wrap: anywhere; }
.paper-footer, .handoff-empty { display: block; padding-top: 16rpx; color: #647469; font-size: 23rpx; line-height: 1.75; }.handoff-empty { padding-bottom: 16rpx; }.handoff-copy { width: 100%; margin-top: 24rpx; background: #287e68; }.handoff-message { display: block; margin-top: 20rpx; color: #805c2e; font-size: 24rpx; line-height: 1.7; }
</style>
