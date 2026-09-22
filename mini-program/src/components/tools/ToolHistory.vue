<template>
  <view class="tool-panel history-panel">
    <view class="panel-head"><text class="panel-title">{{ title || '历史记录' }}</text><text class="panel-badge">共 {{ records.length }} 条</text></view>
    <input v-if="records.length" v-model="query" class="panel-input history-search" placeholder="搜索内容、备注或日期" maxlength="80" />
    <view v-if="!filtered.length" class="history-empty"><text>{{ records.length ? '没有找到匹配记录' : '还没有保存记录' }}</text><text class="panel-hint">{{ records.length ? '换个关键词再试试。' : '保存后会出现在这里，再次打开也能查看。' }}</text></view>
    <view v-for="record in filtered.slice(0, limit)" :key="record.id" class="history-item">
      <button class="history-open" @tap="expanded = expanded === record.id ? '' : record.id">
        <view class="history-copy"><text class="history-title">{{ historyTitle(record) }}</text><text class="panel-hint">{{ historyDate(record) }} · {{ record.syncStatus === 'synced' ? '已同步' : '本机保存' }}</text></view>
        <text class="history-chevron">{{ expanded === record.id ? '收起' : '详情 ›' }}</text>
      </button>
      <view v-if="expanded === record.id" class="history-details">
        <view v-for="field in historyDetails(record)" :key="field.label" class="history-field"><text class="history-label">{{ field.label }}</text><text class="history-value" selectable>{{ field.value }}</text></view>
        <image v-if="imagePath(record) && !failedImages[record.id]" :src="imagePath(record)" class="history-image" mode="widthFix" @tap="preview(record)" @error="failedImages[record.id] = true" />
        <text v-if="imagePath(record) && failedImages[record.id]" class="panel-hint">这张旧图片已不在本机，文字记录仍保留。</text>
        <button class="panel-button panel-button--quiet" @tap="emit('remove', record)">从本机移除</button>
      </view>
    </view>
    <button v-if="filtered.length > limit" class="panel-button panel-button--secondary history-more" @tap="limit += 20">查看更多（还有 {{ filtered.length - limit }} 条）</button>
    <text v-if="records.length" class="panel-hint">本机记录保存在此设备。清理小程序数据前，请保留重要资料的其他副本。</text>
  </view>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { LocalToolRecord } from '@/utils/tool-records'
import { historyDate, historyDetails, historyTitle } from '@/utils/tool-history'
const props = defineProps<{ records: LocalToolRecord[]; title?: string }>()
const emit = defineEmits<{ remove: [record: LocalToolRecord] }>()
const query = ref(''), expanded = ref(''), limit = ref(20), failedImages = ref<Record<string, boolean>>({})
const filtered = computed(() => props.records.filter(record => `${historyTitle(record)} ${historyDate(record)} ${historyDetails(record).map(field => field.value).join(' ')}`.toLowerCase().includes(query.value.trim().toLowerCase())))
watch(query, () => { limit.value = 20 })
function imagePath(record: LocalToolRecord): string { return typeof record.payload.path === 'string' ? record.payload.path : '' }
function preview(record: LocalToolRecord) { uni.previewImage({ urls: [imagePath(record)], fail: () => { failedImages.value[record.id] = true } }) }
</script>
<style scoped lang="scss">
@use './tool-panel.scss';
.history-search { margin-top: 20rpx; }.history-empty { padding: 56rpx 0; text-align: center; color: #766b67; }
.history-item { border-bottom: 1rpx solid #eee7e1; }.history-open { display: flex; align-items: center; gap: 16rpx; padding: 24rpx 0; width: 100%; background: transparent; text-align: left; line-height: 1.5; }.history-open::after { border: 0; }
.history-copy { flex: 1; min-width: 0; }.history-title { display: block; color: #443c3a; font-size: 28rpx; font-weight: 600; overflow-wrap: anywhere; }.history-chevron { color: #166c5b; font-size: 24rpx; flex-shrink: 0; }
.history-details { padding: 0 0 20rpx; }.history-field { margin-bottom: 16rpx; }.history-label { display: block; color: #766b67; font-size: 23rpx; }.history-value { display: block; margin-top: 6rpx; color: #443c3a; font-size: 27rpx; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; }
.history-image { width: 100%; display: block; margin: 16rpx 0; border-radius: 16rpx; }.history-more { margin: 24rpx auto 0; }
</style>
