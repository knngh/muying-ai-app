<template>
  <view class="chat-page">
    <view class="hero">
      <view class="hero-copy">
        <text class="hero-title">AI 母婴答疑</text>
        <text class="hero-subtitle">把您此刻最担心的情况告诉我，我会尽力给您温和、清晰的参考建议。</text>
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
        <text class="empty-subtitle">例如孕吐、发热、辅食、湿疹，或新生儿护理中的具体情况。</text>

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
            <text class="avatar-text">{{ item.role === 'user' ? '我' : 'AI' }}</text>
          </view>

          <view
            class="bubble"
            :class="[
              item.role === 'user' ? 'bubble--user' : 'bubble--assistant',
              item.isEmergency ? 'bubble--emergency' : '',
            ]"
          >
            <text user-select class="bubble-text">{{ getDisplayedContent(item) }}</text>

            <view v-if="item.role === 'assistant'" class="answer-origin">
              <text class="answer-origin-label">答案来源</text>
              <text user-select class="answer-origin-text">{{ getAnswerOrigin(item) }}</text>
            </view>

            <view v-if="item.sources?.length" class="source-list">
              <text class="source-title">具体参考来源</text>
              <view
                v-for="source in getSortedSources(item)"
                :key="`${item.id}-${source.title}`"
                class="source-card"
              >
                <text user-select class="source-name">{{ source.title }}</text>
                <text user-select class="source-meta">{{ source.source }} · 相关度 {{ Math.round(source.relevance * 100) }}%</text>
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
          </view>
        </view>

        <view v-if="loading && streamingContent && !isResumingInPlace" class="message-row message-row--assistant">
          <view class="avatar avatar--assistant">
            <text class="avatar-text">AI</text>
          </view>
          <view class="bubble bubble--assistant bubble--streaming">
            <text class="bubble-text">{{ streamingContent }}</text>
          </view>
        </view>

        <view v-else-if="loading && !isResumingInPlace" class="message-row message-row--assistant">
          <view class="avatar avatar--assistant">
            <text class="avatar-text">AI</text>
          </view>
          <view class="bubble bubble--assistant bubble--loading">
            <text class="loading-dot">正在整理回答...</text>
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
          <text class="composer-status-text">AI 正在生成回答</text>
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
        placeholder="您可以直接描述情况，越具体越容易得到更贴合的建议"
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
import { onHide, onShow } from '@dcloudio/uni-app'
import { useChatStore } from '@/stores/chat'
import { getDisclaimer, type AIMessage, type SourceReference } from '@/api/ai'

const quickQuestions = [
  '孕早期有哪些注意事项？',
  '宝宝发烧先怎么处理？',
  '母乳喂养常见问题有哪些？',
  '新生儿黄疸需要注意什么？',
]

const chatStore = useChatStore()
const { messages, loading, loadingHistory, error, streamingContent, canResume, resumeMessageId } = storeToRefs(chatStore)

const inputValue = ref('')
const disclaimer = getDisclaimer()
const scrollAnchor = ref('chat-bottom')
const scrollTop = ref(0)

const canSend = computed(() => inputValue.value.trim().length > 0 && !loading.value)
const isResumingInPlace = computed(() => loading.value && !!resumeMessageId.value)
const AUTHORITY_DOMAINS = [
  'gov.cn',
  'nhc.gov.cn',
  'who.int',
  'nih.gov',
  'cdc.gov',
  'fda.gov',
  'aap.org',
  'nhs.uk',
  'mayoclinic.org',
]
const AUTHORITY_NAMES = [
  '国家卫健委',
  '中国政府网',
  'who',
  'nih',
  'cdc',
  'fda',
  '美国儿科学会',
  'nhs',
  '梅奥',
]

function syncScrollAnchor() {
  nextTick(() => {
    scrollAnchor.value = 'chat-bottom'
    scrollTop.value += 100000
  })
}

async function handleSend() {
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
  await chatStore.resumeLastAnswer()
  syncScrollAnchor()
}

function handleQuickQuestion(question: string) {
  inputValue.value = question
  handleSend()
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
  if (host && AUTHORITY_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`))) {
    return true
  }

  const sourceName = (source.source || '').toLowerCase()
  return AUTHORITY_NAMES.some(name => sourceName.includes(name))
}

function getSortedSources(message: AIMessage) {
  return [...(message.sources || [])].sort((left, right) => {
    const authorityGap = Number(isAuthoritativeSource(right)) - Number(isAuthoritativeSource(left))
    if (authorityGap !== 0) {
      return authorityGap
    }

    return (right.relevance || 0) - (left.relevance || 0)
  })
}

function getAnswerOrigin(message: AIMessage) {
  if (message.isEmergency) {
    return '系统安全规则触发，已优先给出紧急就医提示。'
  }

  const authoritativeLabels = Array.from(new Set(
    getSortedSources(message)
      .filter(isAuthoritativeSource)
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

onShow(() => {
  const token = uni.getStorageSync('token')
  if (!token) {
    uni.showToast({ title: '请先登录后使用 AI 答疑', icon: 'none' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/home/index' })
    }, 900)
    return
  }

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
  margin-bottom: 24rpx;
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
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
  padding: 24rpx 24rpx 20rpx;
  border-radius: 30rpx;
  box-sizing: border-box;
}

.bubble--assistant {
  background: rgba(255, 255, 255, 0.9);
  border-top-left-radius: 12rpx;
  box-shadow: 0 14rpx 36rpx rgba(46, 38, 30, 0.05);
}

.bubble--user {
  background: linear-gradient(135deg, #5f85e5 0%, #7fa4ff 100%);
  border-top-right-radius: 12rpx;
  box-shadow: 0 14rpx 36rpx rgba(95, 133, 229, 0.16);
}

.bubble--emergency {
  border: 2rpx solid rgba(225, 87, 89, 0.28);
  background: #fff1f0;
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
  font-size: 28rpx;
  line-height: 1.72;
  color: #43352c;
}

.message-row--user .bubble-text {
  color: #fff;
}

.answer-origin {
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 2rpx solid rgba(95, 133, 229, 0.08);
}

.answer-origin-label {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: #7f6958;
}

.answer-origin-text {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  line-height: 1.6;
  color: #6b7285;
}

.loading-dot {
  font-size: 27rpx;
  color: #8d7868;
}

.source-list {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 2rpx solid rgba(95, 133, 229, 0.08);
}

.source-title {
  display: block;
  margin-bottom: 12rpx;
  font-size: 23rpx;
  font-weight: 700;
  color: #7f6958;
}

.source-card {
  padding: 18rpx;
  margin-top: 12rpx;
  border-radius: 22rpx;
  background: #f7f8ff;
}

.source-name {
  display: block;
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 700;
  color: #35405a;
}

.source-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #6c7593;
}

.source-excerpt {
  display: block;
  margin-top: 10rpx;
  font-size: 23rpx;
  line-height: 1.6;
  color: #666b7d;
}

.source-link {
  margin-top: 14rpx;
  align-self: flex-start;
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(95, 133, 229, 0.08);
  border: 2rpx solid rgba(95, 133, 229, 0.12);
}

.source-link--hover {
  transform: translateY(2rpx);
}

.source-link-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #4c6fd1;
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
