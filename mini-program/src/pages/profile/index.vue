<template>
  <view class="profile-page">
    <view v-if="appStore.isLoading" class="loading-box">
      <text class="loading-text">加载中...</text>
    </view>

    <view v-if="!appStore.isLoading && !user" class="empty-box">
      <text class="empty-text">请先登录</text>
      <view class="login-btn" @tap="goLogin">
        <text class="login-btn-text">去登录</text>
      </view>
    </view>

    <view v-if="!appStore.isLoading && user" class="profile-content">
      <view class="avatar-section">
        <view class="profile-avatar profile-avatar-fallback">
          <text class="profile-avatar-text">{{ (user.nickname || user.username || '用')[0] }}</text>
        </view>
        <text class="profile-nickname">{{ user.nickname || user.username }}</text>
      </view>

      <view class="info-section">
        <view class="info-row">
          <text class="info-label">昵称</text>
          <text class="info-value">{{ user.nickname || user.username }}</text>
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
          <text class="info-label">注册时间</text>
          <text class="info-value">{{ formatDate(user.createdAt) }}</text>
        </view>
      </view>

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
    <view v-if="showEditModal" class="modal-mask" @tap="closeEditModal">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">编辑资料</text>
          <text class="modal-subtitle">修改后会同步更新到个人资料页</text>
        </view>

        <view class="modal-body">
          <view class="form-section">
            <text class="section-title">基础信息</text>

            <view class="form-item">
              <text class="form-label">昵称</text>
              <view class="form-main">
                <input
                  v-model="editForm.nickname"
                  class="form-input"
                  placeholder="请输入昵称"
                  @tap.stop
                />
              </view>
            </view>

            <view class="form-item">
              <text class="form-label">手机号</text>
              <view class="form-main">
                <input
                  v-model="editForm.phone"
                  class="form-input"
                  type="number"
                  maxlength="11"
                  placeholder="请输入11位手机号"
                  @tap.stop
                />
                <text class="form-hint">仅支持 11 位大陆手机号</text>
              </view>
            </view>

            <view class="form-item">
              <text class="form-label">邮箱</text>
              <view class="form-main">
                <input
                  v-model="editForm.email"
                  class="form-input"
                  type="text"
                  placeholder="请输入邮箱，如 name@example.com"
                  @tap.stop
                />
                <text class="form-hint">保存前会校验邮箱格式</text>
              </view>
            </view>
          </view>

          <view class="form-section">
            <text class="section-title">孕育信息</text>

            <view class="form-item">
              <text class="form-label">当前孕周</text>
              <view class="form-main">
                <picker mode="selector" :range="weekOptions" @change="onPregnancyWeekChange">
                  <view class="form-picker">
                    <text :class="editForm.pregnancyWeek ? '' : 'placeholder-text'">
                      {{ editForm.pregnancyWeek ? `第 ${editForm.pregnancyWeek} 周` : '请选择当前孕周' }}
                    </text>
                  </view>
                </picker>
                <text class="form-hint">选择孕周后会自动换算预产期</text>
              </view>
            </view>

            <view class="form-item form-item--last">
              <text class="form-label">预产期</text>
              <view class="form-main">
                <picker mode="date" :value="editForm.dueDate" @change="onDueDateChange">
                  <view class="form-picker">
                    <text :class="editForm.dueDate ? '' : 'placeholder-text'">
                      {{ editForm.dueDate || '请选择预产期' }}
                    </text>
                  </view>
                </picker>
              </view>
            </view>
          </view>
        </view>

        <view class="modal-actions">
          <view class="modal-btn modal-btn--cancel" @tap="closeEditModal">
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
import { calculateDueDateFromPregnancyWeek, calculatePregnancyWeekFromDueDate } from '@/utils'

const appStore = useAppStore()

const user = computed(() => appStore.user)
const showEditModal = ref(false)

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

const editForm = reactive<{
  nickname: string
  phone: string
  email: string
  pregnancyWeek: string
  dueDate: string
}>({
  nickname: '',
  phone: '',
  email: '',
  pregnancyWeek: '',
  dueDate: '',
})

const weekOptions = Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 周`)

const currentPregnancyWeekText = computed(() => {
  if (!user.value?.dueDate || normalizePregnancyStatus(user.value.pregnancyStatus) !== 2) return '未设置'
  const currentWeek = calculatePregnancyWeekFromDueDate(user.value.dueDate)
  return currentWeek ? `第 ${currentWeek} 周` : '未设置'
})

const isValidPhone = (phone: string) => /^1\d{10}$/.test(phone)
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const pregnancyStatusLabel = (status?: number | string) => {
  const normalizedStatus = normalizePregnancyStatus(status)
  return normalizedStatus ? pregnancyLabelMap[normalizedStatus] : '未设置'
}
const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD')

const maskPhone = (phone?: string) => {
  if (!phone) return '未设置'
  if (phone.length >= 7) {
    return phone.slice(0, 3) + '****' + phone.slice(-4)
  }
  return phone
}

const shouldPreservePostpartumStatus = computed(() => (
  normalizePregnancyStatus(user.value?.pregnancyStatus) === 3 || !!user.value?.babyBirthday
))

const goLogin = () => {
  uni.navigateTo({ url: '/pages/login/index' })
}

const closeEditModal = () => {
  showEditModal.value = false
}

const openEditModal = () => {
  if (!user.value) return
  editForm.nickname = user.value.nickname || ''
  editForm.phone = user.value.phone || ''
  editForm.email = user.value.email || ''
  editForm.dueDate = user.value.dueDate ? dayjs(user.value.dueDate).format('YYYY-MM-DD') : ''
  editForm.pregnancyWeek = user.value.dueDate ? String(calculatePregnancyWeekFromDueDate(user.value.dueDate) || '') : ''
  showEditModal.value = true
}

const onDueDateChange = (e: any) => {
  editForm.dueDate = e.detail.value
  editForm.pregnancyWeek = editForm.dueDate
    ? String(calculatePregnancyWeekFromDueDate(editForm.dueDate) || '')
    : ''
}

const onPregnancyWeekChange = (e: any) => {
  const selectedOption = weekOptions[Number(e.detail.value)] || ''
  const selectedWeek = selectedOption.replace(/\D/g, '')
  editForm.pregnancyWeek = selectedWeek

  const dueDate = calculateDueDateFromPregnancyWeek(selectedWeek)
  editForm.dueDate = dueDate ? dayjs(dueDate).format('YYYY-MM-DD') : ''
}

const submitEdit = async () => {
  try {
    const data: {
      nickname?: string
      phone?: string
      email?: string
      pregnancyStatus?: number
      dueDate?: string
    } = {}

    if (editForm.nickname.trim()) data.nickname = editForm.nickname.trim()
    const trimmedPhone = editForm.phone.trim()
    const trimmedEmail = editForm.email.trim()

    if (trimmedPhone) {
      if (!isValidPhone(trimmedPhone)) {
        uni.showToast({ title: '请输入11位手机号', icon: 'none' })
        return
      }
      data.phone = trimmedPhone
    }

    if (trimmedEmail) {
      if (!isValidEmail(trimmedEmail)) {
        uni.showToast({ title: '请输入正确的邮箱地址', icon: 'none' })
        return
      }
      data.email = trimmedEmail
    }

    if (editForm.dueDate) {
      data.dueDate = editForm.dueDate
      data.pregnancyStatus = shouldPreservePostpartumStatus.value ? 3 : 2
    }

    const updatedUser = await authApi.updateProfile(data)
    appStore.setUser(updatedUser)
    await appStore.fetchUser()
    closeEditModal()
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch (err: any) {
    console.error('[Profile] 保存失败:', err)
    uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
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
  width: 680rpx;
  background-color: #ffffff;
  border-radius: 28rpx;
  max-height: 80vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24rpx 64rpx rgba(0, 0, 0, 0.16);
}

.modal-header {
  padding: 40rpx 40rpx 24rpx;
  background: linear-gradient(180deg, #fff6fb 0%, #ffffff 100%);
  border-bottom: 1rpx solid #f3e4ec;
}

.modal-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333333;
  text-align: center;
}

.modal-subtitle {
  display: block;
  margin-top: 12rpx;
  text-align: center;
  font-size: 24rpx;
  color: #8c8c8c;
}

.modal-body {
  padding: 28rpx 40rpx 16rpx;
}

.form-section {
  padding: 28rpx 24rpx;
  border: 1rpx solid #f0edf2;
  border-radius: 20rpx;
  background: #fcfcfd;
  margin-bottom: 20rpx;
}

.section-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #4a4a4a;
  margin-bottom: 20rpx;
}

.form-item {
  display: grid;
  grid-template-columns: 132rpx minmax(0, 1fr);
  column-gap: 20rpx;
  align-items: start;
  margin-bottom: 22rpx;
}

.form-item--last {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: #4a4a4a;
  line-height: 84rpx;
}

.form-main {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}

.form-input {
  border: 2rpx solid #e8e8ee;
  border-radius: 14rpx;
  padding: 0 22rpx;
  font-size: 28rpx;
  width: 100%;
  height: 84rpx;
  box-sizing: border-box;
  background: #ffffff;
  display: block;
  line-height: 84rpx;
  vertical-align: middle;
}

.form-picker {
  border: 2rpx solid #e8e8ee;
  border-radius: 14rpx;
  padding: 0 22rpx;
  box-sizing: border-box;
  width: 100%;
  height: 84rpx;
  display: flex;
  align-items: center;
  background: #ffffff;
}

.form-hint {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #9a9a9a;
}

.placeholder-text {
  color: #cccccc;
  font-size: 28rpx;
}

.modal-actions {
  display: flex;
  gap: 20rpx;
  padding: 12rpx 40rpx 40rpx;
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
