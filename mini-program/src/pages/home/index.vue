<template>
  <view class="home-page">
    <view class="hero-section">
      <view class="hero-copy">
        <text class="eyebrow">{{ heroEyebrow }}</text>
        <text class="hero-title">{{ heroTitle }}</text>
        <text class="hero-subtitle">{{ heroSubtitle }}</text>
      </view>

      <view class="hero-badges">
        <view class="hero-badge">
          <text class="hero-badge-label">当前阶段</text>
          <text class="hero-badge-value">{{ pregnancyStageLabel }}</text>
        </view>
        <view class="hero-badge">
          <text class="hero-badge-label">使用状态</text>
          <text class="hero-badge-value">{{ loginStateLabel }}</text>
        </view>
      </view>

      <view class="trust-strip">
        <text class="trust-strip-text">先查权威资料，再问问题，再记录本周安排</text>
      </view>

      <view class="calendar-spotlight" @tap="navigateTo('/pages/calendar/index')">
        <view class="calendar-spotlight-copy">
          <text class="calendar-spotlight-kicker">更直接的入口</text>
          <text class="calendar-spotlight-title">{{ calendarSpotlightTitle }}</text>
          <text class="calendar-spotlight-desc">{{ calendarSpotlightDesc }}</text>
        </view>
        <view class="calendar-spotlight-side">
          <text class="calendar-spotlight-week">{{ calendarSpotlightBadge }}</text>
          <text class="calendar-spotlight-action">去日历</text>
        </view>
      </view>
    </view>

    <view class="content-section">
      <view class="primary-card" @tap="navigateTo('/pages/knowledge/index')">
        <view class="primary-card-top">
          <view>
            <text class="primary-card-kicker">优先入口</text>
            <text class="primary-card-title">权威知识库</text>
          </view>
          <view class="primary-card-tag">
            <text class="primary-card-tag-text">中文源优先</text>
          </view>
        </view>
        <text class="primary-card-desc">
          按机构来源、阶段和关键词快速筛选，英文原文支持中文辅助阅读。
        </text>
        <view class="primary-card-footer">
          <text class="primary-card-action">立即查资料</text>
          <text class="primary-card-arrow">→</text>
        </view>
      </view>

      <view class="quick-grid">
        <view class="quick-card quick-card--warm" @tap="openChat()">
          <text class="quick-card-title">问一个问题</text>
          <text class="quick-card-desc">优先参考权威资料，回答结果标明可信等级。</text>
        </view>
        <view class="quick-card quick-card--soft" @tap="navigateTo('/pages/calendar/index')">
          <text class="quick-card-title">看本周安排</text>
          <text class="quick-card-desc">查看孕周重点、待办和本周记录，完成状态实时更新。</text>
        </view>
      </view>

      <view v-if="recentKnowledge.length" class="recent-card">
        <view class="section-head">
          <text class="section-title">继续阅读</text>
          <text class="section-caption">回到你最近看过的权威内容</text>
        </view>
        <view
          v-for="item in recentKnowledge"
          :key="item.slug"
          class="recent-item"
          @tap="openRecentKnowledge(item.slug)"
        >
          <view class="recent-copy">
            <text class="recent-title">{{ item.title }}</text>
            <text class="recent-meta">{{ item.sourceLabel }} · {{ item.updatedAtLabel }}</text>
          </view>
          <text class="recent-action">继续看</text>
        </view>
      </view>

      <view v-if="recentQuestions.length" class="recent-chat-card">
        <view class="section-head">
          <text class="section-title">继续追问</text>
          <text class="section-caption">回到最近的问题，接着问更快</text>
        </view>
        <view
          v-for="item in recentQuestions"
          :key="item.question"
          class="recent-chat-item"
          @tap="openChat(item.question)"
        >
          <view class="recent-chat-copy">
            <text class="recent-chat-title">{{ item.question }}</text>
            <text class="recent-chat-meta">问题助手 · {{ formatRecentQuestionTime(item.updatedAt) }}</text>
          </view>
          <text class="recent-chat-action">继续问</text>
        </view>
      </view>

      <view class="ask-card">
        <view class="section-head">
          <text class="section-title">现在就能这样提问</text>
          <text class="section-caption">带着具体场景进入更快</text>
        </view>
        <view class="ask-chip-list">
          <view
            v-for="question in suggestedQuestions"
            :key="question"
            class="ask-chip"
            @tap="openChat(question)"
          >
            <text class="ask-chip-text">{{ question }}</text>
          </view>
        </view>
      </view>

      <view class="focus-card">
        <view class="section-head">
          <text class="section-title">本周先做这几件事</text>
          <text class="section-caption">{{ focusCaption }}</text>
        </view>

        <view
          v-for="item in focusItems"
          :key="item.title"
          class="focus-item"
        >
          <view class="focus-index">
            <text class="focus-index-text">{{ item.index }}</text>
          </view>
          <view class="focus-copy">
            <text class="focus-title">{{ item.title }}</text>
            <text class="focus-desc">{{ item.desc }}</text>
          </view>
        </view>
      </view>

      <view class="secondary-actions">
        <view class="secondary-card" @tap="navigateTo('/pages/pregnancy-profile/index')">
          <text class="secondary-card-title">完善孕期档案</text>
          <text class="secondary-card-desc">保存孕周后，首页和日历会自动对齐到你的阶段。</text>
        </view>
        <view class="secondary-card" @tap="navigateTo('/pages/profile/index')">
          <text class="secondary-card-title">查看收藏与记录</text>
          <text class="secondary-card-desc">统一管理浏览历史、收藏文章和账号状态。</text>
        </view>
      </view>

      <view class="notice-card">
        <text class="notice-title">当前版本说明</text>
        <text class="notice-text">小程序首发优先提供权威知识库、问题助手、孕周指南与基础档案，不要求上传身份证件或其他敏感身份材料。</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { calculatePregnancyWeekFromDueDate } from '@/utils'

const appStore = useAppStore()
const RECENT_KNOWLEDGE_STORAGE_KEY = 'recentKnowledgeArticles'
const RECENT_CHAT_QUESTIONS_STORAGE_KEY = 'recentChatQuestions'

interface RecentKnowledgeItem {
  slug: string
  title: string
  sourceLabel: string
  updatedAtLabel: string
}

interface RecentChatQuestionItem {
  question: string
  updatedAt: string
}

const TAB_PAGES = new Set([
  '/pages/home/index',
  '/pages/calendar/index',
  '/pages/knowledge/index',
  '/pages/profile/index',
])

const PUBLIC_PAGES = new Set([
  '/pages/home/index',
  '/pages/calendar/index',
  '/pages/knowledge/index',
])

const sessionLoggedIn = ref(Boolean(uni.getStorageSync('token')))
const storedWeek = ref<number | null>(null)
const CHAT_DRAFT_STORAGE_KEY = 'pendingChatDraft'
const recentKnowledge = ref<RecentKnowledgeItem[]>([])
const recentQuestions = ref<RecentChatQuestionItem[]>([])

function formatRecentQuestionTime(updatedAt?: string) {
  if (!updatedAt) {
    return '最近提问'
  }

  const target = new Date(updatedAt)
  if (Number.isNaN(target.getTime())) {
    return '最近提问'
  }

  const now = new Date()
  const diff = now.getTime() - target.getTime()
  if (diff < 60 * 60 * 1000) {
    return '刚刚提过'
  }
  if (diff < 24 * 60 * 60 * 1000) {
    return '今天提过'
  }
  if (diff < 2 * 24 * 60 * 60 * 1000) {
    return '昨天提过'
  }

  const month = `${target.getMonth() + 1}`.padStart(2, '0')
  const day = `${target.getDate()}`.padStart(2, '0')
  return `${month}-${day} 提过`
}

const syncHomeState = () => {
  sessionLoggedIn.value = Boolean(uni.getStorageSync('token'))
  const rawWeek = Number.parseInt(String(uni.getStorageSync('userPregnancyWeek') || ''), 10)
  storedWeek.value = !Number.isNaN(rawWeek) && rawWeek >= 1 && rawWeek <= 40 ? rawWeek : null
  const storedRecent = uni.getStorageSync(RECENT_KNOWLEDGE_STORAGE_KEY) as RecentKnowledgeItem[] | null
  recentKnowledge.value = Array.isArray(storedRecent) ? storedRecent.slice(0, 3) : []
  const storedRecentQuestions = uni.getStorageSync(RECENT_CHAT_QUESTIONS_STORAGE_KEY) as RecentChatQuestionItem[] | null
  recentQuestions.value = Array.isArray(storedRecentQuestions)
    ? storedRecentQuestions.filter(item => item?.question?.trim()).slice(0, 3)
    : []
}

syncHomeState()

const currentWeek = computed(() => {
  const userDueDate = appStore.user?.dueDate
  if (userDueDate) {
    const week = calculatePregnancyWeekFromDueDate(userDueDate)
    if (week) return week
  }

  return storedWeek.value
})

const isLoggedIn = computed(() => sessionLoggedIn.value)
const pregnancyStageLabel = computed(() => {
  const week = currentWeek.value
  if (!week) return isLoggedIn.value ? '待完善孕周' : '可先浏览'
  if (week <= 12) return `孕早期 · 第 ${week} 周`
  if (week <= 27) return `孕中期 · 第 ${week} 周`
  return `孕晚期 · 第 ${week} 周`
})

const loginStateLabel = computed(() => (isLoggedIn.value ? '已登录' : '未登录也可浏览'))
const heroEyebrow = computed(() => (currentWeek.value ? `第 ${currentWeek.value} 周重点` : '贝护妈妈小程序'))
const heroTitle = computed(() => (
  currentWeek.value
    ? `这周先把信息看准，再安排重点事项`
    : '先查权威资料，再决定下一步怎么做'
))
const heroSubtitle = computed(() => (
  isLoggedIn.value
    ? '知识库、问题助手和孕周安排会围绕你当前阶段提供更贴近的内容。'
    : '不登录也可以先浏览知识库和孕周指南；需要保存记录时再进入登录。'
))

const calendarSpotlightTitle = computed(() => (
  currentWeek.value
    ? `第 ${currentWeek.value} 周安排与记录`
    : '先看孕周日历与本周安排'
))

const calendarSpotlightDesc = computed(() => (
  currentWeek.value
    ? '把本周重点、待办事项和个人记录放在一个页面里，进入后就能继续跟进。'
    : '日历里能直接看阶段重点、待办和记录入口，不用先翻首页其它区块。'
))

const calendarSpotlightBadge = computed(() => (
  currentWeek.value ? `W${currentWeek.value}` : '日历'
))

const focusCaption = computed(() => (
  currentWeek.value ? `围绕第 ${currentWeek.value} 周的实际使用场景` : '适合首次进入时的最小使用路径'
))

const focusItems = computed(() => {
  const week = currentWeek.value
  if (!week) {
    return [
      { index: '01', title: '先查权威知识', desc: '优先阅读中国权威来源与国际指南，避免先被经验帖带偏。' },
      { index: '02', title: '再看孕周安排', desc: '先浏览当前阶段重点，不登录也能看，确定需要保存再进入登录。' },
      { index: '03', title: '最后完善孕周', desc: '只补一个孕周信息，就能让日历、首页和提醒更贴合当前阶段。' },
    ]
  }

  if (week <= 12) {
    return [
      { index: '01', title: '先确认本周风险点', desc: '重点看孕吐、出血、叶酸、早孕检查等高频主题。' },
      { index: '02', title: '安排本周待办', desc: '把产检、补剂和需要观察的身体变化整理进本周清单。' },
      { index: '03', title: '有疑问就问助手', desc: '先快速提问，再回到知识库核对来源和细节。' },
    ]
  }

  if (week <= 27) {
    return [
      { index: '01', title: '对照阶段发育重点', desc: '优先看产检节点、体重管理、胎动和营养主题。' },
      { index: '02', title: '把待办拆成可执行项', desc: '把预约、复查、补充记录拆成本周能完成的小动作。' },
      { index: '03', title: '留下本周记录', desc: '把异常感受和产检结果写下来，后面复盘更省力。' },
    ]
  }

  return [
    { index: '01', title: '优先看临近分娩主题', desc: '先查看宫缩、入院准备、疫苗、哺乳和新生儿护理等主题。' },
    { index: '02', title: '完成临产前准备', desc: '把待产包、产检复查、就诊路线和家人分工放进本周待办。' },
    { index: '03', title: '把变化及时记下来', desc: '出现胎动变化、宫缩频率或医生新建议时，尽快记录。' },
  ]
})

const suggestedQuestions = computed(() => {
  const week = currentWeek.value
  if (!week) {
    return [
      '孕早期第一次产检前，应该先了解哪些重点？',
      '新生儿夜里总醒，先从哪些护理细节排查？',
      '母乳喂养初期最常见的问题有哪些？',
    ]
  }

  if (week <= 12) {
    return [
      '我现在孕早期，这周最需要重点观察什么？',
      '孕吐严重时，哪些情况需要尽快线下就医？',
      '叶酸、饮食和作息这周应该怎么安排？',
    ]
  }

  if (week <= 27) {
    return [
      '我现在孕中期，这周产检和营养要重点看什么？',
      '胎动、体重和睡眠变化，哪些算需要关注？',
      '这周如果要做运动，强度应该怎么把握？',
    ]
  }

  return [
    '我现在孕晚期，这周待产准备优先做哪几件事？',
    '出现宫缩、见红或胎动变化时，应该先怎么判断？',
    '临近分娩，这周要重点补哪些母乳和新生儿护理知识？',
  ]
})

function persistChatDraft(question: string) {
  uni.setStorageSync(CHAT_DRAFT_STORAGE_KEY, { question })
}

const checkLogin = (): boolean => {
  if (!isLoggedIn.value) {
    uni.showToast({ title: '登录后可保存你的进度', icon: 'none' })
    setTimeout(() => {
      uni.navigateTo({ url: '/pages/login/index' })
    }, 900)
    return false
  }
  return true
}

function openChat(question = '') {
  const trimmedQuestion = question.trim()
  if (!isLoggedIn.value) {
    if (trimmedQuestion) {
      persistChatDraft(trimmedQuestion)
    }
    uni.showToast({ title: '登录后可进入问题助手', icon: 'none' })
    setTimeout(() => {
      uni.navigateTo({ url: '/pages/login/index' })
    }, 900)
    return
  }

  const query = trimmedQuestion ? `?q=${encodeURIComponent(trimmedQuestion)}` : ''
  uni.navigateTo({ url: `/pages/chat/index${query}` })
}

function openRecentKnowledge(slug: string) {
  uni.navigateTo({ url: `/pages/knowledge-detail/index?slug=${encodeURIComponent(slug)}` })
}

const navigateTo = (url: string) => {
  if (!PUBLIC_PAGES.has(url) && !checkLogin()) return
  if (TAB_PAGES.has(url)) {
    uni.switchTab({ url })
    return
  }
  uni.navigateTo({ url })
}

onShow(() => {
  syncHomeState()
  if (sessionLoggedIn.value && !appStore.user) {
    void appStore.fetchUser()
  }
})

function buildSharePayload() {
  return {
    title: '贝护妈妈：先查权威知识，再看本周安排',
    path: '/pages/home/index',
    query: '',
  }
}

onShareAppMessage(() => buildSharePayload())

onShareTimeline(() => ({
  title: '贝护妈妈：先查权威知识，再看本周安排',
  query: '',
}))
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(255, 211, 193, 0.75) 0, rgba(255, 211, 193, 0) 38%),
    linear-gradient(180deg, #fff8f2 0%, #f5f8fc 42%, #f3f6fb 100%);
}

.hero-section {
  padding: 116rpx 32rpx 40rpx;
}

.hero-copy {
  padding: 44rpx 36rpx 34rpx;
  border-radius: 40rpx;
  background: linear-gradient(145deg, rgba(255, 247, 241, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%);
  box-shadow: 0 18rpx 46rpx rgba(225, 131, 85, 0.12);
}

.eyebrow {
  display: block;
  margin-bottom: 16rpx;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: #b25d35;
}

.hero-title {
  display: block;
  font-size: 50rpx;
  line-height: 1.24;
  font-weight: 800;
  color: #1f2a37;
}

.hero-subtitle {
  display: block;
  margin-top: 18rpx;
  font-size: 27rpx;
  line-height: 1.7;
  color: #566476;
}

.hero-badges {
  display: flex;
  gap: 18rpx;
  margin-top: 24rpx;
}

.hero-badge {
  flex: 1;
  padding: 24rpx 26rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 10rpx 28rpx rgba(31, 42, 55, 0.06);
}

.hero-badge-label {
  display: block;
  font-size: 22rpx;
  color: #8a96a3;
}

.hero-badge-value {
  display: block;
  margin-top: 10rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #27313d;
}

.trust-strip {
  margin-top: 22rpx;
  padding: 18rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(31, 143, 116, 0.1);
}

.trust-strip-text {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #16735d;
  font-weight: 600;
}

.calendar-spotlight {
  margin-top: 22rpx;
  padding: 26rpx 28rpx;
  border-radius: 30rpx;
  background: linear-gradient(135deg, #2f7cf6 0%, #5a99ff 100%);
  box-shadow: 0 18rpx 38rpx rgba(59, 122, 232, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.calendar-spotlight-copy {
  flex: 1;
}

.calendar-spotlight-kicker {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: rgba(235, 244, 255, 0.72);
}

.calendar-spotlight-title {
  display: block;
  margin-top: 10rpx;
  font-size: 36rpx;
  line-height: 1.3;
  font-weight: 800;
  color: #ffffff;
}

.calendar-spotlight-desc {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.65;
  color: rgba(245, 249, 255, 0.88);
}

.calendar-spotlight-side {
  flex-shrink: 0;
  min-width: 128rpx;
  padding: 18rpx 18rpx 16rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.16);
  text-align: center;
}

.calendar-spotlight-week {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
  color: #ffffff;
}

.calendar-spotlight-action {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.content-section {
  padding: 0 32rpx 48rpx;
}

.primary-card {
  padding: 34rpx;
  border-radius: 34rpx;
  background: linear-gradient(135deg, #1b8b73 0%, #146b59 100%);
  box-shadow: 0 22rpx 42rpx rgba(22, 107, 89, 0.2);
}

.primary-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.primary-card-kicker {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: rgba(238, 255, 249, 0.72);
}

.primary-card-title {
  display: block;
  margin-top: 12rpx;
  font-size: 42rpx;
  font-weight: 800;
  color: #ffffff;
}

.primary-card-tag {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.16);
}

.primary-card-tag-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #effffb;
}

.primary-card-desc {
  display: block;
  margin-top: 22rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.88);
}

.primary-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 28rpx;
}

.primary-card-action {
  font-size: 28rpx;
  font-weight: 700;
  color: #ffffff;
}

.primary-card-arrow {
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.88);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 22rpx;
}

.quick-card {
  min-height: 200rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  box-shadow: 0 14rpx 34rpx rgba(31, 42, 55, 0.06);
}

.quick-card--warm {
  background: linear-gradient(145deg, #fff4eb 0%, #fff9f3 100%);
}

.quick-card--soft {
  background: linear-gradient(145deg, #eef5ff 0%, #f7faff 100%);
}

.quick-card-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #25303c;
}

.quick-card-desc {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  line-height: 1.65;
  color: #657284;
}

.focus-card,
.recent-card,
.recent-chat-card,
.ask-card,
.notice-card {
  margin-top: 22rpx;
  padding: 30rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 14rpx 34rpx rgba(31, 42, 55, 0.05);
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18rpx;
}

.section-title,
.notice-title {
  font-size: 32rpx;
  font-weight: 800;
  color: #24303d;
}

.section-caption {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #8a96a3;
}

.focus-item {
  display: flex;
  gap: 18rpx;
  margin-top: 24rpx;
}

.focus-index {
  width: 64rpx;
  height: 64rpx;
  border-radius: 20rpx;
  background: #f8ede6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.focus-index-text {
  font-size: 24rpx;
  font-weight: 800;
  color: #b5643f;
}

.focus-copy {
  flex: 1;
}

.focus-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #293542;
}

.focus-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #6b7787;
}

.secondary-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 22rpx;
}

.recent-item + .recent-item {
  margin-top: 18rpx;
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 20rpx;
  padding: 22rpx 24rpx;
  border-radius: 22rpx;
  background: #f7f9fc;
}

.recent-copy {
  flex: 1;
}

.recent-title {
  display: block;
  font-size: 26rpx;
  line-height: 1.55;
  font-weight: 700;
  color: #25303c;
}

.recent-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #7a8592;
}

.recent-action {
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 700;
  color: #f36f45;
}

.recent-chat-card {
  background:
    linear-gradient(145deg, rgba(255, 247, 241, 0.94) 0%, rgba(255, 255, 255, 0.9) 100%);
}

.recent-chat-item + .recent-chat-item {
  margin-top: 18rpx;
}

.recent-chat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.72);
  border: 2rpx solid rgba(243, 111, 69, 0.08);
}

.recent-chat-copy {
  flex: 1;
}

.recent-chat-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 26rpx;
  line-height: 1.55;
  font-weight: 700;
  color: #25303c;
}

.recent-chat-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #8a7480;
}

.recent-chat-action {
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 700;
  color: #cf5a39;
}

.ask-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 20rpx;
}

.ask-chip {
  max-width: 100%;
  padding: 16rpx 20rpx;
  border-radius: 18rpx;
  background: #f7f9fc;
  border: 2rpx solid rgba(95, 133, 229, 0.08);
}

.ask-chip-text {
  font-size: 23rpx;
  line-height: 1.5;
  color: #4f5d71;
  font-weight: 600;
}

.secondary-card {
  min-height: 168rpx;
  padding: 26rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 12rpx 30rpx rgba(31, 42, 55, 0.05);
}

.secondary-card-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #25303c;
}

.secondary-card-desc,
.notice-text {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #687588;
}
</style>
