<template>
  <view class="tool-detail-page">
    <view class="detail-hero" :class="getToneClass(tool.tone)">
      <view class="hero-back" @tap="goBack">‹ 工具箱</view>
      <view class="hero-icon"><text>{{ tool.icon }}</text></view>
      <text class="hero-kicker">{{ tool.kicker }} · {{ statusLabel(tool.status) }}</text>
      <text class="hero-title">{{ tool.title }}</text>
      <text class="hero-description">{{ tool.description }}</text>
      <text class="hero-helper">{{ tool.helper }}</text>
    </view>

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
      <text class="counter-label">每次点按保存一个时间点，可撤销上一次</text>
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
      <view v-if="weightRecords.length" class="mini-chart">
        <view v-for="item in weightRecords.slice(0, 7).reverse()" :key="item.id" class="chart-item">
          <view class="chart-bar" :style="{ height: `${weightBarHeight(item)}rpx` }"></view>
          <text>{{ shortDate(item.createdAt) }}</text>
        </view>
      </view>
      <text class="safety-note">参考带和孕周计算会在资料条件完整后开放；当前只保存你的实际测量值。</text>
    </view>

    <view v-else-if="tool.id === 'care'" class="content-card">
      <text class="card-title">快速记一笔照护</text>
      <view class="choice-grid">
        <view v-for="item in careTypes" :key="item.value" class="choice-chip" :class="{ active: careType === item.value }" @tap="careType = item.value"><text>{{ item.label }}</text></view>
      </view>
      <view v-if="careType === 'feeding'" class="field-row"><text class="field-label">奶量</text><input v-model="careAmount" class="field-input" type="digit" placeholder="未知可留空" /><text class="field-unit">ml</text></view>
      <view class="field-row"><text class="field-label">备注</text><input v-model="careNote" class="field-input" maxlength="60" placeholder="可选，例如左侧亲喂" /></view>
      <button class="primary-button" @tap="saveCare">保存照护记录</button>
      <text class="safety-note">喂奶次数、亲喂时长、瓶喂奶量和尿布类型会分别保存，未知量不会记成 0。</text>
    </view>

    <view v-else-if="tool.id === 'growth'" class="content-card">
      <text class="card-title">保存一次生长测量</text>
      <view class="choice-grid"><view v-for="item in growthTypes" :key="item.value" class="choice-chip" :class="{ active: growthType === item.value }" @tap="growthType = item.value"><text>{{ item.label }}</text></view></view>
      <view class="field-row"><text class="field-label">测量值</text><input v-model="growthValue" class="field-input" type="digit" placeholder="请输入数值" /><text class="field-unit">{{ growthUnit }}</text></view>
      <button class="primary-button" @tap="saveGrowth">保存测量</button>
      <text class="safety-note">完善出生日期、性别和测量方式后，再开放 WHO 曲线展示。</text>
    </view>

    <view v-else-if="tool.id === 'packing'" class="content-card">
      <view class="card-eyebrow-line"><text class="card-title">待产包基础清单</text><text class="progress-label">{{ packingDoneCount }}/{{ packingItems.length }}</text></view>
      <text class="card-description">先按妈妈、宝宝、证件分组准备；医院要求可以自行增删。家庭认领将在权限链路完成后开放。</text>
      <view class="check-list"><view v-for="item in packingItems" :key="item.name" class="check-row" @tap="togglePacking(item.name)"><view class="check-box" :class="{ checked: isPackingDone(item.name) }"><text v-if="isPackingDone(item.name)">✓</text></view><view class="check-copy"><text class="check-name">{{ item.name }}</text><text class="check-group">{{ item.group }}</text></view></view></view>
    </view>

    <view v-else-if="tool.id === 'vaccines'" class="content-card">
      <text class="card-title">记录一次接种</text>
      <view class="field-row"><text class="field-label">疫苗名称</text><input v-model="vaccineName" class="field-input" maxlength="40" placeholder="例如 乙肝疫苗" /></view>
      <view class="field-row"><text class="field-label">接种日期</text><picker mode="date" :value="recordDate" @change="onDateChange"><view class="field-value">{{ recordDate }}</view></picker></view>
      <view class="field-row"><text class="field-label">状态</text><picker :range="vaccineStatuses" :value="vaccineStatusIndex" @change="onVaccineStatusChange"><view class="field-value">{{ vaccineStatuses[vaccineStatusIndex] }}</view></picker></view>
      <button class="primary-button" @tap="saveVaccine">保存接种记录</button>
      <text class="safety-note">时间表只做参考，补种、联合苗替换和禁忌请由接种门诊确认。</text>
    </view>

    <view v-else-if="tool.id === 'foods'" class="content-card">
      <text class="card-title">记一次食材尝试</text>
      <view class="field-row"><text class="field-label">食材</text><input v-model="foodName" class="field-input" maxlength="40" placeholder="例如 高铁米粉" /></view>
      <view class="field-row field-row--top"><text class="field-label">观察</text><textarea v-model="foodNote" class="field-textarea" maxlength="160" placeholder="记录当天看到的情况，不需要下结论" /></view>
      <button class="primary-button" @tap="saveFood">保存尝试</button>
      <text class="safety-note">没有观察记录不等于没有反应；需要判断时请咨询专业人员。</text>
    </view>

    <view v-else-if="tool.id === 'reports'" class="content-card">
      <text class="card-title">先建立一条报告归档</text>
      <view class="field-row"><text class="field-label">报告日期</text><picker mode="date" :value="recordDate" @change="onDateChange"><view class="field-value">{{ recordDate }}</view></picker></view>
      <view class="field-row"><text class="field-label">名称</text><input v-model="reportName" class="field-input" maxlength="50" placeholder="例如 28 周产检" /></view>
      <view class="field-row field-row--top"><text class="field-label">备注</text><textarea v-model="reportNote" class="field-textarea" maxlength="240" placeholder="先手动记录或说明待核对字段" /></view>
      <button class="primary-button" @tap="saveReport">保存归档草稿</button>
      <text class="safety-note">OCR 和 Jev 只会从文字候选中整理；没有用户确认前不会写入正式数值。</text>
    </view>

    <view v-else-if="tool.id === 'poster'" class="content-card poster-card">
      <view class="poster-preview"><text class="poster-label">{{ currentWeek ? `孕期第 ${currentWeek} 周` : '贝护阶段卡' }}</text><text class="poster-main">今天也在好好记录</text><text class="poster-small">把真实的日子，留给未来的自己。</text></view>
      <button class="primary-button" @tap="savePoster">保存这张阶段卡</button>
      <text class="safety-note">正式版本会接入 Canvas 和真实小程序码；当前先把预览和保存链路跑通。</text>
    </view>

    <view v-else-if="tool.id === 'diary'" class="content-card">
      <text class="card-title">写下今天的一小段</text>
      <view class="choice-grid"><view v-for="item in moods" :key="item.value" class="choice-chip" :class="{ active: diaryMood === item.value }" @tap="diaryMood = item.value"><text>{{ item.label }}</text></view></view>
      <textarea v-model="diaryText" class="large-textarea" maxlength="800" placeholder="今天有什么想留下？"></textarea>
      <button class="primary-button" @tap="saveDiary">保存日记</button>
      <text class="safety-note">周回顾只引用你保存的文字和数据，原文与整理草稿会分开保留。</text>
    </view>

    <view v-else-if="tool.id === 'album'" class="content-card">
      <text class="card-title">添加一张成长照片</text>
      <text class="card-description">先保存本机照片路径和日期，后续接入私有云端资产、引用和删除管理。</text>
      <button class="secondary-button" @tap="chooseAlbumImage">从相册选择</button>
      <image v-if="albumPreview" class="album-preview" :src="albumPreview" mode="aspectFill"></image>
      <button v-if="albumPreview" class="primary-button" @tap="saveAlbum">保存照片记录</button>
      <text class="safety-note">当前不做人脸识别或儿童人像生成；删除照片前会检查其它记录引用。</text>
    </view>

    <view v-else-if="tool.id === 'expenses'" class="content-card">
      <text class="card-title">记一笔家庭支出</text>
      <view class="field-row"><text class="field-label">金额</text><input v-model="expenseAmount" class="field-input" type="digit" placeholder="0.00" /><text class="field-unit">元</text></view>
      <view class="choice-grid"><view v-for="item in expenseCategories" :key="item.value" class="choice-chip" :class="{ active: expenseCategory === item.value }" @tap="expenseCategory = item.value"><text>{{ item.label }}</text></view></view>
      <view class="field-row"><text class="field-label">备注</text><input v-model="expenseNote" class="field-input" maxlength="60" placeholder="例如 奶粉" /></view>
      <button class="primary-button" @tap="saveExpense">保存账目</button>
      <text class="safety-note">退款和转入会单独记录；月度合计由程序计算，原始金额不进入分析埋点。</text>
    </view>

    <view v-else class="content-card">
      <text class="card-title">{{ tool.title }}正在准备</text>
      <text class="card-description">先把入口、阶段说明和本机草稿链路准备好，后续按计划接入云同步和专属规则。</text>
      <button class="primary-button" @tap="saveGenericNote">保存一条准备备注</button>
    </view>

    <view v-if="notice" class="notice-card"><text>{{ notice }}</text></view>

    <view v-if="displayRecords.length" class="history-section">
      <view class="history-head"><text class="card-title">最近记录</text><text class="history-meta">本机 {{ displayRecords.length }} 条</text></view>
      <view v-for="record in displayRecords" :key="record.id" class="history-row">
        <view class="history-dot" :class="getToneClass(tool.tone)"></view>
        <view class="history-copy"><text class="history-summary">{{ recordSummary(record) }}</text><text class="history-time">{{ formatDateTime(record.createdAt) }}</text></view>
        <text class="history-delete" @tap="removeRecord(record.id)">删除</text>
      </view>
    </view>

    <view class="detail-footer"><text>本机记录 · 登录后再决定是否同步</text></view>
  </view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { calculatePregnancyWeekFromDueDate } from '@/utils'
import { toolRecordApi } from '@/api/modules'
import { getToolDefinition, getToneClass, type ToolId, type ToolStatus } from '@/data/tool-catalog'
import { deleteToolRecord, listToolRecords, readToolRecords, saveToolRecord, type LocalToolRecord } from '@/utils/tool-records'

const appStore = useAppStore()
const toolId = ref<ToolId>('calendar')
const records = ref<LocalToolRecord[]>([])
const notice = ref('')
const recordDate = ref(today())
const storedWeek = ref<number | null>(null)

const contractionStart = ref<string | null>(null)
const contractionNow = ref(Date.now())
const movementCount = ref(0)
let contractionTimer: ReturnType<typeof setInterval> | undefined

const weightValue = ref('')
const careType = ref('feeding')
const careAmount = ref('')
const careNote = ref('')
const growthType = ref('height')
const growthValue = ref('')
const vaccineName = ref('')
const vaccineStatusIndex = ref(0)
const foodName = ref('')
const foodNote = ref('')
const reportName = ref('')
const reportNote = ref('')
const diaryMood = ref('平稳')
const diaryText = ref('')
const albumPreview = ref('')
const expenseAmount = ref('')
const expenseCategory = ref('checkup')
const expenseNote = ref('')

const careTypes = [{ value: 'feeding', label: '喂奶' }, { value: 'diaper', label: '换尿布' }, { value: 'sleep', label: '睡眠' }]
const growthTypes = [{ value: 'height', label: '身高' }, { value: 'weight', label: '体重' }, { value: 'head', label: '头围' }]
const vaccineStatuses = ['已接种', '已预约', '待确认']
const moods = ['开心', '平稳', '疲惫', '期待'].map(label => ({ value: label, label }))
const expenseCategories = [{ value: 'checkup', label: '产检' }, { value: 'supplies', label: '待产包' }, { value: 'feeding', label: '奶粉/喂养' }, { value: 'vaccine', label: '疫苗' }]
const packingItems = [
  { name: '证件与产检资料', group: '证件' }, { name: '产褥垫', group: '妈妈' }, { name: '哺乳内衣', group: '妈妈' },
  { name: '新生儿衣物', group: '宝宝' }, { name: '纸尿裤', group: '宝宝' }, { name: '包被', group: '宝宝' },
]

const tool = computed(() => getToolDefinition(toolId.value))
const currentWeek = computed(() => appStore.user?.dueDate ? calculatePregnancyWeekFromDueDate(appStore.user.dueDate) : storedWeek.value)
const displayRecords = computed(() => listToolRecords(toolId.value).slice(0, 8))
const weightRecords = computed(() => listToolRecords('weight', 'measurement').filter(item => typeof item.payload.value === 'number'))
const packingRecords = computed(() => listToolRecords('packing', 'item'))
const packingDoneCount = computed(() => packingItems.filter(item => isPackingDone(item.name)).length)
const growthUnit = computed(() => growthType.value === 'head' ? 'cm' : growthType.value === 'weight' ? 'kg' : 'cm')
const contractionElapsedText = computed(() => {
  if (!contractionStart.value) return '00:00'
  const seconds = Math.max(0, Math.floor((contractionNow.value - new Date(contractionStart.value).getTime()) / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
})

function today() { return new Date().toISOString().slice(0, 10) }
function reload() {
  const value = Number.parseInt(String(uni.getStorageSync('userPregnancyWeek') || ''), 10)
  storedWeek.value = Number.isFinite(value) && value >= 1 && value <= 40 ? value : null
  records.value = readToolRecords()
}
function statusLabel(status: ToolStatus) { return ({ ready: '已上线', preview: '预览', planned: '逐步开放' }[status]) }
function showNotice(message: string) { notice.value = message; setTimeout(() => { if (notice.value === message) notice.value = '' }, 2400) }
function save(recordType: string, payload: Record<string, string | number | boolean | null | undefined>, summary: string): LocalToolRecord {
  const record = saveToolRecord(toolId.value, recordType, { ...payload, summary })
  reload()
  showNotice('已保存到本机记录')
  return record
}

async function syncServer(record: LocalToolRecord): Promise<void> {
  if (!uni.getStorageSync('token')) return
  try {
    const payload = record.payload
    if (record.toolId === 'contractions' && record.recordType === 'session'
      && typeof payload.startAt === 'string' && typeof payload.endAt === 'string' && typeof payload.durationSeconds === 'number') {
      await toolRecordApi.createContraction({
        startedAt: payload.startAt,
        endedAt: payload.endAt,
        durationSeconds: payload.durationSeconds,
        intervalSeconds: typeof payload.intervalSeconds === 'number' ? payload.intervalSeconds : null,
        clientOperationId: record.id,
      })
    } else if (record.toolId === 'movement' && record.recordType === 'session'
      && typeof payload.startedAt === 'string' && typeof payload.endedAt === 'string' && typeof payload.count === 'number') {
      await toolRecordApi.createMovement({
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        count: payload.count,
        method: typeof payload.method === 'string' ? payload.method : 'free',
        clientOperationId: record.id,
      })
    } else if (record.toolId === 'weight' && record.recordType === 'measurement'
      && typeof payload.measuredAt === 'string' && typeof payload.value === 'number') {
      await toolRecordApi.createWeight({
        measuredAt: payload.measuredAt,
        weightKg: payload.value,
        source: 'manual',
        clientOperationId: record.id,
      })
    } else if (record.toolId === 'diary' && record.recordType === 'entry'
      && typeof payload.date === 'string' && typeof payload.content === 'string') {
      await toolRecordApi.createDiaryEntry({
        entryDate: payload.date,
        mood: typeof payload.mood === 'string' ? payload.mood : null,
        content: payload.content,
        clientOperationId: record.id,
      })
    } else if (record.toolId === 'expenses' && record.recordType === 'entry'
      && typeof payload.date === 'string' && typeof payload.amount === 'number' && typeof payload.category === 'string') {
      await toolRecordApi.createExpenseEntry({
        occurredAt: payload.date,
        amountCents: Math.round(payload.amount * 100),
        direction: 'expense',
        category: payload.category,
        note: typeof payload.note === 'string' ? payload.note : null,
        clientOperationId: record.id,
      })
    }
  } catch {
    showNotice('已保存在本机，网络恢复后可重新同步')
  }
}
function openCalendar() { uni.switchTab({ url: '/pages/calendar/index' }) }
function goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/tools/index' }) }) }
function onDateChange(event: { detail: { value: string } }) { recordDate.value = event.detail.value }
function shortDate(value: string) { return value.slice(5, 10) }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '刚刚' : `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` }
function recordSummary(record: LocalToolRecord) { return typeof record.payload.summary === 'string' ? record.payload.summary : '已保存一条记录' }
function removeRecord(id: string) { deleteToolRecord(id); reload(); showNotice('已删除本机记录') }

function toggleContraction() {
  if (contractionStart.value) {
    const start = new Date(contractionStart.value).getTime()
    const end = Date.now()
    const record = save('session', { startAt: contractionStart.value, endAt: new Date(end).toISOString(), durationSeconds: Math.max(0, Math.round((end - start) / 1000)) }, `宫缩 ${Math.max(0, Math.round((end - start) / 1000))} 秒`)
    void syncServer(record)
    contractionStart.value = null
    if (contractionTimer) clearInterval(contractionTimer)
    uni.removeStorageSync('beihu:contraction-start')
    return
  }
  contractionStart.value = new Date().toISOString()
  uni.setStorageSync('beihu:contraction-start', contractionStart.value)
  contractionNow.value = Date.now()
  contractionTimer = setInterval(() => { contractionNow.value = Date.now() }, 1000)
}

function addMovement() { movementCount.value += 1 }
function undoMovement() { movementCount.value = Math.max(0, movementCount.value - 1) }
function finishMovement() { if (!movementCount.value) { showNotice('先记录至少一次胎动'); return }; const now = new Date(); const startedAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); const record = save('session', { count: movementCount.value, startedAt, endedAt: now.toISOString(), method: 'free' }, `胎动 ${movementCount.value} 次`); void syncServer(record); movementCount.value = 0 }
function saveWeight() { const value = Number(weightValue.value); if (!Number.isFinite(value) || value <= 0 || value > 300) { showNotice('请输入有效体重'); return }; const record = save('measurement', { value, unit: 'kg', measuredAt: recordDate.value }, `${value} kg`); void syncServer(record); weightValue.value = '' }
function saveCare() { const amount = careAmount.value ? Number(careAmount.value) : null; if (careType.value === 'feeding' && amount !== null && (!Number.isFinite(amount) || amount < 0)) { showNotice('奶量格式不正确'); return }; const label = careTypes.find(item => item.value === careType.value)?.label || '照护'; save('log', { kind: careType.value, amount, note: careNote.value || null, recordedAt: new Date().toISOString() }, `${label}${amount === null ? '' : ` ${amount}ml`}`); careAmount.value = ''; careNote.value = '' }
function saveGrowth() { const value = Number(growthValue.value); if (!Number.isFinite(value) || value <= 0) { showNotice('请输入有效测量值'); return }; const label = growthTypes.find(item => item.value === growthType.value)?.label || '测量'; save('measurement', { metric: growthType.value, value, unit: growthUnit.value, measuredAt: recordDate.value }, `${label} ${value}${growthUnit.value}`); growthValue.value = '' }
function isPackingDone(name: string) { const item = packingRecords.value.find(record => record.payload.item === name); return item?.payload.done === true }
function togglePacking(name: string) { const next = !isPackingDone(name); save('item', { item: name, done: next }, `${next ? '已准备' : '取消'}：${name}`) }
function onVaccineStatusChange(event: { detail: { value: string } }) { vaccineStatusIndex.value = Number(event.detail.value) }
function saveVaccine() { if (!vaccineName.value.trim()) { showNotice('请填写疫苗名称'); return }; save('record', { name: vaccineName.value.trim(), date: recordDate.value, status: vaccineStatuses[vaccineStatusIndex.value] }, `${vaccineName.value.trim()} · ${vaccineStatuses[vaccineStatusIndex.value]}`); vaccineName.value = '' }
function saveFood() { if (!foodName.value.trim()) { showNotice('请填写食材名称'); return }; save('trial', { name: foodName.value.trim(), note: foodNote.value || null, date: recordDate.value }, `${foodName.value.trim()} · 已记录观察`); foodName.value = ''; foodNote.value = '' }
function saveReport() { if (!reportName.value.trim()) { showNotice('请填写报告名称'); return }; save('draft', { name: reportName.value.trim(), date: recordDate.value, note: reportNote.value || null, confirmed: false }, `${reportName.value.trim()} · 待核对`); reportName.value = ''; reportNote.value = '' }
function savePoster() { save('card', { week: currentWeek.value, template: 'stage-card' }, currentWeek.value ? `第 ${currentWeek.value} 周阶段卡` : '阶段卡预览') }
function saveDiary() { if (!diaryText.value.trim()) { showNotice('先写下一点内容'); return }; const record = save('entry', { mood: diaryMood.value, content: diaryText.value.trim(), date: recordDate.value }, `${diaryMood.value} · ${diaryText.value.trim().slice(0, 18)}`); void syncServer(record); diaryText.value = '' }
function chooseAlbumImage() { uni.chooseImage({ count: 1, sourceType: ['album', 'camera'], success: result => { albumPreview.value = result.tempFilePaths[0] || '' } }) }
function saveAlbum() { if (!albumPreview.value) return; save('photo', { path: albumPreview.value, date: recordDate.value }, `照片 · ${recordDate.value}`); albumPreview.value = '' }
function saveExpense() { const amount = Number(expenseAmount.value); if (!Number.isFinite(amount) || amount <= 0) { showNotice('请输入有效金额'); return }; const label = expenseCategories.find(item => item.value === expenseCategory.value)?.label || '其它'; const record = save('entry', { amount: Math.round(amount * 100) / 100, category: expenseCategory.value, note: expenseNote.value || null, date: recordDate.value }, `${label} ${amount.toFixed(2)} 元`); void syncServer(record); expenseAmount.value = ''; expenseNote.value = '' }
function saveGenericNote() { save('note', { note: '已打开并准备使用' }, '已建立工具记录入口') }
function weightBarHeight(record: LocalToolRecord) { const values = weightRecords.value.map(item => Number(item.payload.value)); const min = Math.min(...values); const max = Math.max(...values); const current = Number(record.payload.value); return max === min ? 74 : Math.round(42 + ((current - min) / (max - min)) * 64) }

onLoad((options) => {
  toolId.value = String(options?.id || 'calendar') as ToolId
  reload()
  contractionStart.value = uni.getStorageSync('beihu:contraction-start') || null
  if (contractionStart.value) contractionTimer = setInterval(() => { contractionNow.value = Date.now() }, 1000)
})
onBeforeUnmount(() => { if (contractionTimer) clearInterval(contractionTimer) })
onShareAppMessage(() => ({ title: `贝护 · ${tool.value.title}`, path: `/pages/tool-detail/index?id=${toolId.value}` }))
onShareTimeline(() => ({ title: `贝护 · ${tool.value.title}` }))
</script>

<style scoped>
.tool-detail-page { min-height: 100vh; padding-bottom: 70rpx; background: #fcf9f8; }
.detail-hero { padding: 28rpx 28rpx 34rpx; min-height: 310rpx; box-sizing: border-box; }
.hero-back { color: currentColor; opacity: .72; font-size: 24rpx; }
.hero-icon { display: flex; align-items: center; justify-content: center; width: 82rpx; height: 82rpx; margin-top: 24rpx; border-radius: 26rpx; background: rgba(255, 255, 255, .72); font-size: 34rpx; font-weight: 900; }
.hero-kicker { display: block; margin-top: 22rpx; color: currentColor; opacity: .72; font-size: 22rpx; font-weight: 800; }
.hero-title { display: block; margin-top: 8rpx; color: #443c3a; font-size: 48rpx; font-weight: 900; }
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
.mini-chart { display: flex; align-items: end; justify-content: space-around; height: 150rpx; margin-top: 30rpx; padding: 18rpx 8rpx 0; border-radius: 18rpx; background: #f6faf8; }
.chart-item { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: end; height: 100%; color: #9a8f8a; font-size: 18rpx; }
.chart-bar { width: 26rpx; min-height: 18rpx; border-radius: 12rpx 12rpx 0 0; background: #7ebaa4; }
.check-list { margin-top: 20rpx; }
.check-row { display: flex; align-items: center; gap: 16rpx; padding: 18rpx 0; border-top: 1rpx solid #f0e9e6; }
.check-box { display: flex; align-items: center; justify-content: center; width: 42rpx; height: 42rpx; border: 2rpx solid #d8ccc7; border-radius: 12rpx; color: #fff; font-size: 26rpx; }
.check-box.checked { border-color: #16806a; background: #16806a; }
.check-copy { flex: 1; }
.check-name, .check-group { display: block; }
.check-name { color: #4f4744; font-size: 26rpx; }
.check-group { margin-top: 4rpx; color: #a19792; font-size: 20rpx; }
.large-textarea { width: 100%; min-height: 260rpx; margin-top: 20rpx; padding: 20rpx; border-radius: 18rpx; background: #faf6f3; color: #4b4441; font-size: 27rpx; line-height: 1.7; box-sizing: border-box; }
.poster-card { text-align: center; }
.poster-preview { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 390rpx; padding: 28rpx; border-radius: 24rpx; background: linear-gradient(150deg, #f8c5c3, #f3ded0 58%, #fff5e9); box-sizing: border-box; }
.poster-label { color: #ad5d64; font-size: 25rpx; font-weight: 800; }
.poster-main { margin-top: 28rpx; color: #5a3e40; font-size: 42rpx; font-weight: 900; }
.poster-small { margin-top: 16rpx; color: #846d68; font-size: 23rpx; }
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
