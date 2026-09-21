<template>
  <view class="shortcut-editor">
    <text class="editor-hint">最多 {{ MAX_HOME_TOOLS }} 项，设置保存在此设备。用上移、下移调整首页顺序。</text>
    <text v-if="!ids.length" class="editor-hint">首页暂未添加工具，可以从全部工具中选择。</text>
    <view v-for="(id, index) in ids" :key="id" class="editor-row">
      <text class="editor-name">{{ index + 1 }}. {{ getToolDefinition(id).title }}</text>
      <button class="editor-action" :disabled="index === 0" :aria-label="`上移${getToolDefinition(id).title}`" @tap="emit('change', moveHomeTool(ids, index, -1))">上移</button>
      <button class="editor-action" :disabled="index === ids.length - 1" :aria-label="`下移${getToolDefinition(id).title}`" @tap="emit('change', moveHomeTool(ids, index, 1))">下移</button>
      <button class="editor-action editor-remove" :aria-label="`从首页移除${getToolDefinition(id).title}`" @tap="emit('change', ids.filter(item => item !== id))">移除</button>
    </view>
    <button class="reset-button" @tap="emit('change', recommendedHomeTools(stage))">恢复阶段推荐</button>
  </view>
</template>
<script setup lang="ts">
import { getToolDefinition, type ToolId, type ToolStage } from '@/data/tool-catalog'
import { MAX_HOME_TOOLS, moveHomeTool, recommendedHomeTools } from '@/utils/home-tools'
defineProps<{ ids: ToolId[]; stage: ToolStage }>()
const emit = defineEmits<{ change: [ids: ToolId[]] }>()
</script>
<style scoped>
.shortcut-editor { padding-top: 16rpx; }
.editor-hint { display: block; color: #766b67; font-size: 24rpx; line-height: 1.6; margin-bottom: 12rpx; }
.editor-row { display: flex; align-items: center; gap: 4rpx; border-top: 1rpx solid #eee6e1; }
.editor-name { flex: 1; min-width: 0; color: #4a4240; font-size: 25rpx; }
.editor-action { min-width: 88rpx; margin: 0; padding: 22rpx 10rpx; min-height: 88rpx; background: transparent; color: #166c5b; font-size: 24rpx; line-height: 1.8; flex-shrink: 0; }
.editor-action[disabled] { color: #aaa29d; background: transparent; }
.editor-remove { color: #966050; }
button::after { border: 0; }
.reset-button { margin-top: 14rpx; padding: 20rpx; background: #edf5f1; color: #166c5b; border-radius: 16rpx; font-size: 26rpx; line-height: 1.8; }
</style>
