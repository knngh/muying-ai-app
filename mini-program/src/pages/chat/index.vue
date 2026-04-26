<template>
  <view class="chat-page">
    <!-- 紧急警告横幅 -->
    <EmergencyBanner
      :visible="hasEmergency"
      message="系统检测到当前内容可能涉及紧急情况，建议尽快联系专业医护人员。"
    />

    <!-- 对话历史侧栏 -->
    <view v-if="showHistory" class="history-overlay" @tap="showHistory = false">
      <view class="history-panel" @tap.stop>
        <view class="history-header">
          <text class="history-title">历史对话</text>
          <text class="history-new" @tap="onNewChat">新对话</text>
        </view>
        <scroll-view scroll-y class="history-list">
          <view v-if="chatStore.isLoadingConversations" class="history-loading">
            <text>加载中...</text>
          </view>
          <view v-else-if="!chatStore.conversations.length" class="history-empty">
            <text>暂无历史对话</text>
          </view>
          <view
            v-for="conv in chatStore.conversations"
            :key="conv.id"
            class="history-item"
            :class="{ active: conv.id === chatStore.currentConversationId }"
            @tap="onSelectConversation(conv.id)"
          >
            <view class="history-item-content">
              <text class="history-item-title">{{ conv.title || conv.lastMessagePreview || '新对话' }}</text>
              <text class="history-item-meta">{{ formatTime(conv.updatedAt) }}</text>
            </view>
            <view class="history-item-delete" @tap.stop="onDeleteConversation(conv.id)">
              <text>删除</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view
      scroll-y
      class="message-list"
      :scroll-into-view="scrollTarget"
      scroll-with-animation
    >
      <!-- 欢迎消息 -->
      <view v-if="!chatStore.messages.length" class="welcome">
        <view class="welcome-icon">
          <text class="welcome-emoji">AI</text>
        </view>
        <text class="welcome-title">贝护妈妈 AI 助手</text>
        <text class="welcome-desc">您可以向我咨询母婴健康相关问题</text>
        <view class="welcome-hints">
          <view
            v-for="(hint, i) in quickHints"
            :key="i"
            class="hint-card"
            @tap="onQuickHint(hint)"
          >
            <text>{{ hint }}</text>
          </view>
        </view>
        <text class="welcome-disclaimer">{{ disclaimerText }}</text>
      </view>

      <!-- 消息气泡 -->
      <view v-for="(msg, index) in chatStore.messages" :key="msg.id" :id="'msg-' + index">
        <ChatBubble
          :message="msg"
          :is-streaming="chatStore.isStreaming && index === chatStore.messages.length - 1"
          :show-disclaimer="index === chatStore.messages.length - 1 && !chatStore.isStreaming"
          @follow-up="onFollowUp"
        />
      </view>

      <!-- 底部占位 -->
      <view id="msg-bottom" style="height: 20rpx" />
    </scroll-view>

    <!-- 输入栏 -->
    <view class="input-bar" :style="{ paddingBottom: keyboardHeight + 'px' }">
      <view class="input-actions-left">
        <view class="action-btn" @tap="showHistory = true">
          <text class="action-icon">&#xe8b8;</text>
        </view>
      </view>
      <view class="input-wrapper">
        <input
          v-model="inputText"
          class="input-field"
          :placeholder="chatStore.isStreaming ? '正在回答中...' : '请输入您的问题'"
          :disabled="chatStore.isStreaming"
          confirm-type="send"
          :adjust-position="false"
          @confirm="onSend"
          @keyboardheightchange="onKeyboardHeight"
        />
      </view>
      <view
        class="send-btn"
        :class="{ active: canSend, streaming: chatStore.isStreaming }"
        @tap="chatStore.isStreaming ? chatStore.cancelStreaming() : onSend()"
      >
        <text>{{ chatStore.isStreaming ? '停止' : '发送' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { getDisclaimer } from '@/api/ai'
import { wsManager } from '@/utils/websocket'
import ChatBubble from '@/components/ChatBubble.vue'
import EmergencyBanner from '@/components/EmergencyBanner.vue'
import dayjs from 'dayjs'

const chatStore = useChatStore()

const inputText = ref('')
const showHistory = ref(false)
const scrollTarget = ref('')
const keyboardHeight = ref(0)

const disclaimerText = getDisclaimer()

const quickHints = [
  '怀孕初期应该注意什么？',
  '孕期可以吃什么水果？',
  '宝宝发烧怎么处理？',
  '产后恢复有什么建议？',
]

const canSend = computed(() => inputText.value.trim().length > 0 && !chatStore.isStreaming)

const hasEmergency = computed(() =>
  chatStore.messages.some(m => m.isEmergency),
)

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const d = dayjs(dateStr)
  const now = dayjs()
  if (d.isSame(now, 'day')) return d.format('HH:mm')
  if (d.isSame(now.subtract(1, 'day'), 'day')) return '昨天'
  return d.format('MM/DD')
}

function scrollToBottom() {
  nextTick(() => {
    scrollTarget.value = ''
    nextTick(() => {
      scrollTarget.value = 'msg-bottom'
    })
  })
}

async function onSend() {
  const text = inputText.value.trim()
  if (!text || chatStore.isStreaming) return
  inputText.value = ''
  await chatStore.sendMessage(text)
  scrollToBottom()
}

function onQuickHint(hint: string) {
  inputText.value = hint
  onSend()
}

function onFollowUp(question: string) {
  inputText.value = question
  onSend()
}

function onNewChat() {
  chatStore.startNewConversation()
  showHistory.value = false
}

async function onSelectConversation(id: string) {
  await chatStore.loadConversationHistory(id)
  showHistory.value = false
  scrollToBottom()
}

function onDeleteConversation(id: string) {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复，确定要删除该对话吗？',
    success: (res) => {
      if (res.confirm) {
        chatStore.deleteConversation(id)
      }
    },
  })
}

function onKeyboardHeight(e: { detail: { height: number } }) {
  keyboardHeight.value = e.detail.height
  if (e.detail.height > 0) {
    scrollToBottom()
  }
}

onMounted(() => {
  const token = uni.getStorageSync('token')
  if (token) {
    wsManager.connect()
    chatStore.loadConversations()
  }
})

onUnmounted(() => {
  // 不断开 WebSocket，其他页面可能也需要
})
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
}

/* 历史对话侧栏 */
.history-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
}
.history-panel {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 75%;
  max-width: 600rpx;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 40rpx 24rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.history-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}
.history-new {
  font-size: 26rpx;
  color: #ff6b9d;
  font-weight: 500;
}
.history-list {
  flex: 1;
}
.history-loading,
.history-empty {
  padding: 60rpx 24rpx;
  text-align: center;
  color: #999;
  font-size: 26rpx;
}
.history-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.history-item.active {
  background: #fff0f5;
}
.history-item-content {
  flex: 1;
  min-width: 0;
}
.history-item-title {
  font-size: 28rpx;
  color: #333;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-item-meta {
  font-size: 22rpx;
  color: #bbb;
  margin-top: 6rpx;
  display: block;
}
.history-item-delete {
  font-size: 24rpx;
  color: #ff4d4f;
  padding: 8rpx 16rpx;
  flex-shrink: 0;
}

/* 消息列表 */
.message-list {
  flex: 1;
  overflow: hidden;
}

/* 欢迎页 */
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx 40rpx;
}
.welcome-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff6b9d, #ff8a65);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}
.welcome-emoji {
  font-size: 48rpx;
  color: #fff;
  font-weight: bold;
}
.welcome-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
}
.welcome-desc {
  font-size: 26rpx;
  color: #999;
  margin-bottom: 40rpx;
}
.welcome-hints {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.hint-card {
  background: #f5f7fa;
  padding: 24rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
}
.welcome-disclaimer {
  margin-top: 40rpx;
  font-size: 20rpx;
  color: #ccc;
  text-align: center;
  line-height: 1.6;
  padding: 0 20rpx;
}

/* 输入栏 */
.input-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid #f0f0f0;
  background: #fff;
  gap: 12rpx;
}
.input-actions-left {
  flex-shrink: 0;
}
.action-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 50%;
}
.action-icon {
  font-size: 32rpx;
  color: #666;
}
.input-wrapper {
  flex: 1;
  background: #f5f7fa;
  border-radius: 32rpx;
  padding: 0 24rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
}
.input-field {
  width: 100%;
  font-size: 28rpx;
  color: #333;
}
.send-btn {
  flex-shrink: 0;
  padding: 14rpx 28rpx;
  border-radius: 32rpx;
  background: #e8e8e8;
  font-size: 28rpx;
  color: #999;
  transition: all 0.2s;
}
.send-btn.active {
  background: #ff6b9d;
  color: #fff;
}
.send-btn.streaming {
  background: #ff4d4f;
  color: #fff;
}
</style>
