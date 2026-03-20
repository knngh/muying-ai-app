<template>
  <view class="chat-page">
    <!-- Disclaimer -->
    <view class="disclaimer-bar">
      <text class="disclaimer-text">
        声明：AI回答仅供参考，不能替代专业医疗建议。如遇紧急情况请立即就医。
      </text>
    </view>

    <!-- Messages Area -->
    <scroll-view
      class="messages-area"
      scroll-y
      :scroll-into-view="scrollToId"
      scroll-with-animation
    >
      <!-- Empty State -->
      <view v-if="messages.length === 0 && !loading" class="empty-state">
        <text class="empty-title">您好！我是母婴AI助手</text>
        <text class="empty-desc">请问有什么可以帮您的？</text>
        <view class="quick-questions">
          <view
            v-for="(q, index) in quickQuestions"
            :key="index"
            class="quick-question-item"
            @tap="handleQuickQuestion(q)"
          >
            <text class="quick-question-text">{{ q }}</text>
          </view>
        </view>
      </view>

      <!-- Message List -->
      <view
        v-for="(msg, index) in messages"
        :key="msg.id"
        :id="'msg-' + index"
        :class="['message-row', msg.role === 'user' ? 'message-row-user' : 'message-row-ai']"
      >
        <view
          v-if="msg.role === 'assistant'"
          class="avatar avatar-ai"
        >
          <text class="avatar-text">AI</text>
        </view>
        <view :class="['message-bubble', msg.role === 'user' ? 'bubble-user' : 'bubble-ai']">
          <!-- Emergency Alert -->
          <view v-if="msg.isEmergency" class="emergency-alert">
            <text class="emergency-icon">⚠️</text>
            <text class="emergency-label">紧急提醒</text>
          </view>
          
          <mp-html v-if="msg.role === 'assistant'" :content="renderMarkdown(msg.content)" class="message-content" />
          <text v-else class="message-content">{{ msg.content }}</text>
        </view>
        <view
          v-if="msg.role === 'user'"
          class="avatar avatar-user"
        >
          <text class="avatar-text">我</text>
        </view>
      </view>

      <!-- Streaming Message -->
      <view v-if="loading && streamingContent" class="message-row message-row-ai">
        <view class="avatar avatar-ai">
          <text class="avatar-text">AI</text>
        </view>
        <view class="message-bubble bubble-ai">
          <mp-html :content="renderMarkdown(streamingContent)" class="message-content" />
          <text class="typing-indicator">...</text>
        </view>
      </view>

      <!-- Loading Indicator -->
      <view v-if="loading && !streamingContent" class="message-row message-row-ai">
        <view class="avatar avatar-ai">
          <text class="avatar-text">AI</text>
        </view>
        <view class="message-bubble bubble-ai">
          <text class="typing-dots">正在思考中...</text>
        </view>
      </view>

      <!-- Bottom anchor -->
      <view :id="'msg-' + messages.length" style="height: 20rpx;" />
    </scroll-view>

    <!-- Clear Conversation -->
    <view v-if="messages.length > 0" class="clear-bar" @tap="handleClear">
      <text class="clear-text">清空对话</text>
    </view>

    <!-- Input Area -->
    <view class="input-area">
      <textarea
        v-model="inputText"
        class="message-input"
        placeholder="请输入您的问题..."
        :auto-height="true"
        :maxlength="500"
        confirm-type="send"
        @confirm="handleSend"
      />
      <view
        :class="['send-btn', inputText.trim() ? 'send-btn-active' : '']"
        @tap="handleSend"
      >
        <text class="send-btn-text">发送</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import mpHtml from 'mp-html/dist/uni-app/components/mp-html/mp-html.vue'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

const renderMarkdown = (text: string) => {
  return md.render(text || '')
}

const chatStore = useChatStore()
const inputText = ref('')
const scrollToId = ref('')

const quickQuestions = [
  '孕早期有哪些注意事项？',
  '宝宝发烧怎么办？',
  '孕期营养应该怎么补充？',
  '新生儿护理要点有哪些？',
]

const messages = computed(() => chatStore.messages)
const loading = computed(() => chatStore.loading)
const streamingContent = computed(() => chatStore.streamingContent)

watch(
  () => messages.value.length,
  () => {
    nextTick(() => {
      scrollToId.value = ''
      setTimeout(() => {
        scrollToId.value = 'msg-' + messages.value.length
      }, 50)
    })
  },
)

watch(streamingContent, () => {
  nextTick(() => {
    scrollToId.value = ''
    setTimeout(() => {
      scrollToId.value = 'msg-' + messages.value.length
    }, 50)
  })
})

function handleSend() {
  const text = inputText.value.trim()
  if (!text || loading.value) return
  inputText.value = ''
  chatStore.sendMessage(text)
}

function handleQuickQuestion(question: string) {
  if (loading.value) return
  chatStore.sendMessage(question)
}

function handleClear() {
  uni.showModal({
    title: '提示',
    content: '确定要清空所有对话记录吗？',
    success(res) {
      if (res.confirm) {
        chatStore.clearMessages()
        uni.showToast({ title: '已清空', icon: 'success' })
      }
    },
  })
}
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

/* Disclaimer */
.disclaimer-bar {
  background-color: #fff8e1;
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid #ffe082;
  flex-shrink: 0;
}

.disclaimer-text {
  font-size: 22rpx;
  color: #f57c00;
  line-height: 1.5;
}

/* Messages Area */
.messages-area {
  flex: 1;
  padding: 20rpx 24rpx;
  overflow: hidden;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
}

.empty-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 16rpx;
}

.empty-desc {
  font-size: 28rpx;
  color: #999999;
  margin-bottom: 48rpx;
}

.quick-questions {
  width: 100%;
}

.quick-question-item {
  background-color: #ffffff;
  border: 1rpx solid #e8e8e8;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
}

.quick-question-text {
  font-size: 28rpx;
  color: #333333;
}

/* Message Row */
.message-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 24rpx;
}

.message-row-user {
  flex-direction: row;
  justify-content: flex-end;
}

.message-row-ai {
  flex-direction: row;
  justify-content: flex-start;
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-ai {
  margin-right: 16rpx;
  background-color: rgba(255, 107, 157, 0.15);
}

.avatar-user {
  margin-left: 16rpx;
  background-color: rgba(74, 144, 226, 0.15);
}

.avatar-text {
  font-size: 24rpx;
  font-weight: bold;
  color: #666666;
}

/* Bubble */
.message-bubble {
  max-width: 560rpx;
  padding: 20rpx 28rpx;
  border-radius: 20rpx;
}

.bubble-user {
  background-color: #ff6b9d;
  border-top-right-radius: 4rpx;
}

.bubble-ai {
  background-color: #ffffff;
  border-top-left-radius: 4rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.bubble-user .message-content {
  color: #ffffff;
}

.bubble-ai .message-content {
  color: #333333;
}

.message-content {
  font-size: 28rpx;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Emergency */
.emergency-alert {
  display: flex;
  align-items: center;
  background-color: #fff3e0;
  padding: 12rpx 20rpx;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
  border: 1rpx solid #ffcc02;
}

.emergency-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
}

.emergency-label {
  font-size: 24rpx;
  font-weight: bold;
  color: #e65100;
}

/* Typing */
.typing-indicator {
  font-size: 28rpx;
  color: #999999;
}

.typing-dots {
  font-size: 26rpx;
  color: #999999;
}

/* Clear Bar */
.clear-bar {
  display: flex;
  justify-content: center;
  padding: 12rpx;
  flex-shrink: 0;
}

.clear-text {
  font-size: 24rpx;
  color: #999999;
}

/* Input Area */
.input-area {
  display: flex;
  align-items: flex-end;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background-color: #ffffff;
  border-top: 1rpx solid #e8e8e8;
  flex-shrink: 0;
}

.message-input {
  flex: 1;
  min-height: 64rpx;
  max-height: 200rpx;
  padding: 16rpx 24rpx;
  font-size: 28rpx;
  background-color: #f5f5f5;
  border-radius: 32rpx;
  line-height: 1.5;
}

.send-btn {
  margin-left: 16rpx;
  padding: 16rpx 32rpx;
  background-color: #cccccc;
  border-radius: 32rpx;
  flex-shrink: 0;
}

.send-btn-active {
  background-color: #ff6b9d;
}

.send-btn-text {
  font-size: 28rpx;
  color: #ffffff;
  font-weight: 600;
}
</style>
