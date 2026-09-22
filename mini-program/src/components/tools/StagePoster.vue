<template>
  <view class="tool-panel">
    <text class="panel-title">留下一张今日阶段卡</text>
    <text class="panel-hint">固定文案，记录今天。预览与保存的是同一张图片。</text>
    <image v-if="imagePath" class="poster-image" :src="imagePath" mode="widthFix" show-menu-by-longpress @tap="preview" />
    <view v-else class="poster-empty"><text>{{ generating ? '正在制作阶段卡…' : '准备好后，生成一张预览' }}</text></view>
    <canvas canvas-id="stage-poster" class="poster-canvas" width="375" height="450" style="width: 375px; height: 450px" />
    <view class="panel-actions">
      <button class="panel-button" :loading="generating || saving" :disabled="generating || saving" @tap="imagePath ? saveImage() : generate()">{{ imagePath ? '保存到相册' : '生成预览' }}</button>
      <button v-if="imagePath" class="panel-button panel-button--secondary" :disabled="generating || saving" @tap="preview">放大预览</button>
    </view>
    <button v-if="imagePath" class="panel-button panel-button--quiet regenerate" :disabled="generating || saving" @tap="generate">重新生成</button>
    <text v-if="notice" class="panel-hint">{{ notice }}</text>
    <button v-if="permissionDenied" class="panel-button panel-button--secondary" @tap="openSettings">去设置相册权限</button>
    <text class="panel-hint">只展示孕周和固定文案，分享前请确认愿意公开这些信息。</text>
  </view>
</template>
<script setup lang="ts">
import { getCurrentInstance, ref, watch } from 'vue'
import { BASE_URL } from '@/api/request'
import { TOOL_CLOUD_ENABLED } from '@/config/features'
import { saveToolImage } from '@/utils/tool-media'
import { localToolDate } from '@/utils/tool-history'
const props = defineProps<{ week: number | null }>()
const emit = defineEmits<{ saved: [] }>()
const instance = getCurrentInstance()?.proxy
const generating = ref(false), saving = ref(false), imagePath = ref(''), notice = ref(''), permissionDenied = ref(false)
function loadCode(): Promise<string> {
  return new Promise((resolve, reject) => uni.downloadFile({
    url: `${BASE_URL}/tool-records/poster-code`, timeout: 10000,
    success: result => result.statusCode === 200 ? resolve(result.tempFilePath) : reject(new Error('code unavailable')),
    fail: reject,
  }))
}
async function generate() {
  if (generating.value) return
  generating.value = true; notice.value = ''; imagePath.value = ''; permissionDenied.value = false
  const week = props.week && props.week >= 1 && props.week <= 42 ? props.week : null
  try {
    let code = ''
    if (TOOL_CLOUD_ENABLED) {
      try { code = await loadCode() } catch { notice.value = '小程序码暂不可用，图片仍可预览和保存。' }
    }
    const context = uni.createCanvasContext('stage-poster', instance)
    const gradient = context.createLinearGradient(0, 0, 375, 450)
    gradient.addColorStop(0, '#fbe2df'); gradient.addColorStop(1, '#fff5e9')
    context.setFillStyle(gradient); context.fillRect(0, 0, 375, 450)
    context.setFillStyle('#fffaf5'); context.beginPath(); context.arc(312, 40, 106, 0, Math.PI * 2); context.fill()
    context.setFillStyle('#99575c'); context.setFontSize(16)
    context.fillText(week ? `孕期第 ${week} 周` : '贝护 · 今日阶段卡', 28, 64)
    context.setFillStyle('#66484a'); context.setFontSize(28); context.fillText('今天也在好好记录', 28, 178)
    context.setFillStyle('#806861'); context.setFontSize(14); context.fillText('把真实的日子，留给未来的自己。', 28, 218)
    context.setFillStyle('#c57f87'); context.fillRect(28, 254, 40, 3)
    context.setFillStyle('#166c5b'); context.setFontSize(16); context.fillText('贝护', 28, 366)
    context.setFillStyle('#766b67'); context.setFontSize(12); context.fillText('孕育记录与实用工具', 28, 390)
    if (code) { context.drawImage(code, 258, 320, 88, 88); context.setFontSize(10); context.fillText('扫码打开贝护', 270, 424) }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('绘图超时，请重试')), 8000)
      context.draw(false, () => { clearTimeout(timer); resolve() })
    })
    const generated = await new Promise<string>((resolve, reject) => uni.canvasToTempFilePath({
      canvasId: 'stage-poster', width: 375, height: 450, destWidth: 1125, destHeight: 1350, fileType: 'png',
      success: result => resolve(result.tempFilePath), fail: () => reject(new Error('图片未能生成，请重试')),
    }, instance))
    imagePath.value = generated
    const record = await saveToolImage('poster', generated, { week, date: localToolDate(), summary: week ? `孕 ${week} 周纪念卡` : '今日阶段纪念卡' })
    imagePath.value = String(record.payload.path)
    notice.value = `${notice.value} 已保存到海报历史，可随时回来查看。`
    emit('saved')
  } catch (error) { notice.value = error instanceof Error ? error.message : '生成未完成，请重试' }
  finally { generating.value = false }
}
function preview() { if (imagePath.value) uni.previewImage({ urls: [imagePath.value] }) }
async function saveImage() {
  if (!imagePath.value || saving.value) return
  saving.value = true
  uni.saveImageToPhotosAlbum({
    filePath: imagePath.value,
    success: () => { permissionDenied.value = false; notice.value = '阶段卡已保存到相册' },
    fail: result => { permissionDenied.value = /auth|deny|denied/i.test(result.errMsg || ''); notice.value = permissionDenied.value ? '相册权限未开启，预览仍然保留。' : '未能保存到相册，可以重试或打开预览。' },
    complete: () => { saving.value = false },
  })
}
function openSettings() { uni.openSetting({ success: result => { permissionDenied.value = !result.authSetting['scope.writePhotosAlbum']; notice.value = permissionDenied.value ? '可继续查看预览' : '权限已开启，请再点击保存到相册' } }) }
watch(() => props.week, () => { imagePath.value = ''; notice.value = '' })
</script>
<style scoped lang="scss">
@use './tool-panel.scss';
.poster-image { display: block; width: 100%; margin-top: 22rpx; border-radius: 22rpx; }
.poster-empty { margin-top: 22rpx; padding: 96rpx 16rpx; border-radius: 22rpx; text-align: center; background: #fbe2df; color: #99575c; font-size: 26rpx; }
.poster-canvas { position: fixed; left: -2000px; top: -2000px; }
.regenerate { width: 100%; margin-top: 10rpx; }
</style>
