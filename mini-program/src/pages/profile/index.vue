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
          <picker :range="pregnancyOptions" :value="pregnancyIndex" @change="onPregnancyChange">
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
          <picker :range="genderOptions" :value="genderIndex" @change="onGenderChange">
            <view class="form-picker">
              <text :class="editForm.babyGender ? '' : 'placeholder-text'">
                {{ editForm.babyGender ? genderLabel(editForm.babyGender) : '请选择' }}
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

const appStore = useAppStore()

const user = computed(() => appStore.user)
const showEditModal = ref(false)

const pregnancyOptions = ['备孕中', '孕期中', '产后']
const pregnancyValueMap: Record<string, string> = {
  '备孕中': 'preparing',
  '孕期中': 'pregnant',
  '产后': 'postpartum',
}
const pregnancyLabelMap: Record<string, string> = {
  preparing: '备孕中',
  pregnant: '孕期中',
  postpartum: '产后',
}

const genderOptions = ['男', '女', '未知']
const genderValueMap: Record<string, string> = {
  '男': 'male',
  '女': 'female',
  '未知': 'unknown',
}
const genderLabelMap: Record<string, string> = {
  male: '男',
  female: '女',
  unknown: '未知',
}

const editForm = reactive({
  nickname: '',
  pregnancyStatus: '',
  dueDate: '',
  babyBirthday: '',
  babyGender: '',
})

const pregnancyIndex = computed(() => {
  const idx = pregnancyOptions.findIndex(o => pregnancyValueMap[o] === editForm.pregnancyStatus)
  return idx >= 0 ? idx : 0
})

const genderIndex = computed(() => {
  const idx = genderOptions.findIndex(o => genderValueMap[o] === editForm.babyGender)
  return idx >= 0 ? idx : 0
})

const pregnancyStatusLabel = (status: string) => pregnancyLabelMap[status] || status
const genderLabel = (gender?: string) => (gender ? genderLabelMap[gender] || gender : '未设置')
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
  editForm.pregnancyStatus = user.value.pregnancyStatus || ''
  editForm.dueDate = user.value.dueDate ? dayjs(user.value.dueDate).format('YYYY-MM-DD') : ''
  editForm.babyBirthday = user.value.babyBirthday ? dayjs(user.value.babyBirthday).format('YYYY-MM-DD') : ''
  editForm.babyGender = user.value.babyGender || ''
  showEditModal.value = true
}

const onPregnancyChange = (e: any) => {
  editForm.pregnancyStatus = pregnancyValueMap[pregnancyOptions[e.detail.value]] || ''
}

const onDueDateChange = (e: any) => {
  editForm.dueDate = e.detail.value
}

const onBabyBirthdayChange = (e: any) => {
  editForm.babyBirthday = e.detail.value
}

const onGenderChange = (e: any) => {
  editForm.babyGender = genderValueMap[genderOptions[e.detail.value]] || ''
}

const submitEdit = async () => {
  try {
    const data: Record<string, string | undefined> = {}
    if (editForm.nickname.trim()) data.nickname = editForm.nickname.trim()
    if (editForm.pregnancyStatus) data.pregnancyStatus = editForm.pregnancyStatus
    if (editForm.dueDate) data.dueDate = editForm.dueDate
    if (editForm.babyBirthday) data.babyBirthday = editForm.babyBirthday
    if (editForm.babyGender) data.babyGender = editForm.babyGender

    const updatedUser = await authApi.updateProfile(data as any) as any
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
