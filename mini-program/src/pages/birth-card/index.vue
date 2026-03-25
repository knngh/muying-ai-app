<template>
  <view class="birth-card-page">
    <!-- 表单阶段 -->
    <view v-if="stage === 'form'" class="form-stage">
      <view class="form-header">
        <text class="form-header-emoji">👶</text>
        <text class="form-header-title">生成宝宝出生卡片</text>
        <text class="form-header-subtitle">{{ formSubtitle }}</text>
      </view>

      <view class="form-tip">
        <text class="form-tip-title">{{ formTipTitle }}</text>
        <text class="form-tip-text">{{ formTipText }}</text>
      </view>

      <view class="form-card">
        <view class="form-item">
          <text class="form-label">怀孕日期（末次月经）</text>
          <picker mode="date" :value="formData.pregnancyStartDate" @change="onStartDateChange">
            <view class="form-picker">
              <text :class="formData.pregnancyStartDate ? '' : 'placeholder-text'">
                {{ formData.pregnancyStartDate || '请选择末次月经日期' }}
              </text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">宝宝出生日期</text>
          <picker mode="date" :value="formData.birthDate" @change="onBirthDateChange">
            <view class="form-picker">
              <text :class="formData.birthDate ? '' : 'placeholder-text'">
                {{ formData.birthDate || '请选择宝宝出生日期' }}
              </text>
            </view>
          </picker>
        </view>

        <view class="form-item form-item--last">
          <text class="form-label">宝宝性别（可选）</text>
          <picker mode="selector" :range="genderOptions" :range-key="'label'" :value="formData.genderIndex" @change="onGenderChange">
            <view class="form-picker">
              <text :class="formData.genderIndex >= 0 ? '' : 'placeholder-text'">
                {{ formData.genderIndex >= 0 ? genderOptions[formData.genderIndex].label : '请选择' }}
              </text>
            </view>
          </picker>
        </view>
      </view>

      <view class="submit-btn" :class="{ 'submit-btn--disabled': !canSubmit }" @tap="handleSubmit">
        <text class="submit-btn-text">{{ submitButtonText }}</text>
      </view>
    </view>

    <!-- 动画阶段 -->
    <scroll-view v-if="stage === 'animation'" scroll-y class="animation-stage">
      <!-- 标题 -->
      <view class="timeline-header">
        <text class="timeline-header-title">
          {{ formatDateDisplay(formData.pregnancyStartDate) }} → {{ formatDateDisplay(formData.birthDate) }}
        </text>
        <text class="timeline-header-subtitle">{{ totalWeeks }} 周的爱与等待</text>
      </view>

      <!-- 时间线 -->
      <view class="timeline">
        <view class="timeline-line"></view>
        <view class="timeline-progress" :style="{ height: progressHeight }"></view>

        <!-- 里程碑节点 -->
        <view
          v-for="(milestone, index) in visibleMilestones"
          :key="milestone.week"
          class="milestone-node"
          :class="{ 'milestone-node--visible': animatedIndexes.has(index) }"
        >
          <view class="milestone-dot">
            <text class="milestone-dot-emoji">{{ milestone.emoji }}</text>
          </view>
          <view class="milestone-card">
            <text class="milestone-week">第 {{ milestone.week }} 周</text>
            <text class="milestone-size">{{ milestone.emoji }} {{ milestone.sizeLabel }}</text>
            <text class="milestone-desc">{{ milestone.description }}</text>
            <view v-if="milestone.sizeCm || milestone.weightG" class="milestone-stats">
              <text v-if="milestone.sizeCm" class="milestone-stat">约 {{ milestone.sizeCm }} cm</text>
              <text v-if="milestone.weightG" class="milestone-stat">约 {{ milestone.weightG }} g</text>
            </view>
          </view>
        </view>

        <!-- 出生节点 -->
        <view
          class="birth-node"
          :class="{ 'birth-node--visible': animatedIndexes.has(visibleMilestones.length) }"
        >
          <view class="birth-dot">
            <text class="birth-dot-emoji">👶</text>
          </view>
          <view class="birth-card">
            <!-- 庆祝粒子 -->
            <view class="particles">
              <text class="particle p1">🎉</text>
              <text class="particle p2">✨</text>
              <text class="particle p3">🎀</text>
              <text class="particle p4">💖</text>
              <text class="particle p5">🌟</text>
            </view>
            <text class="birth-emoji">👶</text>
            <text class="birth-title">{{ birthMilestone.title }}</text>
            <text class="birth-blessing">{{ birthMilestone.getBlessing(formData.genderValue) }}</text>
          </view>
        </view>
      </view>

      <!-- 重播按钮 -->
      <view class="replay-btn" @tap="handleReplay">
        <text class="replay-btn-text">重新播放</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import { useAppStore } from '@/stores/app'
import { authApi } from '@/api/modules'
import type { User } from '@/api/modules'
import { MILESTONES, BIRTH_MILESTONE } from '@/data/birthCardMilestones'
import dayjs from 'dayjs'

const appStore = useAppStore()
const user = computed(() => appStore.user)

const stage = ref<'form' | 'animation'>('form')
const saving = ref(false)

const genderOptions = [
  { label: '男宝宝', value: 1 },
  { label: '女宝宝', value: 2 },
  { label: '暂不透露', value: 0 },
]

const formData = reactive({
  pregnancyStartDate: '',
  birthDate: '',
  genderIndex: -1,
  genderValue: undefined as number | undefined,
})

const birthMilestone = BIRTH_MILESTONE
const hasRecordedBirth = computed(() => !!user.value?.babyBirthday)

const formSubtitle = computed(() => (
  hasRecordedBirth.value
    ? '更新出生信息后，可以重新播放这段美好的旅程'
    : '填写出生日期后，会自动同步到你的档案'
))

const formTipTitle = computed(() => (
  hasRecordedBirth.value ? '已保存出生信息' : '温柔提醒'
))

const formTipText = computed(() => {
  if (hasRecordedBirth.value) {
    return '你可以随时修改出生日期或性别，卡片会按最新信息重新生成。'
  }

  if (user.value?.dueDate) {
    return '我们已根据预产期为你预填怀孕日期，补充宝宝出生日期后会自动切换为产后状态。'
  }

  return '填写怀孕日期和出生日期后，就能生成一张记录整个孕育旅程的专属卡片。'
})

const submitButtonText = computed(() => {
  if (saving.value) return '保存中...'
  return hasRecordedBirth.value ? '更新并播放卡片' : '保存并生成卡片'
})

// 预填数据
const initForm = () => {
  if (user.value?.dueDate) {
    const start = dayjs(user.value.dueDate).subtract(280, 'day')
    formData.pregnancyStartDate = start.format('YYYY-MM-DD')
  }
  if (user.value?.babyBirthday) {
    formData.birthDate = dayjs(user.value.babyBirthday).format('YYYY-MM-DD')
  }
  if (user.value?.babyGender !== undefined && user.value?.babyGender !== null) {
    const g = Number(user.value.babyGender)
    const idx = genderOptions.findIndex(o => o.value === g)
    if (idx >= 0) {
      formData.genderIndex = idx
      formData.genderValue = g
    }
  }
}

initForm()

// 事件处理
const onStartDateChange = (e: any) => {
  formData.pregnancyStartDate = e.detail.value
}

const onBirthDateChange = (e: any) => {
  formData.birthDate = e.detail.value
}

const onGenderChange = (e: any) => {
  const idx = Number(e.detail.value)
  formData.genderIndex = idx
  formData.genderValue = genderOptions[idx].value
}

const canSubmit = computed(() => {
  return formData.pregnancyStartDate && formData.birthDate && !saving.value
})

const totalWeeks = computed(() => {
  if (!formData.pregnancyStartDate || !formData.birthDate) return 0
  const start = dayjs(formData.pregnancyStartDate)
  const birth = dayjs(formData.birthDate)
  return Math.floor(birth.diff(start, 'day') / 7)
})

const visibleMilestones = computed(() => {
  return MILESTONES.filter(m => m.week <= totalWeeks.value)
})

const formatDateDisplay = (date: string) => {
  if (!date) return ''
  return dayjs(date).format('YYYY.MM.DD')
}

// 动画控制
const animatedIndexes = ref(new Set<number>())
const progressHeight = ref('0%')

const startAnimation = () => {
  animatedIndexes.value = new Set()
  progressHeight.value = '0%'

  const total = visibleMilestones.value.length + 1 // +1 for birth node

  // 进度条动画
  setTimeout(() => {
    progressHeight.value = '100%'
  }, 100)

  // 逐个显示节点
  for (let i = 0; i < total; i++) {
    setTimeout(() => {
      animatedIndexes.value = new Set([...animatedIndexes.value, i])
    }, 300 + i * 350)
  }
}

const handleSubmit = async () => {
  if (!canSubmit.value) return

  if (dayjs(formData.birthDate).isBefore(dayjs(formData.pregnancyStartDate))) {
    uni.showToast({ title: '出生日期不能早于怀孕日期', icon: 'none' })
    return
  }

  saving.value = true
  try {
    const profileData: Record<string, unknown> = {
      pregnancyStatus: 3,
      babyBirthday: formData.birthDate,
      dueDate: dayjs(formData.pregnancyStartDate).add(280, 'day').format('YYYY-MM-DD'),
    }
    if (formData.genderValue !== undefined) {
      profileData.babyGender = formData.genderValue
    }
    const updatedUser = await authApi.updateProfile(profileData as any) as User
    appStore.setUser(updatedUser)
  } catch (err: any) {
    console.error('[BirthCard] 保存失败:', err)
    uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
    saving.value = false
    return
  }
  saving.value = false

  stage.value = 'animation'
  await nextTick()
  startAnimation()
}

const handleReplay = async () => {
  stage.value = 'form'
  await nextTick()
  stage.value = 'animation'
  await nextTick()
  startAnimation()
}
</script>

<style scoped>
.birth-card-page {
  min-height: 100vh;
  background-color: #faf8fc;
}

/* ===== 表单阶段 ===== */
.form-stage {
  padding: 40rpx 32rpx;
}

.form-header {
  text-align: center;
  margin-bottom: 48rpx;
  padding-top: 20rpx;
}

.form-header-emoji {
  font-size: 80rpx;
  display: block;
  margin-bottom: 16rpx;
}

.form-header-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #333;
  margin-bottom: 8rpx;
}

.form-header-subtitle {
  display: block;
  font-size: 26rpx;
  color: #999;
}

.form-tip {
  margin-bottom: 24rpx;
  background: linear-gradient(135deg, rgba(255, 240, 245, 0.92) 0%, rgba(255, 248, 232, 0.95) 100%);
  border: 2rpx solid rgba(255, 173, 210, 0.7);
  border-radius: 24rpx;
  padding: 24rpx 28rpx;
  box-shadow: 0 16rpx 32rpx rgba(235, 47, 150, 0.08);
}

.form-tip-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #7a284f;
  margin-bottom: 8rpx;
}

.form-tip-text {
  display: block;
  font-size: 24rpx;
  color: #9b6b7f;
  line-height: 1.7;
}

.form-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
  margin-bottom: 48rpx;
}

.form-item {
  margin-bottom: 32rpx;
}

.form-item--last {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
}

.form-picker {
  border: 2rpx solid #e8e8ee;
  border-radius: 14rpx;
  padding: 0 24rpx;
  height: 84rpx;
  display: flex;
  align-items: center;
  background: #fafafa;
  font-size: 28rpx;
  color: #333;
}

.placeholder-text {
  color: #ccc;
  font-size: 28rpx;
}

.submit-btn {
  background: linear-gradient(135deg, #ff85c0 0%, #eb2f96 100%);
  border-radius: 48rpx;
  padding: 28rpx 0;
  text-align: center;
  box-shadow: 0 8rpx 24rpx rgba(235, 47, 150, 0.3);
}

.submit-btn--disabled {
  opacity: 0.5;
}

.submit-btn-text {
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
}

/* ===== 动画阶段 ===== */
.animation-stage {
  height: 100vh;
  padding: 32rpx;
  box-sizing: border-box;
}

.timeline-header {
  text-align: center;
  margin-bottom: 48rpx;
  padding-top: 16rpx;
}

.timeline-header-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 8rpx;
}

.timeline-header-subtitle {
  display: block;
  font-size: 26rpx;
  color: #999;
}

/* ===== 时间线 ===== */
.timeline {
  position: relative;
  padding-left: 60rpx;
  padding-bottom: 40rpx;
}

.timeline-line {
  position: absolute;
  left: 24rpx;
  top: 0;
  bottom: 0;
  width: 4rpx;
  background: #f0f0f0;
  border-radius: 2rpx;
}

.timeline-progress {
  position: absolute;
  left: 24rpx;
  top: 0;
  width: 4rpx;
  background: linear-gradient(180deg, #ff85c0 0%, #eb2f96 100%);
  border-radius: 2rpx;
  transition: height 3s ease-out;
}

/* ===== 里程碑节点 ===== */
.milestone-node {
  position: relative;
  margin-bottom: 36rpx;
  opacity: 0;
  transform: translateY(24rpx);
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;
}

.milestone-node--visible {
  opacity: 1;
  transform: translateY(0);
}

.milestone-dot {
  position: absolute;
  left: -48rpx;
  top: 8rpx;
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  background: #fff;
  border: 3rpx solid #eb2f96;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.milestone-dot-emoji {
  font-size: 18rpx;
}

.milestone-card {
  background: #fff;
  border: 1rpx solid #f0f0f0;
  border-radius: 20rpx;
  padding: 24rpx 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.03);
}

.milestone-week {
  display: block;
  font-size: 22rpx;
  color: #eb2f96;
  font-weight: 600;
  margin-bottom: 6rpx;
}

.milestone-size {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  margin-bottom: 6rpx;
}

.milestone-desc {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
}

.milestone-stats {
  display: flex;
  gap: 20rpx;
  margin-top: 10rpx;
}

.milestone-stat {
  font-size: 22rpx;
  color: #999;
}

/* ===== 出生节点 ===== */
.birth-node {
  position: relative;
  margin-bottom: 0;
  opacity: 0;
  transform: translateY(24rpx);
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;
}

.birth-node--visible {
  opacity: 1;
  transform: translateY(0);
}

.birth-dot {
  position: absolute;
  left: -54rpx;
  top: 8rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff85c0, #eb2f96);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.birth-node--visible .birth-dot {
  animation: pulse 2s ease-in-out infinite;
}

.birth-dot-emoji {
  font-size: 24rpx;
}

.birth-card {
  background: linear-gradient(135deg, #fff0f6 0%, #fff7e6 100%);
  border: 3rpx solid #ffadd2;
  border-radius: 28rpx;
  padding: 40rpx 32rpx;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.birth-emoji {
  display: block;
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.birth-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #eb2f96;
  margin-bottom: 12rpx;
}

.birth-blessing {
  display: block;
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
}

/* ===== 庆祝粒子 ===== */
.particles {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

.particle {
  position: absolute;
  bottom: -40rpx;
  font-size: 32rpx;
  opacity: 0;
}

.birth-node--visible .particle {
  animation: floatUp 3s ease-out infinite;
}

.p1 { left: 10%; animation-delay: 0s; }
.p2 { left: 25%; animation-delay: 0.5s; }
.p3 { left: 45%; animation-delay: 1s; }
.p4 { left: 65%; animation-delay: 1.5s; }
.p5 { left: 85%; animation-delay: 2s; }

/* ===== 重播按钮 ===== */
.replay-btn {
  margin: 40rpx auto 60rpx;
  text-align: center;
  background: #fff;
  border: 2rpx solid #eb2f96;
  border-radius: 40rpx;
  padding: 20rpx 60rpx;
  width: fit-content;
}

.replay-btn-text {
  font-size: 28rpx;
  color: #eb2f96;
}

/* ===== 动画 ===== */
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(235, 47, 150, 0.4);
  }
  50% {
    transform: scale(1.15);
    box-shadow: 0 0 0 16rpx rgba(235, 47, 150, 0);
  }
}

@keyframes floatUp {
  0% {
    opacity: 0;
    transform: translateY(0) scale(1);
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-400rpx) scale(0.5);
  }
}

/* ===== 减弱动画 ===== */
@media (prefers-reduced-motion: reduce) {
  .milestone-node,
  .birth-node {
    transition: none;
    opacity: 1;
    transform: none;
  }

  .timeline-progress {
    transition: none;
  }

  .birth-dot {
    animation: none !important;
  }

  .particle {
    animation: none !important;
    display: none;
  }
}
</style>
