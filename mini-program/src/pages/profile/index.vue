<template>
  <view class="profile-page">
    <!-- Loading -->
    <view v-if="appStore.isLoading" class="loading-box">
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="!user" class="empty-box">
      <text class="empty-text">请先登录</text>
      <view class="login-btn" @tap="goLogin">
        <text class="login-btn-text">去登录</text>
      </view>
    </view>

    <view v-else class="profile-content">
      <!-- Avatar Section -->
      <view class="avatar-section">
        <view class="profile-avatar profile-avatar-fallback">
          <text class="profile-avatar-text">{{ (user.nickname || user.username || '用')[0] }}</text>
        </view>
        <text class="profile-nickname">{{ user.nickname || user.username }}</text>
        <text v-if="user.pregnancyStatus" class="profile-status">
          {{ pregnancyStatusLabel(user.pregnancyStatus) }}
        </text>
      </view>

      <!-- Info List -->
      <view class="info-section">
        <view class="info-row">
          <text class="info-label">用户名</text>
          <text class="info-value">{{ user.username }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">手机号</text>
          <text class="info-value">{{ maskPhone(user.phone) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">邮箱</text>
          <text class="info-value">{{ user.email || '未设置' }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">预产期</text>
          <text class="info-value">{{ user.dueDate ? formatDate(user.dueDate) : '未设置' }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">当前孕周</text>
          <text class="info-value">{{ currentPregnancyWeekText }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">宝宝生日</text>
          <text class="info-value">{{ user.babyBirthday ? formatDate(user.babyBirthday) : '未设置' }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">宝宝性别</text>
          <text class="info-value">{{ genderLabel(user.babyGender) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">注册时间</text>
          <text class="info-value">{{ formatDate(user.createdAt) }}</text>
        </view>
      </view>

      <!-- Actions -->
      <view class="action-section">
        <view class="edit-btn" @tap="openEditModal">
          <text class="edit-btn-text">编辑资料</text>
        </view>
        <view class="logout-btn" @tap="onLogout">
          <text class="logout-btn-text">退出登录</text>
        </view>
      </view>
    </view>

    <!-- Edit Modal -->
    <view v-if="showEditModal" class="modal-mask" @tap.self="showEditModal = false">
      <view class="modal-content">
        <text class="modal-title">编辑资料</text>

        <view class="form-item">
          <text class="form-label">昵称</text>
          <input
            v-model="editForm.nickname"
            class="form-input"
            placeholder="请输入昵称"
          />
        </view>

        <view class="form-item">
          <text class="form-label">孕育状态</text>
          <picker :range="pregnancyOptions" range-key="label" :value="pregnancyIndex" @change="onPregnancyChange">
            <view class="form-picker">
              <text :class="editForm.pregnancyStatus ? '' : 'placeholder-text'">
                {{ editForm.pregnancyStatus ? pregnancyStatusLabel(editForm.pregnancyStatus) : '请选择' }}
              </text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">预产期</text>
          <picker mode="date" :value="editForm.dueDate" @change="onDueDateChange">
            <view class="form-picker">
              <text :class="editForm.dueDate ? '' : 'placeholder-text'">
                {{ editForm.dueDate || '请选择预产期' }}
              </text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">宝宝生日</text>
          <picker mode="date" :value="editForm.babyBirthday" @change="onBabyBirthdayChange">
            <view class="form-picker">
              <text :class="editForm.babyBirthday ? '' : 'placeholder-text'">
                {{ editForm.babyBirthday || '请选择宝宝生日' }}
              </text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">宝宝性别</text>
          <picker :range="genderOptions" range-key="label" :value="genderIndex" @change="onGenderChange">
            <view class="form-picker">
              <text :class="editForm.babyGender !== undefined ? '' : 'placeholder-text'">
                {{ editForm.babyGender !== undefined ? genderLabel(editForm.babyGender) : '请选择' }}
              </text>
            </view>
          </picker>
        </view>

        <view class="modal-actions">
          <view class="modal-btn modal-btn--cancel" @tap="showEditModal = false">
            <text class="modal-btn-text">取消</text>
          </view>
          <view class="modal-btn modal-btn--confirm" @tap="submitEdit">
            <text class="modal-btn-text modal-btn-text--white">保存</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useAppStore } from '@/stores/app'
import { authApi } from '@/api/modules'
import { wsManager } from '@/utils/websocket'
import dayjs from 'dayjs'
import { calculatePregnancyWeekFromDueDate } from '@/utils'

const appStore = useAppStore()

const user = computed(() => appStore.user)
const showEditModal = ref(false)

const pregnancyOptions = [
  { label: '备孕中', value: 1 },
  { label: '孕期中', value: 2 },
  { label: '产后', value: 3 },
]
const pregnancyLabelMap: Record<number, string> = {
  1: '备孕中',
  2: '孕期中',
  3: '产后',
}
const legacyPregnancyValueMap: Record<string, number> = {
  preparing: 1,
  pregnant: 2,
  postpartum: 3,
}

const genderOptions = [
  { label: '男', value: 1 },
  { label: '女', value: 2 },
  { label: '未知', value: 0 },
]
const genderLabelMap: Record<number, string> = {
  0: '未知',
  1: '男',
  2: '女',
}
const legacyGenderValueMap: Record<string, number> = {
  unknown: 0,
  male: 1,
  female: 2,
}

const normalizeCode = (value: unknown, legacyMap: Record<string, number>, min: number, max: number) => {
  if (typeof value === 'number' && value >= min && value <= max) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined

    const numericValue = Number.parseInt(trimmed, 10)
    if (!Number.isNaN(numericValue) && numericValue >= min && numericValue <= max) {
      return numericValue
    }

    return legacyMap[trimmed.toLowerCase()]
  }

  return undefined
}

const normalizePregnancyStatus = (value: unknown) => normalizeCode(value, legacyPregnancyValueMap, 1, 3)
const normalizeGender = (value: unknown) => normalizeCode(value, legacyGenderValueMap, 0, 2)

const editForm = reactive<{
  nickname: string
  pregnancyStatus?: number
  dueDate: string
  babyBirthday: string
  babyGender?: number
}>({
  nickname: '',
  pregnancyStatus: undefined,
  dueDate: '',
  babyBirthday: '',
  babyGender: undefined,
})

const pregnancyIndex = computed(() => {
  const idx = pregnancyOptions.findIndex(option => option.value === editForm.pregnancyStatus)
  return idx >= 0 ? idx : 0
})

const genderIndex = computed(() => {
  const idx = genderOptions.findIndex(option => option.value === editForm.babyGender)
  return idx >= 0 ? idx : 0
})

const currentPregnancyWeekText = computed(() => {
  if (!user.value?.dueDate || normalizePregnancyStatus(user.value.pregnancyStatus) !== 2) return '未设置'
  const currentWeek = calculatePregnancyWeekFromDueDate(user.value.dueDate)
  return currentWeek ? `第 ${currentWeek} 周` : '未设置'
})

const pregnancyStatusLabel = (status?: number | string) => {
  const normalizedStatus = normalizePregnancyStatus(status)
  return normalizedStatus ? pregnancyLabelMap[normalizedStatus] : '未设置'
}
const genderLabel = (gender?: number | string) => {
  const normalizedGender = normalizeGender(gender)
  return normalizedGender !== undefined ? genderLabelMap[normalizedGender] : '未设置'
}
const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD')

const maskPhone = (phone?: string) => {
  if (!phone) return '未设置'
  if (phone.length >= 7) {
    return phone.slice(0, 3) + '****' + phone.slice(-4)
  }
  return phone
}

const goLogin = () => {
  uni.navigateTo({ url: '/pages/login/index' })
}

const openEditModal = () => {
  if (!user.value) return
  editForm.nickname = user.value.nickname || ''
  editForm.pregnancyStatus = normalizePregnancyStatus(user.value.pregnancyStatus)
  editForm.dueDate = user.value.dueDate ? dayjs(user.value.dueDate).format('YYYY-MM-DD') : ''
  editForm.babyBirthday = user.value.babyBirthday ? dayjs(user.value.babyBirthday).format('YYYY-MM-DD') : ''
  editForm.babyGender = normalizeGender(user.value.babyGender)
  showEditModal.value = true
}

const onPregnancyChange = (e: any) => {
  editForm.pregnancyStatus = pregnancyOptions[e.detail.value]?.value
}

const onDueDateChange = (e: any) => {
  editForm.dueDate = e.detail.value
}

const onBabyBirthdayChange = (e: any) => {
  editForm.babyBirthday = e.detail.value
}

const onGenderChange = (e: any) => {
  editForm.babyGender = genderOptions[e.detail.value]?.value
}

const submitEdit = async () => {
  try {
    const data: {
      nickname?: string
      pregnancyStatus?: number
      dueDate?: string
      babyBirthday?: string
      babyGender?: number
    } = {}

    if (editForm.nickname.trim()) data.nickname = editForm.nickname.trim()
    if (editForm.pregnancyStatus !== undefined) data.pregnancyStatus = editForm.pregnancyStatus
    if (editForm.dueDate) data.dueDate = editForm.dueDate
    if (editForm.babyBirthday) data.babyBirthday = editForm.babyBirthday
    if (editForm.babyGender !== undefined) data.babyGender = editForm.babyGender

    const updatedUser = await authApi.updateProfile(data)
    appStore.setUser(updatedUser)
    showEditModal.value = false
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch (_err) {
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

const onLogout = () => {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        wsManager.disconnect()
        uni.removeStorageSync('token')
        uni.removeStorageSync('user')
        appStore.setUser(null)
        uni.reLaunch({ url: '/pages/login/index' })
      }
    },
  })
}

onMounted(async () => {
  const token = uni.getStorageSync('token')
  if (token && !user.value) {
    appStore.setIsLoading(true)
    await appStore.fetchUser()
    appStore.setIsLoading(false)
  }
})
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 60rpx;
}

.loading-box,
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.loading-text,
.empty-text {
  font-size: 28rpx;
  color: #999999;
}

.login-btn {
  margin-top: 32rpx;
  background-color: #1890ff;
  border-radius: 32rpx;
  padding: 16rpx 48rpx;
}

.login-btn-text {
  color: #ffffff;
  font-size: 28rpx;
}

.profile-content {
  padding: 0;
}

/* Avatar Section */
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #ffffff;
  padding: 48rpx 32rpx 40rpx;
}

.profile-avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  margin-bottom: 20rpx;
  background-color: #eeeeee;
}

.profile-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(24, 144, 255, 0.15);
}

.profile-avatar-text {
  font-size: 60rpx;
  font-weight: bold;
  color: #1890ff;
}

.profile-nickname {
  font-size: 36rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 8rpx;
}

.profile-status {
  font-size: 26rpx;
  color: #1890ff;
  background-color: #e6f7ff;
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
  margin-top: 8rpx;
}

/* Info Section */
.info-section {
  background-color: #ffffff;
  margin-top: 20rpx;
  padding: 0 32rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 28rpx;
  color: #666666;
}

.info-value {
  font-size: 28rpx;
  color: #333333;
}

/* Actions */
.action-section {
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.edit-btn {
  background-color: #1890ff;
  border-radius: 12rpx;
  padding: 24rpx 0;
  text-align: center;
}

.edit-btn-text {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 500;
}

.logout-btn {
  background-color: #ffffff;
  border: 1rpx solid #ff4d4f;
  border-radius: 12rpx;
  padding: 24rpx 0;
  text-align: center;
}

.logout-btn-text {
  color: #ff4d4f;
  font-size: 30rpx;
  font-weight: 500;
}

/* Modal */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.modal-content {
  width: 640rpx;
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 40rpx;
  max-height: 80vh;
  overflow-y: auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.modal-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333333;
  text-align: center;
  margin-bottom: 32rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  display: block;
  font-size: 28rpx;
  color: #333333;
  margin-bottom: 8rpx;
}

.form-input {
  border: 1rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  width: 100%;
  height: 72rpx;
  box-sizing: border-box;
}

.form-picker {
  border: 1rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  box-sizing: border-box;
  width: 100%;
  height: 72rpx;
  display: flex;
  align-items: center;
}

.placeholder-text {
  color: #cccccc;
  font-size: 28rpx;
}

.modal-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 32rpx;
}

.modal-btn {
  flex: 1;
  border-radius: 12rpx;
  padding: 18rpx 0;
  text-align: center;
}

.modal-btn--cancel {
  background-color: #f5f5f5;
}

.modal-btn--confirm {
  background-color: #1890ff;
}

.modal-btn-text {
  font-size: 30rpx;
  color: #666666;
  text-align: center;
}

.modal-btn-text--white {
  color: #ffffff;
}
</style>
