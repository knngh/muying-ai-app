<template>
  <view class="home-page">
    <HeroSection
      :eyebrow="heroEyebrow"
      :title="heroTitle"
      :subtitle="heroSubtitle"
      :stage-label="pregnancyStageLabel"
      :login-label="loginStateLabel"
    />

    <CalendarSpotlight
      :title="calendarSpotlightTitle"
      :desc="calendarSpotlightDesc"
      :badge="calendarSpotlightBadge"
      @navigate="navigateTo"
    />

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
        <view class="quick-card quick-card--soft" @tap="navigateTo('/pages/calendar/index')">
          <text class="quick-card-title">看本周安排</text>
          <text class="quick-card-desc">查看孕周重点、待办和本周记录，完成状态实时更新。</text>
        </view>
        <view class="quick-card quick-card--warm" @tap="navigateTo('/pages/pregnancy-profile/index')">
          <text class="quick-card-title">完善孕周档案</text>
          <text class="quick-card-desc">补充当前阶段后，首页、日历和知识库会自动贴近你的进度。</text>
        </view>
      </view>

      <StageRecommend
        :title="stageRecommendTitle"
        :caption="stageRecommendCaption"
        :badge="stageRecommendBadge"
        :items="stageRecommendItems"
        @open-recommendation="openStageRecommendation"
      />

      <view class="assistant-status-card">
        <text class="assistant-status-title">当前能力范围</text>
        <text class="assistant-status-desc">当前小程序先聚焦权威知识库、孕周日历和基础档案。阅读问答能力暂不在小程序上线，后续会在安全提示和来源能力更稳定后再开放。</text>
      </view>

      <RecentAiHits
        :articles="recentAiHitArticles"
        :topics="recentAiHitTopics"
        :sources="recentAiHitSources"
        @navigate="navigateTo"
        @open-hit="openRecentAiHit"
        @open-topic="openRecentAiTopic"
        @open-source="openRecentAiSource"
      />

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

      <FocusItems :caption="focusCaption" :items="focusItems" />

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
        <text class="notice-title">隐私与登录说明</text>
        <text class="notice-text">小程序当前优先提供权威知识库、孕周日历与基础档案，不要求上传身份证件或其他敏感身份材料。</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { useKnowledgeStore } from '@/stores/knowledge'
import { calculatePregnancyWeekFromDueDate } from '@/utils'
import { getKnowledgeDisplayTitle } from '@/utils/knowledge-format'
import { trackMiniEvent } from '@/utils/analytics'
import {
  type RecentKnowledgeItem,
  type HomeRecentAiHitItem,
  type HomeRecentAiTopic,
  type HomeRecentAiSource,
  type StageRecommendationItem,
  buildRecentAIHitTopics,
  buildRecentAIHitSources,
  getStageRecommendationItems,
  getFocusItems,
  parseStoredRecentAiHits,
} from '@/utils/home-helpers'
import HeroSection from '@/components/home/HeroSection.vue'
import CalendarSpotlight from '@/components/home/CalendarSpotlight.vue'
import StageRecommend from '@/components/home/StageRecommend.vue'
import RecentAiHits from '@/components/home/RecentAiHits.vue'
import FocusItems from '@/components/home/FocusItems.vue'

const appStore = useAppStore()
const knowledgeStore = useKnowledgeStore()
const RECENT_KNOWLEDGE_STORAGE_KEY = 'recentKnowledgeArticles'
const RECENT_AI_HIT_ARTICLES_KEY = 'knowledgeRecentAiHitArticles'

const TAB_PAGES = new Set([
  '/pages/home/index',
  '/pages/calendar/index',
  '/pages/chat/index',
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
const recentKnowledge = ref<RecentKnowledgeItem[]>([])
const recentAiHitArticles = ref<HomeRecentAiHitItem[]>([])

const syncHomeState = () => {
  uni.removeStorageSync('pendingChatDraft')
  uni.removeStorageSync('recentChatQuestions')
  sessionLoggedIn.value = Boolean(uni.getStorageSync('token'))
  const rawWeek = Number.parseInt(String(uni.getStorageSync('userPregnancyWeek') || ''), 10)
  storedWeek.value = !Number.isNaN(rawWeek) && rawWeek >= 1 && rawWeek <= 40 ? rawWeek : null

  const storedRecent = uni.getStorageSync(RECENT_KNOWLEDGE_STORAGE_KEY) as RecentKnowledgeItem[] | null
  recentKnowledge.value = Array.isArray(storedRecent)
    ? storedRecent.slice(0, 3).map(item => ({ ...item, title: getKnowledgeDisplayTitle({ title: item.title }) }))
    : []

  recentAiHitArticles.value = parseStoredRecentAiHits(
    (uni.getStorageSync(RECENT_AI_HIT_ARTICLES_KEY) as unknown[]) || [],
  )
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
const heroTitle = computed(() => (currentWeek.value ? '这周先把信息看准，再安排重点事项' : '先查权威资料，再决定下一步怎么做'))
const heroSubtitle = computed(() => (
  isLoggedIn.value
    ? '知识库、孕周安排和个人记录会围绕你当前阶段提供更贴近的内容。'
    : '不登录也可以先浏览知识库和孕周日历；需要保存记录时再进入登录。'
))

const calendarSpotlightTitle = computed(() => (currentWeek.value ? `第 ${currentWeek.value} 周安排与记录` : '先看孕周日历与本周安排'))
const calendarSpotlightDesc = computed(() => (
  currentWeek.value
    ? '把本周重点、待办事项和个人记录放在一个页面里，进入后就能继续跟进。'
    : '日历里能直接看阶段重点、待办和记录入口，不用先翻首页其它区块。'
))
const calendarSpotlightBadge = computed(() => (currentWeek.value ? `W${currentWeek.value}` : '日历'))

const recentAiHitTopics = computed(() => buildRecentAIHitTopics(recentAiHitArticles.value))
const recentAiHitSources = computed(() => buildRecentAIHitSources(recentAiHitArticles.value))
const stageRecommendItems = computed(() => getStageRecommendationItems(currentWeek.value))
const stageRecommendTitle = computed(() => (currentWeek.value ? `第 ${currentWeek.value} 周优先查这些` : '第一次来先从这些开始'))
const stageRecommendCaption = computed(() => (
  currentWeek.value
    ? '先按当前孕周把高频主题看准，再进入知识库继续缩小范围。'
    : '先用几个高频入口熟悉知识库结构，再决定接下来补什么信息。'
))
const stageRecommendBadge = computed(() => (currentWeek.value ? pregnancyStageLabel.value : '冷启动'))

const focusCaption = computed(() => (currentWeek.value ? `围绕第 ${currentWeek.value} 周的实际使用场景` : '适合首次进入时的最小使用路径'))
const focusItems = computed(() => getFocusItems(currentWeek.value))

const checkLogin = (): boolean => {
  if (!isLoggedIn.value) {
    uni.showToast({ title: '登录后可保存你的进度', icon: 'none' })
    setTimeout(() => { uni.navigateTo({ url: '/pages/login/index' }) }, 900)
    return false
  }
  return true
}

function openRecentKnowledge(slug: string) {
  uni.navigateTo({ url: `/pages/knowledge-detail/index?slug=${encodeURIComponent(slug)}` })
}

function openRecentAiHit(item: HomeRecentAiHitItem) {
  trackMiniEvent('app_knowledge_recent_ai_hit_click', {
    page: 'HomePage',
    properties: { entrySource: item.originEntrySource || null, articleSlug: item.slug, qaId: item.qaId || null, trigger: item.trigger || null, matchReason: item.matchReason || null, reportId: item.originReportId || null },
  })
  const shouldWarmTranslation = item.sourceLanguage !== 'zh' && item.sourceLocale !== 'zh-CN' ? '1' : '0'
  const params = [
    `slug=${encodeURIComponent(item.slug)}`, `translation=${shouldWarmTranslation}`, 'source=chat_hit',
    `trigger=${encodeURIComponent(item.trigger || '')}`, `matchReason=${encodeURIComponent(item.matchReason || '')}`,
    `originEntrySource=${encodeURIComponent(item.originEntrySource || '')}`, `originReportId=${encodeURIComponent(item.originReportId || '')}`,
    `qaId=${encodeURIComponent(item.qaId || '')}`,
  ].join('&')
  uni.navigateTo({ url: `/pages/knowledge-detail/index?${params}` })
}

async function openRecentAiTopic(item: HomeRecentAiTopic) {
  trackMiniEvent('app_knowledge_recent_ai_topic_click', {
    page: 'HomePage',
    properties: { topic: item.topic, displayName: item.displayName, hitCount: item.count, entrySource: item.sample.originEntrySource || null, articleSlug: item.sample.slug, reportId: item.sample.originReportId || null, qaId: item.sample.qaId || null },
  })
  try { await knowledgeStore.applyFilters({ keyword: item.displayName, source: 'all', stage: item.sample.stage || null }) }
  finally { uni.switchTab({ url: '/pages/knowledge/index' }) }
}

async function openRecentAiSource(item: HomeRecentAiSource) {
  trackMiniEvent('app_knowledge_recent_ai_source_click', {
    page: 'HomePage',
    properties: { sourceOrg: item.source, displayName: item.displayName, hitCount: item.count, entrySource: item.sample.originEntrySource || null, articleSlug: item.sample.slug, reportId: item.sample.originReportId || null, qaId: item.sample.qaId || null },
  })
  try { await knowledgeStore.applyFilters({ keyword: item.source, source: 'all', stage: item.sample.stage || null }) }
  finally { uni.switchTab({ url: '/pages/knowledge/index' }) }
}

async function openStageRecommendation(item: StageRecommendationItem) {
  try { await knowledgeStore.applyFilters({ keyword: item.keyword, source: 'all', stage: item.stage }) }
  finally { uni.switchTab({ url: '/pages/knowledge/index' }) }
}

const navigateTo = (url: string) => {
  if (!PUBLIC_PAGES.has(url) && !checkLogin()) return
  if (TAB_PAGES.has(url)) { uni.switchTab({ url }); return }
  uni.navigateTo({ url })
}

onShow(() => {
  syncHomeState()
  if (sessionLoggedIn.value && !appStore.user) { void appStore.fetchUser() }
})

onShareAppMessage(() => ({ title: '贝护妈妈：先查权威知识，再看本周安排', path: '/pages/home/index', query: '' }))
onShareTimeline(() => ({ title: '贝护妈妈：先查权威知识，再看本周安排', query: '' }))
</script>

<style scoped>
.home-page { min-height: 100vh; background: radial-gradient(circle at top right, rgba(255, 211, 193, 0.75) 0, rgba(255, 211, 193, 0) 38%), linear-gradient(180deg, #fff8f2 0%, #f5f8fc 42%, #f3f6fb 100%); }
.content-section { padding: 0 32rpx 48rpx; }
.primary-card { padding: 34rpx; border-radius: 34rpx; background: linear-gradient(135deg, #1b8b73 0%, #146b59 100%); box-shadow: 0 22rpx 42rpx rgba(22, 107, 89, 0.2); }
.primary-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.primary-card-kicker { display: block; font-size: 22rpx; font-weight: 700; letter-spacing: 2rpx; color: rgba(238, 255, 249, 0.72); }
.primary-card-title { display: block; margin-top: 12rpx; font-size: 42rpx; font-weight: 800; color: #ffffff; }
.primary-card-tag { flex-shrink: 0; padding: 10rpx 18rpx; border-radius: 999rpx; background: rgba(255, 255, 255, 0.16); }
.primary-card-tag-text { font-size: 22rpx; font-weight: 700; color: #effffb; }
.primary-card-desc { display: block; margin-top: 22rpx; font-size: 26rpx; line-height: 1.7; color: rgba(255, 255, 255, 0.88); }
.primary-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 28rpx; }
.primary-card-action { font-size: 28rpx; font-weight: 700; color: #ffffff; }
.primary-card-arrow { font-size: 32rpx; color: rgba(255, 255, 255, 0.88); }
.quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18rpx; margin-top: 22rpx; }
.quick-card { min-height: 200rpx; padding: 28rpx; border-radius: 28rpx; box-shadow: 0 14rpx 34rpx rgba(31, 42, 55, 0.06); }
.quick-card--warm { background: linear-gradient(145deg, #fff4eb 0%, #fff9f3 100%); }
.quick-card--soft { background: linear-gradient(145deg, #eef5ff 0%, #f7faff 100%); }
.quick-card-title { display: block; font-size: 32rpx; font-weight: 700; color: #25303c; }
.quick-card-desc { display: block; margin-top: 16rpx; font-size: 24rpx; line-height: 1.65; color: #657284; }
.assistant-status-card { margin-top: 22rpx; padding: 30rpx; border-radius: 30rpx; background: linear-gradient(145deg, rgba(255, 244, 235, 0.96) 0%, rgba(255, 251, 246, 0.98) 100%); border: 1rpx solid rgba(243, 111, 69, 0.14); box-shadow: 0 14rpx 34rpx rgba(31, 42, 55, 0.05); }
.assistant-status-title { display: block; font-size: 30rpx; font-weight: 800; color: #24303d; }
.assistant-status-desc { display: block; margin-top: 14rpx; font-size: 24rpx; line-height: 1.75; color: #6d7887; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 18rpx; }
.section-title, .notice-title { font-size: 32rpx; font-weight: 800; color: #24303d; }
.section-caption { flex-shrink: 0; font-size: 22rpx; color: #8a96a3; }
.recent-card { margin-top: 22rpx; padding: 30rpx; border-radius: 30rpx; background: rgba(255, 255, 255, 0.86); box-shadow: 0 14rpx 34rpx rgba(31, 42, 55, 0.05); }
.recent-item + .recent-item { margin-top: 18rpx; }
.recent-item { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 20rpx; padding: 22rpx 24rpx; border-radius: 22rpx; background: #f7f9fc; }
.recent-copy { flex: 1; }
.recent-title { display: block; font-size: 26rpx; line-height: 1.55; font-weight: 700; color: #25303c; }
.recent-meta { display: block; margin-top: 8rpx; font-size: 22rpx; color: #7a8592; }
.recent-action { flex-shrink: 0; font-size: 24rpx; font-weight: 700; color: #f36f45; }
.secondary-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18rpx; margin-top: 22rpx; }
.secondary-card { min-height: 168rpx; padding: 26rpx; border-radius: 26rpx; background: rgba(255, 255, 255, 0.82); box-shadow: 0 12rpx 30rpx rgba(31, 42, 55, 0.05); }
.secondary-card-title { display: block; font-size: 28rpx; font-weight: 700; color: #25303c; }
.secondary-card-desc, .notice-text { display: block; margin-top: 14rpx; font-size: 24rpx; line-height: 1.7; color: #687588; }
.notice-card { margin-top: 22rpx; padding: 30rpx; border-radius: 30rpx; background: rgba(255, 255, 255, 0.86); box-shadow: 0 14rpx 34rpx rgba(31, 42, 55, 0.05); }
</style>
