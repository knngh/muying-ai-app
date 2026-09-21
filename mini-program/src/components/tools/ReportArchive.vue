<template>
  <view>
    <view class="tool-panel">
      <text class="panel-title">留好每一份产检资料</text>
      <text class="panel-hint">拍照或选一张报告原图，也可以先记下名称。每份档案支持一张图片。</text>
      <text class="panel-label">报告日期</text>
      <picker mode="date" :value="date" @change="date = $event.detail.value"><view class="panel-input">{{ date }}</view></picker>
      <text class="panel-label">报告名称</text>
      <input v-model="name" class="panel-input" maxlength="100" placeholder="例如：28 周产检血常规" :disabled="busy" />
      <text class="panel-label">备注（可选）</text>
      <textarea v-model="note" class="panel-input panel-textarea" maxlength="500" placeholder="留下下次复诊想问的事" :disabled="busy" />
      <image v-if="imagePath" :src="imagePath" class="report-image" mode="aspectFit" @tap="preview(imagePath)" />
      <view class="panel-actions">
        <button class="panel-button panel-button--secondary" :disabled="busy" @tap="chooseImage">{{ imagePath ? '换一张图片' : '拍照 / 选图' }}</button>
        <button v-if="imagePath" class="panel-button panel-button--quiet" :disabled="busy" @tap="imagePath = ''">移除图片</button>
      </view>
      <view class="panel-actions">
        <button class="panel-button" :disabled="busy" @tap="saveDraft(false)">保存到本机</button>
        <button v-if="owner !== 'guest'" class="panel-button panel-button--secondary" :disabled="busy" :loading="busy" @tap="saveDraft(true)">保存并私有归档</button>
      </view>
      <text class="panel-hint">本机草稿仅在此设备保存，清理小程序数据会丢失。私有归档仅本人登录后可见。</text>
      <text class="panel-hint">自动识别暂未开放；可在云端档案中手动补充字段并核对，不提供检验结果解读。</text>
    </view>
    <view v-if="notice" class="panel-notice">{{ notice }}</view>
    <view class="tool-panel">
      <view class="panel-head"><text class="panel-title">本机草稿</text><text class="panel-badge">{{ drafts.length }} 份</text></view>
      <text v-if="!drafts.length" class="panel-hint">还没有草稿，先保存一份报告吧。</text>
      <view v-for="draft in drafts" :key="draft.id" class="panel-row">
        <text class="panel-row-title">{{ draft.name }}</text>
        <text class="panel-hint">{{ draft.reportDate }} · 本机保存</text>
        <text v-if="draft.note" class="panel-hint">{{ draft.note }}</text>
        <view class="panel-actions">
          <button v-if="draft.imagePath" class="panel-button panel-button--secondary" :disabled="busy" @tap="preview(draft.imagePath)">查看图片</button>
          <button v-if="owner !== 'guest'" class="panel-button panel-button--secondary" :disabled="busy" @tap="upload(draft)">归档 / 重试</button>
          <button class="panel-button panel-button--quiet" :disabled="busy" @tap="discard(draft)">删除本机</button>
        </view>
      </view>
      <button v-if="guestCount && owner !== 'guest'" class="panel-button panel-button--secondary import-button" :disabled="busy" @tap="importGuests">导入此设备游客草稿（{{ guestCount }}）</button>
    </view>
    <view class="tool-panel">
      <view class="panel-head"><text class="panel-title">私有归档</text><button class="panel-button panel-button--quiet" :disabled="loading || busy" @tap="refresh">刷新</button></view>
      <text v-if="owner === 'guest'" class="panel-hint">登录后可归档、查看和核对报告。本机草稿会保留。</text>
      <button v-if="owner === 'guest'" class="panel-button panel-button--secondary import-button" @tap="login">登录并返回</button>
      <text v-else-if="loadError" class="panel-hint">{{ loadError }}</text>
      <text v-else-if="loading && !documents.length" class="panel-hint">正在读取归档…</text>
      <text v-else-if="!documents.length" class="panel-hint">尚无云端报告，可从本机草稿选择归档。</text>
      <view v-for="item in documents" :key="item.id" class="panel-row">
        <text class="panel-row-title">{{ item.name }}</text>
        <text class="panel-hint">{{ item.reportDate }} · {{ status(item) }}</text>
        <view class="panel-actions">
          <button v-if="item.hasImage" class="panel-button panel-button--secondary" :disabled="busy" @tap="openOriginal(item)">查看原图</button>
          <button class="panel-button panel-button--secondary" :disabled="busy" @tap="select(item)">查看 / 核对</button>
          <button class="panel-button panel-button--quiet" :disabled="busy" @tap="removeArchive(item)">删除</button>
        </view>
      </view>
      <button v-if="nextCursor" class="panel-button panel-button--secondary import-button" :disabled="loading" @tap="loadMore">{{ loading ? '读取中…' : '更早的报告' }}</button>
    </view>
    <view v-if="selected" id="report-fields" class="tool-panel">
      <view class="panel-head"><text class="panel-title">{{ selected.name }}</text><button class="panel-button panel-button--quiet" @tap="selectedId = ''">收起</button></view>
      <text v-if="selected.note" class="panel-hint">{{ selected.note }}</text>
      <text class="panel-hint">请对照报告原图核对文字与单位。手动原文始终保留，确认仅用于归档。</text>
      <view v-for="field in selected.fields" :key="field.id" class="panel-row">
        <text class="panel-row-title">{{ field.label || field.fieldKey }} · 第 {{ field.pageNumber }} 页</text>
        <text class="panel-hint">{{ field.source === 'manual' ? '手动原文' : '识别原文' }}：{{ field.candidateValue }}</text>
        <text class="panel-label">核对后内容</text>
        <input v-model="edits[field.id]" class="panel-input" maxlength="500" :disabled="busy" />
        <text class="panel-hint">{{ field.confirmedAt ? '已确认 · 可更正后再次确认' : '待确认 · 尚未计入正式字段' }}</text>
        <button class="panel-button panel-button--secondary import-button" :disabled="busy" @tap="confirmField(field)">核对并确认</button>
      </view>
      <text class="panel-label">补充一个字段</text>
      <input v-model="fieldLabel" class="panel-input" maxlength="100" placeholder="项目名称，例如血红蛋白" :disabled="busy" />
      <input v-model="fieldValue" class="panel-input field-value" maxlength="500" placeholder="按原图填写数值与单位" :disabled="busy" />
      <button class="panel-button panel-button--secondary import-button" :disabled="busy" @tap="addField">保存待核对字段</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { toolRecordApi, type ReportDocumentRecord, type ReportFieldRecord } from '@/api/modules'
import { forgetReportDraft, keepReportImage, newReportOperationId, readReportDrafts, removeReportImage, reportOwner, writeReportDraft, type ReportDraft } from '@/utils/report-drafts'
const props = defineProps<{ owner: string }>()
const date = ref(localDate())
const name = ref(''), note = ref(''), imagePath = ref(''), notice = ref(''), loadError = ref('')
const busy = ref(false), loading = ref(false)
const drafts = ref<ReportDraft[]>([]), documents = ref<ReportDocumentRecord[]>([])
const guestCount = ref(0), nextCursor = ref<string | null>(null), selectedId = ref('')
const selected = computed(() => documents.value.find(item => item.id === selectedId.value))
const edits = ref<Record<string, string>>({}), fieldLabel = ref(''), fieldValue = ref('')
let fieldKey = newReportOperationId(), disposed = false
const downloaded: string[] = []
const current = () => !disposed && reportOwner() === props.owner
function removeDownloaded(filePath: string) {
  if (filePath) uni.getFileSystemManager().unlink({ filePath, fail: () => undefined })
}
function localDate() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }
function message(error: unknown) { return error instanceof Error ? error.message : '操作未完成，请重试' }
function reloadDrafts() { if (current()) { drafts.value = readReportDrafts(props.owner); guestCount.value = readReportDrafts('guest').length } }
function ask(content: string): Promise<boolean> { return new Promise(resolve => uni.showModal({ title: '请确认', content, success: result => resolve(result.confirm), fail: () => resolve(false) })) }
function preview(path: string) { if (current()) uni.previewImage({ urls: [path], fail: () => { notice.value = '图片暂时无法查看，请重新选择或稍后再试' } }) }
function login() { uni.navigateTo({ url: `/pages/login/index?redirect=${encodeURIComponent('/pages/tool-detail/index?id=reports')}` }) }
function chooseImage() {
  uni.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['camera', 'album'], success: result => {
    if (!current()) return
    const files = result.tempFiles as { size: number }[]
    if (files[0]?.size > 8 * 1024 * 1024) { notice.value = '请选择不超过 8MB 的报告图片'; return }
    imagePath.value = result.tempFilePaths[0] || ''
  } })
}
async function saveDraft(toCloud: boolean) {
  if (busy.value || !current()) return
  if (!name.value.trim()) { notice.value = '请填写报告名称'; return }
  busy.value = true
  let savedImage = '', saved = false
  try {
    const draft: ReportDraft = { id: newReportOperationId(), name: name.value.trim(), note: note.value.trim(), reportDate: date.value, imagePath: '', createdAt: new Date().toISOString() }
    if (imagePath.value) savedImage = await keepReportImage(imagePath.value)
    if (!current()) return
    draft.imagePath = savedImage
    writeReportDraft(props.owner, draft)
    saved = true
    name.value = ''; note.value = ''; imagePath.value = ''
    reloadDrafts()
    notice.value = '草稿已保存到本机'
    if (toCloud) await sendDraft(draft)
  } catch (error) { if (current()) notice.value = message(error) }
  finally { if (!saved && savedImage) await removeReportImage(savedImage); busy.value = false }
}
async function sendDraft(draft: ReportDraft) {
  if (props.owner === 'guest' || !current()) return
  const remote = await toolRecordApi.createReport(draft.imagePath || null, { name: draft.name, note: draft.note, reportDate: draft.reportDate, clientOperationId: draft.id })
  if (!current()) return
  documents.value = [remote, ...documents.value.filter(item => item.id !== remote.id)]
  forgetReportDraft(props.owner, draft.id)
  await removeReportImage(draft.imagePath)
  reloadDrafts()
  notice.value = '已归档，原图与字段仅本人可见'
}
async function upload(draft: ReportDraft) {
  if (busy.value || !current()) return
  busy.value = true
  try { await sendDraft(draft) }
  catch (error) { if (current()) notice.value = `${message(error)}。本机草稿保留，可重试归档。` }
  finally { busy.value = false }
}
async function discard(draft: ReportDraft) {
  if (!await ask('删除这份本机草稿和本机图片？已归档到云端的资料需要在“私有归档”中另行删除。') || !current()) return
  try { forgetReportDraft(props.owner, draft.id); await removeReportImage(draft.imagePath); reloadDrafts() }
  catch (error) { notice.value = message(error) }
}
async function importGuests() {
  if (!await ask('将此设备的游客报告草稿移入当前账号的本机草稿？不会自动上传。') || !current()) return
  try {
    for (const draft of readReportDrafts('guest')) { writeReportDraft(props.owner, draft); forgetReportDraft('guest', draft.id) }
    reloadDrafts(); notice.value = '已导入当前账号的本机草稿'
  } catch (error) { notice.value = message(error); reloadDrafts() }
}
async function load(beforeId?: string) {
  if (loading.value || props.owner === 'guest' || !current()) return
  loading.value = true; loadError.value = ''
  try {
    const result = await toolRecordApi.getReports(beforeId)
    if (!current()) return
    const merged = beforeId ? [...documents.value] : []
    result.list.forEach(item => { const index = merged.findIndex(old => old.id === item.id); if (index < 0) merged.push(item); else merged[index] = item })
    documents.value = merged; nextCursor.value = result.nextCursor
    for (const draft of readReportDrafts(props.owner)) {
      if (result.list.some(item => item.clientOperationId === draft.id)) { forgetReportDraft(props.owner, draft.id); await removeReportImage(draft.imagePath) }
    }
    reloadDrafts()
  } catch (error) { if (current()) loadError.value = `${message(error)}，点击刷新重试。` }
  finally { loading.value = false }
}
function refresh() { reloadDrafts(); void load() }
function loadMore() { if (nextCursor.value) void load(nextCursor.value) }
function status(item: ReportDocumentRecord) {
  const total = item.fields.length, confirmed = item.fields.filter(field => field.confirmedAt).length
  return total ? `字段已核对 ${confirmed}/${total}` : item.hasImage ? '原图已归档' : '文字已归档'
}
async function openOriginal(item: ReportDocumentRecord) {
  if (busy.value || !current()) return
  busy.value = true
  try {
    const file = await new Promise<string>((resolve, reject) => uni.downloadFile({
      url: toolRecordApi.getReportFileUrl(item.id), header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
      success: result => {
        if (!current() || result.statusCode !== 200) {
          removeDownloaded(result.tempFilePath)
          reject(new Error('原图暂不可用，请检查登录状态后重试'))
          return
        }
        downloaded.push(result.tempFilePath)
        resolve(result.tempFilePath)
      },
      fail: () => reject(new Error('原图下载失败，请重试')),
    }))
    if (current()) preview(file)
  } catch (error) { if (current()) notice.value = message(error) }
  finally { busy.value = false }
}
async function removeArchive(item: ReportDocumentRecord) {
  if (!await ask('删除这份云端报告、原图和已记录字段？此操作无法恢复。') || !current()) return
  busy.value = true
  try {
    await toolRecordApi.deleteReport(item.id)
    if (!current()) return
    documents.value = documents.value.filter(record => record.id !== item.id)
    notice.value = '报告与原图已删除'
  } catch (error) { if (current()) notice.value = `${message(error)}，可重新点击删除。` }
  finally { busy.value = false }
}
function select(item: ReportDocumentRecord) {
  selectedId.value = item.id; fieldLabel.value = ''; fieldValue.value = ''; fieldKey = newReportOperationId()
  edits.value = Object.fromEntries(item.fields.map(field => [field.id, field.normalizedValue || field.candidateValue]))
  setTimeout(() => uni.pageScrollTo({ selector: '#report-fields', duration: 200 }), 50)
}
async function addField() {
  const report = selected.value
  if (!report || busy.value || !current()) return
  if (!fieldLabel.value.trim() || !fieldValue.value.trim()) { notice.value = '请填写项目名称、数值和单位'; return }
  busy.value = true
  try {
    const field = await toolRecordApi.addReportField(report.id, { fieldKey, label: fieldLabel.value.trim(), candidateValue: fieldValue.value.trim() })
    if (!current()) return
    if (!report.fields.some(item => item.id === field.id)) report.fields.push(field)
    edits.value[field.id] = field.normalizedValue || field.candidateValue
    fieldLabel.value = ''; fieldValue.value = ''; fieldKey = newReportOperationId(); notice.value = '已保存原文，请核对后确认'
  } catch (error) { if (current()) notice.value = message(error) }
  finally { busy.value = false }
}
async function confirmField(field: ReportFieldRecord) {
  const report = selected.value
  if (!report || busy.value || !current()) return
  const value = edits.value[field.id]?.trim()
  if (!value) { notice.value = '请填写核对后的内容'; return }
  busy.value = true
  try {
    const confirmed = await toolRecordApi.confirmReportField(report.id, field.id, value, field.version)
    if (current()) { Object.assign(field, confirmed); notice.value = '字段已确认，手动原文仍保留' }
  } catch (error) { if (current()) notice.value = message(error) }
  finally { busy.value = false }
}
watch(() => props.owner, refresh, { immediate: true })
defineExpose({ refresh })
onBeforeUnmount(() => {
  disposed = true
  downloaded.forEach(removeDownloaded)
})
</script>
<style scoped lang="scss">
@use './tool-panel.scss';
.report-image { display: block; width: 100%; height: 360rpx; margin-top: 22rpx; border-radius: 18rpx; background: #faf6f3; }
.import-button, .field-value { margin-top: 18rpx; }
</style>
