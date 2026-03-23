<template>
  <view class="chat-page">
    <!-- 顶部栏 -->
    <view class="chat-header">
      <view class="header-left">
        <text class="header-title">AI 母婴答疑</text>
        <text class="header-badge">基于专业知识库</text>
      </view>
      <view v-if="chatStore.hasMessages" class="header-right" @tap="handleNewChat">
        <text class="new-chat-text">新对话</text>
      </view>
    </view>

    <!-- 聊天消息区域 -->
    <scroll-view
      class="chat-body"
      scroll-y
      :scroll-into-view="scrollTargetId"
      scroll-with-animation
      :enhanced="true"
      :show-scrollbar="false"
    >
      <!-- 欢迎页面（无消息时） -->
      <view v-if="!chatStore.hasMessages" class="welcome-section">
        <view class="welcome-illustration">
          <text class="welcome-emoji">👩‍⚕️</text>
          <view class="welcome-pulse"></view>
        </view>
        <text class="welcome-title">您好，我是母婴 AI 助手</text>
        <text class="welcome-desc">基于专业母婴知识库，为您提供孕产育儿方面的智能解答</text>

        <!-- 推荐问题 -->
        <view class="recommend-section">
          <text class="recommend-label">大家都在问</text>
          <view class="recommend-grid">
            <view
              v-for="item in chatStore.recommendedQuestions"
              :key="item.id"
              class="recommend-item"
              @tap="handleQuickQuestion(item.question)"
            >
              <text class="recommend-icon">💡</text>
              <text class="recommend-text">{{ item.question }}</text>
            </view>
          </view>
        </view>

        <!-- 免责声明 -->
        <view class="disclaimer-box">
          <text class="disclaimer-icon">⚠️</text>
          <text class="disclaimer-text">本AI助手仅供参考，不构成医疗建议。如有健康问题，请咨询专业医生。</text>
        </view>
      </view>

      <!-- 消息列表 -->
      <view v-if="chatStore.hasMessages" class="messages-list">
        <view
          v-for="msg in chatStore.messages"
          :key="msg.id"
          :id="'msg-' + msg.id"
          class="message-wrapper"
          :class="msg.role"
        >
          <!-- 用户消息 -->
          <view v-if="msg.role === 'user'" class="message-row user-row">
            <view class="message-bubble user-bubble">
              <text class="message-text">{{ msg.content }}</text>
            </view>
            <view class="avatar user-avatar">
              <text class="avatar-text">我</text>
            </view>
          </view>

          <!-- AI 消息 -->
          <view v-if="msg.role === 'assistant'" class="message-row ai-row">
            <view class="avatar ai-avatar">
              <text class="avatar-emoji">🤖</text>
            </view>
            <view class="message-bubble ai-bubble" :class="{ emergency: msg.isEmergency }">
              <view v-if="msg.isEmergency" class="emergency-header">
                <text class="emergency-icon">🚨</text>
                <text class="emergency-label">紧急情况</text>
              </view>
              <text class="message-text ai-text">{{ msg.content }}</text>
              <!-- 反馈按钮 -->
              <view v-if="!msg.isEmergency" class="feedback-row">
                <view class="feedback-btn" @tap="handleFeedback(msg.id, 'helpful')">
                  <text class="feedback-icon">👍</text>
                  <text class="feedback-label">有帮助</text>
                </view>
                <view class="feedback-btn" @tap="handleFeedback(msg.id, 'unhelpful')">
                  <text class="feedback-icon">👎</text>
                  <text class="feedback-label">不准确</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 流式输出中 -->
        <view v-if="chatStore.streamingContent" class="message-wrapper assistant" id="msg-streaming">
          <view class="message-row ai-row">
            <view class="avatar ai-avatar">
              <text class="avatar-emoji">🤖</text>
            </view>
            <view class="message-bubble ai-bubble">
              <text class="message-text ai-text">{{ chatStore.streamingContent }}</text>
              <view class="typing-cursor"></view>
            </view>
          </view>
        </view>

        <!-- 加载状态 -->
        <view v-if="chatStore.loading && !chatStore.streamingContent" class="message-wrapper assistant" id="msg-loading">
          <view class="message-row ai-row">
            <view class="avatar ai-avatar">
              <text class="avatar-emoji">🤖</text>
            </view>
            <view class="message-bubble ai-bubble loading-bubble">
              <view class="typing-indicator">
                <view class="dot dot1"></view>
                <view class="dot dot2"></view>
                <view class="dot dot3"></view>
              </view>
              <text class="thinking-text">正在查阅知识库...</text>
            </view>
          </view>
        </view>

        <!-- 错误提示 -->
        <view v-if="chatStore.error" class="error-toast">
          <text class="error-text">{{ chatStore.error }}</text>
          <view class="error-retry" @tap="retryLastMessage">
            <text class="retry-text">重试</text>
          </view>
        </view>
      </view>

      <!-- 底部占位 -->
      <view class="scroll-bottom-spacer" id="scroll-bottom"></view>
    </scroll-view>

    <!-- 底部输入区域 -->
    <view class="input-area">
      <!-- 快捷问题标签（有对话时也能用） -->
      <scroll-view v-if="chatStore.hasMessages" class="quick-tags-scroll" scroll-x :show-scrollbar="false">
        <view class="quick-tags">
          <view class="quick-tag" @tap="handleQuickQuestion('需要注意什么？')">
            <text class="tag-text">需要注意什么？</text>
          </view>
          <view class="quick-tag" @tap="handleQuickQuestion('有什么食谱推荐？')">
            <text class="tag-text">有什么食谱推荐？</text>
          </view>
          <view class="quick-tag" @tap="handleQuickQuestion('什么时候需要去医院？')">
            <text class="tag-text">什么时候需要去医院？</text>
          </view>
        </view>
      </scroll-view>

      <view class="input-row">
        <view class="input-wrapper">
          <input
            v-model="inputText"
            class="chat-input"
            type="text"
            placeholder="输入您的母婴问题..."
            :disabled="chatStore.loading"
            confirm-type="send"
            @confirm="handleSend"
          />
        </view>
        <view
          class="send-btn"
          :class="{ active: inputText.trim() && !chatStore.loading, disabled: chatStore.loading }"
          @tap="handleSend"
        >
          <text v-if="!chatStore.loading" class="send-icon">↑</text>
          <view v-else class="send-loading"></view>
        </view>
      </view>

      <!-- 安全区域适配 -->
      <view class="safe-area-bottom"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
const inputText = ref('')
const scrollTargetId = ref('')

onMounted(() => {
  // 加载推荐问题
  chatStore.fetchRecommendedQuestions()
})

// 监听消息变化，自动滚动到底部
watch(
  () => [chatStore.messages.length, chatStore.streamingContent],
  () => {
    nextTick(() => {
      scrollToBottom()
    })
  },
)

function scrollToBottom() {
  if (chatStore.streamingContent) {
    scrollTargetId.value = 'msg-streaming'
  } else if (chatStore.loading) {
    scrollTargetId.value = 'msg-loading'
  } else {
    scrollTargetId.value = 'scroll-bottom'
  }
  // 重置以便再次触发
  nextTick(() => {
    scrollTargetId.value = ''
  })
}

function handleSend() {
  const text = inputText.value.trim()
  if (!text || chatStore.loading) return

  // 检查登录状态
  const token = uni.getStorageSync('token')
  if (!token) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' })
    }, 1000)
    return
  }

  inputText.value = ''
  chatStore.sendMessage(text)
}

function handleQuickQuestion(question: string) {
  if (chatStore.loading) return

  const token = uni.getStorageSync('token')
  if (!token) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' })
    }, 1000)
    return
  }

  inputText.value = ''
  chatStore.sendMessage(question)
}

function handleNewChat() {
  uni.showModal({
    title: '开启新对话',
    content: '确定要清空当前对话记录吗？',
    success: (res) => {
      if (res.confirm) {
        chatStore.clearMessages()
      }
    },
  })
}

function handleFeedback(msgId: string, feedback: 'helpful' | 'unhelpful') {
  uni.showToast({ title: feedback === 'helpful' ? '感谢反馈' : '我们会改进', icon: 'none' })
  // 异步提交反馈，不阻塞 UI
  import('@/api/ai').then(({ aiApi }) => {
    aiApi.submitFeedback({ qaId: msgId, feedback }).catch(() => {})
  })
}

function retryLastMessage() {
  chatStore.error = null
  const lastUserMsg = [...chatStore.messages].reverse().find(m => m.role === 'user')
  if (lastUserMsg) {
    // 移除最后一条用户消息，重新发送
    chatStore.messages = chatStore.messages.filter(m => m.id !== lastUserMsg.id)
    chatStore.sendMessage(lastUserMsg.content)
  }
}
</script>

<style scoped>
.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f6fa;
}

/* ===== 顶部栏 ===== */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 32rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #f0f0f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.header-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #333;
}

.header-badge {
  font-size: 20rpx;
  color: #7b9cff;
  background: #eef2ff;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.header-right {
  padding: 12rpx 24rpx;
  background: #f5f6fa;
  border-radius: 24rpx;
}

.new-chat-text {
  font-size: 24rpx;
  color: #666;
}

/* ===== 聊天消息区域 ===== */
.chat-body {
  flex: 1;
  overflow: hidden;
}

/* ===== 欢迎页面 ===== */
.welcome-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 40rpx 40rpx;
}

.welcome-illustration {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32rpx;
}

.welcome-emoji {
  font-size: 100rpx;
  z-index: 2;
}

.welcome-pulse {
  position: absolute;
  width: 160rpx;
  height: 160rpx;
  background: radial-gradient(circle, rgba(123, 156, 255, 0.15) 0%, transparent 70%);
  border-radius: 50%;
  animation: pulse 3s infinite ease-in-out;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.5); opacity: 1; }
  100% { transform: scale(1); opacity: 0.6; }
}

.welcome-title {
  font-size: 38rpx;
  font-weight: 700;
  color: #333;
  margin-bottom: 16rpx;
}

.welcome-desc {
  font-size: 26rpx;
  color: #888;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 48rpx;
  max-width: 80%;
}

/* ===== 推荐问题 ===== */
.recommend-section {
  width: 100%;
  margin-bottom: 40rpx;
}

.recommend-label {
  font-size: 26rpx;
  font-weight: 600;
  color: #666;
  margin-bottom: 20rpx;
  display: block;
  padding-left: 8rpx;
}

.recommend-grid {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.recommend-item {
  display: flex;
  align-items: center;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
}

.recommend-item:active {
  transform: scale(0.98);
  background: #f8faff;
}

.recommend-icon {
  font-size: 32rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.recommend-text {
  font-size: 28rpx;
  color: #444;
  line-height: 1.4;
  flex: 1;
}

/* ===== 免责声明 ===== */
.disclaimer-box {
  display: flex;
  align-items: flex-start;
  background: #fff8f0;
  border-radius: 20rpx;
  padding: 24rpx 28rpx;
  width: 100%;
  box-sizing: border-box;
}

.disclaimer-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
  margin-top: 2rpx;
}

.disclaimer-text {
  font-size: 22rpx;
  color: #b08050;
  line-height: 1.6;
}

/* ===== 消息列表 ===== */
.messages-list {
  padding: 24rpx 24rpx 0;
}

.message-wrapper {
  margin-bottom: 32rpx;
}

.message-row {
  display: flex;
  align-items: flex-start;
}

.user-row {
  justify-content: flex-end;
}

.ai-row {
  justify-content: flex-start;
}

/* 头像 */
.avatar {
  width: 68rpx;
  height: 68rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-avatar {
  background: linear-gradient(135deg, #ff8da1, #ff6b9d);
  margin-left: 16rpx;
  order: 2;
}

.avatar-text {
  font-size: 24rpx;
  color: #fff;
  font-weight: 700;
}

.ai-avatar {
  background: linear-gradient(135deg, #e8efff, #d5e0ff);
  margin-right: 16rpx;
}

.avatar-emoji {
  font-size: 36rpx;
}

/* 气泡 */
.message-bubble {
  max-width: 75%;
  padding: 24rpx 28rpx;
  border-radius: 24rpx;
  position: relative;
}

.user-bubble {
  background: linear-gradient(135deg, #7b9cff, #5a80ff);
  border-bottom-right-radius: 8rpx;
}

.ai-bubble {
  background: #ffffff;
  border-bottom-left-radius: 8rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
}

.ai-bubble.emergency {
  background: #fff5f5;
  border: 2rpx solid #ffccc7;
}

.message-text {
  font-size: 28rpx;
  line-height: 1.7;
  word-break: break-all;
  white-space: pre-wrap;
}

.user-bubble .message-text {
  color: #ffffff;
}

.ai-text {
  color: #333;
}

/* 紧急消息头部 */
.emergency-header {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 12rpx;
  border-bottom: 1rpx solid #ffccc7;
}

.emergency-icon {
  font-size: 32rpx;
  margin-right: 8rpx;
}

.emergency-label {
  font-size: 26rpx;
  font-weight: 700;
  color: #cf1322;
}

/* 反馈按钮 */
.feedback-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #f5f5f5;
}

.feedback-btn {
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 6rpx 16rpx;
  border-radius: 16rpx;
  background: #f8f9fa;
}

.feedback-btn:active {
  background: #eef2ff;
}

.feedback-icon {
  font-size: 24rpx;
}

.feedback-label {
  font-size: 20rpx;
  color: #999;
}

/* 打字指示器 */
.typing-cursor {
  display: inline-block;
  width: 4rpx;
  height: 28rpx;
  background: #7b9cff;
  margin-left: 4rpx;
  vertical-align: middle;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.loading-bubble {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #7b9cff;
  animation: bounce 1.4s infinite ease-in-out;
}

.dot1 { animation-delay: 0s; }
.dot2 { animation-delay: 0.2s; }
.dot3 { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.thinking-text {
  font-size: 24rpx;
  color: #999;
}

/* 错误提示 */
.error-toast {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 20rpx;
  margin: 0 24rpx;
  background: #fff2f0;
  border-radius: 16rpx;
}

.error-text {
  font-size: 24rpx;
  color: #cf1322;
}

.error-retry {
  padding: 8rpx 20rpx;
  background: #ff4d4f;
  border-radius: 12rpx;
}

.retry-text {
  font-size: 22rpx;
  color: #fff;
  font-weight: 600;
}

.scroll-bottom-spacer {
  height: 20rpx;
}

/* ===== 底部输入区域 ===== */
.input-area {
  background: #ffffff;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid #f0f0f0;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.03);
}

/* 快捷标签 */
.quick-tags-scroll {
  margin-bottom: 16rpx;
  white-space: nowrap;
}

.quick-tags {
  display: flex;
  gap: 16rpx;
  padding: 0 4rpx;
}

.quick-tag {
  display: inline-flex;
  padding: 10rpx 24rpx;
  background: #f5f6fa;
  border-radius: 24rpx;
  flex-shrink: 0;
}

.quick-tag:active {
  background: #eef2ff;
}

.tag-text {
  font-size: 22rpx;
  color: #666;
  white-space: nowrap;
}

/* 输入行 */
.input-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.input-wrapper {
  flex: 1;
  background: #f5f6fa;
  border-radius: 40rpx;
  padding: 0 28rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
}

.chat-input {
  width: 100%;
  height: 80rpx;
  font-size: 28rpx;
  color: #333;
}

.send-btn {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e0e0e0;
  flex-shrink: 0;
  transition: all 0.2s;
}

.send-btn.active {
  background: linear-gradient(135deg, #7b9cff, #5a80ff);
  box-shadow: 0 8rpx 20rpx rgba(90, 128, 255, 0.3);
}

.send-btn.disabled {
  background: #e0e0e0;
  opacity: 0.7;
}

.send-btn:active.active {
  transform: scale(0.92);
}

.send-icon {
  font-size: 36rpx;
  color: #fff;
  font-weight: 700;
}

.send-loading {
  width: 32rpx;
  height: 32rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
