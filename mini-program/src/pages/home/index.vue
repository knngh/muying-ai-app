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
        <text class="trust-strip-text">先查权威资料，再安排本周重点与记录</text>
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
        <view class="quick-card quick-card--soft" @tap="navigateTo('/pages/calendar/index')">
          <text class="quick-card-title">看本周安排</text>
          <text class="quick-card-desc">查看孕周重点、待办和本周记录，完成状态实时更新。</text>
        </view>
        <view class="quick-card quick-card--warm" @tap="navigateTo('/pages/pregnancy-profile/index')">
          <text class="quick-card-title">完善孕周档案</text>
          <text class="quick-card-desc">补充当前阶段后，首页、日历和知识库会自动贴近你的进度。</text>
        </view>
      </view>

      <view class="stage-recommend-card">
        <view class="section-head">
          <view>
            <text class="section-title">{{ stageRecommendTitle }}</text>
            <text class="section-caption section-caption--block">{{ stageRecommendCaption }}</text>
          </view>
          <view class="stage-recommend-badge">
            <text class="stage-recommend-badge-text">{{ stageRecommendBadge }}</text>
          </view>
        </view>

        <view class="stage-topic-grid">
          <view
            v-for="item in stageRecommendItems"
            :key="item.key"
            class="stage-topic-card"
            @tap="openStageRecommendation(item)"
          >
            <text class="stage-topic-title">{{ item.title }}</text>
            <text class="stage-topic-desc">{{ item.desc }}</text>
            <text class="stage-topic-action">去知识库筛选</text>
          </view>
        </view>
      </view>

      <view class="assistant-status-card">
        <text class="assistant-status-title">当前能力范围</text>
        <text class="assistant-status-desc">当前小程序先聚焦权威知识库、孕周日历和基础档案。阅读问答能力暂不在小程序上线，后续会在安全提示和来源能力更稳定后再开放。</text>
      </view>

      <view v-if="recentAiHitArticles.length" class="recent-ai-card">
        <view class="section-head">
          <view>
            <text class="section-title">最近权威线索</text>
            <text class="section-caption section-caption--block">回到最近命中的权威内容继续阅读</text>
          </view>
          <view class="recent-ai-link" @tap="navigateTo('/pages/knowledge/index')">
            <text class="recent-ai-link-text">去知识库</text>
          </view>
        </view>

        <view
          v-for="item in recentAiHitArticles"
          :key="item.slug"
          class="recent-ai-item"
          @tap="openRecentAiHit(item)"
        >
          <view class="recent-ai-copy">
            <text class="recent-ai-title">{{ item.title }}</text>
            <text class="recent-ai-meta">
              {{ item.sourceLabel }}
              <text v-if="item.topicLabel"> · {{ item.topicLabel }}</text>
              · {{ item.hitLabel }}
            </text>
          </view>
          <text class="recent-ai-action">继续看</text>
        </view>

        <view v-if="recentAiHitTopics.length || recentAiHitSources.length" class="recent-ai-chip-panel">
          <view v-if="recentAiHitTopics.length" class="recent-ai-chip-row">
            <text class="recent-ai-chip-label">按主题继续</text>
            <view
              v-for="item in recentAiHitTopics"
              :key="`topic-${item.displayName}`"
              class="recent-ai-topic-chip"
              @tap="openRecentAiTopic(item)"
            >
              <text class="recent-ai-chip-name">{{ item.displayName }}</text>
              <text class="recent-ai-chip-count">{{ item.count }} 次</text>
            </view>
          </view>

          <view v-if="recentAiHitSources.length" class="recent-ai-chip-row">
            <text class="recent-ai-chip-label">按机构继续</text>
            <view
              v-for="item in recentAiHitSources"
              :key="`source-${item.displayName}`"
              class="recent-ai-source-chip"
              @tap="openRecentAiSource(item)"
            >
              <text class="recent-ai-chip-name">{{ item.displayName }}</text>
              <text class="recent-ai-chip-count">{{ item.count }} 次</text>
            </view>
          </view>
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
import { useKnowledgeStore, type RecentAIHitArticle } from '@/stores/knowledge'
import { calculatePregnancyWeekFromDueDate } from '@/utils'
import { formatSourceLabel } from '@/utils/knowledge-format'
import { trackMiniEvent } from '@/utils/analytics'

const appStore = useAppStore()
const knowledgeStore = useKnowledgeStore()
const RECENT_KNOWLEDGE_STORAGE_KEY = 'recentKnowledgeArticles'
const RECENT_AI_HIT_ARTICLES_KEY = 'knowledgeRecentAiHitArticles'

interface RecentKnowledgeItem {
  slug: string
  title: string
  sourceLabel: string
  updatedAtLabel: string
}

interface HomeRecentAiHitItem extends RecentAIHitArticle {
  sourceLabel: string
  topicLabel: string
  hitLabel: string
}

interface HomeRecentAiTopic {
  topic: string
  displayName: string
  count: number
  sample: HomeRecentAiHitItem
}

interface HomeRecentAiSource {
  source: string
  displayName: string
  count: number
  sample: HomeRecentAiHitItem
}

interface StageRecommendationItem {
  key: string
  title: string
  desc: string
  keyword: string
  stage: string | null
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
const recentKnowledge = ref<RecentKnowledgeItem[]>([])
const recentAiHitArticles = ref<HomeRecentAiHitItem[]>([])

function formatRecentHitTime(value?: string) {
  if (!value) return '刚刚命中'

  const diffMs = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diffMs) || diffMs < 0) return '刚刚命中'

  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return '刚刚命中'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前命中`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} 小时前命中`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} 天前命中`
}

function buildRecentAIHitTopics(items: HomeRecentAiHitItem[]): HomeRecentAiTopic[] {
  const topicMap = new Map<string, HomeRecentAiTopic>()

  items.forEach((item) => {
    const displayName = (item.topic || '').trim()
    if (!displayName) {
      return
    }

    const key = displayName.toLowerCase()
    const existing = topicMap.get(key)
    if (existing) {
      existing.count += 1
      return
    }

    topicMap.set(key, {
      topic: item.topic || displayName,
      displayName,
      count: 1,
      sample: item,
    })
  })

  return Array.from(topicMap.values())
    .sort((left, right) => right.count - left.count || left.displayName.localeCompare(right.displayName, 'zh-CN'))
    .slice(0, 3)
}

function buildRecentAIHitSources(items: HomeRecentAiHitItem[]): HomeRecentAiSource[] {
  const sourceMap = new Map<string, HomeRecentAiSource>()

  items.forEach((item) => {
    const rawSource = (item.sourceOrg || item.source || '').trim()
    const displayName = formatSourceLabel(rawSource)
    if (!displayName) {
      return
    }

    const key = displayName.toLowerCase()
    const existing = sourceMap.get(key)
    if (existing) {
      existing.count += 1
      return
    }

    sourceMap.set(key, {
      source: rawSource || displayName,
      displayName,
      count: 1,
      sample: item,
    })
  })

  return Array.from(sourceMap.values())
    .sort((left, right) => right.count - left.count || left.displayName.localeCompare(right.displayName, 'zh-CN'))
    .slice(0, 3)
}

const syncHomeState = () => {
  uni.removeStorageSync('pendingChatDraft')
  uni.removeStorageSync('recentChatQuestions')
  sessionLoggedIn.value = Boolean(uni.getStorageSync('token'))
  const rawWeek = Number.parseInt(String(uni.getStorageSync('userPregnancyWeek') || ''), 10)
  storedWeek.value = !Number.isNaN(rawWeek) && rawWeek >= 1 && rawWeek <= 40 ? rawWeek : null
  const storedRecent = uni.getStorageSync(RECENT_KNOWLEDGE_STORAGE_KEY) as RecentKnowledgeItem[] | null
  recentKnowledge.value = Array.isArray(storedRecent) ? storedRecent.slice(0, 3) : []
  const storedAiHits = uni.getStorageSync(RECENT_AI_HIT_ARTICLES_KEY) as Array<{
    articleId?: number
    slug?: string
    title?: string
    summary?: string
    source?: string
    sourceOrg?: string
    topic?: string
    stage?: string
    publishedAt?: string
    sourceUpdatedAt?: string
    createdAt?: string
    lastHitAt?: string
    sourceLanguage?: string
    sourceLocale?: string
    trigger?: string
    matchReason?: string
    originEntrySource?: string
    originReportId?: string
    qaId?: string
  }> | null
  recentAiHitArticles.value = Array.isArray(storedAiHits)
    ? storedAiHits
      .filter(item => item?.slug && item?.title && Number.isFinite(item?.articleId))
      .slice(0, 2)
      .map(item => ({
        articleId: Number(item.articleId),
        slug: item.slug || '',
        title: item.title || '',
        summary: item.summary || '',
        source: item.source,
        sourceOrg: item.sourceOrg,
        topic: item.topic,
        stage: item.stage,
        publishedAt: item.publishedAt,
        sourceUpdatedAt: item.sourceUpdatedAt,
        createdAt: item.createdAt || new Date().toISOString(),
        lastHitAt: item.lastHitAt || new Date().toISOString(),
        sourceLabel: formatSourceLabel(item.sourceOrg || item.source || '权威来源'),
        topicLabel: item.topic?.trim() || '',
        hitLabel: formatRecentHitTime(item.lastHitAt),
        sourceLanguage: item.sourceLanguage === 'zh' || item.sourceLanguage === 'en' ? item.sourceLanguage : undefined,
        sourceLocale: item.sourceLocale,
        trigger: item.trigger === 'hit_card' || item.trigger === 'knowledge_action' ? item.trigger : undefined,
        matchReason: item.matchReason === 'entry_meta'
          || item.matchReason === 'source_url'
          || item.matchReason === 'source_title'
          || item.matchReason === 'source_keyword'
          ? item.matchReason
          : undefined,
        originEntrySource: item.originEntrySource,
        originReportId: item.originReportId,
        qaId: item.qaId,
      }))
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
    ? '知识库、孕周安排和个人记录会围绕你当前阶段提供更贴近的内容。'
    : '不登录也可以先浏览知识库和孕周日历；需要保存记录时再进入登录。'
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
const recentAiHitTopics = computed(() => buildRecentAIHitTopics(recentAiHitArticles.value))
const recentAiHitSources = computed(() => buildRecentAIHitSources(recentAiHitArticles.value))

const focusCaption = computed(() => (
  currentWeek.value ? `围绕第 ${currentWeek.value} 周的实际使用场景` : '适合首次进入时的最小使用路径'
))

function getStageRecommendationItems(week?: number | null): StageRecommendationItem[] {
  if (!week) {
    return [
      {
        key: 'start-stage',
        title: '先补当前阶段',
        desc: '先确认自己处于备孕、孕期还是产后，再去读对应资料更省时间。',
        keyword: '孕期 阶段 产检 新手指南',
        stage: null,
      },
      {
        key: 'authority-start',
        title: '先看权威来源',
        desc: '从中国政府网、国家卫健委和中国疾控的公开资料开始，减少经验帖干扰。',
        keyword: '国家卫健委 中国疾控 孕产 指南',
        stage: null,
      },
      {
        key: 'newborn-start',
        title: '新生儿常见问题',
        desc: '提前熟悉喂养、黄疸、疫苗和睡眠主题，后面进入对应阶段会更快。',
        keyword: '新生儿 喂养 黄疸 疫苗 睡眠',
        stage: 'newborn',
      },
    ]
  }

  if (week <= 12) {
    return [
      {
        key: 'early-risk',
        title: '孕早期风险信号',
        desc: '优先读出血、腹痛、孕吐和何时需要尽快线下就医。',
        keyword: '孕早期 出血 腹痛 孕吐 就医',
        stage: 'first-trimester',
      },
      {
        key: 'early-checkup',
        title: '叶酸与首次产检',
        desc: '先把叶酸补充、建档和初次产检节点看清楚。',
        keyword: '叶酸 建档 初次产检 早孕',
        stage: 'first-trimester',
      },
      {
        key: 'early-lifestyle',
        title: '饮食和生活方式',
        desc: '重点看忌口、补剂、休息和早孕期日常注意事项。',
        keyword: '孕早期 饮食 补剂 休息 注意事项',
        stage: 'first-trimester',
      },
    ]
  }

  if (week <= 27) {
    return [
      {
        key: 'mid-checkup',
        title: '产检节点与报告',
        desc: '把中期检查、常见指标和复查时机串起来看。',
        keyword: '孕中期 产检 报告 糖耐 B超',
        stage: 'second-trimester',
      },
      {
        key: 'mid-nutrition',
        title: '体重与营养安排',
        desc: '优先看营养补充、体重管理和运动建议。',
        keyword: '孕中期 营养 体重 运动',
        stage: 'second-trimester',
      },
      {
        key: 'mid-fetal-movement',
        title: '胎动与身体变化',
        desc: '先把胎动观察、宫缩区别和异常信号理顺。',
        keyword: '胎动 宫缩 孕中期 异常信号',
        stage: 'second-trimester',
      },
    ]
  }

  return [
    {
      key: 'late-delivery',
      title: '临近分娩准备',
      desc: '优先读入院信号、待产包和家人分工。',
      keyword: '孕晚期 入院信号 待产包 分娩准备',
      stage: 'third-trimester',
    },
    {
      key: 'late-breastfeeding',
      title: '哺乳与新生儿护理',
      desc: '先把产后喂养、皮肤接触和新生儿护理的基础内容看一遍。',
      keyword: '哺乳 新生儿护理 产后 喂养',
      stage: 'third-trimester',
    },
    {
      key: 'late-warning',
      title: '宫缩与异常情况',
      desc: '重点区分规律宫缩、破水和需要尽快处理的异常信号。',
      keyword: '孕晚期 宫缩 破水 胎动 异常',
      stage: 'third-trimester',
    },
  ]
}

const stageRecommendItems = computed(() => getStageRecommendationItems(currentWeek.value))
const stageRecommendTitle = computed(() => (
  currentWeek.value ? `第 ${currentWeek.value} 周优先查这些` : '第一次来先从这些开始'
))
const stageRecommendCaption = computed(() => (
  currentWeek.value
    ? '先按当前孕周把高频主题看准，再进入知识库继续缩小范围。'
    : '先用几个高频入口熟悉知识库结构，再决定接下来补什么信息。'
))
const stageRecommendBadge = computed(() => (
  currentWeek.value ? pregnancyStageLabel.value : '冷启动'
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
      { index: '03', title: '补齐阶段档案', desc: '保存孕周后，首页和日历会更准确地贴合你当前这一阶段。' },
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

function openRecentKnowledge(slug: string) {
  uni.navigateTo({ url: `/pages/knowledge-detail/index?slug=${encodeURIComponent(slug)}` })
}

function openRecentAiHit(item: HomeRecentAiHitItem) {
  trackMiniEvent('app_knowledge_recent_ai_hit_click', {
    page: 'HomePage',
    properties: {
      entrySource: item.originEntrySource || null,
      articleSlug: item.slug,
      qaId: item.qaId || null,
      trigger: item.trigger || null,
      matchReason: item.matchReason || null,
      reportId: item.originReportId || null,
    },
  })

  const shouldWarmTranslation = item.sourceLanguage !== 'zh' && item.sourceLocale !== 'zh-CN' ? '1' : '0'
  const params = [
    `slug=${encodeURIComponent(item.slug)}`,
    `translation=${shouldWarmTranslation}`,
    'source=chat_hit',
    `trigger=${encodeURIComponent(item.trigger || '')}`,
    `matchReason=${encodeURIComponent(item.matchReason || '')}`,
    `originEntrySource=${encodeURIComponent(item.originEntrySource || '')}`,
    `originReportId=${encodeURIComponent(item.originReportId || '')}`,
    `qaId=${encodeURIComponent(item.qaId || '')}`,
  ].join('&')
  uni.navigateTo({ url: `/pages/knowledge-detail/index?${params}` })
}

async function openRecentAiTopic(item: HomeRecentAiTopic) {
  trackMiniEvent('app_knowledge_recent_ai_topic_click', {
    page: 'HomePage',
    properties: {
      topic: item.topic,
      displayName: item.displayName,
      hitCount: item.count,
      entrySource: item.sample.originEntrySource || null,
      articleSlug: item.sample.slug,
      reportId: item.sample.originReportId || null,
      qaId: item.sample.qaId || null,
    },
  })

  try {
    await knowledgeStore.applyFilters({
      keyword: item.displayName,
      source: 'all',
      stage: item.sample.stage || null,
    })
  } finally {
    uni.switchTab({ url: '/pages/knowledge/index' })
  }
}

async function openRecentAiSource(item: HomeRecentAiSource) {
  trackMiniEvent('app_knowledge_recent_ai_source_click', {
    page: 'HomePage',
    properties: {
      sourceOrg: item.source,
      displayName: item.displayName,
      hitCount: item.count,
      entrySource: item.sample.originEntrySource || null,
      articleSlug: item.sample.slug,
      reportId: item.sample.originReportId || null,
      qaId: item.sample.qaId || null,
    },
  })

  try {
    await knowledgeStore.applyFilters({
      keyword: item.source,
      source: 'all',
      stage: item.sample.stage || null,
    })
  } finally {
    uni.switchTab({ url: '/pages/knowledge/index' })
  }
}

async function openStageRecommendation(item: StageRecommendationItem) {
  try {
    await knowledgeStore.applyFilters({
      keyword: item.keyword,
      source: 'all',
      stage: item.stage,
    })
  } finally {
    uni.switchTab({ url: '/pages/knowledge/index' })
  }
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
.stage-recommend-card,
.recent-ai-card,
.assistant-status-card,
.notice-card {
  margin-top: 22rpx;
  padding: 30rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 14rpx 34rpx rgba(31, 42, 55, 0.05);
}

.stage-recommend-badge {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(47, 124, 246, 0.1);
}

.stage-recommend-badge-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #326ac8;
}

.stage-topic-grid {
  display: grid;
  gap: 16rpx;
  margin-top: 20rpx;
}

.stage-topic-card {
  padding: 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(145deg, #eef5ff 0%, #f9fbff 100%);
}

.stage-topic-title {
  display: block;
  font-size: 28rpx;
  line-height: 1.5;
  font-weight: 700;
  color: #24303d;
}

.stage-topic-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 23rpx;
  line-height: 1.65;
  color: #667486;
}

.stage-topic-action {
  display: block;
  margin-top: 14rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: #326ac8;
}

.assistant-status-card {
  background: linear-gradient(145deg, rgba(255, 244, 235, 0.96) 0%, rgba(255, 251, 246, 0.98) 100%);
  border: 1rpx solid rgba(243, 111, 69, 0.14);
}

.assistant-status-title {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
  color: #24303d;
}

.assistant-status-desc {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.75;
  color: #6d7887;
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

.section-caption--block {
  display: block;
  margin-top: 6rpx;
}

.recent-ai-link {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(31, 143, 116, 0.1);
}

.recent-ai-link-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #16735d;
}

.recent-ai-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 22rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(145deg, #fff7f0 0%, #fffcf8 100%);
}

.recent-ai-copy {
  flex: 1;
}

.recent-ai-title {
  display: block;
  font-size: 28rpx;
  line-height: 1.55;
  font-weight: 700;
  color: #24303d;
}

.recent-ai-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 1.55;
  color: #7a8697;
}

.recent-ai-action {
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 700;
  color: #f36f45;
}

.recent-ai-chip-panel {
  margin-top: 18rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.82);
}

.recent-ai-chip-row + .recent-ai-chip-row {
  margin-top: 16rpx;
}

.recent-ai-chip-label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: #7a8697;
}

.recent-ai-topic-chip,
.recent-ai-source-chip {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  margin-right: 12rpx;
  margin-bottom: 12rpx;
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
}

.recent-ai-topic-chip {
  background: rgba(31, 143, 116, 0.1);
}

.recent-ai-source-chip {
  background: rgba(243, 111, 69, 0.1);
}

.recent-ai-chip-name {
  font-size: 23rpx;
  font-weight: 700;
  color: #324255;
}

.recent-ai-chip-count {
  font-size: 21rpx;
  color: #7a8697;
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
