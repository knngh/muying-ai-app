<template>
  <view class="calendar-timeline-page">
    <!-- 顶部背景与动态宝宝展示 -->
    <view class="hero-section">
      <view class="header-nav">
        <text class="hero-title">{{ currentWeekData.title }}</text>
      </view>

      <!-- 动态宝宝成长动画区 -->
      <view class="baby-animation-container">
        <!-- 呼吸动画的光晕 -->
        <view class="breathing-glow"></view>
        <!-- 宝宝状态/大小比喻展示 -->
        <view class="baby-visual">
          <text class="baby-emoji">{{ currentWeekData.babySizeEmoji || '🌱' }}</text>
        </view>
        <view class="baby-size-info">
          <text class="size-text">{{ heroMetricLabel }}: {{ currentWeekData.babySizeText || '未知阶段' }}</text>
          <text class="size-desc" v-if="currentWeekData.babyWeight">{{ heroMetricDescLabel }}: {{ currentWeekData.babyWeight }}</text>
        </view>
      </view>

      <!-- 横向滑动时间轴 -->
      <scroll-view 
        scroll-x 
        class="week-timeline-scroll" 
        :scroll-into-view="timelineScrollTarget"
        scroll-with-animation
      >
        <view class="timeline-container">
          <view 
            v-for="week in weeksList" 
            :key="week.timelineKey"
            :id="'week-' + week.storageWeek"
            class="timeline-item"
            :class="{ 'active': currentSelectedWeek === week.storageWeek }"
            :data-week="week.storageWeek"
            @tap="handleSelectWeek"
          >
            <view class="week-circle">{{ week.circleLabel }}</view>
            <text class="week-label">{{ week.weekLabel }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="week-command-card">
      <view class="week-command-head">
        <view class="week-command-copy">
          <text class="week-command-kicker">{{ timelineKicker }}</text>
          <text class="week-command-title">{{ selectedPeriodTitle }}先看这里</text>
          <text class="week-command-desc">{{ weekCommandDescription }}</text>
        </view>
        <view class="week-command-badge">
          <text class="week-command-badge-text">{{ weekCommandBadge }}</text>
        </view>
      </view>

      <view class="week-command-grid">
        <view
          v-for="item in tabQuickActions"
          :key="item.key"
          class="week-command-item"
          :class="{ 'week-command-item--active': activeTab === item.key }"
          @tap="activeTab = item.key"
        >
          <text class="week-command-item-label">{{ item.label }}</text>
          <text class="week-command-item-value">{{ item.value }}</text>
          <text class="week-command-item-meta">{{ item.meta }}</text>
        </view>
      </view>
    </view>

    <!-- 选项卡切换 -->
    <view class="tabs-container">
      <view 
        class="tab-item" 
        :class="{ 'active': activeTab === 'guide' }" 
        @tap="activeTab = 'guide'"
      >
        <text class="tab-text">{{ guideTabLabel }}</text>
        <view class="tab-line" v-if="activeTab === 'guide'"></view>
      </view>
      <view 
        class="tab-item" 
        :class="{ 'active': activeTab === 'todo' }" 
        @tap="activeTab = 'todo'"
      >
        <text class="tab-text">待办事项</text>
        <view class="tab-line" v-if="activeTab === 'todo'"></view>
      </view>
      <view 
        class="tab-item" 
        :class="{ 'active': activeTab === 'diary' }" 
        @tap="activeTab = 'diary'"
      >
        <text class="tab-text">我的记录</text>
        <view class="tab-line" v-if="activeTab === 'diary'"></view>
      </view>
    </view>

    <!-- 时间线内容 -->
    <view class="content-section" v-if="activeTab === 'guide'">
      <!-- 总体总结 -->
      <view class="summary-card">
        <text class="quote-mark">“</text>
        <text class="summary-text">{{ currentWeekData.summary }}</text>
        <text class="quote-mark right">”</text>
      </view>

      <!-- 宝宝发育 -->
      <view class="info-card baby-card">
        <view class="card-header">
          <view class="header-left">
            <text class="card-icon">👶</text>
            <text class="card-title">{{ babySectionTitle }}</text>
          </view>
        </view>
        <view class="card-body">
          <text class="card-text">{{ parsedContent.baby }}</text>
        </view>
      </view>

      <!-- 孕妈变化 -->
      <view class="info-card mom-card">
        <view class="card-header">
          <view class="header-left">
            <text class="card-icon">👩</text>
            <text class="card-title">{{ momSectionTitle }}</text>
          </view>
        </view>
        <view class="card-body">
          <text class="card-text">{{ parsedContent.mom }}</text>
        </view>
      </view>

      <!-- 本周建议 Tips -->
      <view class="info-card tips-card" v-if="parsedContent.tips && parsedContent.tips.length > 0">
        <view class="card-header">
          <view class="header-left">
            <text class="card-icon">💡</text>
            <text class="card-title">{{ tipsSectionTitle }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="tip-item" v-for="(tip, index) in parsedContent.tips" :key="index">
            <view class="tip-dot"></view>
            <text class="tip-text">{{ tip }}</text>
          </view>
        </view>
      </view>

    </view>

    <!-- 待办事项 内容 -->
    <view class="content-section" v-if="activeTab === 'todo'">
      <view class="week-overview-card">
        <view class="week-overview-copy">
          <text class="week-overview-title">{{ selectedPeriodTitle }}执行面板</text>
          <text class="week-overview-desc">
            {{ canUseTodoActions ? `已完成 ${completedTodoCount} / ${todoList.length} 项，本周事项会实时保存。` : '未登录也可先看本周重点；登录后再保存待办和完成状态。' }}
          </text>
        </view>
        <view
          v-if="!canUseTodoActions"
          class="week-overview-btn"
          @tap="goLoginForTimeline('登录后可保存待办和记录')"
        >
          <text class="week-overview-btn-text">去登录</text>
        </view>
      </view>

      <view class="week-priority-card">
        <view class="week-priority-head">
          <view class="week-priority-copy">
            <text class="week-priority-kicker">{{ priorityKicker }}</text>
            <text class="week-priority-title">{{ weekPriority.title }}</text>
            <text class="week-priority-subtitle">{{ weekPriority.subtitle }}</text>
          </view>
          <view class="week-priority-badge">
            <text class="week-priority-badge-text">{{ weekPriority.items.length }}</text>
          </view>
        </view>

        <view
          v-for="item in weekPriority.items"
          :key="`${item.label}-${item.title}`"
          class="week-priority-item"
          :class="{ 'week-priority-item--done': item.completed }"
        >
          <view class="week-priority-item-head">
            <text class="week-priority-item-title">{{ item.title }}</text>
            <text class="week-priority-item-label">{{ item.label }}</text>
          </view>
          <text class="week-priority-item-desc">{{ item.desc }}</text>
          <text class="week-priority-item-reason">{{ item.reason }}</text>
        </view>

        <text class="week-priority-reminder">{{ weekPriority.reminder }}</text>
      </view>

      <view class="info-card todo-card">
        <view class="card-header">
          <view class="header-left">
            <text class="card-icon">📌</text>
            <text class="card-title">核心待办</text>
          </view>
          <view class="todo-header-actions">
            <text class="todo-progress">{{ completedTodoCount }}/{{ todoList.length }} 完成</text>
            <view
              class="todo-add-chip"
              :class="{ 'todo-add-chip--disabled': !canUseTodoActions }"
              @tap="openCustomTodoModal"
            >
              <text class="todo-add-chip-icon">+</text>
              <text class="todo-add-chip-text">添加</text>
            </view>
          </view>
        </view>
        <text v-if="timelineTodoLoading" class="todo-login-hint">正在同步{{ guideTabLabel }}待办...</text>
        <text v-else-if="!canUseTodoActions" class="todo-login-hint">登录后可勾选并保存待办进度</text>
        <view class="card-body">
          <view
            class="todo-item"
            :class="{
              'todo-item--done': todo.completed,
              'todo-item--disabled': !canUseTodoActions,
              'todo-item--pending': todoPendingKey === todo.stateKey,
            }"
            v-for="todo in todoList"
            :key="todo.stateKey"
            @tap="toggleTodo(todo)"
          >
            <view class="todo-check" :class="{ 'todo-check--done': todo.completed }">
              <text class="todo-check-icon">{{ todo.completed ? '✓' : '' }}</text>
            </view>
            <view class="todo-content">
              <view class="todo-meta">
                <view class="todo-type" :class="'type-' + todo.type">
                  {{ getTodoTypeLabel(todo.type) }}
                </view>
                <text v-if="todoPendingKey === todo.stateKey" class="todo-state todo-state--muted">同步中</text>
                <text v-if="todo.completed" class="todo-state">已完成</text>
              </view>
              <text class="todo-title">{{ todo.title }}</text>
              <text class="todo-desc">{{ todo.desc }}</text>
              <view
                v-if="todo.type === 'custom' && canUseTodoActions"
                class="todo-actions"
                @tap.stop
              >
                <text class="todo-action-btn" @tap.stop="openEditCustomTodoModal(todo)">编辑</text>
                <text class="todo-action-divider">|</text>
                <text class="todo-action-btn todo-action-btn--danger" @tap.stop="removeCustomTodo(todo)">删除</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 我的记录 内容 -->
    <view class="content-section" v-if="activeTab === 'diary'">
      <view v-if="!canUseTodoActions" class="week-overview-card week-overview-card--soft">
        <view class="week-overview-copy">
          <text class="week-overview-title">{{ recordLoginTitle }}</text>
          <text class="week-overview-desc">{{ recordLoginDesc }}</text>
        </view>
        <view
          class="week-overview-btn"
          @tap="goLoginForTimeline(recordLoginTitle)"
        >
          <text class="week-overview-btn-text">去登录</text>
        </view>
      </view>

      <view class="diary-empty" v-if="!currentDiary">
        <text class="empty-emoji">📝</text>
        <text class="empty-text">{{ diaryEmptyText }}</text>
        <button class="add-diary-btn" @tap="openDiaryModal">{{ canUseTodoActions ? recordActionText : '登录后记录' }}</button>
      </view>

      <view class="diary-card" v-else>
        <view class="diary-header">
          <text class="diary-date">{{ currentDiary.date }}</text>
          <view class="diary-header-actions">
            <text class="edit-btn" @tap="openDiaryModal">编辑</text>
            <text class="diary-header-divider">|</text>
            <text class="delete-btn" @tap="removeDiary">删除</text>
          </view>
        </view>
        <view class="diary-content" v-if="currentDiary.content">
          <text>{{ currentDiary.content }}</text>
        </view>
        <view class="diary-image-grid" v-if="currentDiaryImages.length">
          <image
            v-for="(url, index) in currentDiaryImages"
            :key="url"
            class="diary-image"
            :src="resolveDiaryImageSrc(url)"
            mode="aspectFill"
            @tap="previewDiaryImages(index, currentDiaryImages)"
          />
        </view>
      </view>
    </view>

    <!-- 浮动操作按钮 -->
    <view class="fab-button" v-if="activeTab === 'guide'" @tap="openDiaryModal">
      <text class="fab-icon">✏️</text>
    </view>

    <!-- 编辑记录弹窗 -->
    <view class="modal-mask" v-if="showDiaryModal" @tap="closeDiaryModal">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">记录 {{ currentWeekData.title }}</text>
          <text class="close-icon" @tap="closeDiaryModal">×</text>
        </view>
        <textarea 
          class="diary-textarea" 
          v-model="diaryInput" 
          :placeholder="diaryPlaceholder"
          :maxlength="500"
        />
        <view class="diary-photo-section">
          <view class="diary-photo-head">
            <text class="diary-photo-title">照片</text>
            <text class="diary-photo-count">{{ diaryImageUrls.length }}/{{ MAX_DIARY_IMAGES }}</text>
          </view>
          <view class="diary-photo-grid">
            <view
              v-for="(url, index) in diaryImageUrls"
              :key="url"
              class="diary-photo-thumb"
              @tap="previewDiaryImages(index, diaryImageUrls)"
            >
              <image class="diary-photo-image" :src="resolveDiaryImageSrc(url)" mode="aspectFill" />
              <view class="diary-photo-remove" @tap.stop="removeDiaryImage(index)">
                <text class="diary-photo-remove-text">×</text>
              </view>
            </view>
            <view
              v-if="diaryImageUrls.length < MAX_DIARY_IMAGES"
              class="diary-photo-add diary-photo-add-options"
              :class="{ 'diary-photo-add--loading': isUploadingDiaryImage }"
            >
              <template v-if="isUploadingDiaryImage">
                <text class="diary-photo-add-icon">...</text>
                <text class="diary-photo-add-text">上传中</text>
              </template>
              <template v-else>
                <view class="diary-photo-option" @tap.stop="chooseDiaryImages('camera')">
                  <text class="diary-photo-add-icon">+</text>
                  <text class="diary-photo-add-text">拍照</text>
                </view>
                <view class="diary-photo-option-divider"></view>
                <view class="diary-photo-option" @tap.stop="chooseDiaryImages('album')">
                  <text class="diary-photo-add-icon">□</text>
                  <text class="diary-photo-add-text">相册</text>
                </view>
              </template>
            </view>
          </view>
        </view>
        <button class="save-btn" @tap="saveDiary">保存记录</button>
      </view>
    </view>

    <!-- 添加待办弹窗 -->
    <view class="modal-mask" v-if="showCustomTodoModal" @tap="closeCustomTodoModal">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">{{ customTodoModalTitle }}</text>
          <text class="close-icon" @tap="closeCustomTodoModal">×</text>
        </view>
        <textarea
          class="diary-textarea"
          v-model="customTodoInput"
          :placeholder="customTodoPlaceholder"
          :maxlength="200"
        />
        <button class="save-btn" @tap="saveCustomTodo">{{ customTodoSubmitText }}</button>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import mockDataArray from './mockData.json'
import { useAppStore } from '@/stores/app'
import { calendarApi, type PregnancyTodoProgress, type PregnancyDiary, type PregnancyCustomTodo, type TimelineContext, type TimelineDefaultTodo } from '@/api/modules'
import { resolveUploadUrl } from '@/api/request'
import { calculatePregnancyWeekFromDueDate } from '@/utils'
import { buildAcquisitionPath, buildAcquisitionQuery, recordAcquisitionContext } from '@/utils/acquisition'
import { buildWeekPriorityPlan } from '@/utils/record-assist'

type TimelineStage = 'pregnancy' | 'postpartum'

interface TimelineListItem {
  storageWeek: number
  displayWeek: number
  timelineKey: string
  stage: TimelineStage
  circleLabel: string
  weekLabel: string
  title: string
  shortTitle: string
}

const PREGNANCY_WEEK_MAX = 40
const POSTPARTUM_WEEK_MAX = 156
const POSTPARTUM_STORAGE_WEEK_OFFSET = 40
const TIMELINE_KEY_PATTERN = /^(pregnancy|postpartum):w(\d{1,3})$/i

const appStore = useAppStore()
const MAX_DIARY_IMAGES = 3

const padWeek = (week: number) => String(week).padStart(2, '0')

const buildTimelineKey = (stage: TimelineStage, week: number) => `${stage}:w${padWeek(week)}`

const buildPregnancyTimelineItems = (): TimelineListItem[] => (
  Array.from({ length: PREGNANCY_WEEK_MAX }, (_, index) => {
    const week = index + 1
    return {
      storageWeek: week,
      displayWeek: week,
      timelineKey: buildTimelineKey('pregnancy', week),
      stage: 'pregnancy',
      circleLabel: String(week),
      weekLabel: '周',
      title: `孕第 ${week} 周`,
      shortTitle: `孕 ${week} 周`,
    }
  })
)

const buildPostpartumTimelineItems = (): TimelineListItem[] => (
  Array.from({ length: POSTPARTUM_WEEK_MAX }, (_, index) => {
    const week = index + 1
    return {
      storageWeek: POSTPARTUM_STORAGE_WEEK_OFFSET + week,
      displayWeek: week,
      timelineKey: buildTimelineKey('postpartum', week),
      stage: 'postpartum',
      circleLabel: String(week),
      weekLabel: week <= 52 ? '周龄' : '周',
      title: `出生后第 ${week} 周`,
      shortTitle: `第 ${week} 周`,
    }
  })
)

const pregnancyTimelineItems = buildPregnancyTimelineItems()
const postpartumTimelineItems = buildPostpartumTimelineItems()

const resolveInitialWeek = () => {
  const storedWeek = Number(uni.getStorageSync('userPregnancyWeek'))

  if (storedWeek >= 1 && storedWeek <= 40) return storedWeek

  if (appStore.user?.dueDate) {
    const weekFromDueDate = calculatePregnancyWeekFromDueDate(appStore.user.dueDate)
    if (weekFromDueDate && weekFromDueDate >= 1 && weekFromDueDate <= 40) {
      return weekFromDueDate
    }
  }

  return 1
}

const currentSelectedWeek = ref(resolveInitialWeek())
const timelineScrollTarget = ref(`week-${currentSelectedWeek.value}`)
const activeTab = ref('guide') // 'guide' | 'todo' | 'diary'
const initialSharedWeek = ref<number | null>(null)
const timelineContext = ref<TimelineContext | null>(null)
const timelineTodos = ref<TimelineDefaultTodo[]>([])
const timelineTodoLoading = ref(false)

// 模拟日记数据库
const userDiaries = ref<Record<number, PregnancyDiary>>({})
const customTodos = ref<Record<number, PregnancyCustomTodo[]>>({})
const loginUserId = ref('')
const todoState = ref<Record<string, boolean>>({})

// 日记弹窗状态
const showDiaryModal = ref(false)
const diaryInput = ref('')
const diaryImageUrls = ref<string[]>([])
const isUploadingDiaryImage = ref(false)
const showCustomTodoModal = ref(false)
const customTodoInput = ref('')
const editingCustomTodoId = ref('')
const todoPendingKey = ref('')

const fallbackData = {
  title: '数据未收录',
  summary: '当前周内容暂未完整收录，可先使用待办、日记和知识库继续记录本周重点。',
  babySizeEmoji: '✨',
  babySizeText: '不断成长中',
  babyWeight: '',
  content: { baby: '暂无数据', mom: '暂无数据', tips: [], todo: [] }
}

const formatPostpartumAge = (week: number) => {
  if (week <= 4) return `${week} 周龄`
  const months = Math.max(1, Math.round(week / 4.345))
  if (months < 12) return `${months} 月龄左右`
  const years = Math.floor(months / 12)
  const extraMonths = months % 12
  return extraMonths ? `${years} 岁 ${extraMonths} 个月左右` : `${years} 岁左右`
}

const buildPostpartumWeekData = (
  week: number,
  todos: TimelineDefaultTodo[],
  context: TimelineContext | null,
) => {
  const ageText = formatPostpartumAge(week)
  const checkupCount = todos.filter(item => item.type === 'checkup' || item.type === 'vaccine').length
  const hasBirthday = Boolean(context?.babyBirthday)

  return {
    title: `出生后第 ${week} 周`,
    summary: todos.length
      ? `本周进入${ageText}，重点是${todos.slice(0, 2).map(item => item.title).join('、')}。`
      : `本周进入${ageText}，可以继续记录喂养、睡眠、发育和家庭照护变化。`,
    babySizeEmoji: week <= 4 ? '👶' : week < 52 ? '🧸' : '🌟',
    babySizeText: ageText,
    babyWeight: hasBirthday ? `出生日期 ${context?.babyBirthday}` : '补充宝宝出生日期后自动定位',
    content: {
      baby: week <= 4
        ? '重点观察吃奶、大小便、黄疸、体温、脐带和精神状态，异常情况优先线下咨询。'
        : week < 52
          ? '重点记录身高体重、喂养、睡眠、运动发育、互动反应和疫苗/儿保节点。'
          : '重点记录语言、运动、社交、睡眠、饮食、如厕训练和年度体检节点。',
      mom: week <= 6
        ? '继续记录恶露、伤口、乳房胀痛、睡眠和情绪变化，产后复查前集中回看。'
        : '可以把妈妈恢复、照护压力、睡眠和家庭分工一起记录，方便后续复盘。',
      tips: [
        hasBirthday ? `当前按宝宝出生日期定位到${ageText}` : '先在个人资料补充宝宝出生日期，系统会自动定位产后周数。',
        checkupCount ? `本周有 ${checkupCount} 个检查或疫苗相关提醒，建议提前确认线下安排。` : '没有固定检查节点时，也建议保留每周观察记录。',
        '如出现发热、精神反应差、喂养明显减少、呼吸异常等情况，优先线下就医或咨询专业人员。',
      ],
      todo: todos.map(item => ({
        type: item.type,
        title: item.title,
        desc: item.desc,
      })),
    },
  }
}

const parseTimelineKeyToStorageWeek = (value: unknown): number | null => {
  if (typeof value !== 'string') return null
  const match = TIMELINE_KEY_PATTERN.exec(value.trim())
  if (!match) return null

  const stage = match[1].toLowerCase() as TimelineStage
  const week = Number(match[2])
  if (!Number.isInteger(week)) return null

  if (stage === 'pregnancy' && week >= 1 && week <= PREGNANCY_WEEK_MAX) return week
  if (stage === 'postpartum' && week >= 1 && week <= POSTPARTUM_WEEK_MAX) {
    return POSTPARTUM_STORAGE_WEEK_OFFSET + week
  }

  return null
}

const getTimelineItemFromStorageWeek = (storageWeek: number): TimelineListItem => {
  const found = [...pregnancyTimelineItems, ...postpartumTimelineItems]
    .find(item => item.storageWeek === storageWeek)
  if (found) return found

  return pregnancyTimelineItems[Math.min(Math.max(storageWeek, 1), PREGNANCY_WEEK_MAX) - 1]
}

const selectedTimelineItem = computed(() => getTimelineItemFromStorageWeek(currentSelectedWeek.value))
const isPostpartumTimeline = computed(() => (
  timelineContext.value?.lifecycleStage === 'postpartum' || selectedTimelineItem.value.stage === 'postpartum'
))
const weeksList = computed(() => (isPostpartumTimeline.value ? postpartumTimelineItems : pregnancyTimelineItems))
const selectedPeriodTitle = computed(() => `${selectedTimelineItem.value.title}`)
const selectedTimelineParams = computed(() => ({
  week: selectedTimelineItem.value.storageWeek,
  timelineKey: selectedTimelineItem.value.timelineKey,
}))
const heroMetricLabel = computed(() => selectedTimelineItem.value.stage === 'postpartum' ? '宝宝阶段' : '相当于')
const heroMetricDescLabel = computed(() => selectedTimelineItem.value.stage === 'postpartum' ? '定位依据' : '体重约')
const guideTabLabel = computed(() => selectedTimelineItem.value.stage === 'postpartum' ? '成长时间线' : '孕周日历')
const timelineKicker = computed(() => selectedTimelineItem.value.stage === 'postpartum' ? '成长周总览' : '当前周总览')
const babySectionTitle = computed(() => selectedTimelineItem.value.stage === 'postpartum' ? '宝宝成长' : '宝宝发育')
const momSectionTitle = computed(() => selectedTimelineItem.value.stage === 'postpartum' ? '妈妈恢复' : '妈妈变化')
const tipsSectionTitle = computed(() => selectedTimelineItem.value.stage === 'postpartum' ? '本周照护建议' : '本周建议')
const priorityKicker = computed(() => selectedTimelineItem.value.stage === 'postpartum' ? '本周照护重点' : '本周重点待办')
const recordLoginTitle = computed(() => selectedTimelineItem.value.stage === 'postpartum' ? '登录后可保存成长记录' : '登录后可保存本周记录')
const recordActionText = computed(() => selectedTimelineItem.value.stage === 'postpartum' ? '添加成长记录' : '添加本周记录')
const recordLoginDesc = computed(() => (
  selectedTimelineItem.value.stage === 'postpartum'
    ? '未登录时可以先浏览成长时间线，登录后保存宝宝和妈妈这周的变化。'
    : '未登录时可以先浏览孕周日历，确认有需要再保存你这周的感受和重点事项。'
))
const diaryPlaceholder = computed(() => (
  selectedTimelineItem.value.stage === 'postpartum'
    ? '记录宝宝喂养、睡眠、发育、疫苗或妈妈恢复情况...'
    : '记录本周感受、线下提醒或下一步待办...'
))
const customTodoPlaceholder = computed(() => (
  selectedTimelineItem.value.stage === 'postpartum'
    ? '请输入本周待办，例如：预约儿保、记录疫苗、整理喂养问题...'
    : '请输入本周待办，例如：预约产检、准备营养品...'
))
const diaryEmptyText = computed(() => (
  canUseTodoActions.value
    ? (selectedTimelineItem.value.stage === 'postpartum' ? '这周还没有记录，可以留下宝宝和妈妈的变化。' : '这周还没有记录哦，写下你的孕期感受吧！')
    : '当前还没有保存记录，登录后可以把本周感受与线下提醒留下来。'
))

const currentWeekData = computed(() => {
  if (selectedTimelineItem.value.stage === 'postpartum') {
    return buildPostpartumWeekData(selectedTimelineItem.value.displayWeek, timelineTodos.value, timelineContext.value)
  }

  const found = mockDataArray.find((item: any) => item.week === selectedTimelineItem.value.displayWeek)
  return found || fallbackData
})

const buildTodoKey = (index: number) => `todo-${index}`
const buildTodoStateKey = (week: number, todoKey: string) => `${week}:${todoKey}`

const resolveLoginUserId = () => {
  const token = uni.getStorageSync('token')
  if (!token) return ''

  if (appStore.user?.id) {
    return String(appStore.user.id)
  }

  const storedUser = uni.getStorageSync('user')
  if (storedUser && typeof storedUser === 'object' && 'id' in storedUser && storedUser.id) {
    return String(storedUser.id)
  }

  return ''
}

const mapTodoProgressToState = (progressList: PregnancyTodoProgress[]) => {
  const nextState: Record<string, boolean> = {}
  progressList.forEach((item) => {
    if (item.completed) {
      nextState[buildTodoStateKey(item.week, item.todoKey)] = true
    }
  })
  return nextState
}

const mapDiariesToState = (diaries: PregnancyDiary[]) => {
  const nextState: Record<number, PregnancyDiary> = {}
  diaries.forEach((item) => {
    nextState[item.week] = item
  })
  return nextState
}

const mapCustomTodosToState = (todoList: PregnancyCustomTodo[]) => {
  const nextState: Record<number, PregnancyCustomTodo[]> = {}
  todoList.forEach((item) => {
    if (!nextState[item.week]) {
      nextState[item.week] = []
    }
    nextState[item.week].push(item)
  })
  return nextState
}

const syncTimelineTodos = async () => {
  if (selectedTimelineItem.value.stage !== 'postpartum' || !loginUserId.value) {
    timelineTodos.value = []
    return
  }

  timelineTodoLoading.value = true
  try {
    timelineTodos.value = await calendarApi.getTimelineTodos(selectedTimelineParams.value)
  } catch (err) {
    console.error('[Calendar] 获取产后时间线待办失败:', err)
    timelineTodos.value = []
  } finally {
    timelineTodoLoading.value = false
  }
}

const syncTimelineContext = async (options: { preserveSelected?: boolean } = {}) => {
  if (!loginUserId.value) {
    timelineContext.value = null
    timelineTodos.value = []
    return
  }

  try {
    const context = await calendarApi.getTimelineContext()
    timelineContext.value = context

    if (!options.preserveSelected) {
      if (context.currentPeriod?.week) {
        await selectStorageWeek(context.currentPeriod.week)
      } else if (context.lifecycleStage === 'postpartum') {
        await selectStorageWeek(POSTPARTUM_STORAGE_WEEK_OFFSET + 1)
      } else if (selectedTimelineItem.value.stage !== 'pregnancy') {
        await syncSelectedWeekFromSession()
      }
    }
  } catch (err) {
    console.error('[Calendar] 获取孕育时间线状态失败:', err)
    timelineContext.value = null
  }
}

const syncTodoContext = async () => {
  loginUserId.value = resolveLoginUserId()
  if (!loginUserId.value) {
    todoState.value = {}
    return
  }

  try {
    const progressList = await calendarApi.getTodoProgress()
    todoState.value = mapTodoProgressToState(progressList)
  } catch (err) {
    console.error('[Calendar] 获取待办进度失败:', err)
    todoState.value = {}
  }
}

const syncDiaryContext = async () => {
  if (!loginUserId.value) {
    userDiaries.value = {}
    return
  }

  try {
    const diaries = await calendarApi.getDiaries()
    userDiaries.value = mapDiariesToState(diaries)
  } catch (err) {
    console.error('[Calendar] 获取时间线记录失败:', err)
    userDiaries.value = {}
  }
}

const syncCustomTodoContext = async () => {
  if (!loginUserId.value) {
    customTodos.value = {}
    return
  }

  try {
    const todoList = await calendarApi.getCustomTodos()
    customTodos.value = mapCustomTodosToState(todoList)
  } catch (err) {
    console.error('[Calendar] 获取自定义待办失败:', err)
    customTodos.value = {}
  }
}

const parsedContent = computed(() => currentWeekData.value.content)
const currentDiary = computed(() => userDiaries.value[currentSelectedWeek.value])
const currentDiaryImages = computed(() => currentDiary.value?.imageUrls || [])
const canUseTodoActions = computed(() => !!loginUserId.value)
const customTodoModalTitle = computed(() => editingCustomTodoId.value ? '编辑待办' : '添加待办')
const customTodoSubmitText = computed(() => editingCustomTodoId.value ? '保存修改' : '添加待办')
const customTodoList = computed(() =>
  (customTodos.value[currentSelectedWeek.value] || []).map((todo) => {
    const todoKey = `custom-${todo.id}`
    const stateKey = buildTodoStateKey(currentSelectedWeek.value, todoKey)
    return {
      id: todo.id,
      type: 'custom',
      title: '我的待办',
      desc: todo.content,
      todoKey,
      stateKey,
      completed: !!todoState.value[stateKey],
    }
  }),
)
const defaultTodoList = computed(() =>
  (parsedContent.value.todo || []).map((todo: any, index: number) => {
    const todoKey = selectedTimelineItem.value.stage === 'postpartum'
      ? (timelineTodos.value[index]?.todoKey || `${selectedTimelineItem.value.timelineKey}:todo-${index}`)
      : buildTodoKey(index)
    const stateKey = buildTodoStateKey(currentSelectedWeek.value, todoKey)
    return {
      ...todo,
      todoKey,
      stateKey,
      completed: !!todoState.value[stateKey],
    }
  }),
)
const todoList = computed(() => [...customTodoList.value, ...defaultTodoList.value])
const getTodoTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    checkup: '检查',
    vaccine: '疫苗',
    feeding: '喂养',
    development: '发育',
    safety: '安全',
    care: '照护',
    custom: '自定义',
    action: '事项',
  }

  return labels[type] || '事项'
}
const completedTodoCount = computed(() => todoList.value.filter(todo => todo.completed).length)
const weekPriority = computed(() => buildWeekPriorityPlan({
  week: selectedTimelineItem.value.displayWeek,
  summary: currentWeekData.value.summary,
  tips: parsedContent.value.tips || [],
  todos: todoList.value,
  completedCount: completedTodoCount.value,
  hasDiary: Boolean(currentDiary.value),
}))
const weekCommandDescription = computed(() => (
  activeTab.value === 'guide'
    ? (selectedTimelineItem.value.stage === 'postpartum' ? '先扫一眼本周成长与照护重点，再决定要不要补待办或记录。' : '先扫一眼本周发育与注意事项，再决定要不要补待办或记录。')
    : activeTab.value === 'todo'
      ? (canUseTodoActions.value ? '把这一周要做的事集中处理，完成进度会实时保存。' : '先看本周待办结构，登录后再保存完成状态。')
      : (canUseTodoActions.value ? '把这一周的变化和提醒记下来，后面回看更省力。' : '登录后可以把这周感受、线下提醒和待办留下来。')
))
const weekCommandBadge = computed(() => (
  activeTab.value === 'guide'
    ? '指南'
    : activeTab.value === 'todo'
      ? `${completedTodoCount.value}/${todoList.value.length || 0}`
      : (currentDiary.value ? '已记录' : '未记录')
))
const tabQuickActions = computed(() => [
  {
    key: 'guide',
    label: guideTabLabel.value,
    value: currentWeekData.value.babySizeText || '查看重点',
    meta: parsedContent.value.tips?.length
      ? `${parsedContent.value.tips.length} 条${tipsSectionTitle.value}`
      : (selectedTimelineItem.value.stage === 'postpartum' ? '先看宝宝成长和照护重点' : '先看宝宝发育和妈妈变化'),
  },
  {
    key: 'todo',
    label: '待办事项',
    value: todoList.value.length ? `${completedTodoCount.value}/${todoList.value.length} 已完成` : '本周待办待整理',
    meta: canUseTodoActions.value
      ? (selectedTimelineItem.value.stage === 'postpartum' ? '儿保、疫苗和自定义事项都在这里' : '产检、营养和自定义事项都在这里')
      : '登录后可勾选并保存待办进度',
  },
  {
    key: 'diary',
    label: '我的记录',
    value: currentDiary.value ? '本周已写记录' : '还没写记录',
    meta: currentDiary.value ? '可继续补充这周变化和提醒' : '适合记下感受、线下提醒和异常变化',
  },
])

const scrollToWeek = async (week: number) => {
  timelineScrollTarget.value = ''
  await nextTick()
  timelineScrollTarget.value = `week-${week}`
}

const selectStorageWeek = async (week: number) => {
  currentSelectedWeek.value = week
  await scrollToWeek(week)
}

const syncSelectedWeekFromSession = async () => {
  const resolvedWeek = resolveInitialWeek()
  await selectStorageWeek(resolvedWeek)
}

function readWeekFromQuery(options?: Record<string, unknown> | null): number | null {
  const timelineKeyWeek = parseTimelineKeyToStorageWeek(options?.timelineKey)
  if (timelineKeyWeek) return timelineKeyWeek

  const value = options?.week
  const week = Number.parseInt(String(value || ''), 10)
  return week >= 1 && week <= POSTPARTUM_STORAGE_WEEK_OFFSET + POSTPARTUM_WEEK_MAX ? week : null
}

const handleSelectWeek = (e: any) => {
  const weekNum = e.currentTarget.dataset.week
  if (weekNum) {
    const selectedWeek = Number(weekNum)
    void (async () => {
      await selectStorageWeek(selectedWeek)
      await syncTimelineTodos()
    })()
  }
}

const goLoginForTimeline = (toastTitle = '请先登录后保存') => {
  uni.showToast({ title: toastTitle, icon: 'none' })
  setTimeout(() => {
    uni.navigateTo({ url: '/pages/login/index' })
  }, 900)
}

// 登录检查（编辑功能需要登录）
const checkLogin = (
  toastTitle = '请先登录后再记录',
  shouldRedirect = true,
): boolean => {
  const token = uni.getStorageSync('token')
  if (!token) {
    if (shouldRedirect) {
      goLoginForTimeline(toastTitle)
    } else {
      uni.showToast({ title: toastTitle, icon: 'none' })
    }
    return false
  }
  return true
}

// 弹窗与记录逻辑
const openDiaryModal = () => {
  if (!checkLogin()) return
  const existing = userDiaries.value[currentSelectedWeek.value]
  diaryInput.value = existing ? existing.content : ''
  diaryImageUrls.value = existing?.imageUrls ? [...existing.imageUrls] : []
  showDiaryModal.value = true
}

const closeDiaryModal = () => {
  showDiaryModal.value = false
  isUploadingDiaryImage.value = false
}

const resolveDiaryImageSrc = (url: string) => resolveUploadUrl(url)

const previewDiaryImages = (index: number, urls: string[]) => {
  const images = urls.map(resolveDiaryImageSrc).filter(Boolean)
  if (!images.length) return
  uni.previewImage({
    urls: images,
    current: images[index] || images[0],
  })
}

const uploadDiaryImages = async (filePaths: string[]) => {
  if (!filePaths.length) return
  isUploadingDiaryImage.value = true

  try {
    const nextUrls = [...diaryImageUrls.value]
    for (const filePath of filePaths) {
      if (nextUrls.length >= MAX_DIARY_IMAGES) break
      const result = await calendarApi.uploadDiaryImage(filePath, {
        ...selectedTimelineParams.value,
        imageUrls: nextUrls,
      })
      nextUrls.push(result.url)
      diaryImageUrls.value = [...nextUrls]
    }
  } catch (err: any) {
    console.error('[Calendar] 上传记录照片失败:', err)
    uni.showToast({ title: err?.message || '照片上传失败', icon: 'none' })
  } finally {
    isUploadingDiaryImage.value = false
  }
}

type ChooseMediaSource = 'camera' | 'album'

const chooseImageFallback = (source: ChooseMediaSource, count: number) => {
  uni.chooseImage({
    count,
    sizeType: ['compressed'],
    sourceType: [source],
    success: (res) => {
      const rawFilePaths = Array.isArray(res.tempFilePaths)
        ? res.tempFilePaths
        : [res.tempFilePaths].filter(Boolean)
      const filePaths = rawFilePaths.map((item: string) => String(item)).filter(Boolean)
      void uploadDiaryImages(filePaths)
    },
  })
}

const chooseDiaryImages = (source: 'camera' | 'album') => {
  if (!checkLogin('请先登录后上传照片', false)) return
  if (isUploadingDiaryImage.value) return

  const remaining = MAX_DIARY_IMAGES - diaryImageUrls.value.length
  if (remaining <= 0) {
    uni.showToast({ title: `最多添加${MAX_DIARY_IMAGES}张照片`, icon: 'none' })
    return
  }

  if (source === 'camera') {
    chooseImageFallback('camera', 1)
    return
  }

  chooseImageFallback('album', remaining)
}

const removeDiaryImage = (index: number) => {
  diaryImageUrls.value = diaryImageUrls.value.filter((_, currentIndex) => currentIndex !== index)
}

const openCustomTodoModal = () => {
  if (!checkLogin('请先登录后添加待办', false)) return
  editingCustomTodoId.value = ''
  customTodoInput.value = ''
  showCustomTodoModal.value = true
}

const closeCustomTodoModal = () => {
  editingCustomTodoId.value = ''
  customTodoInput.value = ''
  showCustomTodoModal.value = false
}

const openEditCustomTodoModal = (todo: { id: string; desc: string }) => {
  if (!checkLogin('请先登录后编辑待办', false)) return
  editingCustomTodoId.value = todo.id
  customTodoInput.value = todo.desc
  showCustomTodoModal.value = true
}

const saveDiary = () => {
  if (!checkLogin()) return

  const trimmedContent = diaryInput.value.trim()
  if (!trimmedContent && diaryImageUrls.value.length === 0) {
    uni.showToast({ title: '内容或照片不能为空', icon: 'none' })
    return
  }

  if (trimmedContent.length > 500) {
    uni.showToast({ title: '内容不能超过500字', icon: 'none' })
    return
  }

  void (async () => {
    try {
      const savedDiary = await calendarApi.saveDiary({
        ...selectedTimelineParams.value,
        content: trimmedContent,
        imageUrls: diaryImageUrls.value,
      })

      userDiaries.value = {
        ...userDiaries.value,
        [currentSelectedWeek.value]: savedDiary,
      }
      closeDiaryModal()
      activeTab.value = 'diary'
      uni.showToast({ title: '记录已保存', icon: 'success' })
    } catch (err: any) {
      console.error('[Calendar] 保存时间线记录失败:', err)
      uni.showToast({ title: err?.message || '保存失败，请稍后重试', icon: 'none' })
    }
  })()
}

const removeDiary = () => {
  if (!checkLogin('请先登录后删除记录', false)) return

  const week = currentSelectedWeek.value
  if (!userDiaries.value[week]) {
    uni.showToast({ title: '当前没有可删除的记录', icon: 'none' })
    return
  }

  uni.showModal({
    title: '删除记录',
    content: `确认删除${selectedPeriodTitle.value}的记录吗？`,
    success: (res) => {
      if (!res.confirm) return

      void (async () => {
        try {
          await calendarApi.deleteDiary(selectedTimelineParams.value)

          const nextDiaries = { ...userDiaries.value }
          delete nextDiaries[week]
          userDiaries.value = nextDiaries

          diaryInput.value = ''
          diaryImageUrls.value = []
          uni.showToast({ title: '记录已删除', icon: 'success' })
        } catch (err: any) {
          console.error('[Calendar] 删除时间线记录失败:', err)
          uni.showToast({ title: err?.message || '删除失败，请稍后重试', icon: 'none' })
        }
      })()
    },
  })
}

const saveCustomTodo = () => {
  if (!checkLogin('请先登录后添加待办', false)) return

  const trimmedContent = customTodoInput.value.trim()
  if (!trimmedContent) {
    uni.showToast({ title: '待办内容不能为空', icon: 'none' })
    return
  }

  if (trimmedContent.length > 200) {
    uni.showToast({ title: '待办内容不能超过200字', icon: 'none' })
    return
  }

  void (async () => {
    try {
      const currentWeekTodos = customTodos.value[currentSelectedWeek.value] || []
      const isEditing = !!editingCustomTodoId.value
      if (isEditing) {
        const updatedTodo = await calendarApi.updateCustomTodo(editingCustomTodoId.value, {
          content: trimmedContent,
        })

        customTodos.value = {
          ...customTodos.value,
          [currentSelectedWeek.value]: currentWeekTodos.map(item => (
            item.id === updatedTodo.id ? updatedTodo : item
          )),
        }
      } else {
        const savedTodo = await calendarApi.createCustomTodo({
          ...selectedTimelineParams.value,
          content: trimmedContent,
        })

        customTodos.value = {
          ...customTodos.value,
          [currentSelectedWeek.value]: [...currentWeekTodos, savedTodo],
        }
      }
      closeCustomTodoModal()
      uni.showToast({ title: isEditing ? '待办已更新' : '待办已添加', icon: 'success' })
    } catch (err: any) {
      console.error('[Calendar] 保存自定义待办失败:', err)
      uni.showToast({ title: err?.message || '保存失败，请稍后重试', icon: 'none' })
    }
  })()
}

const removeCustomTodo = (todo: { id: string; stateKey: string }) => {
  if (!checkLogin('请先登录后删除待办', false)) return

  uni.showModal({
    title: '删除待办',
    content: '确认删除这条自定义待办吗？',
    success: (res) => {
      if (!res.confirm) return

      void (async () => {
        try {
          await calendarApi.deleteCustomTodo(todo.id)

          customTodos.value = {
            ...customTodos.value,
            [currentSelectedWeek.value]: (customTodos.value[currentSelectedWeek.value] || [])
              .filter(item => item.id !== todo.id),
          }

          const nextState = { ...todoState.value }
          delete nextState[todo.stateKey]
          todoState.value = nextState

          uni.showToast({ title: '待办已删除', icon: 'success' })
        } catch (err: any) {
          console.error('[Calendar] 删除自定义待办失败:', err)
          uni.showToast({ title: err?.message || '删除失败，请稍后重试', icon: 'none' })
        }
      })()
    },
  })
}

const toggleTodo = async (todo: { todoKey: string; stateKey: string; completed: boolean }) => {
  if (!checkLogin('请先登录后使用待办', false) || !canUseTodoActions.value) return

  const nextCompleted = !todo.completed
  const previousState = { ...todoState.value }
  const nextState = { ...todoState.value }
  if (nextCompleted) {
    nextState[todo.stateKey] = true
  } else {
    delete nextState[todo.stateKey]
  }
  todoState.value = nextState
  todoPendingKey.value = todo.stateKey

  try {
    await calendarApi.updateTodoProgress({
      ...selectedTimelineParams.value,
      todoKey: todo.todoKey,
      completed: nextCompleted,
    })
    uni.showToast({ title: nextCompleted ? '已标记完成' : '已恢复待办', icon: 'none' })
  } catch (err: any) {
    todoState.value = previousState
    console.error('[Calendar] 保存待办进度失败:', err)
    uni.showToast({ title: err?.message || '保存失败，请稍后重试', icon: 'none' })
  } finally {
    if (todoPendingKey.value === todo.stateKey) {
      todoPendingKey.value = ''
    }
  }
}

onLoad((options) => {
  recordAcquisitionContext(options)

  const sharedWeek = readWeekFromQuery(options)
  if (sharedWeek) {
    initialSharedWeek.value = sharedWeek
    void selectStorageWeek(sharedWeek)
  }
})

onShow(() => {
  void (async () => {
    const sharedWeek = initialSharedWeek.value
    const hasSharedWeek = sharedWeek !== null

    loginUserId.value = resolveLoginUserId()

    if (hasSharedWeek && sharedWeek) {
      await selectStorageWeek(sharedWeek)
      initialSharedWeek.value = null
    } else if (!loginUserId.value) {
      await syncSelectedWeekFromSession()
    }

    await syncTimelineContext({ preserveSelected: hasSharedWeek })
    await Promise.all([
      syncTodoContext(),
      syncDiaryContext(),
      syncCustomTodoContext(),
      syncTimelineTodos(),
    ])
  })()
})

function buildSharePayload() {
  const period = selectedTimelineItem.value
  const params = {
    week: period.storageWeek,
    timelineKey: period.timelineKey,
  }
  const query = buildAcquisitionQuery(params)
  const titlePrefix = period.stage === 'postpartum' ? '贝护妈妈成长时间线' : '贝护妈妈孕周日历'

  return {
    title: `${titlePrefix}：${period.title}重点与记录`,
    path: buildAcquisitionPath('/pages/calendar/index', params),
    query,
  }
}

onShareAppMessage(() => buildSharePayload())

onShareTimeline(() => {
  const payload = buildSharePayload()
  return {
    title: payload.title,
    query: payload.query,
  }
})
</script>

<style scoped>
.calendar-timeline-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f9f0f5 0%, #fff7f2 100%);
  padding-bottom: 120rpx;
}

/* 顶部 Hero Section */
.hero-section {
  background: linear-gradient(180deg, #ffffff 0%, #fdf5f0 72%, #fff7f2 100%);
  padding-top: 100rpx;
  position: relative;
  overflow: hidden;
  border-bottom: 1rpx solid rgba(31, 42, 55, 0.06);
}

.header-nav {
  text-align: center;
  margin-bottom: 40rpx;
}

.hero-title {
  font-size: 46rpx;
  font-weight: 900;
  color: #444;
  letter-spacing: 1rpx;
}

/* 宝宝动态展示区 */
.baby-animation-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 248rpx;
  position: relative;
  margin-bottom: 40rpx;
}

.breathing-glow {
  display: none;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.5); opacity: 0.3; }
  100% { transform: scale(1); opacity: 0.8; }
}

.baby-visual {
  z-index: 2;
  font-size: 82rpx;
  background: #fffcf8;
  width: 140rpx;
  height: 140rpx;
  border-radius: 42rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10rpx 28rpx rgba(31, 42, 55, 0.03);
}

@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}

.baby-size-info {
  z-index: 2;
  margin-top: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  padding: 10rpx 30rpx;
  border-radius: 40rpx;
  border: 1rpx solid rgba(31, 42, 55, 0.06);
}

.size-text { font-size: 28rpx; color: #16806a; font-weight: bold; }
.size-desc { font-size: 22rpx; color: #888; margin-top: 4rpx; }

/* 时间轴 */
.week-timeline-scroll {
  width: 100%;
  white-space: nowrap;
  padding-bottom: 20rpx;
  -webkit-overflow-scrolling: touch;
}

.timeline-container { display: inline-flex; padding: 0 30rpx; }
.timeline-item {
  display: flex; flex-direction: column; align-items: center;
  margin-right: 36rpx; opacity: 0.6; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.timeline-item.active { opacity: 1; transform: scale(1.15) translateY(-5rpx); }

.week-circle {
  width: 70rpx; height: 70rpx; border-radius: 35rpx;
  background-color: #fffcf8; color: #666; display: flex;
  justify-content: center; align-items: center; font-size: 28rpx;
  font-weight: bold; margin-bottom: 8rpx; box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.05);
}
.timeline-item.active .week-circle {
  background: linear-gradient(135deg, #16806a 0%, #2f7cf6 100%);
  color: #fff; box-shadow: 0 8rpx 20rpx rgba(22, 128, 106, 0.24);
}

.week-label { font-size: 22rpx; color: #999; }
.timeline-item.active .week-label { color: #16806a; font-weight: bold; }

.week-command-card {
  position: relative;
  z-index: 12;
  margin: -4rpx 28rpx 20rpx;
  padding: 32rpx;
  border-radius: 30rpx;
  background: #fffcf8;
  border: 1rpx solid rgba(31, 42, 55, 0.06);
  box-shadow: 0 12rpx 30rpx rgba(31, 42, 55, 0.02);
}

.week-command-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22rpx;
}

.week-command-copy {
  flex: 1;
}

.week-command-kicker {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: #16806a;
}

.week-command-title {
  display: block;
  margin-top: 10rpx;
  font-size: 36rpx;
  line-height: 1.3;
  font-weight: 800;
  color: #27313d;
}

.week-command-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.65;
  color: #657284;
}

.week-command-badge {
  flex-shrink: 0;
  min-width: 112rpx;
  padding: 18rpx 16rpx;
  border-radius: 24rpx;
  text-align: center;
  background: linear-gradient(135deg, #16806a 0%, #2f7cf6 100%);
}

.week-command-badge-text {
  font-size: 28rpx;
  font-weight: 800;
  color: #ffffff;
}

.week-command-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 24rpx;
}

.week-command-item {
  min-height: 150rpx;
  padding: 20rpx 18rpx;
  border-radius: 24rpx;
  background: #f4f7fb;
  border: 2rpx solid transparent;
  box-sizing: border-box;
}

.week-command-item--active {
  background: #edf8f4;
  border-color: rgba(22, 128, 106, 0.18);
}

.week-command-item-label {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: #8a96a3;
}

.week-command-item-value {
  display: block;
  margin-top: 10rpx;
  font-size: 25rpx;
  line-height: 1.35;
  font-weight: 800;
  color: #293542;
}

.week-command-item-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1.45;
  color: #788595;
}

/* Tabs */
.tabs-container {
  display: flex; justify-content: space-around; background-color: #fffcf8;
  border-radius: 28rpx 28rpx 0 0; padding: 28rpx 32rpx 0; margin-top: -10rpx;
  position: relative; z-index: 10; border-top: 1rpx solid rgba(31, 42, 55, 0.06);
}
.tab-item { position: relative; padding-bottom: 20rpx; }
.tab-text { font-size: 32rpx; color: #888; font-weight: 500; transition: color 0.3s; }
.tab-item.active .tab-text { color: #444; font-weight: bold; }
.tab-line {
  position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 40rpx; height: 8rpx; border-radius: 4rpx; background: #16806a;
}

/* 内容区 */
.content-section { padding: 28rpx; background-color: transparent; }
.week-overview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
  padding: 28rpx 30rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #fff2ed 0%, #fffcf8 100%);
  box-shadow: 0 8rpx 24rpx rgba(180, 112, 72, 0.04);
}
.week-overview-card--soft {
  background: linear-gradient(135deg, #f9ebf1 0%, #ffffff 100%);
}
.week-overview-copy { flex: 1; }
.week-overview-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #313b47;
}
.week-overview-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #727f8d;
}
.week-overview-btn {
  flex-shrink: 0;
  padding: 16rpx 22rpx;
  border-radius: 999rpx;
  background: #fffcf8;
  border: 2rpx solid #ffd9bf;
}
.week-overview-btn-text {
  font-size: 24rpx;
  font-weight: 700;
  color: #b4633d;
}
.week-priority-card {
  margin-bottom: 24rpx;
  padding: 28rpx 30rpx;
  border-radius: 26rpx;
  background: #fffcf8;
  border: 1rpx solid rgba(31, 42, 55, 0.06);
  box-shadow: 0 10rpx 26rpx rgba(31, 42, 55, 0.04);
}
.week-priority-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22rpx;
}
.week-priority-copy { flex: 1; }
.week-priority-kicker {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: #16806a;
}
.week-priority-title {
  display: block;
  margin-top: 10rpx;
  font-size: 32rpx;
  line-height: 1.3;
  font-weight: 800;
  color: #27313d;
}
.week-priority-subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.65;
  color: #6f7f93;
}
.week-priority-badge {
  flex-shrink: 0;
  min-width: 92rpx;
  padding: 16rpx 14rpx;
  border-radius: 22rpx;
  text-align: center;
  background: #16806a;
}
.week-priority-badge-text {
  font-size: 28rpx;
  font-weight: 800;
  color: #fff;
}
.week-priority-item {
  margin-top: 20rpx;
  padding: 22rpx 24rpx;
  border-radius: 22rpx;
  background: #f8fbff;
}
.week-priority-item--done {
  background: #f1f7f3;
}
.week-priority-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.week-priority-item-title {
  flex: 1;
  font-size: 27rpx;
  line-height: 1.45;
  font-weight: 700;
  color: #2b3542;
}
.week-priority-item-label {
  flex-shrink: 0;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(22, 128, 106, 0.1);
  font-size: 21rpx;
  font-weight: 700;
  color: #16806a;
}
.week-priority-item-desc,
.week-priority-item-reason,
.week-priority-reminder {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.7;
}
.week-priority-item-desc { color: #59697c; }
.week-priority-item-reason { color: #7d8c9b; }
.week-priority-reminder {
  margin-top: 18rpx;
  color: #5a6d83;
}
.summary-card {
  background: #fffcf8;
  padding: 40rpx 30rpx; border-radius: 24rpx; margin-bottom: 30rpx;
  position: relative; border: 1rpx solid rgba(31, 42, 55, 0.06);
}
.quote-mark {
  font-size: 80rpx; color: rgba(22, 128, 106, 0.14); position: absolute;
  font-family: Georgia, serif; line-height: 1;
}
.quote-mark { left: 20rpx; top: 10rpx; }
.quote-mark.right { right: 20rpx; bottom: -20rpx; transform: rotate(180deg); }
.summary-text { font-size: 30rpx; color: #444; line-height: 1.6; text-indent: 2em; position: relative; z-index: 2; }

.info-card { background-color: #fffcf8; border-radius: 30rpx; padding: 30rpx; margin-bottom: 30rpx; border: 1rpx solid rgba(31, 42, 55, 0.04); box-shadow: 0 8rpx 24rpx rgba(31, 42, 55, 0.03); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.header-left { display: flex; align-items: center; }
.card-icon { font-size: 36rpx; margin-right: 12rpx; }
.card-title { font-size: 32rpx; font-weight: bold; color: #444; }
.card-body { font-size: 28rpx; color: #555; line-height: 1.7; }
.card-text { white-space: pre-wrap; display: block; margin-bottom: 12rpx; }
.todo-header-actions { display: flex; align-items: center; gap: 16rpx; }
.todo-progress { font-size: 22rpx; color: #999; }
.todo-add-chip {
  display: inline-flex; align-items: center; gap: 8rpx; padding: 10rpx 18rpx;
  border-radius: 999rpx; background: #eef1ff; border: 2rpx solid #d9e0ff;
}
.todo-add-chip--disabled { opacity: 0.72; }
.todo-add-chip-icon { color: #6274ff; font-size: 24rpx; font-weight: bold; line-height: 1; }
.todo-add-chip-text { color: #6274ff; font-size: 22rpx; font-weight: 600; }
.todo-login-hint { display: block; margin-bottom: 16rpx; font-size: 24rpx; color: #8c8c8c; }

.tip-item { display: flex; margin-bottom: 12rpx; align-items: flex-start; }
.tip-dot { width: 10rpx; height: 10rpx; background-color: #16806a; border-radius: 50%; margin-top: 16rpx; margin-right: 16rpx; flex-shrink: 0; }
.tip-text { flex: 1; }

.todo-item {
  display: flex; align-items: flex-start; background-color: #f8f9fa; border-radius: 16rpx; padding: 24rpx;
  margin-bottom: 16rpx; border-left: 8rpx solid transparent; transition: all 0.2s ease;
}
.todo-item:nth-child(odd) { border-left-color: #4caf50; }
.todo-item:nth-child(even) { border-left-color: #ff9800; }
.todo-item--done { background-color: #eef7f1; border-left-color: #5dbb7f !important; }
.todo-item--disabled { opacity: 0.78; }
.todo-item--pending { opacity: 0.72; }
.todo-check {
  width: 40rpx; height: 40rpx; border-radius: 20rpx; border: 2rpx solid #d7dbe2;
  background: #fffcf8; display: flex; align-items: center; justify-content: center;
  margin-right: 20rpx; margin-top: 8rpx; flex-shrink: 0;
}
.todo-check--done { border-color: #5dbb7f; background: #5dbb7f; }
.todo-check-icon { color: #fff; font-size: 24rpx; font-weight: bold; }
.todo-content { flex: 1; }
.todo-meta { display: flex; align-items: center; gap: 12rpx; margin-bottom: 8rpx; }
.todo-type { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 8rpx; height: fit-content; white-space: nowrap; }
.type-checkup { background-color: #e8f5e9; color: #4caf50; }
.type-action { background-color: #fff3e0; color: #ff9800; }
.type-custom { background-color: #eef1ff; color: #6274ff; }
.type-vaccine { background-color: #eef5ff; color: #2f7cf6; }
.type-feeding { background-color: #fff7e6; color: #c47a1c; }
.type-development { background-color: #f1f7ff; color: #5167d8; }
.type-safety { background-color: #fff1f0; color: #d95c5c; }
.type-care { background-color: #edf8f4; color: #16806a; }
.todo-state { font-size: 22rpx; color: #5dbb7f; }
.todo-state--muted { color: #8b96a3; }
.todo-title { display: block; font-size: 28rpx; font-weight: bold; color: #444; margin-bottom: 8rpx; }
.todo-desc { font-size: 24rpx; color: #777; }
.todo-item--done .todo-title { color: #7e8b84; text-decoration: line-through; }
.todo-item--done .todo-desc { color: #98a49d; }
.todo-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 16rpx;
}
.todo-action-btn { font-size: 24rpx; color: #6274ff; font-weight: 600; }
.todo-action-btn--danger { color: #ff7875; }
.todo-action-divider { font-size: 22rpx; color: #c2c8d0; }

.diary-empty { display: flex; flex-direction: column; align-items: center; padding: 100rpx 0; }
.empty-emoji { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #999; margin-bottom: 40rpx; }
.add-diary-btn { background: linear-gradient(135deg, #16806a 0%, #2f7cf6 100%); color: white; border-radius: 40rpx; padding: 0 60rpx; height: 80rpx; line-height: 80rpx; font-size: 30rpx; box-shadow: 0 8rpx 20rpx rgba(22, 128, 106, 0.24); }

.diary-card { background-color: #fffcf8; border-radius: 24rpx; padding: 40rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04); }
.diary-header { display: flex; justify-content: space-between; margin-bottom: 20rpx; border-bottom: 2rpx dashed #eee; padding-bottom: 15rpx; }
.diary-header-actions { display: flex; align-items: center; gap: 14rpx; }
.diary-date { font-size: 24rpx; color: #999; }
.edit-btn { font-size: 24rpx; color: #16806a; }
.diary-header-divider { font-size: 22rpx; color: #c2c8d0; }
.delete-btn { font-size: 24rpx; color: #ff7875; }
.diary-content { font-size: 30rpx; color: #444; line-height: 1.8; }
.diary-image-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 24rpx;
}
.diary-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 16rpx;
  background: #f2f4f7;
}

.fab-button {
  position: fixed; bottom: 60rpx; right: 40rpx; width: 100rpx; height: 100rpx;
  background: linear-gradient(135deg, #16806a 0%, #2f7cf6 100%); border-radius: 50%;
  display: flex; justify-content: center; align-items: center; box-shadow: 0 8rpx 20rpx rgba(22, 128, 106, 0.28); z-index: 100;
}
.fab-icon { font-size: 40rpx; }

.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 999; }
.modal-content { width: 85%; background-color: #fffcf8; border-radius: 30rpx; padding: 40rpx; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30rpx; }
.modal-title { font-size: 34rpx; font-weight: bold; }
.close-icon { font-size: 44rpx; color: #999; padding: 10rpx; }
.diary-textarea { width: 100%; height: 300rpx; background-color: #f7f9fa; border-radius: 16rpx; padding: 20rpx; font-size: 28rpx; box-sizing: border-box; margin-bottom: 30rpx; }
.diary-photo-section {
  margin-bottom: 30rpx;
}
.diary-photo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.diary-photo-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #313b47;
}
.diary-photo-count {
  font-size: 22rpx;
  color: #8a96a3;
}
.diary-photo-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}
.diary-photo-thumb,
.diary-photo-add {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 18rpx;
  overflow: hidden;
  background: #f7f9fa;
}
.diary-photo-image {
  width: 100%;
  height: 100%;
}
.diary-photo-remove {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(31, 42, 55, 0.72);
}
.diary-photo-remove-text {
  color: #ffffff;
  font-size: 30rpx;
  line-height: 1;
}
.diary-photo-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border: 2rpx dashed #cbd5e1;
  box-sizing: border-box;
}
.diary-photo-add-options {
  flex-direction: row;
  gap: 0;
}
.diary-photo-add--loading {
  opacity: 0.72;
}
.diary-photo-option {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}
.diary-photo-option-divider {
  width: 2rpx;
  height: 56rpx;
  background: #d8e0e8;
}
.diary-photo-add-icon {
  font-size: 38rpx;
  line-height: 1;
  color: #16806a;
}
.diary-photo-add-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #59697c;
}
.save-btn { background: linear-gradient(135deg, #16806a 0%, #2f7cf6 100%); color: white; border-radius: 40rpx; height: 80rpx; line-height: 80rpx; font-size: 32rpx; }
</style>
