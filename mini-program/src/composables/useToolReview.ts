import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { toolRecordApi } from '@/api/modules'
import { TOOL_AI_ENABLED } from '@/config/features'
import { getToolDefinition } from '@/data/tool-catalog'
import type { LocalToolRecord } from '@/utils/tool-records'
import { reportOwner } from '@/utils/report-drafts'
import { isToolReviewResponse, localToolReview, MAX_REVIEW_RECORDS, readSavedReviews, reviewInputs, selectReviewRecords, writeSavedReviews, type SavedToolReview } from '@/utils/tool-review'

export function useToolReview(props: { toolId: string; records: LocalToolRecord[]; week: number | null; owner: string }) {
  const expanded = ref(false), busy = ref(false), consent = ref(false), message = ref('')
  const selectedIds = ref<string[]>([]), visibleCount = ref(20)
  const current = ref<SavedToolReview | null>(null), saved = ref<SavedToolReview[]>([])
  const inputs = computed(() => reviewInputs(props.records))
  const selected = computed(() => selectedIds.value.map(id => inputs.value.find(record => record.id === id)).filter((record): record is typeof inputs.value[number] => !!record).slice(0, MAX_REVIEW_RECORDS))
  const stage = computed(() => props.week ? `孕 ${props.week} 周` : '当前阶段')
  const label = computed(() => getToolDefinition(props.toolId).title)
  const isSaved = computed(() => !!current.value && saved.value.some(item => item.id === current.value?.id))
  let revision = 0
  let preparedSelection = false

  function loadSaved() {
    try { saved.value = readSavedReviews(props.owner, props.toolId, inputs.value) }
    catch { saved.value = []; message.value = '已保存回顾暂时无法读取，请检查本机存储空间。' }
  }
  function invalidate() { revision++; busy.value = false; current.value = null; consent.value = false; message.value = '' }
  watch(() => JSON.stringify([props.owner, props.toolId, stage.value, inputs.value]), () => {
    invalidate()
    selectedIds.value = preparedSelection ? [] : inputs.value.slice(0, MAX_REVIEW_RECORDS).map(record => record.id)
    if (preparedSelection) message.value = '记录已变化，请重新选择这一周的日记再整理。'
    loadSaved()
  }, { immediate: true, flush: 'sync' })
  function toggle(id: string) {
    if (busy.value) return
    if (!selectedIds.value.includes(id) && selected.value.length >= MAX_REVIEW_RECORDS) { message.value = '每次最多选 20 条，请先取消一条。'; return }
    invalidate()
    selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter(value => value !== id) : [...selectedIds.value, id]
  }
  function setSelection(all: boolean) {
    if (busy.value) return
    preparedSelection = false
    invalidate(); selectedIds.value = all ? inputs.value.slice(0, MAX_REVIEW_RECORDS).map(record => record.id) : []
  }
  function prepareSelection(ids: string[]): boolean {
    if (reportOwner() !== props.owner) { message.value = '账号已变化，请重新打开工具'; return false }
    invalidate()
    preparedSelection = true
    const selection = selectReviewRecords(inputs.value, ids)
    selectedIds.value = selection.ids; expanded.value = true
    visibleCount.value = Math.max(20, ...selection.ids.map(id => inputs.value.findIndex(item => item.id === id) + 1))
    if (!selection.total) { message.value = '这些日记已变化，请返回周记重新选择。'; return true }
    message.value = selection.total > MAX_REVIEW_RECORDS ? '本周超过 20 篇，已按日期选入前 20 篇。可取消或替换后再整理。' : '已选入这一周的日记，请核对正文后再整理。'
    return true
  }
  async function run(useAI: boolean) {
    if (busy.value || !selected.value.length) return
    if (reportOwner() !== props.owner) { message.value = '账号已变化，请重新打开工具'; return }
    if (useAI && (!TOOL_AI_ENABLED || !consent.value)) return
    if (useAI && (props.owner === 'guest' || reportOwner() !== props.owner)) { message.value = '请登录后使用 AI，或先选择本机摘要。'; return }
    const requestRevision = ++revision, owner = props.owner
    const requestStage = stage.value, records = selected.value.map(record => ({ ...record }))
    const local = () => localToolReview(label.value, records)
    const stillCurrent = () => requestRevision === revision && props.owner === owner && reportOwner() === owner
    busy.value = true; message.value = ''; current.value = null
    let result = local(), origin: SavedToolReview['origin'] = 'local'
    try {
      if (useAI) {
        const response = await toolRecordApi.reviewRecords({
          toolId: props.toolId as Parameters<typeof toolRecordApi.reviewRecords>[0]['toolId'],
          stage: requestStage, records: records.map(({ date, content }) => ({ date, content })), consent: true,
        })
        if (!isToolReviewResponse(response)) throw new Error('Invalid review response')
        result = response
        origin = result.source === 'ai' ? 'ai' : 'server-rules'
        if (stillCurrent() && origin === 'server-rules') message.value = '本次返回服务端规则摘要；所选记录已发送至服务端。'
      }
    } catch {
      if (stillCurrent()) message.value = 'AI 整理未完成，以下改用本机摘要。本次所选记录可能已送达服务端。'
      result = local()
    } finally {
      if (requestRevision === revision) busy.value = false
    }
    if (!stillCurrent()) {
      if (requestRevision === revision) { consent.value = false; message.value = '登录状态已变化，本次结果已丢弃。请重新登录或使用本机摘要。' }
      return
    }
    current.value = { id: `review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), stage: requestStage, records, result, origin }
  }
  function save() {
    if (!current.value || isSaved.value) return
    if (reportOwner() !== props.owner) { message.value = '账号已变化，请重新打开工具'; return }
    try {
      writeSavedReviews(props.owner, props.toolId, [current.value, ...saved.value]); loadSaved()
      message.value = '回顾已保存到本机，再次进入可在“已保存回顾”打开。'
    } catch { message.value = '回顾未能保存，请检查本机存储空间后重试。' }
  }
  function open(review: SavedToolReview) { invalidate(); selectedIds.value = review.records.map(record => record.id); current.value = review; expanded.value = true }
  function remove(review: SavedToolReview) {
    const owner = props.owner, toolId = props.toolId
    uni.showModal({ title: '删除这份回顾？', content: '仅删除本机回顾，原始记录会保留。', success: response => {
      if (!response.confirm || owner !== props.owner || toolId !== props.toolId) return
      try {
        writeSavedReviews(owner, toolId, saved.value.filter(item => item.id !== review.id)); loadSaved()
        if (current.value?.id === review.id) current.value = null
      } catch { message.value = '删除未完成，请重试。' }
    } })
  }
  function login() { uni.navigateTo({ url: `/pages/login/index?redirect=${encodeURIComponent(`/pages/tool-detail/index?id=${props.toolId}`)}` }) }
  onBeforeUnmount(() => { revision++ })
  return { expanded, busy, consent, message, selectedIds, visibleCount, current, saved, inputs, selected, stage, isSaved, toggle, setSelection, prepareSelection, run, save, open, remove, login }
}
