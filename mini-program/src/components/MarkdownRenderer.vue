<template>
  <view class="markdown-content">
    <mp-html :content="htmlContent" />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps<{
  content: string
}>()

const md = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: true,
})

const htmlContent = computed(() => {
  if (!props.content) return ''
  return md.render(props.content)
})
</script>

<style scoped>
.markdown-content {
  font-size: 28rpx;
  color: #333;
  line-height: 1.7;
  word-break: break-word;
}
</style>
