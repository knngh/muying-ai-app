<template>
  <view class="tool-panel reminder-panel">
    <view class="panel-head"><view><text class="panel-title">{{ kind === 'vaccines' ? '接种提醒' : '我的提醒' }}</text><text class="panel-hint">{{ activeCount }} 项待处理 · {{ owner === 'guest' ? '游客本机' : '当前账号本机' }}</text></view><button class="panel-button panel-button--secondary" @tap="edit({ kind: kind || 'calendar', title: '' })">＋ 新建</button></view>
    <text class="panel-hint">在这里查看安排；加入手机日历后，由手机系统到点提醒。微信消息提醒尚未开启。</text>
    <view v-if="editor" class="reminder-editor">
      <text class="panel-title">{{ editor.id ? '修改提醒' : '设置提醒' }}</text>
      <text class="panel-label">事项名称</text><input v-model="title" class="panel-input reminder-title-input" maxlength="100" placeholder="例如：周三产检 / 乙肝第二剂" />
      <view class="reminder-field"><text>事项日期</text><picker mode="date" :value="date" @change="date = $event.detail.value"><view>{{ date }} ›</view></picker></view>
      <view class="reminder-field"><text>事项时间</text><picker mode="time" :value="time" @change="time = $event.detail.value"><view>{{ time }} ›</view></picker></view>
      <view class="reminder-field"><text>提前提醒</text><picker :range="REMINDER_LEAD_LABELS" :value="leadIndex" @change="leadIndex = Number($event.detail.value)"><view>{{ REMINDER_LEAD_LABELS[leadIndex] }} ›</view></picker></view>
      <text class="panel-hint">提醒时刻：{{ formatTime(reminderTime({ date, time, leadMinutes: REMINDER_LEADS[leadIndex] })) }}（本机时区）</text>
      <text v-if="kind === 'vaccines' || editor.kind === 'vaccines'" class="panel-hint">请填写接种门诊确认的日期；这里不计算补种或替代接种方案。</text>
      <view class="panel-actions"><button class="panel-button panel-button--quiet" @tap="editor = null">取消编辑</button><button class="panel-button reminder-save" @tap="save">保存提醒</button></view>
    </view>
    <text v-if="message" class="reminder-message">{{ message }}</text>
    <view class="reminder-filters"><button :class="{ active: !showClosed }" @tap="showClosed = false">待处理 {{ activeCount }}</button><button :class="{ active: showClosed }" @tap="showClosed = true">已结束 {{ items.length - activeCount }}</button></view>
    <view v-if="!visible.length" class="reminder-empty">{{ showClosed ? '完成或停止的提醒会留在这里' : '还没有提醒，可从待办或疫苗预约设置' }}</view>
    <view v-for="item in visible" :key="item.id" class="panel-row reminder-item">
      <view class="panel-head"><text class="panel-row-title">{{ item.title }}</text><text class="reminder-state">{{ stateLabel(item) }}</text></view>
      <text class="panel-hint">{{ item.date }} {{ item.time }} · {{ item.kind === 'vaccines' ? '疫苗' : '日历' }}</text>
      <text class="panel-hint">{{ REMINDER_LEAD_LABELS[REMINDER_LEADS.findIndex(value => value === item.leadMinutes)] }} · {{ formatTime(reminderTime(item)) }}</text>
      <text class="panel-hint">{{ item.phoneSignature ? (item.phoneSignature === reminderSignature(item) ? '已加入手机日历，请保持系统通知开启' : '手机日历中仍有旧安排，请同步修改') : '仅在小程序内展示，尚未加入手机日历' }}</text>
      <view v-if="item.state === 'active'" class="reminder-actions">
        <button class="panel-button panel-button--secondary reminder-export" :disabled="busy || item.phoneSignature === reminderSignature(item)" @tap="addToPhone(item)">{{ item.phoneSignature === reminderSignature(item) ? '已加入手机日历' : '加入手机日历' }}</button>
        <button class="panel-button panel-button--quiet" :disabled="busy" @tap="edit(item)">修改</button>
        <button v-if="!item.sourceKey" class="panel-button panel-button--quiet" :disabled="busy" @tap="close(item, 'completed')">完成</button>
        <button class="panel-button panel-button--quiet" :disabled="busy" @tap="close(item)">停止提醒</button>
      </view>
      <view v-else class="reminder-actions"><button class="panel-button panel-button--quiet" @tap="edit(item)">重新安排</button><button class="panel-button panel-button--quiet" @tap="remove(item)">删除</button></view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { reportOwner } from '@/utils/report-drafts'
import { localToolDate } from '@/utils/tool-history'
import { defaultReminderDate, deleteReminder, markPhoneCalendarAdded, phoneCalendarPayload, readReminders, REMINDER_LEADS, REMINDER_LEAD_LABELS, REMINDERS_CHANGED, reminderSignature, reminderTime, saveReminder, setReminderState, type LocalReminder, type ReminderSeed } from '@/utils/reminders'
const props = defineProps<{ kind?: 'vaccines' }>()
const owner = ref(reportOwner()), all = ref<LocalReminder[]>([]), showClosed = ref(false), busy = ref(false), message = ref('')
const editor = ref<ReminderSeed | null>(null), title = ref(''), date = ref(''), time = ref('09:00'), leadIndex = ref(0), now = ref(Date.now())
const items = computed(() => all.value.filter(item => !props.kind || item.kind === props.kind))
const activeCount = computed(() => items.value.filter(item => item.state === 'active').length)
const visible = computed(() => items.value.filter(item => showClosed.value ? item.state !== 'active' : item.state === 'active'))
let timer: ReturnType<typeof setInterval> | undefined
function refresh() {
  if (owner.value !== reportOwner()) { owner.value = reportOwner(); editor.value = null; message.value = '' }
  try { all.value = readReminders(owner.value); now.value = Date.now() } catch { message.value = '提醒暂时读取失败，请重新进入后再试。' }
}
function edit(seed: ReminderSeed) {
  refresh()
  const existing = all.value.find(item => seed.id ? item.id === seed.id : !!seed.sourceKey && item.sourceKey === seed.sourceKey)
  editor.value = existing || seed; title.value = existing?.title || seed.title.slice(0, 100); date.value = existing?.date || seed.date?.slice(0, 10) || defaultReminderDate()
  time.value = existing?.time || '09:00'; leadIndex.value = existing ? REMINDER_LEADS.findIndex(value => value === existing.leadMinutes) : 0; message.value = ''; showClosed.value = false
}
function save() {
  if (!editor.value) return
  if (owner.value !== reportOwner()) { refresh(); return }
  try {
    const saved = saveReminder(owner.value, { sourceKey: editor.value.sourceKey || '', kind: editor.value.kind, title: title.value, date: date.value, time: time.value, leadMinutes: REMINDER_LEADS[leadIndex.value] }, editor.value.id)
    editor.value = null; message.value = saved.phoneSignature ? '小程序内已更新；请到手机日历修改原来的安排。' : '已保存提醒；如需离开小程序后收到通知，请再加入手机日历。'; refresh()
  } catch (error) { message.value = error instanceof Error ? error.message : '保存失败，请重试' }
}
function formatTime(value: number) { if (!Number.isFinite(value)) return '请选择有效时间'; const date = new Date(value); return `${localToolDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` }
function stateLabel(item: LocalReminder) { return item.state === 'completed' ? '事项已完成' : item.state === 'cancelled' ? '已停止' : reminderTime(item) <= now.value ? '已到提醒时间' : '待提醒' }
function close(item: LocalReminder, state: 'completed' | 'cancelled' = 'cancelled') {
  const scope = owner.value
  uni.showModal({ title: state === 'completed' ? '标记事项已完成？' : '停止这条提醒？', content: item.phoneSignature ? '小程序内会停止提醒。手机日历中已有的事项，请同时手动删除或关闭通知。' : '结束后会保留在“已结束”，需要时可重新安排。', success: res => {
    if (!res.confirm || scope !== reportOwner()) return
    try { setReminderState(scope, item.id, state) } catch { message.value = '操作失败，请重试' }
  } })
}
function remove(item: LocalReminder) {
  const scope = owner.value
  uni.showModal({ title: '删除提醒记录？', content: item.phoneSignature ? '仅删除本机记录，手机日历的事项仍需手动删除。' : '只删除提醒，不影响原始待办或接种记录。', success: res => {
    if (!res.confirm || scope !== reportOwner()) return
    try { deleteReminder(scope, item.id) } catch { message.value = '删除失败，请重试' }
  } })
}
function addToPhone(item: LocalReminder) {
  if (busy.value || owner.value !== reportOwner() || item.state !== 'active' || item.phoneSignature === reminderSignature(item)) return
  if (reminderTime(item) <= Date.now()) { message.value = '提醒时间已过，请先修改安排。'; return }
  if (typeof uni.addPhoneCalendar !== 'function') { message.value = '请在支持此功能的手机微信中加入日历；本机提醒记录已保留。'; return }
  const scope = owner.value, signature = reminderSignature(item)
  busy.value = true; message.value = ''
  uni.addPhoneCalendar({ ...phoneCalendarPayload(item), success: () => {
    if (scope !== reportOwner()) return
    try { markPhoneCalendarAdded(scope, item.id, signature); message.value = '已加入手机日历。通知能否响起取决于手机日历的通知与日程提醒设置。' }
    catch { message.value = '已加入手机日历，但本机标记未保存，请勿重复添加。' }
  }, fail: () => { if (scope === reportOwner()) message.value = '未能加入手机日历，可能取消了授权或当前设备不支持。本机提醒仍保留，可检查权限后重试。' }, complete: () => { busy.value = false } })
}
onMounted(() => { refresh(); uni.$on(REMINDERS_CHANGED, refresh); timer = setInterval(() => { now.value = Date.now() }, 60000) })
onShow(refresh)
onBeforeUnmount(() => { uni.$off(REMINDERS_CHANGED, refresh); if (timer) clearInterval(timer) })
defineExpose({ edit, refresh })
</script>
<style scoped lang="scss">
@use '../tools/tool-panel.scss';
.reminder-editor { margin-top: 22rpx; padding: 22rpx; border-radius: 18rpx; background: #f7f6f1; }.reminder-editor .panel-input { background: #fffdfb; }
.reminder-field { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; padding: 24rpx 0; border-bottom: 1rpx solid #e6e5df; font-size: 24rpx; color: #645e55; }.reminder-field picker { color: #166c5b; }
.reminder-actions { display: flex; align-items: center; gap: 14rpx; flex-wrap: wrap; margin-top: 18rpx; }.reminder-actions .panel-button { font-size: 23rpx; padding: 16rpx 10rpx; }
.reminder-message { display: block; margin-top: 18rpx; color: #956147; font-size: 24rpx; line-height: 1.7; }.reminder-filters { display: flex; margin-top: 24rpx; border-bottom: 1rpx solid #eee7e1; }.reminder-filters button { margin: 0; padding: 18rpx 12rpx; font-size: 24rpx; line-height: 1.8; background: transparent; color: #766b67; }.reminder-filters .active { color: #166c5b; font-weight: 700; border-bottom: 4rpx solid #287e68; border-radius: 0; }.reminder-filters button::after { border: 0; }
.reminder-item .panel-row-title { flex: 1; min-width: 0; }.reminder-state { flex-shrink: 0; font-size: 20rpx; color: #9d6647; }.reminder-empty { padding: 36rpx 0 16rpx; color: #8b817b; font-size: 25rpx; line-height: 1.6; text-align: center; }
</style>
