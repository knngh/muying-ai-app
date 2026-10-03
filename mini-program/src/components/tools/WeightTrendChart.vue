<template>
  <view class="weight-trend">
    <view class="chart-head">
      <view><text class="chart-title">体重趋势</text><text class="chart-hint">最近 {{ points.length }} 次测量 · 按实际日期间隔</text></view>
      <text v-if="latest" class="chart-latest">{{ latest }} <text class="chart-unit">kg</text></text>
    </view>
    <view v-if="points.length < 2" class="chart-empty"><text>{{ points.length ? '再记录一次，就能看到趋势线' : '保存体重后，在这里看见变化' }}</text><text>保留每次测量，不评价是否合适</text></view>
    <template v-else>
      <view class="chart-plot">
        <canvas v-if="visible && width" :key="width" canvas-id="weight-trend-chart" class="weight-chart" :width="width" :height="height" :style="{ width: `${width}px`, height: `${height}px` }"></canvas>
      </view>
      <view class="chart-axis"><text>{{ points[0].date }}</text><text v-if="points[0].date !== points[points.length - 1].date">{{ points[points.length - 1].date }}</text></view>
      <view v-if="selected" class="chart-inspect">
        <button class="chart-step" :disabled="selectedIndex === 0" aria-label="上一条测量" @tap="selectedIndex--">‹</button>
        <view class="chart-reading"><text>{{ selected.date }} · {{ selected.value }} kg</text><text class="chart-hint">第 {{ selectedIndex + 1 }} / {{ points.length }} 次测量</text></view>
        <button class="chart-step" :disabled="selectedIndex === points.length - 1" aria-label="下一条测量" @tap="selectedIndex++">›</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { LocalToolRecord } from '@/utils/tool-records'
import { weightChartLayout, weightPoints } from '@/utils/weight-trend'

const props = withDefaults(defineProps<{ records: LocalToolRecord[]; visible?: boolean }>(), { visible: true })
const instance = getCurrentInstance()?.proxy
const width = ref(0), height = 166, selectedIndex = ref(0)
const points = computed(() => weightPoints(props.records))
const layout = computed(() => weightChartLayout(points.value))
const latest = computed(() => points.value[points.value.length - 1]?.value.toFixed(1) || '')
const selected = computed(() => points.value[selectedIndex.value])
let disposed = false

async function measure() {
  await nextTick()
  if (!props.visible || points.value.length < 2 || !instance || disposed) return
  uni.createSelectorQuery().in(instance).select('.chart-plot').boundingClientRect(rect => {
    if (disposed || !props.visible || !rect || Array.isArray(rect) || !rect.width) return
    // A width-keyed canvas avoids restoring a clipped bitmap during H5's resize observer.
    width.value = Math.floor(rect.width)
    void nextTick(draw)
  }).exec()
}

function draw() {
  if (!props.visible || !width.value || points.value.length < 2 || !instance || disposed) return
  const context = uni.createCanvasContext('weight-trend-chart', instance)
  const left = 38, right = width.value - 9, top = 16, bottom = height - 12
  const x = (fraction: number) => left + fraction * (right - left)
  const y = (fraction: number) => top + fraction * (bottom - top)
  context.clearRect(0, 0, width.value, height)
  context.setFontSize(10)
  context.setTextAlign('left')
  context.setTextBaseline('middle')
  layout.value.ticks.forEach((tick, index) => {
    const lineY = y(index / 3)
    context.setFillStyle('#65796f'); context.fillText(tick.toFixed(1), 0, lineY)
    context.setStrokeStyle('#dce8e1'); context.setLineWidth(1)
    context.beginPath(); context.moveTo(left, lineY); context.lineTo(right, lineY); context.stroke()
  })
  context.beginPath()
  layout.value.points.forEach((point, index) => {
    if (index === 0) context.moveTo(x(point.x), y(point.y))
    else context.lineTo(x(point.x), y(point.y))
  })
  context.setStrokeStyle('#287e68'); context.setLineWidth(2); context.stroke()
  layout.value.points.forEach((point, index) => {
    context.beginPath(); context.arc(x(point.x), y(point.y), index === selectedIndex.value ? 5 : 3, 0, Math.PI * 2)
    context.setFillStyle(index === selectedIndex.value ? '#287e68' : '#fffdfb'); context.fill()
    context.setStrokeStyle('#287e68'); context.setLineWidth(2); context.stroke()
  })
  context.draw()
}

onMounted(() => { void measure(); uni.onWindowResize(measure) })
watch(points, () => { selectedIndex.value = Math.max(0, points.value.length - 1); void measure() }, { immediate: true })
watch(() => props.visible, () => { void measure() })
watch(selectedIndex, () => { void nextTick(draw) })
onBeforeUnmount(() => { disposed = true; uni.offWindowResize(measure) })
</script>

<style scoped>
.weight-trend { margin-top: 26rpx; padding: 20rpx; border-radius: 20rpx; background: #f6faf8; }
.chart-head { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 14rpx; }
.chart-title, .chart-hint { display: block; }.chart-title { color: #315f51; font-size: 26rpx; font-weight: 700; }.chart-hint { margin-top: 6rpx; color: #687c71; font-size: 21rpx; }
.chart-latest { color: #287e68; font-size: 32rpx; font-weight: 700; }.chart-unit { font-size: 21rpx; font-weight: 400; }
.chart-plot { width: 100%; height: 166px; margin-top: 14rpx; }.weight-chart { display: block; }
.chart-axis { display: flex; justify-content: space-between; padding-left: 38px; color: #65796f; font-size: 19rpx; }
.chart-inspect { display: flex; align-items: center; justify-content: space-between; gap: 8rpx; margin-top: 18rpx; border-top: 1rpx solid #dce8e1; padding-top: 12rpx; }
.chart-reading { text-align: center; color: #315f51; font-size: 23rpx; }
.chart-step { flex-shrink: 0; margin: 0; width: 80rpx; padding: 12rpx 0; background: transparent; color: #287e68; font-size: 38rpx; line-height: 1.5; }.chart-step[disabled] { opacity: .3; }.chart-step::after { border: 0; }
.chart-empty { padding: 32rpx 10rpx 20rpx; text-align: center; color: #687c71; font-size: 22rpx; line-height: 1.7; }.chart-empty text { display: block; }
</style>
