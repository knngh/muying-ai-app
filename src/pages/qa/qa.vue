<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { sendQuestion } from '@/api/qa'
import type { QAMessage } from '@/api/types'
import ChatMessage from '@/components/ChatMessage.vue'

const messages = ref<QAMessage[]>([])
const input = ref('')
const sending = ref(false)

const welcome: QAMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '你好，我是母婴AI小助手。可以问我孕期护理、辅食添加、睡眠、疫苗等问题，回答均整理自权威来源，并会标注参考与免责说明。',
  timestamp: Date.now(),
}

onMounted(() => {
  messages.value = [welcome]
})

async function send() {
  const q = (input.value || '').trim()
  if (!q || sending.value) return
  const userMsg: QAMessage = {
    id: `u-${Date.now()}`,
    role: 'user',
    content: q,
    timestamp: Date.now(),
  }
  messages.value.push(userMsg)
  input.value = ''
  sending.value = true
  try {
    const res = await sendQuestion(q, messages.value)
    messages.value.push(res)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <view class="page">
    <scroll-view scroll-y class="list" :scroll-into-view="'msg-' + (messages.length - 1)">
      <view
        v-for="(m, i) in messages"
        :id="'msg-' + i"
        :key="m.id"
      >
        <ChatMessage
          :role="m.role"
          :content="m.content"
          :sources="m.sources"
          :disclaimer="m.disclaimer"
        />
      </view>
    </scroll-view>
    <view class="input-bar">
      <input
        v-model="input"
        class="input"
        placeholder="输入育儿问题..."
        confirm-type="send"
        @confirm="send"
      />
      <button class="btn" :disabled="sending" @click="send">发送</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8f8f8;
}
.list {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
}
.input-bar {
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: #fff;
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.input {
  flex: 1;
  height: 72rpx;
  padding: 0 24rpx;
  background: #f0f0f0;
  border-radius: 36rpx;
  font-size: 28rpx;
}
.btn {
  width: 120rpx;
  height: 72rpx;
  line-height: 72rpx;
  background: #5b9cff;
  color: #fff;
  font-size: 28rpx;
  border-radius: 36rpx;
  padding: 0;
}
</style>
