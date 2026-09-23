<template>
  <view class="tool-detail-page">
    <view class="detail-hero" :class="getToneClass(tool.tone)">
      <button class="hero-back" @tap="goBack">‹ {{ sourcePeriod ? `返回${toolPeriodLabel(sourcePeriod)}` : '返回' }}</button>
      <view class="hero-heading">
        <view class="hero-icon"><ToolIcon :id="tool.id" /></view>
        <view><text class="hero-kicker">{{ tool.kicker }} · {{ statusLabel(tool.status) }}</text><text class="hero-title">{{ tool.title }}</text></view>
      </view>
      <text class="hero-description">{{ tool.description }}</text>
      <text class="hero-helper">{{ tool.helper }}</text>
      <button class="home-pin-button" @tap="toggleHomeTool">{{ isOnHome ? '已添加到首页 ✓' : '＋ 添加到首页' }}</button>
    </view>

    <view v-if="sourcePeriod" class="source-context"><text>{{ toolPeriodLabel(sourcePeriod) }} · {{ sourceReason || '从孕育日历打开' }}</text><text class="source-context-note">新记录按实际填写日期保存。</text></view>

    <view class="record-tabs">
      <button class="record-tab" :class="{ active: activePanel === 'entry' }" @tap="activePanel = 'entry'">{{ tool.id === 'poster' ? '制作海报' : tool.id === 'packing' ? '我的清单' : '记录' }}</button>
      <button class="record-tab" :class="{ active: activePanel === 'history' }" @tap="activePanel = 'history'">历史记录{{ historyCount ? ` (${historyCount})` : '' }}</button>
    </view>
    <button v-if="activePanel === 'entry' && lastRecordTitle" class="last-record" @tap="activePanel = 'history'"><text class="last-record-title">上次保存：{{ lastRecordTitle }}</text><text>查看 ›</text></button>
    <view class="detail-summary">
      <view class="detail-summary-item"><text class="detail-summary-value">{{ historyCount }}</text><text class="detail-summary-label">已保存</text></view>
      <view class="detail-summary-item"><text class="detail-summary-value">{{ currentWeek ? `孕${currentWeek}周` : '本阶段' }}</text><text class="detail-summary-label">当前阶段</text></view>
      <view class="detail-summary-item"><text class="detail-summary-value">{{ TOOL_CLOUD_ENABLED ? '可同步' : '本机' }}</text><text class="detail-summary-label">保存位置</text></view>
    </view>

    <view v-show="activePanel === 'entry' || tool.id === 'reports'">

    <view v-if="tool.id === 'calendar'" class="content-card">
      <text class="card-title">孕育日历是记录底座</text>
      <text class="card-description">所有提醒、待办和工具摘要都会回到日历里。原有孕周轴继续使用，新的工具先从本机记录开始。</text>
      <button class="primary-button" @tap="openCalendar">打开孕育日历</button>
    </view>

    <view v-else-if="tool.id === 'contractions'" class="content-card timer-card">
      <text class="card-eyebrow">本次会话</text>
      <text class="timer-value">{{ contractionElapsedText }}</text>
      <text class="timer-label">{{ contractionStart ? '正在记录本次宫缩' : '按下开始，记录起止时间' }}</text>
      <button class="primary-button" :class="{ 'primary-button--stop': contractionStart }" @tap="toggleContraction">
        {{ contractionStart ? '结束本次宫缩' : '开始本次宫缩' }}
      </button>
      <text class="safety-note">这里只记录时间，不判断是否临产。明显不适或有疑虑时，请按医嘱及时联系医护人员。</text>
    </view>

    <view v-else-if="tool.id === 'movement'" class="content-card counter-card">
      <view class="card-eyebrow-line"><text class="card-eyebrow">今日胎动记录</text><text class="local-badge">本机</text></view>
      <text class="counter-value">{{ movementCount }}</text>
      <text class="counter-label">{{ movementCount ? '计数进度已保存在本机，退出后可继续' : '每次点按保存一个时间点，可撤销上一次' }}</text>
      <view class="counter-actions">
        <button class="counter-button counter-button--undo" :disabled="movementCount === 0" @tap="undoMovement">撤销</button>
        <button class="counter-button" @tap="addMovement">踢一下 +1</button>
      </view>
      <button class="secondary-button" @tap="finishMovement">保存这次计数</button>
      <text class="safety-note">记录保存后不会评价正常或异常；如果你有疑虑，请咨询医生。</text>
    </view>

    <view v-else-if="tool.id === 'weight'" class="content-card">
      <text class="card-title">记录今天的体重</text>
      <view class="field-row"><text class="field-label">测量日期</text><picker mode="date" :value="recordDate" @change="onDateChange"><view class="field-value">{{ recordDate }}</view></picker></view>
      <view class="field-row"><text class="field-label">体重</text><input v-model="weightValue" class="field-input" type="digit" placeholder="例如 61.2" /><text class="field-unit">kg</text></view>
      <button class="primary-button" @tap="saveWeight">保存体重</button>
      <WeightTrendChart :records="weightRecords" :visible="activePanel === 'entry'" />
      <text class="safety-note">参考带和孕周计算会在资料条件完整后开放；当前只保存你的实际测量值。</text>
    </view>

    <CareTracker v-else-if="tool.id === 'care'" :records="displayRecords" :owner="reportScope" @saved="onCareSaved" @view-record="viewCareRecord" @refresh="reload" />

    <view v-else-if="tool.id === 'growth'" class="content-card">
      <text class="card-title">保存一次生长测量</text>
      <view class="field-row"><text class="field-label">测量日期</text><picker mode="date" :value="recordDate" @change="onDateChange"><view class="field-value">{{ recordDate }}</view></picker></view>
      <view class="choice-grid"><view v-for="item in growthTypes" :key="item.value" class="choice-chip" :class="{ active: growthType === item.value }" @tap="growthType = item.value"><text>{{ item.label }}</text></view></view>
      <view class="field-row"><text class="field-label">测量值</text><input v-model="growthValue" class="field-input" type="digit" placeholder="请输入数值" /><text class="field-unit">{{ growthUnit }}</text></view>
      <button class="primary-button" @tap="saveGrowth">保存测量</button>
      <text class="safety-note">完善出生日期、性别和测量方式后，再开放 WHO 曲线展示。</text>
    </view>

    <view v-else-if="tool.id === 'packing'" class="content-card">
      <view class="card-eyebrow-line"><text class="card-title">待产包基础清单</text><text class="progress-label">{{ packingDoneCount }}/{{ packingItems.length }}</text></view>
      <text class="card-description">按妈妈、宝宝、证件逐项勾选。上次勾选会保留，医院的其他要求请另行核对。</text>
      <view class="check-list"><view v-for="item in packingItems" :key="item.name" class="check-row" @tap="togglePacking(item.name)"><view class="check-box" :class="{ checked: isPackingDone(item.name) }"><text v-if="isPackingDone(item.name)">✓</text></view><view class="check-copy"><text class="check-name">{{ item.name }}</text><text class="check-group">{{ item.group }}</text></view></view></view>
    </view>

    <view v-else-if="tool.id === 'vaccines'" class="content-card">
      <text class="card-title">记录一次接种</text>
      <view class="field-row"><text class="field-label">疫苗名称</text><input v-model="vaccineName" class="field-input" maxlength="40" placeholder="例如 乙肝疫苗" /></view>
      <view class="field-row"><text class="field-label">接种日期</text><picker mode="date" :value="recordDate" @change="onDateChange"><view class="field-value">{{ recordDate }}</view></picker></view>
      <view class="field-row"><text class="field-label">状态</text><picker :range="vaccineStatuses" :value="vaccineStatusIndex" @change="onVaccineStatusChange"><view class="field-value">{{ vaccineStatuses[vaccineStatusIndex] }}</view></picker></view>
      <button class="primary-button" @tap="saveVaccine">保存接种记录</button>
      <text class="safety-note">时间表只做参考，补种、联合苗替换和禁忌请由接种门诊确认。</text>
      <view v-if="vaccineAppointments.length" class="vaccine-appointments">
        <text class="card-title">待接种安排</text>
        <view v-for="record in vaccineAppointments" :key="record.id" class="vaccine-appointment">
          <text class="check-name">{{ record.payload.name }}</text><text class="card-description">{{ record.payload.date }} · {{ record.payload.status === 'scheduled' ? '已预约' : '待门诊确认' }}</text>
          <view class="vaccine-actions"><button class="secondary-button" @tap="openVaccineReminder(record)">设置提醒</button><button class="secondary-button" @tap="completeVaccine(record)">标记已接种</button></view>
        </view>
      </view>
    </view>

    <view v-else-if="tool.id === 'foods'" class="content-card">
      <text class="card-title">记一次食材尝试</text>
      <view class="field-row"><text class="field-label">尝试日期</text><picker mode="date" :value="recordDate" @change="onDateChange"><view class="field-value">{{ recordDate }}</view></picker></view>
      <view class="field-row"><text class="field-label">食材</text><input v-model="foodName" class="field-input" maxlength="40" placeholder="例如 高铁米粉" /></view>
      <view class="field-row field-row--top"><text class="field-label">观察</text><textarea v-model="foodNote" class="field-textarea" maxlength="160" placeholder="记录当天看到的情况，不需要下结论" /></view>
      <button class="primary-button" @tap="saveFood">保存尝试</button>
      <text class="safety-note">没有观察记录不等于没有反应；需要判断时请咨询专业人员。</text>
    </view>

    <ReportArchive v-else-if="tool.id === 'reports'" :key="reportScope" ref="reportPanel" :owner="reportScope" :history-only="activePanel === 'history'" @count="reportCount = $event" @latest="reportLatest = $event" @saved="activePanel = 'history'" />

    <StagePoster v-else-if="tool.id === 'poster'" :week="currentWeek" @saved="onPosterSaved" />

    <view v-else-if="tool.id === 'diary'" class="content-card">
      <text class="card-title">写下今天的一小段</text>
      <view class="field-row"><text class="field-label">日记日期</text><picker mode="date" :value="recordDate" @change="onDateChange"><view class="field-value">{{ recordDate }}</view></picker></view>
      <view class="choice-grid"><view v-for="item in moods" :key="item.value" class="choice-chip" :class="{ active: diaryMood === item.value }" @tap="diaryMood = item.value"><text>{{ item.label }}</text></view></view>
      <textarea v-model="diaryText" class="large-textarea" maxlength="800" placeholder="今天有什么想留下？"></textarea>
      <button class="primary-button" @tap="saveDiary">保存日记</button>
      <text class="safety-note">保存后可在“历史记录”展开查看完整日记。</text>
    </view>

    <view v-else-if="tool.id === 'album'" class="content-card">
      <text class="card-title">添加一张成长照片</text>
      <text class="card-description">照片会保存到本机历史中，再次打开也能预览。</text>
      <view class="field-row"><text class="field-label">照片日期</text><picker mode="date" :value="recordDate" @change="onDateChange"><view class="field-value">{{ recordDate }}</view></picker></view>
      <button class="secondary-button" @tap="chooseAlbumImage">从相册选择</button>
      <image v-if="albumPreview" class="album-preview" :src="albumPreview" mode="aspectFill"></image>
      <button v-if="albumPreview" class="primary-button" :loading="albumSaving" :disabled="albumSaving" @tap="saveAlbum">保存照片记录</button>
      <text class="safety-note">照片仅在此设备保存，清理小程序数据会丢失。</text>
    </view>

    <view v-else-if="tool.id === 'expenses'" class="content-card">
      <text class="card-title">记一笔家庭支出</text>
      <view class="field-row"><text class="field-label">支出日期</text><picker mode="date" :value="recordDate" @change="onDateChange"><view class="field-value">{{ recordDate }}</view></picker></view>
      <view class="field-row"><text class="field-label">金额</text><input v-model="expenseAmount" class="field-input" type="digit" placeholder="0.00" /><text class="field-unit">元</text></view>
      <view class="choice-grid"><view v-for="item in expenseCategories" :key="item.value" class="choice-chip" :class="{ active: expenseCategory === item.value }" @tap="expenseCategory = item.value"><text>{{ item.label }}</text></view></view>
      <view class="field-row"><text class="field-label">备注</text><input v-model="expenseNote" class="field-input" maxlength="60" placeholder="例如 奶粉" /></view>
      <button class="primary-button" @tap="saveExpense">保存账目</button>
      <text class="safety-note">当前记录家庭支出，金额、分类和完整备注都可在历史中查看。</text>
    </view>

    <view v-else class="content-card">
      <text class="card-title">{{ tool.title }}正在准备</text>
      <text class="card-description">先把入口、阶段说明和本机草稿链路准备好，后续按计划接入云同步和专属规则。</text>
      <button class="primary-button" @tap="saveGenericNote">保存一条准备备注</button>
    </view>
    </view>

    <view v-if="notice" class="notice-card"><text>{{ notice }}</text></view>

    <view v-if="tool.id === 'vaccines'" id="vaccine-reminders"><ReminderCenter ref="vaccineReminders" kind="vaccines" /></view>

    <ToolHistory v-if="activePanel === 'history' && (tool.id !== 'reports' || displayRecords.length)" :key="reportScope" ref="historyPanel" :records="displayRecords" :title="tool.id === 'reports' ? '早期本机记录' : '历史记录'" @remove="removeRecord" />

    <ToolAIReview
      v-if="canReviewRecords"
      :tool-id="tool.id"
      :records="displayRecords"
      :week="currentWeek"
      :owner="reportScope"
    />

    <view v-if="tool.id !== 'reports'" class="detail-footer"><text>{{ TOOL_CLOUD_ENABLED ? '本机保存 · 登录后尝试同步' : '本机保存 · 云端同步暂未开放' }} · 最近 500 条保留在本机</text></view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { onLoad, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { calculatePregnancyWeekFromDueDate } from '@/utils'
import { toolRecordApi } from '@/api/modules'
import ReportArchive from '@/components/tools/ReportArchive.vue'
import StagePoster from '@/components/tools/StagePoster.vue'
import ToolIcon from '@/components/tools/ToolIcon.vue'
import ToolHistory from '@/components/tools/ToolHistory.vue'
import ToolAIReview from '@/components/tools/ToolAIReview.vue'
import WeightTrendChart from '@/components/tools/WeightTrendChart.vue'
import ReminderCenter from '@/components/reminders/ReminderCenter.vue'
import { closeReminderSource, readReminders } from '@/utils/reminders'
import { cancelWechatReminderRemote } from '@/utils/wechat-subscribe'
import { historyTitle, localToolDate } from '@/utils/tool-history'
import CareTracker from '@/components/tools/CareTracker.vue'
import { saveToolImage, removeUnusedToolImage } from '@/utils/tool-media'
import { TOOL_CLOUD_ENABLED } from '@/config/features'
import { readMovementTaps, writeMovementTaps } from '@/utils/tool-sessions'
import { currentToolPeriod, parseToolPeriod, periodTools, toolPeriodLabel, type ToolPeriod } from '@/utils/tool-period'
import { reportOwner } from '@/utils/report-drafts'
import { getToolDefinition, getToneClass, type ToolId, type ToolStatus } from '@/data/tool-catalog'
import { deleteToolRecord, importToolRecord, readToolRecords, saveToolRecord, updateToolRecord, type LocalToolRecord } from '@/utils/tool-records'
import { trackMiniEvent } from '@/utils/analytics'
import { MAX_HOME_TOOLS, readHomeTools, recommendedHomeTools, saveHomeTools } from '@/utils/home-tools'
import { getToolStage } from '@/data/tool-catalog'

const appStore = useAppStore()
const toolId = ref<ToolId>('calendar')
const records = ref<LocalToolRecord[]>([])
const notice = ref('')
const activePanel = ref<'entry' | 'history'>('entry')
const historyPanel = ref<{ openRecord: (id: string) => Promise<void> } | null>(null)
const reportCount = ref(0), albumSaving = ref(false)
const reportLatest = ref<{ name: string; createdAt: string } | null>(null)
const recordDate = ref(today())
const storedWeek = ref<number | null>(null)

const contractionStart = ref<string | null>(null)
const contractionNow = ref(Date.now())
const movementTaps = ref<string[]>([])
const movementCount = computed(() => movementTaps.value.length)
let contractionTimer: ReturnType<typeof setInterval> | undefined

const weightValue = ref('')
const growthType = ref('height')
const growthValue = ref('')
const vaccineName = ref('')
const vaccineStatusIndex = ref(0)
const vaccineReminders = ref<InstanceType<typeof ReminderCenter> | null>(null)
const vaccineAppointments = computed(() => displayRecords.value.filter(record => record.toolId === 'vaccines' && ['scheduled', 'unconfirmed'].includes(String(record.payload.status))))
const foodName = ref('')
const foodNote = ref('')
const reportScope = ref(reportOwner())
const reportPanel = ref<InstanceType<typeof ReportArchive> | null>(null)
const diaryMood = ref('平稳')
const diaryText = ref('')
const albumPreview = ref('')
const expenseAmount = ref('')
const expenseCategory = ref('checkup')
const expenseNote = ref('')

const growthTypes = [{ value: 'height', label: '身高' }, { value: 'weight', label: '体重' }, { value: 'head', label: '头围' }]
const vaccineStatuses = ['已接种', '已预约', '待确认']
const moods = ['开心', '平稳', '疲惫', '期待'].map(label => ({ value: label, label }))
const expenseCategories = [{ value: 'checkup', label: '产检' }, { value: 'supplies', label: '待产包' }, { value: 'feeding', label: '奶粉/喂养' }, { value: 'vaccine', label: '疫苗' }]
const packingItems = [
  { name: '证件与产检资料', group: '证件' }, { name: '产褥垫', group: '妈妈' }, { name: '哺乳内衣', group: '妈妈' },
  { name: '新生儿衣物', group: '宝宝' }, { name: '纸尿裤', group: '宝宝' }, { name: '包被', group: '宝宝' },
]

const pinnedIds = ref(readHomeTools())
const sourcePeriod = ref<ToolPeriod | null>(null)
const sourceReason = computed(() => periodTools(sourcePeriod.value).find(item => item.id === toolId.value)?.reason)
const selectedHomeIds = computed(() => pinnedIds.value ?? recommendedHomeTools(getToolStage(currentWeek.value, appStore.user?.babyBirthday), currentToolPeriod(currentWeek.value, appStore.user?.babyBirthday)))
const isOnHome = computed(() => selectedHomeIds.value.includes(toolId.value))
function toggleHomeTool() {
  if (!isOnHome.value && selectedHomeIds.value.length >= MAX_HOME_TOOLS) { uni.showToast({ title: '首页已满，请在工具页管理', icon: 'none' }); return }
  const next = isOnHome.value ? selectedHomeIds.value.filter(id => id !== toolId.value) : [...selectedHomeIds.value, toolId.value]
  try { saveHomeTools(next); pinnedIds.value = next } catch { showNotice('设置未能保存，请重试') }
}
const tool = computed(() => getToolDefinition(toolId.value))
const currentWeek = computed(() => appStore.user?.babyBirthday ? null : appStore.user?.dueDate ? calculatePregnancyWeekFromDueDate(appStore.user.dueDate) : storedWeek.value)
const displayRecords = computed(() => records.value.filter(item => item.toolId === toolId.value))
const historyCount = computed(() => displayRecords.value.length + (toolId.value === 'reports' ? reportCount.value : 0))
const lastRecordTitle = computed(() => {
  const record = displayRecords.value[0]
  if (toolId.value === 'reports' && reportLatest.value && (!record || Date.parse(reportLatest.value.createdAt) >= Date.parse(record.createdAt))) return reportLatest.value.name
  return record ? historyTitle(record) : ''
})
const canReviewRecords = computed(() => ['contractions', 'movement', 'weight', 'care', 'growth', 'packing', 'vaccines', 'foods', 'diary', 'expenses'].includes(toolId.value))
const weightRecords = computed(() => records.value.filter(item => item.toolId === 'weight' && item.recordType === 'measurement').filter(item => typeof item.payload.value === 'number'))
const packingRecords = computed(() => records.value.filter(item => item.toolId === 'packing' && item.recordType === 'item'))
const packingDoneCount = computed(() => packingItems.filter(item => isPackingDone(item.name)).length)
const growthUnit = computed(() => growthType.value === 'head' ? 'cm' : growthType.value === 'weight' ? 'kg' : 'cm')
const contractionElapsedText = computed(() => {
  if (!contractionStart.value) return '00:00'
  const seconds = Math.max(0, Math.floor((contractionNow.value - new Date(contractionStart.value).getTime()) / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
})

function today() { return localToolDate() }
function reload() {
  const value = Number.parseInt(String(uni.getStorageSync('userPregnancyWeek') || ''), 10)
  storedWeek.value = Number.isFinite(value) && value >= 1 && value <= 40 ? value : null
  records.value = readToolRecords()
}
function statusLabel(status: ToolStatus) { return ({ ready: '已上线', preview: '基础版', planned: '基础版' }[status]) }
function showNotice(message: string) { notice.value = message; setTimeout(() => { if (notice.value === message) notice.value = '' }, 2400) }
function save(recordType: string, payload: Record<string, string | number | boolean | null | undefined>, summary: string): LocalToolRecord | null {
  try {
    const record = saveToolRecord(toolId.value, recordType, { ...payload, summary })
    trackMiniEvent('app_tool_record_save', { page: 'ToolDetail', properties: { toolId: toolId.value, recordType } })
    reload()
    if (toolId.value !== 'packing') activePanel.value = 'history'
    showNotice('已保存，可在历史记录中查看')
    return record
  } catch { showNotice('未能保存，请检查本机空间后重试'); return null }
}

function markSynced(record: LocalToolRecord, serverId: string) {
  updateToolRecord(record.id, { syncStatus: 'synced', payload: { ...record.payload, serverId } })
  reload()
}

async function syncServer(record: LocalToolRecord | null): Promise<void> {
  if (!record || !TOOL_CLOUD_ENABLED || !uni.getStorageSync('token')) return
  try {
    const payload = record.payload
    if (record.toolId === 'contractions' && record.recordType === 'session'
      && typeof payload.startAt === 'string' && typeof payload.endAt === 'string' && typeof payload.durationSeconds === 'number') {
      const remote = await toolRecordApi.createContraction({
        startedAt: payload.startAt,
        endedAt: payload.endAt,
        durationSeconds: payload.durationSeconds,
        intervalSeconds: typeof payload.intervalSeconds === 'number' ? payload.intervalSeconds : null,
        clientOperationId: record.id,
      })
      markSynced(record, remote.id)
    } else if (record.toolId === 'movement' && record.recordType === 'session'
      && typeof payload.startedAt === 'string' && typeof payload.endedAt === 'string' && typeof payload.count === 'number') {
      const remote = await toolRecordApi.createMovement({
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        count: payload.count,
        method: typeof payload.method === 'string' ? payload.method : 'free',
        clientOperationId: record.id,
      })
      markSynced(record, remote.id)
    } else if (record.toolId === 'weight' && record.recordType === 'measurement'
      && typeof payload.measuredAt === 'string' && typeof payload.value === 'number') {
      const remote = await toolRecordApi.createWeight({
        measuredAt: payload.measuredAt,
        weightKg: payload.value,
        source: 'manual',
        clientOperationId: record.id,
      })
      markSynced(record, remote.id)
    } else if (record.toolId === 'diary' && record.recordType === 'entry'
      && typeof payload.date === 'string' && typeof payload.content === 'string') {
      const remote = await toolRecordApi.createDiaryEntry({
        entryDate: payload.date,
        mood: typeof payload.mood === 'string' ? payload.mood : null,
        content: payload.content,
        clientOperationId: record.id,
      })
      markSynced(record, remote.id)
    } else if (record.toolId === 'expenses' && record.recordType === 'entry'
      && typeof payload.date === 'string' && typeof payload.amount === 'number' && typeof payload.category === 'string') {
      const remote = await toolRecordApi.createExpenseEntry({
        occurredAt: payload.date,
        amountCents: Math.round(payload.amount * 100),
        direction: 'expense',
        category: payload.category,
        note: typeof payload.note === 'string' ? payload.note : null,
        clientOperationId: record.id,
      })
      markSynced(record, remote.id)
    } else if (record.toolId === 'care' && record.recordType === 'log'
      && typeof payload.recordedAt === 'string' && typeof payload.kind === 'string') {
      const remote = await toolRecordApi.createCareLog({
        kind: payload.kind as 'feeding' | 'diaper' | 'sleep',
        recordedAt: payload.recordedAt,
        endedAt: typeof payload.endedAt === 'string' ? payload.endedAt : undefined,
        amountMl: typeof payload.amount === 'number' ? payload.amount : null,
        side: typeof payload.side === 'string' ? payload.side : null,
        diaperType: typeof payload.diaperType === 'string' ? payload.diaperType : null,
        note: typeof payload.note === 'string' ? payload.note : null,
        clientOperationId: record.id,
      })
      markSynced(record, remote.id)
    } else if (record.toolId === 'growth' && record.recordType === 'measurement'
      && typeof payload.measuredAt === 'string' && typeof payload.metric === 'string' && typeof payload.value === 'number') {
      const remote = await toolRecordApi.createBabyMeasurement({
        measuredAt: payload.measuredAt,
        metric: payload.metric as 'height' | 'weight' | 'head',
        value: payload.value,
        unit: typeof payload.unit === 'string' ? payload.unit : 'cm',
        method: null,
        clientOperationId: record.id,
      })
      markSynced(record, remote.id)
    } else if (record.toolId === 'vaccines' && record.recordType === 'record'
      && typeof payload.date === 'string' && typeof payload.name === 'string' && typeof payload.status === 'string') {
      const remote = await toolRecordApi.createVaccination({
        vaccineName: payload.name,
        administeredAt: payload.date,
        status: payload.status as 'planned' | 'scheduled' | 'administered' | 'unconfirmed',
        doseNumber: null,
        note: null,
        clientOperationId: record.id,
      })
      markSynced(record, remote.id)
    } else if (record.toolId === 'foods' && record.recordType === 'trial'
      && typeof payload.date === 'string' && typeof payload.name === 'string') {
      const remote = await toolRecordApi.createFoodTrial({
        foodName: payload.name,
        triedAt: payload.date,
        observation: typeof payload.note === 'string' ? payload.note : null,
        responseStatus: 'unconfirmed',
        clientOperationId: record.id,
      })
      markSynced(record, remote.id)
    } else if (record.toolId === 'packing' && record.recordType === 'item'
      && typeof payload.item === 'string' && typeof payload.done === 'boolean') {
      const remote = await toolRecordApi.upsertPackingItem({
        name: payload.item,
        category: '待产包',
        quantity: 1,
        isDone: payload.done,
        clientOperationId: record.id,
      })
      markSynced(record, remote.id)
    }
  } catch {
    showNotice('已保存在本机，网络恢复后可重新同步')
  }
}

async function loadRemoteRecords(): Promise<void> {
  if (!TOOL_CLOUD_ENABLED || !uni.getStorageSync('token')) return
  try {
    if (toolId.value === 'contractions') {
      const list = await toolRecordApi.getContractions()
      list.forEach(item => importToolRecord('contractions', 'session', item.id, {
        startAt: item.startedAt, endAt: item.endedAt, durationSeconds: item.durationSeconds,
        intervalSeconds: item.intervalSeconds, summary: `宫缩 ${item.durationSeconds} 秒`,
      }, item.createdAt, item.updatedAt))
    } else if (toolId.value === 'movement') {
      const list = await toolRecordApi.getMovements()
      list.forEach(item => importToolRecord('movement', 'session', item.id, {
        startedAt: item.startedAt, endedAt: item.endedAt, count: item.count, method: item.method, summary: `胎动 ${item.count} 次`,
      }, item.createdAt, item.updatedAt))
    } else if (toolId.value === 'weight') {
      const list = await toolRecordApi.getWeights()
      list.forEach(item => importToolRecord('weight', 'measurement', item.id, {
        value: item.weightKg, unit: 'kg', measuredAt: item.measuredAt, summary: `${item.weightKg} kg`,
      }, item.createdAt, item.updatedAt))
    } else if (toolId.value === 'diary') {
      const list = await toolRecordApi.getDiaryEntries()
      list.forEach(item => importToolRecord('diary', 'entry', item.id, {
        mood: item.mood, content: item.content, date: item.entryDate, summary: `${item.mood || '未标心情'} · ${item.content.slice(0, 18)}`,
      }, item.createdAt, item.updatedAt))
    } else if (toolId.value === 'expenses') {
      const list = await toolRecordApi.getExpenseEntries()
      list.forEach(item => importToolRecord('expenses', 'entry', item.id, {
        amount: item.amountCents / 100, category: item.category, note: item.note, date: item.occurredAt, summary: `${item.category} ${(item.amountCents / 100).toFixed(2)} 元`,
      }, item.createdAt, item.updatedAt))
    } else if (toolId.value === 'care') {
      const list = await toolRecordApi.getCareLogs()
      list.forEach(item => importToolRecord('care', 'log', item.id, {
        kind: item.kind, amount: item.amountMl, side: item.side, diaperType: item.diaperType, note: item.note,
        recordedAt: item.recordedAt, endedAt: item.endedAt, summary: `${item.kind}${item.amountMl === null ? '' : ` ${item.amountMl}ml`}`,
      }, item.createdAt, item.updatedAt))
    } else if (toolId.value === 'growth') {
      const list = await toolRecordApi.getBabyMeasurements()
      list.forEach(item => importToolRecord('growth', 'measurement', item.id, {
        metric: item.metric, value: item.value, unit: item.unit, measuredAt: item.measuredAt, summary: `${item.metric} ${item.value}${item.unit}`,
      }, item.createdAt, item.updatedAt))
    } else if (toolId.value === 'vaccines') {
      const list = await toolRecordApi.getVaccinations()
      list.forEach(item => importToolRecord('vaccines', 'record', item.id, { name: item.vaccineName, date: item.administeredAt, status: item.status, summary: `${item.vaccineName} · ${item.status}` }, item.createdAt, item.updatedAt))
    } else if (toolId.value === 'foods') {
      const list = await toolRecordApi.getFoodTrials()
      list.forEach(item => importToolRecord('foods', 'trial', item.id, {
        name: item.foodName, note: item.observation, date: item.triedAt, summary: `${item.foodName} · 已记录观察`,
      }, item.createdAt, item.updatedAt))
    } else if (toolId.value === 'packing') {
      const list = await toolRecordApi.getPackingItems()
      list.forEach(item => importToolRecord('packing', 'item', item.id, {
        item: item.name, done: item.isDone, summary: `${item.isDone ? '已准备' : '待准备'}：${item.name}`,
      }, item.createdAt, item.updatedAt))
    }
    reload()
  } catch {
    // 本机记录优先，远端暂时不可用时不打断页面。
  }
}
function openCalendar() { uni.switchTab({ url: '/pages/calendar/index' }) }
function goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/tools/index' }) }) }
function onDateChange(event: { detail: { value: string } }) { recordDate.value = event.detail.value }
function onPosterSaved() { reload(); activePanel.value = 'history' }
function removeRecord(record: LocalToolRecord) {
  uni.showModal({ title: '移除本机记录', content: record.syncStatus === 'synced' ? '仅移除此设备的副本，云端记录仍保留。' : '移除后无法从本机恢复，确定继续？', success: async result => {
    if (!result.confirm) return
    try { deleteToolRecord(record.id); if (record.toolId === 'vaccines') closeVaccineReminder(record.id, 'cancelled'); if (typeof record.payload.path === 'string') await removeUnusedToolImage(record.payload.path); reload(); showNotice('已移除本机记录') }
    catch { showNotice('移除未完成，请重试') }
  } })
}

function toggleContraction() {
  if (contractionStart.value) {
    const start = new Date(contractionStart.value).getTime()
    const end = Date.now()
    const record = save('session', { startAt: contractionStart.value, endAt: new Date(end).toISOString(), durationSeconds: Math.max(0, Math.round((end - start) / 1000)) }, `宫缩 ${Math.max(0, Math.round((end - start) / 1000))} 秒`)
    if (!record) return
    void syncServer(record)
    contractionStart.value = null
    if (contractionTimer) clearInterval(contractionTimer)
    uni.removeStorageSync('beihu:contraction-start')
    return
  }
  const startedAt = new Date().toISOString()
  try { uni.setStorageSync('beihu:contraction-start', startedAt) }
  catch { showNotice('未能保存计时起点，请检查本机空间'); return }
  contractionStart.value = startedAt
  contractionNow.value = Date.now()
  contractionTimer = setInterval(() => { contractionNow.value = Date.now() }, 1000)
}

function setMovement(taps: string[]) {
  try { writeMovementTaps(taps); movementTaps.value = taps; return true }
  catch { showNotice('未能保存计数，请检查本机空间'); return false }
}
function addMovement() { if (movementCount.value >= 10000) { showNotice('请先保存这次计数'); return }; setMovement([...movementTaps.value, new Date().toISOString()]) }
function undoMovement() { setMovement(movementTaps.value.slice(0, -1)) }
function finishMovement() {
  if (!movementCount.value) { showNotice('先记录至少一次胎动'); return }
  const record = save('session', { count: movementCount.value, startedAt: movementTaps.value[0], endedAt: new Date().toISOString(), method: 'free' }, `胎动 ${movementCount.value} 次`)
  if (record) { void syncServer(record); setMovement([]) }
}
function saveWeight() {
  const value = Number(weightValue.value)
  if (!Number.isFinite(value) || value < 0.1 || value > 300) { showNotice('请输入有效体重'); return }
  const record = save('measurement', { value, unit: 'kg', measuredAt: recordDate.value }, `${value} kg`)
  if (record) { void syncServer(record); weightValue.value = '' }
}
async function viewCareRecord(id: string) {
  if (reportOwner() !== reportScope.value) { showNotice('账号已变化，请重新打开工具'); return }
  reload()
  if (!displayRecords.value.some(record => record.id === id)) { showNotice('这条记录已移除，交接单已更新'); return }
  activePanel.value = 'history'
  await nextTick()
  await historyPanel.value?.openRecord(id)
}
function onCareSaved(record: LocalToolRecord) {
  trackMiniEvent('app_tool_record_save', { page: 'ToolDetail', properties: { toolId: 'care', recordType: 'log' } })
  reload(); activePanel.value = 'history'; showNotice('已保存，可在历史记录中查看'); void syncServer(record)
}
function saveGrowth() {
  const value = Number(growthValue.value)
  if (!Number.isFinite(value) || value < 0.1 || value > 300) { showNotice('请输入有效测量值'); return }
  const label = growthTypes.find(item => item.value === growthType.value)?.label || '测量'
  const record = save('measurement', { metric: growthType.value, value, unit: growthUnit.value, measuredAt: recordDate.value }, `${label} ${value}${growthUnit.value}`)
  if (record) { void syncServer(record); growthValue.value = '' }
}
function isPackingDone(name: string) { const item = packingRecords.value.find(record => record.payload.item === name); return item?.payload.done === true }
function togglePacking(name: string) { const next = !isPackingDone(name); const record = save('item', { item: name, done: next }, `${next ? '已准备' : '取消'}：${name}`); void syncServer(record) }
function onVaccineStatusChange(event: { detail: { value: string } }) { vaccineStatusIndex.value = Number(event.detail.value) }
function saveVaccine() { if (!vaccineName.value.trim()) { showNotice('请填写疫苗名称'); return }; const record = save('record', { name: vaccineName.value.trim(), date: recordDate.value, status: ['administered', 'scheduled', 'unconfirmed'][vaccineStatusIndex.value] }, `${vaccineName.value.trim()} · ${vaccineStatuses[vaccineStatusIndex.value]}`); if (record) { void syncServer(record); vaccineName.value = ''; if (record.payload.status !== 'administered') openVaccineReminder(record) } }
function openVaccineReminder(record: LocalToolRecord) {
  activePanel.value = 'entry'
  void nextTick(() => {
    vaccineReminders.value?.edit({ sourceKey: `vaccine:${record.id}`, kind: 'vaccines', title: `${record.payload.status === 'unconfirmed' ? '确认接种安排' : '接种'} · ${record.payload.name}`, date: String(record.payload.date || today()) })
    uni.pageScrollTo({ selector: '#vaccine-reminders', duration: 200 })
  })
}
function closeVaccineReminder(id: string, state: 'completed' | 'cancelled') {
  try {
    const owner = reportOwner(), sourceKey = `vaccine:${id}`
    const reminderIds = readReminders(owner).filter(item => item.sourceKey === sourceKey && item.state === 'active').map(item => item.id)
    if (closeReminderSource(owner, sourceKey, state)) uni.showModal({ title: '请同步手机日历', content: '小程序内提醒已结束。此前加入手机日历的事项，请手动修改或删除。', showCancel: false })
    reminderIds.forEach(reminderId => { void cancelWechatReminderRemote(reminderId, owner) })
  } catch { showNotice('记录已保存，请在提醒列表手动停止提醒') }
}
function completeVaccine(record: LocalToolRecord) {
  const owner = reportOwner()
  uni.showModal({ title: '确认已接种？', content: `接种日期将记为今天 ${today()}，原预约日期仍会保留。若需补记其他日期，请在上方新建接种记录，并停止原预约提醒。`, success: res => {
    if (!res.confirm || owner !== reportOwner()) return
    try {
      const updated = updateToolRecord(record.id, { syncStatus: 'local', payload: { ...record.payload, appointmentDate: record.payload.date, date: today(), status: 'administered', summary: `${record.payload.name} · 已接种` } })
      if (!updated) { showNotice('这条预约已移除，请重新查看记录'); return }
      closeVaccineReminder(record.id, 'completed'); reload(); activePanel.value = 'history'; showNotice('已保存接种记录，并结束对应提醒')
    } catch { showNotice('未能保存，请重试') }
  } })
}
function saveFood() { if (!foodName.value.trim()) { showNotice('请填写食材名称'); return }; const record = save('trial', { name: foodName.value.trim(), note: foodNote.value || null, date: recordDate.value }, `${foodName.value.trim()} · 已记录观察`); if (record) { void syncServer(record); foodName.value = ''; foodNote.value = '' } }
function saveDiary() { if (!diaryText.value.trim()) { showNotice('先写下一点内容'); return }; const record = save('entry', { mood: diaryMood.value, content: diaryText.value.trim(), date: recordDate.value }, `${diaryMood.value} · ${diaryText.value.trim().slice(0, 18)}`); if (record) { void syncServer(record); diaryText.value = '' } }
function chooseAlbumImage() { uni.chooseImage({ count: 1, sourceType: ['album', 'camera'], success: result => { albumPreview.value = result.tempFilePaths[0] || '' } }) }
async function saveAlbum() {
  if (!albumPreview.value || albumSaving.value) return
  albumSaving.value = true
  try { await saveToolImage('album', albumPreview.value, { date: recordDate.value, summary: `照片 · ${recordDate.value}` }); albumPreview.value = ''; reload(); activePanel.value = 'history'; showNotice('照片已保存到本机历史') }
  catch (error) { showNotice(error instanceof Error ? error.message : '保存失败，请重试') }
  finally { albumSaving.value = false }
}
function saveExpense() { const amount = Math.round(Number(expenseAmount.value) * 100) / 100; if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) { showNotice('请输入有效金额'); return }; const label = expenseCategories.find(item => item.value === expenseCategory.value)?.label || '其它'; const record = save('entry', { amount, category: expenseCategory.value, note: expenseNote.value || null, date: recordDate.value }, `${label} ${amount.toFixed(2)} 元`); if (record) { void syncServer(record); expenseAmount.value = ''; expenseNote.value = '' } }
function saveGenericNote() { save('note', { note: '已打开并准备使用' }, '已建立工具记录入口') }

onLoad((options) => {
  toolId.value = String(options?.id || 'calendar') as ToolId
  sourcePeriod.value = parseToolPeriod(options?.fromStage, options?.fromWeek)
  reload()
  void loadRemoteRecords()
  if (toolId.value === 'movement') movementTaps.value = readMovementTaps()
  const startedAt = uni.getStorageSync('beihu:contraction-start')
  if (toolId.value === 'contractions' && typeof startedAt === 'string' && Number.isFinite(Date.parse(startedAt)) && Date.parse(startedAt) <= Date.now()) {
    contractionStart.value = startedAt
    contractionTimer = setInterval(() => { contractionNow.value = Date.now() }, 1000)
  }
})
onShow(() => { reload(); pinnedIds.value = readHomeTools(); reportScope.value = reportOwner(); reportPanel.value?.refresh?.() })
onBeforeUnmount(() => { if (contractionTimer) clearInterval(contractionTimer) })
onShareAppMessage(() => ({ title: `贝护 · ${tool.value.title}`, path: `/pages/tool-detail/index?id=${toolId.value}` }))
onShareTimeline(() => ({ title: `贝护 · ${tool.value.title}` }))
</script>

<style scoped>
.vaccine-appointments { margin-top: 28rpx; padding-top: 24rpx; border-top: 1rpx solid #eee7e1; }
.vaccine-appointment { padding: 22rpx 0; border-bottom: 1rpx solid #eee7e1; }.vaccine-actions { display: flex; gap: 12rpx; }.vaccine-actions .secondary-button { flex: 1; margin-top: 16rpx; font-size: 24rpx; padding: 16rpx 8rpx; }
.tool-detail-page { min-height: 100vh; padding-bottom: 70rpx; background: #fcf9f8; }
.record-tabs { display: flex; gap: 8rpx; position: sticky; top: 0; z-index: 5; padding: 12rpx 28rpx; background: #fcf9f8; border-bottom: 1rpx solid #eee7e1; }
.record-tab { flex: 1; padding: 20rpx 8rpx; margin: 0; min-height: 88rpx; font-size: 28rpx; line-height: 1.8; background: transparent; color: #766b67; border-radius: 18rpx; }.record-tab.active { background: #edf5f1; color: #166c5b; font-weight: 700; }
.last-record { display: flex; justify-content: space-between; gap: 12rpx; margin: 16rpx 28rpx 0; padding: 20rpx; text-align: left; background: #fffdfb; color: #655a57; font-size: 24rpx; line-height: 1.6; }.last-record text { flex-shrink: 0; color: #166c5b; }
.last-record .last-record-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #655a57; }
.detail-summary { display: flex; gap: 10rpx; margin: 16rpx 28rpx 0; }
.detail-summary-item { flex: 1; min-width: 0; padding: 16rpx 12rpx; border-radius: 18rpx; background: rgba(255,255,255,.78); border: 1rpx solid #eee7e1; text-align: center; }
.detail-summary-value, .detail-summary-label { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-summary-value { color: #4b5d56; font-size: 27rpx; font-weight: 900; }
.detail-summary-label { margin-top: 5rpx; color: #9a8f8a; font-size: 20rpx; }
.home-pin-button { margin: 20rpx 0 0; width: auto; display: inline-block; padding: 18rpx 24rpx; min-height: 88rpx; background: #edf5f1; color: #166c5b; border-radius: 16rpx; font-size: 25rpx; line-height: 1.8; }
.detail-hero { padding: 28rpx 28rpx 24rpx; box-sizing: border-box; }
.detail-hero.tool-tone--rose { background: linear-gradient(135deg, #fff1f2 0%, #fbe4e5 100%); }
.detail-hero.tool-tone--orange { background: linear-gradient(135deg, #fff4ec 0%, #fbe6d5 100%); }
.detail-hero.tool-tone--green { background: linear-gradient(135deg, #eff8f3 0%, #dcefe7 100%); }
.detail-hero.tool-tone--lilac { background: linear-gradient(135deg, #f8f2f8 0%, #eaddec 100%); }
.hero-back { display: block; width: fit-content; color: #655a57; font-size: 24rpx; background: transparent; margin: 0; padding: 20rpx 16rpx 20rpx 0; min-height: 88rpx; line-height: 1.8; text-align: left; }
.source-context { margin: 20rpx 28rpx 0; padding: 20rpx 24rpx; border-radius: 20rpx; background: #edf5f1; color: #34584d; font-size: 24rpx; line-height: 1.6; }
.source-context-note { display: block; color: #66766e; margin-top: 8rpx; font-size: 22rpx; }
.hero-heading { display: flex; align-items: center; gap: 20rpx; margin-top: 8rpx; }
.hero-icon { display: flex; flex-shrink: 0; align-items: center; justify-content: center; width: 82rpx; height: 82rpx; border-radius: 24rpx; background: rgba(255, 255, 255, .72); font-size: 34rpx; font-weight: 900; }
.hero-kicker { display: block; color: #766b68; font-size: 22rpx; font-weight: 600; }
.hero-title { display: block; margin-top: 6rpx; color: #443c3a; font-size: 44rpx; line-height: 1.4; font-weight: 800; }
.hero-description { display: block; margin-top: 12rpx; color: #655a57; font-size: 27rpx; line-height: 1.65; }
.hero-helper { display: block; margin-top: 12rpx; color: #766b68; font-size: 22rpx; line-height: 1.5; }
.content-card, .history-section { margin: 22rpx 28rpx 0; padding: 26rpx; border-radius: 28rpx; background: #fffdfb; box-shadow: 0 12rpx 28rpx rgba(58, 48, 44, .045); box-sizing: border-box; }
.card-title { display: block; color: #4a4240; font-size: 31rpx; font-weight: 900; }
.card-description, .safety-note { display: block; margin-top: 12rpx; color: #817774; font-size: 23rpx; line-height: 1.65; }
.card-eyebrow { color: #a68d84; font-size: 22rpx; font-weight: 800; }
.card-eyebrow-line, .history-head, .field-row, .counter-actions { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.timer-card { text-align: center; }
.timer-value { display: block; margin-top: 20rpx; color: #b65e68; font-size: 92rpx; line-height: 1; font-weight: 900; font-variant-numeric: tabular-nums; }
.timer-label, .counter-label { display: block; margin-top: 16rpx; color: #897d78; font-size: 23rpx; }
.primary-button, .secondary-button { width: 100%; margin-top: 24rpx; border: 0; border-radius: 16rpx; font-size: 27rpx; font-weight: 800; line-height: 1.5; }
.primary-button { padding: 19rpx 24rpx; background: #16806a; color: #fff; }
.primary-button--stop { background: #c7656e; }
.secondary-button { padding: 17rpx 24rpx; background: #edf5f1; color: #16806a; }
button::after { border: 0; }
.counter-card { text-align: center; }
.counter-value { display: block; margin-top: 18rpx; color: #16806a; font-size: 94rpx; line-height: 1; font-weight: 900; }
.counter-actions { justify-content: center; margin-top: 24rpx; }
.counter-button { flex: 1; max-width: 280rpx; padding: 20rpx 10rpx; border: 0; border-radius: 18rpx; background: #16806a; color: #fff; font-size: 27rpx; font-weight: 800; }
.counter-button--undo { background: #f2eeeb; color: #847873; }
.counter-button[disabled] { opacity: .45; }
.local-badge, .progress-label { padding: 6rpx 12rpx; border-radius: 999rpx; background: #edf5f1; color: #16806a; font-size: 20rpx; }
.field-row { min-height: 84rpx; border-bottom: 1rpx solid #f0e9e6; }
.field-row--top { align-items: flex-start; padding-top: 18rpx; }
.field-label { flex-shrink: 0; width: 124rpx; color: #756a66; font-size: 25rpx; font-weight: 800; }
.field-input, .field-value { flex: 1; min-width: 0; color: #4b4441; font-size: 27rpx; }
.field-value { padding: 25rpx 0; }
.field-unit { flex-shrink: 0; color: #9a8f8a; font-size: 23rpx; }
.field-textarea { flex: 1; min-height: 130rpx; padding: 20rpx 0; color: #4b4441; font-size: 26rpx; line-height: 1.6; }
.choice-grid { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 18rpx; }
.choice-chip { padding: 13rpx 18rpx; border-radius: 999rpx; background: #f5f0ed; color: #8d817b; font-size: 23rpx; }
.choice-chip.active { background: #dcefe7; color: #16806a; font-weight: 800; }
.check-list { margin-top: 20rpx; }
.check-row { display: flex; align-items: center; gap: 16rpx; padding: 18rpx 0; border-top: 1rpx solid #f0e9e6; }
.check-box { display: flex; align-items: center; justify-content: center; width: 42rpx; height: 42rpx; border: 2rpx solid #d8ccc7; border-radius: 12rpx; color: #fff; font-size: 26rpx; }
.check-box.checked { border-color: #16806a; background: #16806a; }
.check-copy { flex: 1; }
.check-name, .check-group { display: block; }
.check-name { color: #4f4744; font-size: 26rpx; }
.check-group { margin-top: 4rpx; color: #a19792; font-size: 20rpx; }
.large-textarea { width: 100%; min-height: 260rpx; margin-top: 20rpx; padding: 20rpx; border-radius: 18rpx; background: #faf6f3; color: #4b4441; font-size: 27rpx; line-height: 1.7; box-sizing: border-box; }
.album-preview { display: block; width: 100%; height: 420rpx; margin-top: 22rpx; border-radius: 22rpx; background: #f4efed; }
.notice-card { margin: 20rpx 28rpx 0; padding: 18rpx 22rpx; border-radius: 18rpx; background: #edf7f2; color: #16806a; font-size: 23rpx; text-align: center; }
.history-section { padding-bottom: 14rpx; }
.history-head { padding-bottom: 14rpx; }
.history-meta { color: #a0938d; font-size: 21rpx; }
.history-row { display: flex; align-items: center; gap: 14rpx; padding: 17rpx 0; border-top: 1rpx solid #f0e9e6; }
.history-dot { width: 16rpx; height: 16rpx; border-radius: 50%; }
.history-copy { flex: 1; min-width: 0; }
.history-summary { display: block; overflow: hidden; color: #554b48; font-size: 24rpx; text-overflow: ellipsis; white-space: nowrap; }
.history-time { display: block; margin-top: 5rpx; color: #a0938d; font-size: 20rpx; }
.history-delete { color: #b8796c; font-size: 21rpx; }
.detail-footer { padding: 32rpx 28rpx 0; color: #aaa09b; font-size: 20rpx; text-align: center; }
</style>
