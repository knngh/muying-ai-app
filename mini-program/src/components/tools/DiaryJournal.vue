<template>
  <view class="diary-journal">
    <view class="tool-panel diary-week-card">
      <view class="week-navigation">
        <button class="week-step" aria-label="上一周" :disabled="week.start <= '1900-01-01'" @tap="moveWeek(-1)">‹</button>
        <picker class="diary-week-picker" mode="date" :value="weekDate" start="1900-01-01" :end="today" @change="weekDate = $event.detail.value"><view><text class="week-heading">{{ isCurrentWeek ? '这一周的日记' : '翻看这一周' }}</text><text class="week-range">{{ week.start }} — {{ week.end }}</text></view></picker>
        <button class="week-step" aria-label="下一周" :disabled="isCurrentWeek" @tap="moveWeek(1)">›</button>
      </view>
      <text class="week-summary">{{ summary.summary }}</text>
      <view class="diary-days">
        <button v-for="(day, index) in summary.days" :key="day.date" :disabled="day.date > today && !day.count" :class="{ selected: selectedDay === day.date, recorded: day.count > 0 }" :aria-label="day.date + '，' + day.count + ' 篇日记'" @tap="selectedDay = selectedDay === day.date ? '' : day.date"><text>{{ weekdays[index] }}</text><text class="day-number">{{ Number(day.date.slice(-2)) }}</text><text class="day-count">{{ day.count ? day.count + '篇' : '—' }}</text></button>
      </view>
      <view v-if="summary.moods.length" class="diary-moods-summary"><text v-for="mood in summary.moods" :key="mood.label">{{ mood.label }} · {{ mood.count }} 篇</text></view>
      <text v-if="summary.unmarkedMoodCount" class="panel-hint">{{ summary.unmarkedMoodCount }} 篇未选心情。</text>
      <text class="panel-hint">按周一到周日归组；心情按每篇已保存的标签计数，同一天可以写多篇。</text>
      <button v-if="!isCurrentWeek" class="back-to-week" @tap="weekDate = today">回到本周</button>
      <button class="panel-button diary-week-review" :disabled="!summary.entries.length" @tap="emit('reviewWeek', week.start)">整理这一周 · {{ summary.entries.length }} 篇</button>
      <text class="panel-hint">先核对所选正文，再选本机摘要或 AI 整理，每次最多 20 篇。</text>
    </view>

    <view class="tool-panel diary-writing">
      <button class="writing-toggle" :aria-expanded="showWriter" @tap="showWriter = !showWriter"><text class="panel-title">写下今天的一小段</text><text>{{ showWriter ? '收起' : '＋ 写日记' }}</text></button>
      <form v-if="showWriter" @submit="save">
        <text class="panel-label">日记日期</text><picker class="diary-date" mode="date" :value="date" :end="today" @change="date = $event.detail.value"><view class="panel-input">{{ date }}</view></picker>
        <text class="panel-label">心情（选填）</text><view class="diary-mood-options"><button v-for="mood in DIARY_MOODS" :key="mood" :class="{ selected: selectedMood === mood }" @tap="selectedMood = selectedMood === mood ? '' : mood">{{ mood }}</button></view>
        <textarea v-model="content" name="content" class="diary-text" maxlength="800" aria-label="日记正文" placeholder="今天想留下什么？一件小事、一份期待，或一句想对宝宝说的话。" />
        <text class="writing-length">{{ content.length }} / 800</text>
        <text v-if="message" class="diary-message" role="alert">{{ message }}</text>
        <button class="panel-button diary-save" form-type="submit" :disabled="busy">保存日记</button>
        <text class="panel-hint">保存原文和自己选的心情，之后可从周记或历史记录找回。</text>
      </form>
    </view>

    <view class="tool-panel diary-week-entries">
      <view class="panel-head"><text class="panel-title">{{ selectedDay ? selectedDay.slice(5) + ' 的日记' : '这一周写过的' }}</text><text class="panel-badge">{{ filtered.length }} 篇</text></view>
      <button v-if="selectedDay" class="show-whole-week" @tap="selectedDay = ''">查看整周日记 ›</button>
      <view v-if="!filtered.length" class="diary-empty"><text>{{ selectedDay ? '这一天还没有日记' : '还没有这一周的日记' }}</text><text class="panel-hint">{{ selectedDay ? '可以查看整周，或补记这一天的故事。' : '写下的一点一滴，会按日期留在这里。' }}</text></view>
      <button v-for="item in filtered.slice(0, limit)" :key="item.record.id" class="diary-record" @tap="emit('viewRecord', item.record.id)">
        <view class="diary-record-heading"><text>{{ item.date }}</text><text class="diary-record-mood">{{ item.mood || '未选心情' }}</text></view>
        <text class="diary-preview">{{ item.preview }}</text><text class="diary-source">查看完整原文 ›</text>
      </button>
      <button v-if="filtered.length > limit" class="panel-button panel-button--secondary diary-more" @tap="limit += 20">查看更多（还有 {{ filtered.length - limit }} 篇）</button>
      <text class="panel-hint">这里整理的是此账号在本机保留的日记。原文修改或删除后，周记会更新。</text>
      <view v-if="summary.ungroupedRecords.length" class="ungrouped-diaries">
        <button class="ungrouped-toggle" :aria-expanded="showUngrouped" @tap="showUngrouped = !showUngrouped">未归组旧记录 · {{ summary.ungroupedRecords.length }} 篇 <text>{{ showUngrouped ? '收起' : '查看 ›' }}</text></button>
        <template v-if="showUngrouped"><text class="panel-hint">缺少有效日期、正文或属于旧周记录，暂未分入某一天，原记录仍保留。</text><button v-for="record in summary.ungroupedRecords.slice(0, oldLimit)" :key="record.id" class="ungrouped-record" @tap="emit('viewRecord', record.id)">{{ historyTitle(record) }} ›</button><button v-if="summary.ungroupedRecords.length > oldLimit" class="panel-button panel-button--quiet" @tap="oldLimit += 20">查看更多旧记录</button></template>
      </view>
      <button class="calendar-diaries" @tap="openCalendar">日历中的孕周周记，从这里查看 ›</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { DIARY_MOODS, diaryPayload, diaryWeek, shiftDiaryDate, summarizeDiaryWeek } from '@/utils/diary-week'
import { historyTitle, localToolDate } from '@/utils/tool-history'
import { reportOwner } from '@/utils/report-drafts'
import { saveToolRecord, type LocalToolRecord } from '@/utils/tool-records'
const props = defineProps<{ records: LocalToolRecord[]; owner: string }>()
const emit = defineEmits<{ saved: [record: LocalToolRecord]; viewRecord: [id: string]; reviewWeek: [weekStart: string] }>()
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const today = ref(localToolDate()), weekDate = ref(today.value), date = ref(today.value), selectedDay = ref('')
const selectedMood = ref(''), content = ref(''), message = ref(''), busy = ref(false)
const showWriter = ref(!props.records.length), showUngrouped = ref(false), limit = ref(10), oldLimit = ref(10)
const summary = computed(() => summarizeDiaryWeek(props.records, weekDate.value))
const week = computed(() => summary.value.week || diaryWeek(today.value)!)
const isCurrentWeek = computed(() => week.value.start === diaryWeek(today.value)?.start)
const filtered = computed(() => summary.value.entries.filter(item => !selectedDay.value || item.date === selectedDay.value))
watch(() => week.value.start, () => { selectedDay.value = ''; limit.value = 10 })
watch(selectedDay, () => { limit.value = 10 })
watch(() => props.owner, () => {
  today.value = localToolDate(); weekDate.value = today.value; date.value = today.value; selectedDay.value = ''
  selectedMood.value = ''; content.value = ''; message.value = ''; showWriter.value = !props.records.length
  showUngrouped.value = false; limit.value = 10; oldLimit.value = 10
})
onShow(() => {
  const previous = today.value, next = localToolDate(), followWeek = week.value.start === diaryWeek(previous)?.start
  today.value = next
  if (followWeek) weekDate.value = next
  if (date.value === previous) date.value = next
})
function moveWeek(step: number) {
  const next = shiftDiaryDate(week.value.start, step * 7)
  if (next && next >= '1900-01-01' && next <= today.value) weekDate.value = next
}
function openCalendar() { uni.switchTab({ url: '/pages/calendar/index' }) }
function save(event: Event) {
  if (busy.value) return
  busy.value = true; message.value = ''
  try {
    if (reportOwner() !== props.owner) throw new Error('账号已变化，请重新打开工具')
    const text = (event as unknown as { detail: { value: { content: string } } }).detail.value.content
    const payload = diaryPayload(date.value, selectedMood.value, text, localToolDate())
    const record = saveToolRecord('diary', 'entry', payload)
    weekDate.value = date.value; selectedDay.value = ''; content.value = ''; selectedMood.value = ''; showWriter.value = false
    emit('saved', record)
  } catch (error) { message.value = error instanceof Error ? error.message : '保存未完成，请检查本机空间后重试' }
  finally { busy.value = false }
}
</script>

<style scoped lang="scss">
@use './tool-panel.scss';
button::after { border: none; }.diary-week-card { background: #f3eff6; box-shadow: none; }.week-navigation { display: flex; align-items: center; justify-content: space-between; gap: 8rpx; }.week-step { width: 72rpx; min-height: 88rpx; padding: 0; margin: 0; line-height: 88rpx; font-size: 42rpx; color: #6d587b; background: transparent; }.week-step[disabled] { opacity: .35; }.diary-week-picker { flex: 1; min-width: 0; text-align: center; padding: 16rpx 0; }.week-heading { display: block; color: #574362; font-size: 30rpx; font-weight: 700; }.week-range { display: block; margin-top: 8rpx; color: #776780; font-size: 22rpx; }.week-summary { display: block; margin: 22rpx 0; color: #63526e; font-size: 27rpx; line-height: 1.8; }
.diary-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6rpx; }.diary-days button { min-width: 0; width: 100%; margin: 0; padding: 14rpx 0; background: #faf8fb; color: #776780; border-radius: 16rpx; font-size: 22rpx; line-height: 1.7; }.diary-days text { display: block; }.diary-days .day-number { font-size: 30rpx; font-weight: 600; }.diary-days .day-count { font-size: 20rpx; }.diary-days .recorded { background: #e8deee; color: #624b73; }.diary-days .selected { background: #7b628d; color: #fff; }.diary-days button[disabled] { opacity: .5; }
.diary-moods-summary { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 22rpx; }.diary-moods-summary text { padding: 8rpx 16rpx; border-radius: 12rpx; background: #fffdfb; font-size: 23rpx; color: #6d587b; overflow-wrap: anywhere; }.diary-week-review { width: 100%; margin-top: 24rpx; background: #7b628d; }.back-to-week, .show-whole-week, .calendar-diaries { padding: 20rpx 0; margin: 0; line-height: 1.8; font-size: 24rpx; background: transparent; color: #166c5b; }.back-to-week { margin-top: 8rpx; }
.writing-toggle, .ungrouped-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12rpx; padding: 8rpx 0; min-height: 88rpx; margin: 0; text-align: left; background: transparent; font-size: 25rpx; line-height: 1.7; color: #6d587b; }.writing-toggle > text:last-child { flex-shrink: 0; font-size: 24rpx; }.diary-mood-options { display: flex; gap: 12rpx; }.diary-mood-options button { flex: 1; min-width: 0; margin: 0; padding: 20rpx 8rpx; min-height: 88rpx; border-radius: 16rpx; background: #f6f1ee; color: #625650; line-height: 1.8; font-size: 25rpx; }.diary-mood-options .selected { background: #7b628d; color: #fff; }
.diary-text { display: block; width: 100%; height: 280rpx; padding: 22rpx; margin-top: 24rpx; box-sizing: border-box; border-radius: 18rpx; background: #faf6f3; color: #514743; font-size: 28rpx; line-height: 1.85; }.writing-length { display: block; text-align: right; margin: 12rpx 0 20rpx; font-size: 22rpx; color: #766b67; }.diary-save { width: 100%; background: #7b628d; }.diary-message { display: block; margin-bottom: 20rpx; color: #965238; font-size: 24rpx; line-height: 1.7; }
.diary-empty { padding: 36rpx 0; text-align: center; font-size: 27rpx; color: #766b67; }.diary-record { display: block; width: 100%; margin: 0; padding: 26rpx 0; border-bottom: 1rpx solid #eee7e1; border-radius: 0; text-align: left; background: transparent; line-height: 1.85; }.diary-record-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8rpx 16rpx; font-size: 25rpx; color: #766b67; }.diary-record-mood { color: #6d587b; overflow-wrap: anywhere; }.diary-preview { display: block; margin-top: 12rpx; color: #514743; font-size: 28rpx; white-space: pre-wrap; overflow-wrap: anywhere; }.diary-source { display: block; margin-top: 16rpx; color: #166c5b; font-size: 24rpx; }.diary-more { width: 100%; margin-top: 20rpx; }.ungrouped-diaries { margin-top: 24rpx; border-top: 1rpx solid #eee7e1; }.ungrouped-record { width: 100%; margin: 0; padding: 20rpx 0; background: transparent; color: #766b67; text-align: left; font-size: 25rpx; line-height: 1.7; overflow-wrap: anywhere; }.calendar-diaries { margin-top: 16rpx; text-align: left; }
</style>
