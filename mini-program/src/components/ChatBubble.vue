<template>
  <view class="chat-bubble" :class="[message.role, { emergency: message.isEmergency }]">
    <!-- 头像 -->
    <view class="bubble-avatar" :class="message.role">
      <text>{{ message.role === 'user' ? '我' : '答' }}</text>
    </view>

    <view class="bubble-body">
      <!-- 紧急标记 -->
      <view v-if="message.isEmergency && message.role === 'assistant'" class="emergency-tag">
        <text>需要关注</text>
      </view>

      <!-- 消息内容 -->
      <view class="bubble-content" :class="message.role">
        <MarkdownRenderer v-if="message.role === 'assistant'" :content="message.content" />
        <text v-else class="user-text">{{ message.content }}</text>

        <!-- 流式加载指示器 -->
        <view v-if="isStreaming && !message.content" class="typing-indicator">
          <view class="dot" /><view class="dot" /><view class="dot" />
        </view>
      </view>

      <!-- 来源引用 -->
      <SourceCitation
        v-if="message.role === 'assistant' && message.sources?.length"
        :sources="message.sources"
      />

      <!-- 跟进问题 -->
      <view v-if="message.followUpQuestions?.length && !isStreaming" class="follow-up">
        <view
          v-for="(q, i) in message.followUpQuestions"
          :key="i"
          class="follow-up-item"
          @tap="$emit('followUp', q)"
        >
          <text>{{ q }}</text>
        </view>
      </view>

      <!-- 免责声明 -->
      <view v-if="showDisclaimer && message.role === 'assistant' && message.content" class="disclaimer">
        <text>{{ disclaimerText }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { AIMessage } from '@/api/ai'
import { getDisclaimer } from '@/api/ai'
import MarkdownRenderer from './MarkdownRenderer.vue'
import SourceCitation from './SourceCitation.vue'

defineProps<{
  message: AIMessage
  isStreaming?: boolean
  showDisclaimer?: boolean
}>()

defineEmits<{
  followUp: [question: string]
}>()

const disclaimerText = getDisclaimer()
</script>

<style scoped>
.chat-bubble {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  align-items: flex-start;
}
.chat-bubble.user {
  flex-direction: row-reverse;
}
.bubble-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 600;
  flex-shrink: 0;
}
.bubble-avatar.user {
  background: #16806a;
  color: #fff;
}
.bubble-avatar.assistant {
  background: #edf8f4;
  color: #16806a;
}
.bubble-body {
  flex: 1;
  min-width: 0;
  max-width: 80%;
}
.bubble-content {
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  word-break: break-word;
}
.bubble-content.assistant {
  background: #f5f7fa;
  border-top-left-radius: 4rpx;
}
.bubble-content.user {
  background: #16806a;
  border-top-right-radius: 4rpx;
}
.user-text {
  color: #fff;
  font-size: 28rpx;
  line-height: 1.6;
}
.chat-bubble.emergency .bubble-content.assistant {
  background: #fff2f0;
  border: 1rpx solid #ffccc7;
}
.emergency-tag {
  display: inline-flex;
  background: #ff4d4f;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  margin-bottom: 8rpx;
}
.typing-indicator {
  display: flex;
  gap: 8rpx;
  padding: 8rpx 0;
}
.dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #999;
  animation: typing 1.4s infinite ease-in-out both;
}
.dot:nth-child(1) { animation-delay: 0s; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
.follow-up {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.follow-up-item {
  background: rgba(22, 128, 106, 0.1);
  color: #16806a;
  font-size: 24rpx;
  padding: 12rpx 20rpx;
  border-radius: 12rpx;
  line-height: 1.4;
}
.disclaimer {
  margin-top: 12rpx;
  font-size: 20rpx;
  color: #bbb;
  line-height: 1.5;
}
</style>
