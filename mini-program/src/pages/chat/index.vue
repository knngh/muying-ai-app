<template>
  <view class="chat-page">
    <view class="hero">
      <view class="hero-copy">
        <text class="hero-title">问题助手</text>
        <text class="hero-subtitle">把您此刻最担心的情况告诉我，我会先帮您整理可参考信息和下一步关注点。</text>
      </view>
      <view class="hero-badge">Beta</view>
    </view>

    <view class="notice-card">
      <view class="notice-head">
        <text class="notice-title">免责声明</text>
      </view>
      <text user-select class="notice-text">{{ disclaimer }}</text>
    </view>

    <scroll-view
      class="chat-scroll"
      scroll-y
      :scroll-into-view="scrollAnchor"
      :scroll-top="scrollTop"
      scroll-with-animation
    >
      <view v-if="messages.length === 0" class="empty-state">
        <text v-if="loadingHistory" class="empty-loading">正在恢复最近一次对话...</text>
        <view class="empty-illustration">
          <text class="empty-emoji">🍼</text>
        </view>
        <text class="empty-title">您可以先说说现在最担心的问题</text>
        <text class="empty-subtitle">例如作息安排、喂养节奏、辅食添加，或新生儿日常护理中的具体情况。</text>

        <view v-if="prefillQuestion" class="prefill-box">
          <text class="prefill-title">已为你准备好一个问题草稿</text>
          <text class="prefill-text">{{ prefillQuestion }}</text>
          <view class="prefill-actions">
            <view class="prefill-btn prefill-btn--primary" @tap="handleSend">
              <text class="prefill-btn-text prefill-btn-text--primary">直接发送</text>
            </view>
            <view class="prefill-btn" @tap="clearPrefillQuestion">
              <text class="prefill-btn-text">我自己改一下</text>
            </view>
          </view>
        </view>

        <view v-if="recentQuestions.length" class="recent-question-panel">
          <text class="recent-question-title">最近问过</text>
          <view class="recent-question-list">
            <view
              v-for="item in recentQuestions"
              :key="item.question"
              class="recent-question-item"
              hover-class="recent-question-item--hover"
              @tap="applyPrefillQuestion(item.question)"
            >
              <text class="recent-question-text">{{ item.question }}</text>
            </view>
          </view>
        </view>

        <view class="quick-list">
          <view
            v-for="question in quickQuestions"
            :key="question"
            class="quick-chip"
            hover-class="quick-chip--hover"
            @tap="handleQuickQuestion(question)"
          >
            <text class="quick-chip-text">{{ question }}</text>
          </view>
        </view>
      </view>

      <view v-else class="message-list">
        <view
          v-for="item in messages"
          :id="`msg-${item.id}`"
          :key="item.id"
          class="message-row"
          :class="item.role === 'user' ? 'message-row--user' : 'message-row--assistant'"
        >
          <view class="avatar" :class="item.role === 'user' ? 'avatar--user' : 'avatar--assistant'">
            <text class="avatar-text">{{ item.role === 'user' ? '我' : '助' }}</text>
          </view>

          <view
            class="bubble"
            :class="item.role === 'user' ? 'bubble--user' : 'bubble--assistant'"
          >
            <text v-if="item.role === 'user'" user-select class="bubble-text">{{ getDisplayedContent(item) }}</text>
            <view v-else class="bubble-html">
              <mp-html :content="getDisplayedContent(item)" :copy-link="true" :selectable="true" />
            </view>

            <view v-if="item.role === 'assistant' && getTrustChips(item).length" class="trust-chips">
              <text
                v-for="chip in getTrustChips(item)"
                :key="`${item.id}-${chip.label}`"
                class="trust-chip"
                :class="`trust-chip--${chip.tone}`"
              >
                {{ chip.label }}
              </text>
            </view>

            <view v-if="item.role === 'assistant' && shouldShowTrustOverview(item)" class="trust-overview">
              <text class="trust-overview-title">本轮可信判断</text>
              <text v-if="item.sourceReliability" class="trust-overview-text">
                证据层级：{{ getReliabilityLabel(item.sourceReliability) }}
              </text>
              <text v-if="item.route" class="trust-overview-text">
                执行路径：{{ getRouteLabel(item.route) }}
              </text>
              <text v-if="getAuthoritySourceCount(item) > 0" class="trust-overview-text">
                命中权威来源：{{ getAuthoritySourceCount(item) }} 条
              </text>
              <text v-if="getChineseAuthoritySourceCount(item) > 0" class="trust-overview-text">
                其中中文权威来源：{{ getChineseAuthoritySourceCount(item) }} 条
              </text>
              <text v-if="item.structuredAnswer?.conclusion" user-select class="trust-overview-conclusion">
                {{ item.structuredAnswer.conclusion }}
              </text>
            </view>

            <view v-if="item.role === 'assistant' && item.uncertainty?.message" class="uncertainty-card">
              <text class="uncertainty-title">不确定性说明</text>
              <text user-select class="uncertainty-text">{{ item.uncertainty.message }}</text>
            </view>

            <view v-if="item.role === 'assistant'" class="answer-origin">
              <text class="answer-origin-label">答案来源</text>
              <text user-select class="answer-origin-text">{{ getAnswerOrigin(item) }}</text>
            </view>

            <view v-if="item.role === 'assistant' && shouldShowActionPlan(item)" class="action-plan">
              <text class="action-plan-title">建议怎么用这条回答</text>
              <view v-if="item.structuredAnswer?.reasons?.length" class="action-plan-block">
                <text class="action-plan-label">为什么这样判断</text>
                <text
                  v-for="reason in item.structuredAnswer.reasons"
                  :key="`${item.id}-reason-${reason}`"
                  user-select
                  class="action-plan-item"
                >
                  {{ reason }}
                </text>
              </view>
              <view v-if="item.structuredAnswer?.actions?.length" class="action-plan-block">
                <text class="action-plan-label">现在可以先做</text>
                <text
                  v-for="action in item.structuredAnswer.actions"
                  :key="`${item.id}-action-${action}`"
                  user-select
                  class="action-plan-item"
                >
                  {{ action }}
                </text>
              </view>
              <view v-if="item.structuredAnswer?.whenToSeekCare?.length" class="action-plan-block">
                <text class="action-plan-label">出现这些情况尽快线下处理</text>
                <text
                  v-for="trigger in item.structuredAnswer.whenToSeekCare"
                  :key="`${item.id}-care-${trigger}`"
                  user-select
                  class="action-plan-item action-plan-item--alert"
                >
                  {{ trigger }}
                </text>
              </view>
            </view>

            <view v-if="item.sources?.length" class="source-list-container">
              <text class="source-title">具体参考来源</text>
              <view v-if="getChineseOfficialSources(item).length" class="source-group">
                <text class="source-group-title">中国权威依据</text>
                <scroll-view scroll-x class="source-list-scroll">
                  <view class="source-list-inner">
                    <view
                      v-for="source in getChineseOfficialSources(item)"
                      :key="`${item.id}-official-cn-${source.title}`"
                      class="source-card"
                      :class="`source-card--${getOfficialRegionTag(source)}`"
                    >
                      <text class="source-region-chip" :class="`source-region-chip--${getOfficialRegionTag(source)}`">{{ getOfficialRegionLabel(source) }}</text>
                      <text user-select class="source-name">{{ source.title }}</text>
                      <text user-select class="source-meta">{{ formatSourceMeta(source) }}</text>
                      <text v-if="source.excerpt" user-select class="source-excerpt">{{ source.excerpt }}</text>
                      <view
                        v-if="source.url"
                        class="source-link"
                        hover-class="source-link--hover"
                        @tap="handleOpenSource(source)"
                      >
                        <text class="source-link-text">查看原文</text>
                      </view>
                    </view>
                  </view>
                </scroll-view>
              </view>

              <view v-if="getGlobalOfficialSources(item).length" class="source-group">
                <text class="source-group-title">国际权威依据</text>
                <scroll-view scroll-x class="source-list-scroll">
                  <view class="source-list-inner">
                    <view
                      v-for="source in getGlobalOfficialSources(item)"
                      :key="`${item.id}-official-global-${source.title}`"
                      class="source-card"
                      :class="`source-card--${getOfficialRegionTag(source)}`"
                    >
                      <text class="source-region-chip" :class="`source-region-chip--${getOfficialRegionTag(source)}`">{{ getOfficialRegionLabel(source) }}</text>
                      <text user-select class="source-name">{{ source.title }}</text>
                      <text user-select class="source-meta">{{ formatSourceMeta(source) }}</text>
                      <text v-if="source.excerpt" user-select class="source-excerpt">{{ source.excerpt }}</text>
                      <view
                        v-if="source.url"
                        class="source-link"
                        hover-class="source-link--hover"
                        @tap="handleOpenSource(source)"
                      >
                        <text class="source-link-text">查看原文</text>
                      </view>
                    </view>
                  </view>
                </scroll-view>
              </view>

              <view v-if="getMedicalPlatformSources(item).length" class="source-group">
                <text class="source-group-title">平台补充依据</text>
                <scroll-view scroll-x class="source-list-scroll">
                  <view class="source-list-inner">
                    <view
                      v-for="source in getMedicalPlatformSources(item)"
                      :key="`${item.id}-platform-${source.title}`"
                      class="source-card"
                    >
                      <text user-select class="source-name">{{ source.title }}</text>
                      <text user-select class="source-meta">{{ formatSourceMeta(source) }}</text>
                      <text v-if="source.excerpt" user-select class="source-excerpt">{{ source.excerpt }}</text>
                      <view
                        v-if="source.url"
                        class="source-link"
                        hover-class="source-link--hover"
                        @tap="handleOpenSource(source)"
                      >
                        <text class="source-link-text">查看原文</text>
                      </view>
                    </view>
                  </view>
                </scroll-view>
              </view>

              <view v-if="getOtherSources(item).length" class="source-group">
                <text class="source-group-title">其他来源</text>
                <scroll-view scroll-x class="source-list-scroll">
                  <view class="source-list-inner">
                    <view
                      v-for="source in getOtherSources(item)"
                      :key="`${item.id}-other-${source.title}`"
                      class="source-card"
                    >
                      <text user-select class="source-name">{{ source.title }}</text>
                      <text user-select class="source-meta">{{ formatSourceMeta(source) }}</text>
                      <text v-if="source.excerpt" user-select class="source-excerpt">{{ source.excerpt }}</text>
                      <view
                        v-if="source.url"
                        class="source-link"
                        hover-class="source-link--hover"
                        @tap="handleOpenSource(source)"
                      >
                        <text class="source-link-text">查看原文</text>
                      </view>
                    </view>
                  </view>
                </scroll-view>
              </view>
            </view>

            <view v-if="item.role === 'assistant' && getFollowUpQuestions(item).length" class="follow-up-card">
              <text class="follow-up-title">继续追问</text>
              <view class="follow-up-list">
                <view
                  v-for="question in getFollowUpQuestions(item)"
                  :key="`${item.id}-${question}`"
                  class="follow-up-chip"
                  hover-class="follow-up-chip--hover"
                  @tap="handleQuickQuestion(question)"
                >
                  <text class="follow-up-chip-text">{{ question }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view v-if="loading && streamingContent && !isResumingInPlace" class="message-row message-row--assistant">
          <view class="avatar avatar--assistant">
            <text class="avatar-text">助</text>
          </view>
          <view class="bubble bubble--assistant bubble--streaming">
            <text class="bubble-text">{{ streamingContent }}</text>
          </view>
        </view>

        <view v-else-if="loading && !isResumingInPlace" class="message-row message-row--assistant">
          <view class="avatar avatar--assistant">
            <text class="avatar-text">助</text>
          </view>
          <view class="bubble bubble--assistant bubble--loading">
            <view class="bouncing-dots">
              <view class="dot"></view>
              <view class="dot"></view>
              <view class="dot"></view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="error" class="error-bar">
        <text class="error-text">{{ error }}</text>
      </view>

      <view id="chat-bottom" class="bottom-anchor"></view>
    </scroll-view>

    <view class="composer">
      <view class="composer-shell">
        <view v-if="loading" class="composer-status">
          <text class="composer-status-text">正在整理信息</text>
          <text class="composer-status-subtext">可随时停止，保留当前内容</text>
        </view>

        <view class="composer-row">
      <textarea
        v-model="inputValue"
        class="composer-input"
        auto-height
        maxlength="2000"
        :disabled="loading"
        confirm-type="send"
        placeholder="您可以直接描述情况，越具体越容易得到更贴合的参考信息"
        @confirm="handleSend"
      />
      <view
        v-if="!loading && canResume"
        class="resume-button"
        hover-class="resume-button--hover"
        @tap="handleResume"
      >
        <text class="resume-button-text">恢复</text>
      </view>
      <view
        v-if="loading"
        class="stop-button"
        hover-class="stop-button--hover"
        @tap="handleStop"
      >
        <text class="stop-button-text">停止</text>
      </view>
      <view
        v-else
        class="send-button"
        :class="{ 'send-button--disabled': !canSend }"
        hover-class="send-button--hover"
        @tap="handleSend"
      >
        <text class="send-button-text">发送</text>
      </view>
        </view>
    </view>
      </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { onHide, onLoad, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { useChatStore } from '@/stores/chat'
import { getDisclaimer, type AIMessage, type SourceReference } from '@/api/ai'
import mpHtml from 'mp-html/dist/uni-app/components/mp-html/mp-html.vue'
import { features } from '@/config/features'
import { getAuthorityRegionLabel, getAuthorityRegionTag, isChineseAuthoritySource } from '@/utils/authority-source'

const quickQuestions = [
  '孕早期有哪些注意事项？',
  '宝宝作息怎么调整更顺一些？',
  '母乳喂养有哪些常见小问题？',
  '辅食添加一般怎么开始？',
]

const chatStore = useChatStore()
const { messages, loading, loadingHistory, error, streamingContent, canResume, resumeMessageId } = storeToRefs(chatStore)

const inputValue = ref('')
const prefillQuestion = ref('')
const disclaimer = getDisclaimer()
const scrollAnchor = ref('chat-bottom')
const scrollTop = ref(0)
const canSend = computed(() => inputValue.value.trim().length > 0 && !loading.value)
const isResumingInPlace = computed(() => loading.value && !!resumeMessageId.value)
const OFFICIAL_DOMAINS = [
  'gov.cn',
  'nhc.gov.cn',
  'ndcpa.gov.cn',
  'chinacdc.cn',
  'who.int',
  'nih.gov',
  'cdc.gov',
  'fda.gov',
  'aap.org',
  'nhs.uk',
  'mayoclinic.org',
]
const OFFICIAL_NAMES = [
  '国家卫健委',
  '中国政府网',
  '国家疾病预防控制局',
  '中国疾控',
  'who',
  'nih',
  'cdc',
  'fda',
  '美国儿科学会',
  'nhs',
  '梅奥',
]
const MEDICAL_PLATFORM_DOMAINS = [
  'dxy.com',
  'chunyuyisheng.com',
]
const MEDICAL_PLATFORM_NAMES = [
  '丁香医生',
  '春雨医生',
]
const CHAT_DRAFT_STORAGE_KEY = 'pendingChatDraft'
const RECENT_CHAT_QUESTIONS_STORAGE_KEY = 'recentChatQuestions'

interface RecentChatQuestionItem {
  question: string
  updatedAt: string
}

function redirectWhenAssistantDisabled() {
  uni.showToast({ title: '问题助手正在调整中', icon: 'none' })
  setTimeout(() => {
    uni.switchTab({ url: '/pages/home/index' })
  }, 600)
}

function syncScrollAnchor() {
  nextTick(() => {
    scrollAnchor.value = 'chat-bottom'
    scrollTop.value += 100000
  })
}

async function handleSend() {
  if (!features.aiQaAssistant) {
    redirectWhenAssistantDisabled()
    return
  }

  const content = inputValue.value.trim()
  if (!content || loading.value) {
    return
  }

  inputValue.value = ''
  await chatStore.sendMessage(content)
  syncScrollAnchor()
}

function handleStop() {
  if (!loading.value) {
    return
  }

  chatStore.stopGenerating()
  uni.showToast({ title: '已停止生成', icon: 'none' })
  syncScrollAnchor()
}

async function handleResume() {
  if (!features.aiQaAssistant) {
    redirectWhenAssistantDisabled()
    return
  }

  await chatStore.resumeLastAnswer()
  syncScrollAnchor()
}

function handleQuickQuestion(question: string) {
  prefillQuestion.value = question
  inputValue.value = question
  handleSend()
}

function applyPrefillQuestion(question?: string) {
  const trimmedQuestion = question?.trim() || ''
  if (!trimmedQuestion) {
    return
  }

  prefillQuestion.value = trimmedQuestion
  inputValue.value = trimmedQuestion
}

function clearPrefillQuestion() {
  prefillQuestion.value = ''
}

const recentQuestions = ref<RecentChatQuestionItem[]>([])

function syncRecentQuestions() {
  const stored = uni.getStorageSync(RECENT_CHAT_QUESTIONS_STORAGE_KEY) as RecentChatQuestionItem[] | null
  recentQuestions.value = Array.isArray(stored)
    ? stored.filter(item => item?.question?.trim()).slice(0, 3)
    : []
}

function getDisplayedContent(message: AIMessage) {
  if (isResumingInPlace.value && resumeMessageId.value === message.id) {
    return `${message.content}${streamingContent.value}`
  }

  return message.content
}

function getSourceHost(url?: string) {
  if (!url) {
    return ''
  }

  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function isAuthoritativeSource(source: SourceReference) {
  const host = getSourceHost(source.url)
  if (host && OFFICIAL_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`))) {
    return true
  }

  const sourceName = `${source.source || ''} ${source.sourceOrg || ''}`.toLowerCase()
  return OFFICIAL_NAMES.some(name => sourceName.includes(name))
}

function isMedicalPlatformSource(source: SourceReference) {
  const host = getSourceHost(source.url)
  if (host && MEDICAL_PLATFORM_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`))) {
    return true
  }

  const sourceName = `${source.source || ''} ${source.sourceOrg || ''}`.toLowerCase()
  return MEDICAL_PLATFORM_NAMES.some(name => sourceName.includes(name))
}

function getSourceClass(source: SourceReference): 'official' | 'medical_platform' | 'dataset' | 'unknown' {
  if (source.sourceClass === 'official' || source.sourceType === 'authority' || source.authoritative || isAuthoritativeSource(source)) {
    return 'official'
  }

  if (source.sourceClass === 'medical_platform' || source.sourceType === 'editorial' || isMedicalPlatformSource(source)) {
    return 'medical_platform'
  }

  if (source.sourceClass === 'dataset' || source.sourceType === 'dataset') {
    return 'dataset'
  }

  return 'unknown'
}

function getSortedSources(message: AIMessage) {
  return [...(message.sources || [])].sort((left, right) => {
    const priorityMap = {
      official: 0,
      medical_platform: 1,
      dataset: 2,
      unknown: 3,
    } as const
    const classGap = priorityMap[getSourceClass(left)] - priorityMap[getSourceClass(right)]
    if (classGap !== 0) {
      return classGap
    }

    return (right.relevance || 0) - (left.relevance || 0)
  })
}

function getOfficialSources(message: AIMessage) {
  return getSortedSources(message).filter(source => getSourceClass(source) === 'official')
}

function getChineseOfficialSources(message: AIMessage) {
  return getOfficialSources(message).filter(source => isChineseAuthoritySource({
    source: source.source,
    sourceOrg: source.sourceOrg,
    sourceUrl: source.url,
    url: source.url,
    region: source.region,
    title: source.title,
  }))
}

function getGlobalOfficialSources(message: AIMessage) {
  return getOfficialSources(message).filter(source => !isChineseAuthoritySource({
    source: source.source,
    sourceOrg: source.sourceOrg,
    sourceUrl: source.url,
    url: source.url,
    region: source.region,
    title: source.title,
  }))
}

function getMedicalPlatformSources(message: AIMessage) {
  return getSortedSources(message).filter(source => getSourceClass(source) === 'medical_platform')
}

function getOtherSources(message: AIMessage) {
  return getSortedSources(message).filter(source => {
    const sourceClass = getSourceClass(source)
    return sourceClass === 'dataset' || sourceClass === 'unknown'
  })
}

function getAnswerOrigin(message: AIMessage) {
  if (message.isEmergency) {
    return '当前回答已按系统规则优先整理参考建议。'
  }

  if (message.sourceReliability === 'authoritative') {
    return getChineseAuthoritySourceCount(message) > 0
      ? '当前回答已优先展示中国权威来源，并按需补充国际权威资料。'
      : '当前回答已优先展示权威来源。'
  }

  if (message.sourceReliability === 'mixed') {
    return getChineseAuthoritySourceCount(message) > 0
      ? '当前回答优先参考中国权威来源，并补充国际指南、平台医学内容或知识库信息。'
      : '当前回答优先参考官方权威来源，并补充了平台医学内容或知识库信息。'
  }

  if (message.sourceReliability === 'medical_platform_only') {
    return '当前回答主要参考第三方医学平台内容，可作辅助参考，但不属于官方指南。'
  }

  if (message.sourceReliability === 'dataset_only') {
    return '当前回答主要基于内部知识库或公开问答数据，不属于权威指南。'
  }

  const authoritativeLabels = Array.from(new Set(
    getSortedSources(message)
      .filter((source) => getSourceClass(source) === 'official')
      .map((source) => {
        const sourceName = source.source?.trim()
        const title = source.title?.trim()
        if (sourceName && title) {
          return `${sourceName}《${title}》`
        }
        return title || sourceName || ''
      })
      .filter(Boolean),
  ))

  if (authoritativeLabels.length) {
    return authoritativeLabels.slice(0, 3).join('；')
  }

  const sourceLabels = Array.from(new Set(
    getSortedSources(message)
      .map((source) => {
        const sourceName = source.source?.trim()
        const title = source.title?.trim()
        if (sourceName && title) {
          return `${sourceName}《${title}》`
        }
        return title || sourceName || ''
      })
      .filter(Boolean),
  ))

  if (sourceLabels.length) {
    return sourceLabels.slice(0, 3).join('；')
  }

  if (message.degraded) {
    return '当前回答未附带明确权威来源，请谨慎参考并结合线下专业意见判断。'
  }

  return '当前回答未附带明确权威来源，请谨慎参考并结合线下专业意见判断。'
}

function getReliabilityLabel(sourceReliability?: AIMessage['sourceReliability']) {
  if (sourceReliability === 'authoritative') return '权威来源优先'
  if (sourceReliability === 'mixed') return '权威 + 补充来源'
  if (sourceReliability === 'medical_platform_only') return '平台医学内容'
  if (sourceReliability === 'dataset_only') return '知识库兜底'
  return '未命中可靠来源'
}

function getRiskLevelLabel(riskLevel?: AIMessage['riskLevel']) {
  if (riskLevel === 'red') return '需尽快线下处理'
  if (riskLevel === 'yellow') return '建议重点观察'
  if (riskLevel === 'green') return '可先居家参考'
  return ''
}

function getTriageCategoryLabel(triageCategory?: AIMessage['triageCategory']) {
  if (triageCategory === 'emergency') return '紧急分流'
  if (triageCategory === 'caution') return '需要谨慎判断'
  if (triageCategory === 'out_of_scope') return '超出直接建议范围'
  if (triageCategory === 'normal') return '一般咨询'
  return ''
}

function getConfidenceLabel(confidence?: number) {
  if (typeof confidence !== 'number') return ''
  if (confidence >= 0.85) return '把握较高'
  if (confidence >= 0.65) return '把握中等'
  return '把握有限'
}

function getRouteLabel(route?: AIMessage['route']) {
  if (route === 'trusted_rag') return '可信检索'
  if (route === 'safety_fallback') return '保守兜底'
  if (route === 'emergency') return '规则处理'
  return route || '直接回答'
}

function getAuthoritySourceCount(message: AIMessage) {
  return getOfficialSources(message).length
}

function getChineseAuthoritySourceCount(message: AIMessage) {
  return getChineseOfficialSources(message).length
}

function shouldShowTrustOverview(message: AIMessage) {
  return Boolean(message.sourceReliability || message.route || message.structuredAnswer?.conclusion || getAuthoritySourceCount(message) > 0)
}

function shouldShowActionPlan(message: AIMessage) {
  return Boolean(
    message.structuredAnswer?.reasons?.length
    || message.structuredAnswer?.actions?.length
    || message.structuredAnswer?.whenToSeekCare?.length,
  )
}

function getFollowUpQuestions(message: AIMessage) {
  return (message.followUpQuestions || []).filter(Boolean).slice(0, 3)
}

function getTrustChips(message: AIMessage) {
  const chips: Array<{ label: string; tone: 'warm' | 'blue' | 'green' | 'red' | 'muted' }> = []
  if (message.sourceReliability) {
    chips.push({
      label: getReliabilityLabel(message.sourceReliability),
      tone: message.sourceReliability === 'authoritative' ? 'green' : message.sourceReliability === 'mixed' ? 'blue' : 'warm',
    })
  }

  if (message.riskLevel) {
    chips.push({
      label: getRiskLevelLabel(message.riskLevel),
      tone: message.riskLevel === 'red' ? 'red' : message.riskLevel === 'yellow' ? 'warm' : 'green',
    })
  }

  if (message.triageCategory && message.triageCategory !== 'normal') {
    chips.push({
      label: getTriageCategoryLabel(message.triageCategory),
      tone: message.triageCategory === 'emergency' ? 'red' : 'muted',
    })
  }

  if (message.route) {
    chips.push({
      label: getRouteLabel(message.route),
      tone: 'muted',
    })
  }

  const confidenceLabel = getConfidenceLabel(message.confidence)
  if (confidenceLabel) {
    chips.push({
      label: confidenceLabel,
      tone: 'blue',
    })
  }

  return chips.slice(0, 4)
}

function getOfficialRegionLabel(source: SourceReference) {
  return getAuthorityRegionLabel({
    source: source.source,
    sourceOrg: source.sourceOrg,
    sourceUrl: source.url,
    url: source.url,
    region: source.region,
    title: source.title,
  })
}

function getOfficialRegionTag(source: SourceReference) {
  return getAuthorityRegionTag({
    source: source.source,
    sourceOrg: source.sourceOrg,
    sourceUrl: source.url,
    url: source.url,
    region: source.region,
    title: source.title,
  })
}

function formatSourceMeta(source: SourceReference) {
  const sourceClass = getSourceClass(source)
  const parts = [
    source.sourceOrg || source.source,
    sourceClass === 'official'
      ? (getOfficialRegionTag(source) === 'cn' ? '中国权威' : '国际权威')
      : (sourceClass === 'medical_platform' ? '平台医学内容' : (sourceClass === 'dataset' ? '知识库/数据集' : undefined)),
    source.updatedAt ? `更新于 ${source.updatedAt.slice(0, 10)}` : undefined,
    `相关度 ${Math.round(source.relevance * 100)}%`,
  ].filter(Boolean)

  return parts.join(' · ')
}

function handleOpenSource(source: SourceReference) {
  if (!source.url) {
    uni.showToast({ title: '该来源暂无原文链接', icon: 'none' })
    return
  }

  uni.navigateTo({
    url: `/pages/webview/index?url=${encodeURIComponent(source.url)}`,
    fail: () => {
      uni.setClipboardData({
        data: source.url || '',
        success: () => {
          uni.showToast({ title: '已复制来源链接', icon: 'none' })
        },
      })
    },
  })
}

onLoad((options) => {
  if (typeof options?.q === 'string' && options.q.trim()) {
    applyPrefillQuestion(decodeURIComponent(options.q))
  }
})

onShow(() => {
  if (!features.aiQaAssistant) {
    redirectWhenAssistantDisabled()
    return
  }

  const token = uni.getStorageSync('token')
  if (!token) {
    if (prefillQuestion.value.trim()) {
      uni.setStorageSync(CHAT_DRAFT_STORAGE_KEY, { question: prefillQuestion.value.trim() })
    }
    uni.showToast({ title: '请先登录后使用问题助手', icon: 'none' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' })
    }, 900)
    return
  }

  const pendingChatDraft = uni.getStorageSync(CHAT_DRAFT_STORAGE_KEY) as { question?: string } | null
  const pendingQuestion = pendingChatDraft?.question?.trim()
  if (pendingQuestion) {
    uni.removeStorageSync(CHAT_DRAFT_STORAGE_KEY)
    applyPrefillQuestion(pendingQuestion)
  }

  syncRecentQuestions()
  chatStore.initialize()
})

onHide(() => {
  if (loading.value) {
    chatStore.stopGenerating()
  }
})

watch([messages, streamingContent], () => {
  syncScrollAnchor()
}, { deep: true })

const latestUserQuestion = computed(() => {
  const latestUserMessage = [...messages.value].reverse().find(message => message.role === 'user')
  return latestUserMessage?.content?.trim() || prefillQuestion.value.trim()
})

function buildSharePayload() {
  const question = latestUserQuestion.value
  if (!question) {
    return {
      title: '贝护妈妈问题助手：把问题先整理清楚，再决定下一步',
      path: '/pages/chat/index',
      query: '',
    }
  }

  const shortQuestion = question.length > 26 ? `${question.slice(0, 26)}...` : question
  return {
    title: `一起问：${shortQuestion}`,
    path: '/pages/chat/index',
    query: `q=${encodeURIComponent(question)}`,
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
.chat-page {
  height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(255, 196, 157, 0.28), transparent 30%),
    linear-gradient(180deg, #fff8f2 0%, #fffdf9 42%, #f9fbff 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hero {
  padding: 36rpx 36rpx 28rpx;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.hero-copy {
  flex: 1;
}

.hero-title {
  display: block;
  font-size: 54rpx;
  line-height: 1.1;
  font-weight: 900;
  color: #2f2a26;
  letter-spacing: 1rpx;
}

.hero-subtitle {
  display: block;
  margin-top: 16rpx;
  font-size: 27rpx;
  line-height: 1.6;
  color: #75685d;
}

.hero-badge {
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  background: #ff8f5a;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  box-shadow: 0 10rpx 20rpx rgba(255, 143, 90, 0.22);
}

.notice-card {
  margin: 0 28rpx 16rpx;
  padding: 24rpx 28rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.72);
  border: 2rpx solid rgba(255, 173, 122, 0.18);
  backdrop-filter: blur(12px);
}

.notice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.notice-title {
  font-size: 24rpx;
  font-weight: 700;
  color: #6f4b2f;
}

.notice-text {
  font-size: 24rpx;
  line-height: 1.7;
  color: #7c6958;
}

.chat-scroll {
  flex: 1;
  min-height: 0;
  padding: 0 28rpx calc(220rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.empty-state {
  min-height: 780rpx;
  padding: 48rpx 16rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-illustration {
  width: 160rpx;
  height: 160rpx;
  border-radius: 44rpx;
  background: linear-gradient(135deg, #fff0e4 0%, #ffe4cf 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 20rpx 40rpx rgba(255, 165, 116, 0.14);
}

.empty-emoji {
  font-size: 86rpx;
}

.empty-title {
  margin-top: 32rpx;
  font-size: 38rpx;
  font-weight: 800;
  color: #2f2a26;
}

.empty-subtitle {
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #7f746b;
  text-align: center;
}

.empty-loading {
  margin-bottom: 20rpx;
  font-size: 25rpx;
  line-height: 1.6;
  color: #9a7c68;
  text-align: center;
}

.prefill-box {
  width: 100%;
  margin-top: 28rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.88);
  border: 2rpx solid rgba(95, 133, 229, 0.1);
  box-sizing: border-box;
}

.prefill-title {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: #5a6477;
}

.prefill-text {
  display: block;
  margin-top: 12rpx;
  font-size: 25rpx;
  line-height: 1.65;
  color: #344054;
}

.prefill-actions {
  display: flex;
  gap: 14rpx;
  margin-top: 18rpx;
}

.prefill-btn {
  padding: 14rpx 20rpx;
  border-radius: 16rpx;
  background: #f4f6fb;
}

.prefill-btn--primary {
  background: linear-gradient(135deg, #ff8f5a 0%, #ffb077 100%);
}

.prefill-btn-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #556273;
}

.prefill-btn-text--primary {
  color: #fff;
}

.recent-question-panel {
  width: 100%;
  margin-top: 26rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.72);
  box-sizing: border-box;
}

.recent-question-title {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: #7b695c;
}

.recent-question-list {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.recent-question-item {
  padding: 18rpx 20rpx;
  border-radius: 20rpx;
  background: linear-gradient(145deg, rgba(255, 245, 238, 0.96) 0%, rgba(255, 255, 255, 0.94) 100%);
  border: 2rpx solid rgba(255, 143, 90, 0.1);
}

.recent-question-item--hover {
  transform: scale(0.985);
}

.recent-question-text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 24rpx;
  line-height: 1.6;
  color: #6c5444;
}

.quick-list {
  width: 100%;
  margin-top: 30rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
  justify-content: center;
}

.quick-chip {
  max-width: 100%;
  padding: 18rpx 24rpx;
  border-radius: 999rpx;
  background: #fff;
  border: 2rpx solid rgba(255, 143, 90, 0.18);
  box-shadow: 0 8rpx 18rpx rgba(46, 38, 30, 0.04);
}

.quick-chip--hover {
  transform: scale(0.97);
}

.quick-chip-text {
  font-size: 25rpx;
  line-height: 1.4;
  color: #805f4b;
}

.message-list {
  padding-top: 10rpx;
}

.message-row {
  margin-bottom: 20rpx;
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}

.message-row--user {
  flex-direction: row-reverse;
}

.avatar {
  width: 60rpx;
  height: 60rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar--assistant {
  background: linear-gradient(135deg, #ffbf86 0%, #ff8f5a 100%);
  box-shadow: 0 12rpx 24rpx rgba(255, 143, 90, 0.22);
}

.avatar--user {
  background: linear-gradient(135deg, #87aaf7 0%, #5f85e5 100%);
  box-shadow: 0 12rpx 24rpx rgba(95, 133, 229, 0.2);
}

.avatar-text {
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
}

.bubble {
  max-width: 78%;
  padding: 18rpx 20rpx 16rpx;
  border-radius: 24rpx;
  box-sizing: border-box;
}

.bubble--assistant {
  background: rgba(255, 255, 255, 0.9);
  border-top-left-radius: 10rpx;
  box-shadow: 0 10rpx 24rpx rgba(46, 38, 30, 0.05);
}

.bubble--user {
  background: linear-gradient(135deg, #5f85e5 0%, #7fa4ff 100%);
  border-top-right-radius: 10rpx;
  box-shadow: 0 10rpx 24rpx rgba(95, 133, 229, 0.16);
}

.bubble--emergency {
  border: 2rpx solid rgba(225, 87, 89, 0.28);
  background: #fff1f0;
}

.trust-chips {
  margin-top: 14rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.trust-chip {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 700;
}

.trust-chip--warm {
  background: rgba(255, 143, 90, 0.12);
  color: #b96736;
}

.trust-chip--blue {
  background: rgba(95, 133, 229, 0.1);
  color: #4666c1;
}

.trust-chip--green {
  background: rgba(31, 143, 116, 0.12);
  color: #18755f;
}

.trust-chip--red {
  background: rgba(225, 87, 89, 0.12);
  color: #c4494b;
}

.trust-chip--muted {
  background: rgba(120, 132, 146, 0.1);
  color: #66788a;
}

.trust-chip {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  line-height: 1.2;
  color: #7a624d;
  background: rgba(246, 236, 224, 0.9);
}

.trust-chip--green {
  color: #216b49;
  background: rgba(208, 239, 223, 0.9);
}

.trust-chip--yellow {
  color: #8a5a00;
  background: rgba(255, 236, 189, 0.95);
}

.trust-chip--red {
  color: #a43030;
  background: rgba(255, 219, 214, 0.95);
}

.uncertainty-card {
  margin-top: 14rpx;
  padding: 16rpx 18rpx;
  border-radius: 18rpx;
  background: rgba(255, 246, 230, 0.9);
  border: 2rpx solid rgba(232, 177, 72, 0.2);
}

.trust-overview {
  margin-top: 14rpx;
  padding: 16rpx 18rpx;
  border-radius: 18rpx;
  background: rgba(247, 243, 237, 0.95);
  border: 2rpx solid rgba(120, 104, 93, 0.1);
}

.trust-overview-title {
  display: block;
  font-size: 23rpx;
  font-weight: 700;
  color: #5f4a3d;
}

.trust-overview-text {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  line-height: 1.5;
  color: #746456;
}

.trust-overview-conclusion {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #43352c;
}

.uncertainty-title {
  display: block;
  font-size: 23rpx;
  font-weight: 700;
  color: #8a5a00;
}

.uncertainty-text {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #81653b;
}

.emergency-actions {
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 2rpx dashed rgba(225, 87, 89, 0.2);
}

.emergency-btn {
  background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%);
  border-radius: 999rpx;
  padding: 12rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 12rpx rgba(255, 77, 79, 0.2);
}

.emergency-btn--hover {
  transform: translateY(2rpx);
  box-shadow: 0 2rpx 6rpx rgba(255, 77, 79, 0.2);
}

.emergency-btn-text {
  color: #fff;
  font-size: 24rpx;
  font-weight: bold;
}

.bubble--streaming {
  border: 2rpx solid rgba(255, 143, 90, 0.12);
}

.bubble--loading {
  opacity: 0.82;
}

.bubble-text {
  display: block;
  white-space: pre-wrap;
  font-size: 26rpx;
  line-height: 1.6;
  color: #43352c;
}

.message-row--user .bubble-text {
  color: #fff;
}

.bubble-html {
  font-size: 26rpx;
  line-height: 1.6;
  color: #43352c;
  word-break: break-word;
}

.bubble-html :deep(.strong) {
  color: #2f2a26;
  font-weight: 800;
}

.answer-origin {
  margin-top: 14rpx;
  padding-top: 12rpx;
  border-top: 2rpx solid rgba(95, 133, 229, 0.08);
}

.answer-origin-label {
  display: block;
  font-size: 20rpx;
  font-weight: 700;
  color: #7f6958;
}

.answer-origin-text {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: #6b7285;
}

.action-plan {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 2rpx solid rgba(95, 133, 229, 0.08);
}

.action-plan-title {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: #6f4b2f;
}

.action-plan-block + .action-plan-block {
  margin-top: 14rpx;
}

.action-plan-label {
  display: block;
  margin-top: 12rpx;
  font-size: 20rpx;
  font-weight: 700;
  color: #8d715f;
}

.action-plan-item {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  line-height: 1.6;
  color: #4f5968;
}

.action-plan-item--alert {
  color: #b84d4b;
}

.loading-dot {
  font-size: 27rpx;
  color: #8d7868;
}

.bouncing-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 48rpx;
  padding: 0 12rpx;
}

.bouncing-dots .dot {
  width: 12rpx;
  height: 12rpx;
  background-color: #ff8f5a;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.bouncing-dots .dot:nth-child(1) {
  animation-delay: -0.32s;
}

.bouncing-dots .dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.source-list-container {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 2rpx solid rgba(95, 133, 229, 0.08);
  width: 100%;
}

.source-title {
  display: block;
  margin-bottom: 12rpx;
  font-size: 23rpx;
  font-weight: 700;
  color: #7f6958;
}

.source-group {
  margin-top: 10rpx;
}

.source-group-title {
  display: block;
  margin-bottom: 10rpx;
  font-size: 21rpx;
  font-weight: 700;
  color: #96755f;
}

.source-list-scroll {
  width: 100%;
  white-space: nowrap;
}

.source-list-inner {
  display: inline-flex;
  gap: 16rpx;
  padding-bottom: 12rpx;
}

.source-card {
  display: inline-flex;
  flex-direction: column;
  width: 440rpx;
  padding: 14rpx;
  border-radius: 16rpx;
  background: #f7f8ff;
  box-sizing: border-box;
  white-space: normal;
}

.source-card--cn {
  background: rgba(241, 247, 255, 0.98);
}

.source-card--global {
  background: rgba(248, 245, 255, 0.98);
}

.source-region-chip {
  align-self: flex-start;
  margin-bottom: 8rpx;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 700;
}

.source-region-chip--cn {
  background: rgba(41, 121, 255, 0.12);
  color: #285eb7;
}

.source-region-chip--global {
  background: rgba(126, 87, 194, 0.1);
  color: #6b4ab1;
}

.source-name {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 22rpx;
  line-height: 1.4;
  font-weight: 700;
  color: #35405a;
}

.source-meta {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #6c7593;
}

.source-excerpt {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1.5;
  color: #666b7d;
}

.source-link {
  margin-top: 10rpx;
  align-self: flex-start;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(95, 133, 229, 0.08);
  border: 2rpx solid rgba(95, 133, 229, 0.12);
}

.source-link--hover {
  transform: translateY(2rpx);
}

.source-link-text {
  font-size: 20rpx;
  font-weight: 700;
  color: #4c6fd1;
}

.follow-up-card {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 2rpx solid rgba(95, 133, 229, 0.08);
}

.follow-up-title {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: #6f4b2f;
}

.follow-up-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 12rpx;
}

.follow-up-chip {
  max-width: 100%;
  padding: 14rpx 18rpx;
  border-radius: 18rpx;
  background: rgba(95, 133, 229, 0.08);
  border: 2rpx solid rgba(95, 133, 229, 0.1);
}

.follow-up-chip--hover {
  transform: scale(0.98);
}

.follow-up-chip-text {
  font-size: 22rpx;
  line-height: 1.45;
  color: #4c6fd1;
  font-weight: 600;
}

.error-bar {
  margin: 16rpx 0 6rpx;
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  background: #fff1f0;
  border: 2rpx solid rgba(225, 87, 89, 0.12);
}

.error-text {
  color: #cf4f4c;
  font-size: 25rpx;
  line-height: 1.5;
}

.bottom-anchor {
  height: 12rpx;
}

.composer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 18rpx calc(env(safe-area-inset-bottom) + 10rpx);
  z-index: 20;
}

.composer-shell {
  padding: 16rpx 16rpx 16rpx;
  border-radius: 28rpx 28rpx 0 0;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(14px);
  border: 2rpx solid rgba(92, 113, 173, 0.08);
  box-shadow: 0 -12rpx 36rpx rgba(46, 38, 30, 0.08);
}

.composer-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.composer-status-text {
  font-size: 24rpx;
  font-weight: 700;
  color: #6f4b2f;
}

.composer-status-subtext {
  font-size: 22rpx;
  color: #9a7c68;
}

.composer-row {
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
}

.composer-input {
  flex: 1;
  min-height: 88rpx;
  max-height: 240rpx;
  padding: 20rpx 22rpx;
  border-radius: 28rpx;
  background: #f6f7fb;
  font-size: 28rpx;
  line-height: 1.6;
  color: #2f2a26;
  box-sizing: border-box;
}

.stop-button {
  height: 88rpx;
  padding: 0 30rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #8f98aa 0%, #6f7687 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14rpx 28rpx rgba(111, 118, 135, 0.2);
  transition: all 0.3s ease;
}

.stop-button--hover {
  transform: translateY(2rpx);
}

.stop-button-text {
  color: #fff;
  font-size: 28rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
}

.resume-button {
  height: 88rpx;
  padding: 0 30rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.96);
  border: 2rpx solid rgba(95, 133, 229, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14rpx 28rpx rgba(95, 133, 229, 0.08);
  transition: all 0.3s ease;
}

.resume-button--hover {
  transform: translateY(2rpx);
}

.resume-button-text {
  color: #5f85e5;
  font-size: 28rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
}

.send-button {
  height: 88rpx;
  padding: 0 30rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #ff945f 0%, #ff7845 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14rpx 28rpx rgba(255, 120, 69, 0.22);
  transition: all 0.3s ease;
}

.send-button--hover {
  transform: translateY(2rpx);
}

.send-button--disabled {
  opacity: 0.45;
}

.send-button-text {
  color: #fff;
  font-size: 28rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
}
</style>
