<template>
  <view class="calendar-page">
    <!-- Header -->
    <view class="header">
      <text class="header-title">孕育日历</text>
      <view class="header-btn" @tap="openAddModal">
        <text class="header-btn-text">+ 添加事件</text>
      </view>
    </view>

    <!-- Month Navigation -->
    <view class="month-nav">
      <view class="nav-arrow" @tap="prevMonth">
        <text class="arrow-text">&lt;</text>
      </view>
      <text class="month-text">{{ currentMonthLabel }}</text>
      <view class="nav-arrow" @tap="nextMonth">
        <text class="arrow-text">&gt;</text>
      </view>
    </view>

    <!-- Weekday Headers -->
    <view class="weekday-row">
      <text v-for="d in weekdays" :key="d" class="weekday-cell">{{ d }}</text>
    </view>

    <!-- Date Grid -->
    <view class="date-grid">
      <view
        v-for="(cell, idx) in calendarCells"
        :key="idx"
        class="date-cell"
        :class="{
          'date-cell--other': !cell.currentMonth,
          'date-cell--today': cell.isToday,
          'date-cell--selected': cell.dateStr === selectedDate,
          'date-cell--has-event': cell.hasEvent,
        }"
        @tap="onDateTap(cell)"
      >
        <text class="date-num">{{ cell.day }}</text>
        <view v-if="cell.hasEvent" class="event-dot" />
      </view>
    </view>

    <!-- Event List -->
    <view class="event-section">
      <text class="section-title">
        {{ selectedDate ? `${selectedDate} 的事件` : '近期事件' }}
      </text>

      <view v-if="calendarStore.loading" class="loading-box">
        <text class="loading-text">加载中...</text>
      </view>

      <view v-else-if="displayEvents.length === 0" class="empty-box">
        <text class="empty-text">暂无事件</text>
      </view>

      <view v-else class="event-list">
        <view v-for="event in displayEvents" :key="event.id" class="event-card">
          <view class="event-card-header">
            <view class="event-title-row">
              <text class="event-title">{{ event.title }}</text>
              <view class="event-tag" :style="{ backgroundColor: typeColor(event.eventType) }">
                <text class="event-tag-text">{{ typeLabel(event.eventType) }}</text>
              </view>
            </view>
            <text class="event-date">{{ formatDate(event.eventDate) }}</text>
          </view>
          <text v-if="event.description" class="event-desc">{{ event.description }}</text>
          <view class="event-actions">
            <view
              class="action-btn action-btn--complete"
              :class="{ 'action-btn--completed': event.isCompleted }"
              @tap="onComplete(event)"
            >
              <text class="action-btn-text">{{ event.isCompleted ? '已完成' : '完成' }}</text>
            </view>
            <view class="action-btn action-btn--edit" @tap="openEditModal(event)">
              <text class="action-btn-text">编辑</text>
            </view>
            <view class="action-btn action-btn--delete" @tap="onDelete(event)">
              <text class="action-btn-text">删除</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- Add/Edit Modal -->
    <view v-if="showModal" class="modal-mask" @tap.self="closeModal">
      <view class="modal-content">
        <text class="modal-title">{{ editingEvent ? '编辑事件' : '添加事件' }}</text>

        <view class="form-item">
          <text class="form-label">标题 *</text>
          <input
            v-model="form.title"
            class="form-input"
            placeholder="请输入事件标题"
          />
        </view>

        <view class="form-item">
          <text class="form-label">描述</text>
          <textarea
            v-model="form.description"
            class="form-textarea"
            placeholder="请输入描述（可选）"
          />
        </view>

        <view class="form-item">
          <text class="form-label">日期 *</text>
          <picker mode="date" :value="form.eventDate" @change="onDateChange">
            <view class="form-picker">
              <text :class="form.eventDate ? '' : 'placeholder-text'">
                {{ form.eventDate || '请选择日期' }}
              </text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">类型 *</text>
          <picker :range="eventTypeOptions" range-key="label" :value="eventTypeIndex" @change="onTypeChange">
            <view class="form-picker">
              <text :class="form.eventType ? '' : 'placeholder-text'">
                {{ form.eventType ? typeLabel(form.eventType) : '请选择类型' }}
              </text>
            </view>
          </picker>
        </view>

        <view class="form-item form-item--row">
          <text class="form-label">开启提醒</text>
          <switch :checked="form.reminderEnabled" @change="onReminderChange" />
        </view>

        <view class="modal-actions">
          <view class="modal-btn modal-btn--cancel" @tap="closeModal">
            <text class="modal-btn-text">取消</text>
          </view>
          <view class="modal-btn modal-btn--confirm" @tap="onSubmit">
            <text class="modal-btn-text modal-btn-text--white">确定</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCalendarStore } from '@/stores/calendar'
import type { CalendarEvent } from '@/api/modules'
import dayjs from 'dayjs'

const calendarStore = useCalendarStore()

const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const selectedDate = ref('')
const showModal = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)

const form = ref({
  title: '',
  description: '',
  eventDate: '',
  eventType: '' as CalendarEvent['eventType'] | '',
  reminderEnabled: false,
})

const eventTypeOptions = [
  { label: '产检', value: 'checkup' },
  { label: '疫苗', value: 'vaccine' },
  { label: '提醒', value: 'reminder' },
  { label: '其他', value: 'other' },
]

const eventTypeIndex = computed(() => {
  const idx = eventTypeOptions.findIndex(o => o.value === form.value.eventType)
  return idx >= 0 ? idx : 0
})

const typeColor = (type: string) => {
  const map: Record<string, string> = {
    checkup: '#f5a623',
    vaccine: '#52c41a',
    reminder: '#1890ff',
    other: '#999999',
  }
  return map[type] || '#999999'
}

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    checkup: '产检',
    vaccine: '疫苗',
    reminder: '提醒',
    other: '其他',
  }
  return map[type] || '其他'
}

const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD')

const currentMonthLabel = computed(() => {
  return dayjs(calendarStore.currentMonth).format('YYYY年MM月')
})

interface CalendarCell {
  day: number
  dateStr: string
  currentMonth: boolean
  isToday: boolean
  hasEvent: boolean
}

const calendarCells = computed<CalendarCell[]>(() => {
  const month = dayjs(calendarStore.currentMonth)
  const startOfMonth = month.startOf('month')
  const endOfMonth = month.endOf('month')
  const startDay = startOfMonth.day()
  const daysInMonth = endOfMonth.date()
  const today = dayjs().format('YYYY-MM-DD')

  const eventDates = new Set(calendarStore.events.map(e => e.eventDate))
  const cells: CalendarCell[] = []

  // Previous month fill
  const prevMonth = month.subtract(1, 'month')
  const prevDays = prevMonth.daysInMonth()
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevDays - i
    const dateStr = prevMonth.date(d).format('YYYY-MM-DD')
    cells.push({ day: d, dateStr, currentMonth: false, isToday: dateStr === today, hasEvent: eventDates.has(dateStr) })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = month.date(d).format('YYYY-MM-DD')
    cells.push({ day: d, dateStr, currentMonth: true, isToday: dateStr === today, hasEvent: eventDates.has(dateStr) })
  }

  // Next month fill
  const remaining = 42 - cells.length
  const nextMonth = month.add(1, 'month')
  for (let d = 1; d <= remaining; d++) {
    const dateStr = nextMonth.date(d).format('YYYY-MM-DD')
    cells.push({ day: d, dateStr, currentMonth: false, isToday: dateStr === today, hasEvent: eventDates.has(dateStr) })
  }

  return cells
})

const displayEvents = computed(() => {
  if (selectedDate.value) {
    return calendarStore.events.filter(e => e.eventDate === selectedDate.value)
  }
  return [...calendarStore.events].sort((a, b) => dayjs(a.eventDate).unix() - dayjs(b.eventDate).unix())
})

const prevMonth = () => {
  const m = dayjs(calendarStore.currentMonth).subtract(1, 'month').format('YYYY-MM')
  calendarStore.setCurrentMonth(m)
}

const nextMonth = () => {
  const m = dayjs(calendarStore.currentMonth).add(1, 'month').format('YYYY-MM')
  calendarStore.setCurrentMonth(m)
}

const onDateTap = (cell: CalendarCell) => {
  selectedDate.value = selectedDate.value === cell.dateStr ? '' : cell.dateStr
}

const openAddModal = () => {
  editingEvent.value = null
  form.value = {
    title: '',
    description: '',
    eventDate: selectedDate.value || dayjs().format('YYYY-MM-DD'),
    eventType: '',
    reminderEnabled: false,
  }
  showModal.value = true
}

const openEditModal = (event: CalendarEvent) => {
  editingEvent.value = event
  form.value = {
    title: event.title,
    description: event.description || '',
    eventDate: event.eventDate,
    eventType: event.eventType,
    reminderEnabled: event.reminderEnabled,
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingEvent.value = null
}

const onDateChange = (e: any) => {
  form.value.eventDate = e.detail.value
}

const onTypeChange = (e: any) => {
  form.value.eventType = eventTypeOptions[e.detail.value].value as CalendarEvent['eventType']
}

const onReminderChange = (e: any) => {
  form.value.reminderEnabled = e.detail.value
}

const onSubmit = async () => {
  if (!form.value.title.trim()) {
    uni.showToast({ title: '请输入标题', icon: 'none' })
    return
  }
  if (!form.value.eventDate) {
    uni.showToast({ title: '请选择日期', icon: 'none' })
    return
  }
  if (!form.value.eventType) {
    uni.showToast({ title: '请选择类型', icon: 'none' })
    return
  }

  const data = {
    title: form.value.title.trim(),
    description: form.value.description.trim() || undefined,
    eventDate: form.value.eventDate,
    eventType: form.value.eventType,
    reminderEnabled: form.value.reminderEnabled,
  }

  const isEditing = !!editingEvent.value
  if (editingEvent.value) {
    await calendarStore.updateEvent(editingEvent.value.id, data)
  } else {
    await calendarStore.createEvent(data)
  }

  closeModal()
  uni.showToast({ title: isEditing ? '更新成功' : '创建成功', icon: 'success' })
}

const onComplete = async (event: CalendarEvent) => {
  if (event.isCompleted) return
  await calendarStore.completeEvent(event.id)
  uni.showToast({ title: '已标记完成', icon: 'success' })
}

const onDelete = (event: CalendarEvent) => {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除"${event.title}"吗？`,
    success: async (res) => {
      if (res.confirm) {
        await calendarStore.deleteEvent(event.id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    },
  })
}

function refreshEvents() {
  const month = calendarStore.currentMonth
  const start = dayjs(month).startOf('month').format('YYYY-MM-DD')
  const end = dayjs(month).endOf('month').format('YYYY-MM-DD')
  calendarStore.fetchEvents(start, end)
}

onMounted(() => {
  refreshEvents()
})

onShow(() => {
  refreshEvents()
})
</script>

<style scoped>
.calendar-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 40rpx;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  background-color: #ffffff;
}

.header-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333333;
}

.header-btn {
  background-color: #1890ff;
  border-radius: 32rpx;
  padding: 12rpx 28rpx;
}

.header-btn-text {
  color: #ffffff;
  font-size: 26rpx;
}

.month-nav {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20rpx 0;
  background-color: #ffffff;
}

.nav-arrow {
  padding: 10rpx 30rpx;
}

.arrow-text {
  font-size: 32rpx;
  color: #1890ff;
  font-weight: bold;
}

.month-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
  margin: 0 40rpx;
}

.weekday-row {
  display: flex;
  background-color: #ffffff;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.weekday-cell {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: #999999;
}

.date-grid {
  display: flex;
  flex-wrap: wrap;
  background-color: #ffffff;
  padding-bottom: 12rpx;
}

.date-cell {
  width: 14.2857%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 80rpx;
  position: relative;
}

.date-num {
  font-size: 28rpx;
  color: #333333;
}

.date-cell--other .date-num {
  color: #cccccc;
}

.date-cell--today {
  background-color: #e6f7ff;
  border-radius: 50%;
}

.date-cell--today .date-num {
  color: #1890ff;
  font-weight: bold;
}

.date-cell--selected {
  background-color: #1890ff;
  border-radius: 50%;
}

.date-cell--selected .date-num {
  color: #ffffff;
}

.event-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background-color: #f5a623;
  position: absolute;
  bottom: 6rpx;
}

.date-cell--selected .event-dot {
  background-color: #ffffff;
}

.event-section {
  padding: 24rpx 32rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 20rpx;
}

.loading-box,
.empty-box {
  display: flex;
  justify-content: center;
  padding: 60rpx 0;
}

.loading-text,
.empty-text {
  font-size: 28rpx;
  color: #999999;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.event-card {
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
}

.event-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12rpx;
}

.event-title-row {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 12rpx;
}

.event-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333333;
}

.event-tag {
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
}

.event-tag-text {
  font-size: 22rpx;
  color: #ffffff;
}

.event-date {
  font-size: 24rpx;
  color: #999999;
  flex-shrink: 0;
}

.event-desc {
  font-size: 26rpx;
  color: #666666;
  margin-bottom: 16rpx;
  line-height: 1.5;
}

.event-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 12rpx;
}

.action-btn {
  border-radius: 24rpx;
  padding: 8rpx 24rpx;
  border: 1rpx solid #d9d9d9;
}

.action-btn--complete {
  border-color: #52c41a;
}

.action-btn--completed {
  background-color: #f6ffed;
  border-color: #b7eb8f;
}

.action-btn--edit {
  border-color: #1890ff;
}

.action-btn--delete {
  border-color: #ff4d4f;
}

.action-btn-text {
  font-size: 24rpx;
  color: #666666;
}

.action-btn--complete .action-btn-text {
  color: #52c41a;
}

.action-btn--completed .action-btn-text {
  color: #b7eb8f;
}

.action-btn--edit .action-btn-text {
  color: #1890ff;
}

.action-btn--delete .action-btn-text {
  color: #ff4d4f;
}

/* Modal */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.modal-content {
  width: 640rpx;
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 40rpx;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333333;
  text-align: center;
  margin-bottom: 32rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-item--row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-label {
  font-size: 28rpx;
  color: #333333;
  margin-bottom: 8rpx;
}

.form-input {
  border: 1rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  width: 100%;
  box-sizing: border-box;
}

.form-textarea {
  border: 1rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  width: 100%;
  height: 160rpx;
  box-sizing: border-box;
}

.form-picker {
  border: 1rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
}

.placeholder-text {
  color: #cccccc;
  font-size: 28rpx;
}

.modal-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 32rpx;
}

.modal-btn {
  flex: 1;
  border-radius: 12rpx;
  padding: 18rpx 0;
  text-align: center;
}

.modal-btn--cancel {
  background-color: #f5f5f5;
}

.modal-btn--confirm {
  background-color: #1890ff;
}

.modal-btn-text {
  font-size: 30rpx;
  color: #666666;
  text-align: center;
}

.modal-btn-text--white {
  color: #ffffff;
}
</style>
