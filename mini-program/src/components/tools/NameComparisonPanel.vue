<template>
  <view class="comparison-panel">
    <view class="panel-head"><text class="panel-title">挑名字，一起比较</text><text class="panel-count">{{ selected.length }} / 5 个</text></view>
    <view class="panel-tabs">
      <button :class="{ active: tab === 'current' }" @tap="tab = 'current'">本次对比</button>
      <button :class="{ active: tab === 'history' }" @tap="tab = 'history'">历史记录 {{ history.length }}</button>
    </view>
    <view v-if="tab === 'current'">
      <text v-if="!selected.length" class="hint empty">从下方名字卡或收藏中选 1–5 个候选名，比较含义和风格。</text>
      <view v-else>
        <view class="selected-names"><button v-for="item in selected" :key="item.id" :disabled="busy" @tap="$emit('remove', item)">{{ item.fullName }} ×</button></view>
        <text class="section-label">喜欢什么风格 <text class="optional">选 1–3 项</text></text>
        <view class="preferences"><button v-for="preference in NAME_EVALUATION_PREFERENCES" :key="preference" :class="{ chosen: preferences.includes(preference) }" :disabled="busy" @tap="togglePreference(preference)">{{ preferences.includes(preference) ? '✓ ' : '' }}{{ preference }}</button></view>
        <text class="hint">资料对比保留读音、含义和参考原句；AI 按你选择的风格提供 1–5 级匹配评分。</text>
        <view class="panel-actions">
          <button class="secondary" :disabled="busy || !preferences.length" @tap="compareLocally">资料对比</button>
          <button class="primary" :loading="busy" :disabled="busy || !preferences.length || !NAME_EVALUATION_AI_ENABLED" @tap="evaluate">{{ busy ? '评测中…' : NAME_EVALUATION_AI_ENABLED ? 'AI 评测' : 'AI 评测待开放' }}</button>
        </view>
        <text v-if="NAME_EVALUATION_AI_ENABLED" class="hint">本次评测经确认后发送所选名字的库内释义与风格偏好。不会发送姓氏、账号资料或家人信息给模型。</text>
        <text v-else class="hint">当前可使用资料对比并保存记录；AI 评测开放后可在这里使用。</text>
      </view>
      <text v-if="notice" class="notice">{{ notice }}</text>
      <text v-if="savedAt" class="saved">最近保存 · {{ formatDate(savedAt) }} · 本机记录</text>
      <NameEvaluationResults v-if="result" :result="result" />
    </view>
    <view v-else>
      <text class="hint">保留本机最近 10 次结果，可展开查看或删除。更换设备不会同步。</text>
      <text v-if="!history.length" class="hint empty">还没有对比记录。选好名字后，点击资料对比或 AI 评测即可保存。</text>
      <view v-for="entry in history" :key="entry.id" class="history-entry">
        <button class="history-open" @tap="expanded = expanded === entry.id ? '' : entry.id">
          <text class="history-names">{{ entry.result.candidates.map(item => item.fullName).join(' · ') }}</text>
          <text class="hint">{{ formatDate(entry.createdAt) }} · {{ entry.result.source === 'ai' ? 'AI 评测' : '资料对比' }} · {{ expanded === entry.id ? '收起' : '查看' }}</text>
        </button>
        <view v-if="expanded === entry.id"><NameEvaluationResults :result="entry.result" /><button class="delete-button" @tap="removeHistory(entry.id)">删除这次记录</button></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { nameLibraryApi } from '@/api/modules'
import { NAME_EVALUATION_AI_ENABLED } from '@/config/features'
import { NAME_EVALUATION_PREFERENCES, type NameLibraryItem, type NameEvaluationPreference, type NameEvaluationResponse } from '../../../../shared/types/name-library'
import { NAME_EVALUATIONS_KEY, NAME_PREFERENCE_DRAFT_KEY, MAX_NAME_EVALUATIONS, readNameEvaluations, type SavedNameEvaluation } from '../../../../shared/utils/name-evaluation'
import { buildNameComparison } from '../../../../src/services/name-evaluation-rules'
import NameEvaluationResults from './NameEvaluationResults.vue'

const props = defineProps<{ selected: NameLibraryItem[] }>()
const emit = defineEmits<{ remove: [item: NameLibraryItem]; busy: [value: boolean] }>()
const tab = ref<'current' | 'history'>('current')
const preferences = ref<NameEvaluationPreference[]>(['清雅', '简洁'])
const result = ref<NameEvaluationResponse | null>(null)
const history = ref<SavedNameEvaluation[]>([])
const expanded = ref('')
const busy = ref(false)
const notice = ref('')
const savedAt = ref('')
let generation = 0
try { history.value = readNameEvaluations(uni.getStorageSync(NAME_EVALUATIONS_KEY)) } catch { /* Empty history. */ }
try {
  const saved = uni.getStorageSync(NAME_PREFERENCE_DRAFT_KEY)
  if (Array.isArray(saved) && saved.length <= 3 && new Set(saved).size === saved.length
    && saved.every(item => NAME_EVALUATION_PREFERENCES.includes(item))) preferences.value = saved
} catch { /* Use initial preferences. */ }

watch(() => [props.selected.map(item => item.fullName).join(','), preferences.value.join(',')], () => {
  generation += 1
  result.value = null
  notice.value = ''
  savedAt.value = ''
})
watch(busy, value => emit('busy', value))
watch(preferences, value => {
  try { uni.setStorageSync(NAME_PREFERENCE_DRAFT_KEY, value) }
  catch { notice.value = '风格偏好未能保存在本机，重新进入后需要再次选择。' }
})
onUnmounted(() => { generation += 1 })
const formatDate = (date: string) => {
  const value = new Date(date)
  return `${value.getFullYear()}/${value.getMonth() + 1}/${value.getDate()} ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}
const togglePreference = (preference: NameEvaluationPreference) => {
  if (preferences.value.includes(preference)) preferences.value = preferences.value.filter(item => item !== preference)
  else if (preferences.value.length < 3) preferences.value = [...preferences.value, preference]
  else uni.showToast({ title: '最多选择 3 种风格', icon: 'none' })
}
const input = () => ({
  surname: props.selected[0].fullName.slice(0, -props.selected[0].givenName.length),
  candidateIds: props.selected.map(item => item.id), preferences: [...preferences.value],
})
function save(value: NameEvaluationResponse, request: ReturnType<typeof input>) {
  const createdAt = new Date().toISOString()
  const entry = readNameEvaluations([{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt, input: request, result: value }])[0]
  if (!entry) throw new Error('评测资料有更新，请重新进入起名页后再试')
  result.value = entry.result
  const next = [entry, ...history.value].slice(0, MAX_NAME_EVALUATIONS)
  try {
    uni.setStorageSync(NAME_EVALUATIONS_KEY, next)
    history.value = next
    savedAt.value = createdAt
  } catch { notice.value = '结果已展示，但本机空间不足，未能保存历史记录。' }
}
function compareLocally() {
  if (busy.value || !props.selected.length || !preferences.value.length) return
  notice.value = ''
  savedAt.value = ''
  try { const request = input(); save(buildNameComparison(request), request) }
  catch { notice.value = '部分候选名已更新，请移除后重新选择。' }
}
async function evaluate() {
  if (busy.value || !NAME_EVALUATION_AI_ENABLED || !props.selected.length || !preferences.value.length) return
  if (!uni.getStorageSync('token')) {
    uni.navigateTo({ url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/name-library/index') })
    return
  }
  busy.value = true
  const current = generation
  const request = input()
  try {
    const confirmed = await new Promise<boolean>(resolve => uni.showModal({
      title: '确认本次 AI 评测',
      content: '将向 TypeSafe（Jev）发送所选名字的库内释义和风格偏好，生成主观匹配评分。姓名组合仅在贝护内处理，模型不会收到姓氏。本次请求使用 AI 额度，结果保存在本机。',
      confirmText: '同意评测', success: response => resolve(response.confirm), fail: () => resolve(false),
    }))
    if (!confirmed || current !== generation) return
    notice.value = ''
    savedAt.value = ''
    const response = await nameLibraryApi.evaluate({ ...request, consent: true })
    if (current !== generation) return
    if (response.source === 'rules') notice.value = '这次未获得可靠的 AI 评分，已为你保留资料对比，可稍后重试。'
    save(response, request)
  } catch (error) {
    if (current === generation) notice.value = `${error instanceof Error ? error.message : '评测没有完成'}。可稍后重试或使用资料对比。`
  } finally { busy.value = false }
}
function removeHistory(id: string) {
  uni.showModal({ title: '删除这次对比？', content: '删除后无法恢复，已收藏的名字仍会保留。', success: response => {
    if (!response.confirm) return
    const next = history.value.filter(entry => entry.id !== id)
    try {
      uni.setStorageSync(NAME_EVALUATIONS_KEY, next)
      if (history.value.find(entry => entry.id === id)?.createdAt === savedAt.value) { result.value = null; savedAt.value = '' }
      history.value = next
      expanded.value = ''
    }
    catch { uni.showToast({ title: '删除失败，请重试', icon: 'none' }) }
  } })
}
</script>

<style scoped>
.comparison-panel { margin-top: 24rpx; padding: 24rpx; border-radius: 24rpx; border: 1rpx solid #ead9cc; background: #fffaf6; }
button { margin: 0; line-height: 1.5; font-size: 24rpx; } button::after { border: 0; }
.panel-head { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; }
.panel-title { color: #46312a; font-size: 30rpx; font-weight: 800; }.panel-count { color: #79665b; font-size: 22rpx; }
.panel-tabs { display: flex; margin: 20rpx 0; padding: 6rpx; border-radius: 16rpx; background: #f3e8df; }
.panel-tabs button { flex: 1; padding: 14rpx 8rpx; border-radius: 12rpx; color: #79665b; background: transparent; }
.panel-tabs .active { color: #8a4d32; background: #fff; font-weight: 700; }
.hint, .notice, .saved { display: block; color: #766359; font-size: 22rpx; line-height: 1.65; margin-top: 12rpx; }.empty { padding: 24rpx 0; }
.selected-names, .preferences { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 16rpx; }
.selected-names button { padding: 12rpx 16rpx; background: #f3e0d3; color: #80523c; border-radius: 12rpx; }
.section-label { display: block; margin-top: 24rpx; color: #46312a; font-size: 26rpx; font-weight: 700; }.optional { margin-left: 12rpx; color: #79665b; font-size: 22rpx; font-weight: 400; }
.preferences button { padding: 12rpx 20rpx; border: 1rpx solid #e6dbd3; border-radius: 999rpx; color: #766359; background: #fff; }
.preferences .chosen { color: #8a4d32; border-color: #b76d4d; background: #fbefe8; }
.panel-actions { display: flex; gap: 16rpx; margin-top: 24rpx; }.panel-actions button { flex: 1; padding: 20rpx 8rpx; border-radius: 16rpx; font-weight: 700; }
.primary { color: #fff; background: #b76d4d; }.secondary { color: #8a4d32; background: #f3e0d3; }.primary[disabled] { background: #eee7e1; color: #766359; }
.notice { padding: 16rpx; border-radius: 12rpx; background: #f7e8da; color: #80523c; }.saved { color: #506c57; }
.history-entry { margin-top: 16rpx; border-top: 1rpx solid #ead9cc; }.history-open { width: 100%; padding: 20rpx 0; text-align: left; background: transparent; }
.history-names { display: block; color: #46312a; font-size: 26rpx; font-weight: 700; }.delete-button { margin: 20rpx 0; padding: 16rpx; color: #8a4d32; background: #f3e0d3; }
</style>
