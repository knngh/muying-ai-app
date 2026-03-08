<script setup lang="ts">
defineProps<{
  role: 'user' | 'assistant'
  content: string
  sources?: { name: string; url?: string }[]
  disclaimer?: boolean
}>()
</script>

<template>
  <view :class="['msg', role]">
    <view class="bubble">
      <text class="text">{{ content }}</text>
      <view v-if="sources && sources.length" class="sources">
        <text class="label">参考来源：</text>
        <text v-for="(s, i) in sources" :key="i" class="source">{{ s.name }}</text>
      </view>
      <view v-if="disclaimer" class="disclaimer">
        本建议仅供参考，不能替代医生诊断。如有不适请及时就医。
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.msg {
  margin-bottom: 24rpx;
  &.user {
    display: flex;
    justify-content: flex-end;
    .bubble {
      background: #5b9cff;
      color: #fff;
      max-width: 80%;
      border-radius: 16rpx 16rpx 4rpx 16rpx;
    }
  }
  &.assistant .bubble {
    background: #f0f5ff;
    color: #333;
    max-width: 90%;
    border-radius: 16rpx 16rpx 16rpx 4rpx;
  }
}
.bubble {
  padding: 20rpx 24rpx;
  .text {
    font-size: 28rpx;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .sources {
    margin-top: 12rpx;
    font-size: 22rpx;
    color: #666;
    .label { margin-right: 4rpx; }
    .source { margin-right: 8rpx; }
  }
  .disclaimer {
    margin-top: 12rpx;
    font-size: 22rpx;
    color: #999;
  }
}
</style>
