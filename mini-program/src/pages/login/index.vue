<template>
  <view class="login-page">
    <view class="login-header">
      <text class="login-logo">贝护妈妈</text>
      <text class="login-subtitle">欢迎来到专属您的孕产空间</text>
    </view>

    <view class="login-form">
      <view class="form-title">
        <text>{{ loginStep === 'auth' ? '先完成登录' : '请选择当前孕周' }}</text>
      </view>

      <text class="form-desc">
        {{ loginStep === 'auth' ? '首次登录后再完善孕周信息，之后登录无需重复选择。' : '仅首次登录需要选择一次，后续可在编辑资料里修改。' }}
      </text>

      <template v-if="loginStep === 'auth'">
        <!-- #ifdef MP-WEIXIN -->
        <view
          class="submit-btn wechat-btn"
          hover-class="wechat-btn--hover"
          hover-start-time="20"
          hover-stay-time="80"
          @tap="handleWechatLogin()"
        >
          <text class="btn-text">微信一键登录</text>
        </view>
        <!-- #endif -->

        <!-- #ifndef MP-WEIXIN -->
        <view class="auth-mode-tabs">
          <view
            class="auth-mode-tab"
            :class="{ 'auth-mode-tab--active': authMode === 'login' }"
            @tap="setAuthMode('login')"
          >
            <text :class="{ 'auth-mode-text--active': authMode === 'login' }">账号登录</text>
          </view>
          <view
            class="auth-mode-tab"
            :class="{ 'auth-mode-tab--active': authMode === 'register' }"
            @tap="setAuthMode('register')"
          >
            <text :class="{ 'auth-mode-text--active': authMode === 'register' }">注册账号</text>
          </view>
        </view>

        <view class="demo-account-box">
          <text class="demo-account-title">演示账号</text>
          <text class="demo-account-hint">密码统一为 Test123456!，点击可直接填充。</text>
          <view
            v-for="account in demoAccounts"
            :key="account.username"
            class="demo-account-card"
            @tap="applyDemoAccount(account)"
          >
            <view class="demo-account-copy">
              <text class="demo-account-name">{{ account.label }}</text>
              <text class="demo-account-desc">{{ account.description }}</text>
            </view>
            <text class="demo-account-action">一键填充</text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">{{ authMode === 'register' ? '用户名' : '用户名 / 手机号 / 邮箱' }} <text class="required">*</text></text>
          <input
            v-model.trim="username"
            class="form-input"
            :placeholder="authMode === 'register' ? '请输入用户名' : '请输入用户名、手机号或邮箱'"
            maxlength="50"
          />
        </view>

        <view class="form-item">
          <text class="form-label">密码 <text class="required">*</text></text>
          <input
            v-model="password"
            class="form-input"
            placeholder="请输入至少 6 位密码"
            maxlength="50"
            password
          />
        </view>

        <template v-if="authMode === 'register'">
          <view class="form-item">
            <text class="form-label">手机号</text>
            <input
              v-model.trim="phone"
              class="form-input"
              type="number"
              placeholder="选填"
              maxlength="20"
            />
          </view>

          <view class="form-item">
            <text class="form-label">邮箱</text>
            <input
              v-model.trim="email"
              class="form-input"
              type="text"
              placeholder="选填"
              maxlength="100"
            />
          </view>
        </template>

        <text v-if="authError" class="form-error">{{ authError }}</text>

        <view
          class="submit-btn primary-btn"
          hover-class="primary-btn--hover"
          hover-start-time="20"
          hover-stay-time="80"
          @tap="handleAccountAuth()"
        >
          <text class="btn-text">{{ authMode === 'login' ? '登录并进入' : '注册并进入' }}</text>
        </view>
        <!-- #endif -->
      </template>

      <view v-else class="form-item">
        <text class="form-label">当前孕周 <text class="required">*</text></text>
        <picker mode="selector" :range="weekOptions" @change="onWeekChange" class="form-picker">
          <view class="picker-value">
            <text :class="{ placeholder: !pregnancyWeek }">{{ pregnancyWeek ? '第 ' + pregnancyWeek + ' 周' : '点击选择当前孕周' }}</text>
          </view>
        </picker>
      </view>

      <view
        v-if="loginStep === 'week'"
        class="submit-btn primary-btn"
        hover-class="primary-btn--hover"
        hover-start-time="20"
        hover-stay-time="80"
        @tap="savePregnancyWeek()"
      >
        <text class="btn-text">保存并进入</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { authApi } from '@/api/modules'
import { useAppStore } from '@/stores/app'
import type { User } from '@/api/modules'
import { calculateDueDateFromPregnancyWeek, syncPregnancyWeekStorage } from '@/utils'
import dayjs from 'dayjs'

const appStore = useAppStore()
const loginStep = ref<'auth' | 'week'>('auth')
const pregnancyWeek = ref('')
const authMode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const phone = ref('')
const email = ref('')
const authError = ref('')
const weekOptions = Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 周`)
const demoAccounts = [
  {
    label: '免费演示账号',
    username: 'demo_free_user',
    password: 'Test123456!',
    description: '演示基础功能和升级前状态',
  },
  {
    label: '会员演示账号',
    username: 'demo_vip_user',
    password: 'Test123456!',
    description: '演示会员周报、无限额度和标识',
  },
]

const onWeekChange = (e: any) => {
  const selectedOption = weekOptions[Number(e.detail.value)] || ''
  pregnancyWeek.value = selectedOption.replace(/\D/g, '')
}

const setAuthMode = (mode: 'login' | 'register') => {
  authMode.value = mode
  authError.value = ''
}

const applyDemoAccount = (account: typeof demoAccounts[number]) => {
  authMode.value = 'login'
  username.value = account.username
  password.value = account.password
  phone.value = ''
  email.value = ''
  authError.value = ''
}

const navigateHome = () => {
  uni.showToast({ title: '登录成功', icon: 'success' })
  setTimeout(() => {
    uni.switchTab({ url: '/pages/home/index' })
  }, 500)
}

const normalizePregnancyStatus = (value: unknown) => {
  if (typeof value === 'number' && value >= 1 && value <= 3) return value

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    if (!trimmed) return undefined
    if (trimmed === 'preparing') return 1
    if (trimmed === 'pregnant') return 2
    if (trimmed === 'postpartum') return 3

    const numericValue = Number.parseInt(trimmed, 10)
    if (!Number.isNaN(numericValue) && numericValue >= 1 && numericValue <= 3) {
      return numericValue
    }
  }

  return undefined
}

const shouldSelectPregnancyWeek = (targetUser?: User | null) => {
  if (!targetUser) return true
  const status = normalizePregnancyStatus(targetUser.pregnancyStatus)
  if (status === 1 || status === 3 || targetUser.babyBirthday) {
    return false
  }
  return !targetUser.dueDate
}

async function finalizeLogin(result: { user: User; token: string }) {
  if (!result?.token) {
    throw new Error('登录异常：未获取到凭证')
  }

  uni.setStorageSync('token', result.token)
  appStore.setUser(result.user)
  await appStore.fetchUser()

  const latestUser = appStore.user || result.user
  uni.hideLoading()

  if (shouldSelectPregnancyWeek(latestUser)) {
    loginStep.value = 'week'
    uni.showToast({ title: '请选择当前孕周', icon: 'none' })
    return
  }

  syncPregnancyWeekStorage(latestUser?.dueDate)
  navigateHome()
}

// 微信登录逻辑
async function handleWechatLogin() {
  uni.showLoading({ title: '登录中...' })
  uni.login({
    provider: 'weixin',
    success: async (loginRes) => {
      try {
        const res = await authApi.wechatLogin({
          code: loginRes.code,
        }) as unknown as { user: User; token: string }
        await finalizeLogin(res)
      } catch (err: any) {
        uni.hideLoading()
        console.error('WeChat login API failed:', err)
        uni.showToast({ title: err.message || '微信登录失败', icon: 'none' })
      }
    },
    fail: (err) => {
      uni.hideLoading()
      console.error('WeChat login trigger failed:', err)
      uni.showToast({ title: '微信授权失败', icon: 'none' })
    }
  })
}

async function handleAccountAuth() {
  authError.value = ''

  if (!username.value) {
    authError.value = authMode.value === 'register' ? '请输入用户名' : '请输入登录账号'
    return
  }

  if (!password.value) {
    authError.value = '请输入密码'
    return
  }

  if (password.value.length < 6) {
    authError.value = '密码长度不能少于 6 位'
    return
  }

  uni.showLoading({ title: authMode.value === 'login' ? '登录中...' : '注册中...' })
  try {
    const result = authMode.value === 'login'
      ? await authApi.login({
          username: username.value,
          password: password.value,
        }) as { user: User; token: string }
      : await authApi.register({
          username: username.value,
          password: password.value,
          phone: phone.value || undefined,
          email: email.value || undefined,
        }) as { user: User; token: string }

    await finalizeLogin(result)
  } catch (err: any) {
    uni.hideLoading()
    console.error('[Login] 账号登录失败:', err)
    authError.value = err?.message || (authMode.value === 'login' ? '登录失败，请重试' : '注册失败，请重试')
  }
}

async function savePregnancyWeek() {
  if (!pregnancyWeek.value) {
    uni.showToast({ title: '请先选择当前孕周', icon: 'none' })
    return
  }

  const dueDate = calculateDueDateFromPregnancyWeek(pregnancyWeek.value)
  if (!dueDate) {
    uni.showToast({ title: '孕周无效，请重新选择', icon: 'none' })
    return
  }

  try {
    uni.showLoading({ title: '保存中...' })
    const updatedUser = await authApi.updateProfile({
      pregnancyStatus: 2,
      dueDate: dayjs(dueDate).format('YYYY-MM-DD'),
      babyBirthday: null,
    })

    appStore.setUser(updatedUser)
    await appStore.fetchUser()
    syncPregnancyWeekStorage(appStore.user?.dueDate, pregnancyWeek.value)
    uni.hideLoading()
    navigateHome()
  } catch (err: any) {
    uni.hideLoading()
    console.error('[Login] 保存孕周失败:', err)
    uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
  }
}

onMounted(async () => {
  const token = uni.getStorageSync('token')
  if (!token) return

  await appStore.fetchUser()
  const latestUser = appStore.user
  if (!latestUser) return

  if (shouldSelectPregnancyWeek(latestUser)) {
    loginStep.value = 'week'
    return
  }

  syncPregnancyWeekStorage(latestUser.dueDate)
  uni.switchTab({ url: '/pages/home/index' })
})
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #fff0f5 0%, #ffffff 40%);
  padding: 0 48rpx;
}

.login-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 160rpx;
  margin-bottom: 80rpx;
}

.login-logo {
  font-size: 52rpx;
  font-weight: bold;
  color: #ff6b9d;
  margin-bottom: 16rpx;
}

.login-subtitle {
  font-size: 30rpx;
  color: #666666;
}

.login-form {
  background-color: #ffffff;
  border-radius: 24rpx;
  padding: 50rpx 40rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.08);
}

.form-title {
  text-align: center;
  margin-bottom: 20rpx;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.form-desc {
  display: block;
  margin-bottom: 36rpx;
  text-align: center;
  font-size: 24rpx;
  line-height: 1.6;
  color: #8c8c8c;
}

.form-item {
  margin-bottom: 50rpx;
}

.auth-mode-tabs {
  display: flex;
  background: #fff5f8;
  border-radius: 18rpx;
  padding: 8rpx;
  margin-bottom: 36rpx;
}

.auth-mode-tab {
  flex: 1;
  border-radius: 14rpx;
  padding: 18rpx 0;
  text-align: center;
  transition: all 0.2s ease;
}

.auth-mode-tab--active {
  background: #ffffff;
  box-shadow: 0 6rpx 20rpx rgba(255, 107, 157, 0.16);
}

.auth-mode-tab text {
  font-size: 28rpx;
  color: #999999;
  font-weight: 500;
}

.auth-mode-text--active {
  color: #ff6b9d !important;
  font-weight: 700 !important;
}

.demo-account-box {
  margin-bottom: 28rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: #fff5f8;
}

.demo-account-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #d84f84;
}

.demo-account-hint {
  display: block;
  margin-top: 10rpx;
  margin-bottom: 18rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #8c6f7d;
}

.demo-account-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 22rpx;
  border-radius: 18rpx;
  background: #ffffff;
}

.demo-account-card + .demo-account-card {
  margin-top: 14rpx;
}

.demo-account-copy {
  flex: 1;
}

.demo-account-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #333333;
}

.demo-account-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #7d7d7d;
}

.demo-account-action {
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 600;
  color: #ff6b9d;
}

.form-label {
  font-size: 28rpx;
  color: #333333;
  font-weight: 600;
  margin-bottom: 16rpx;
  display: block;
}

.required {
  color: #ff4d4f;
  margin-left: 8rpx;
}

.form-picker {
  width: 100%;
  height: 90rpx;
  padding: 0 30rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 16rpx;
  background-color: #fcfcfc;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.picker-value {
  font-size: 30rpx;
  color: #333333;
  width: 100%;
}

.form-input {
  width: 100%;
  min-height: 90rpx;
  padding: 0 30rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 16rpx;
  background-color: #fcfcfc;
  box-sizing: border-box;
  font-size: 30rpx;
  color: #333333;
}

.picker-value .placeholder {
  color: #999999;
}

.form-error {
  display: block;
  margin-top: -20rpx;
  margin-bottom: 24rpx;
  color: #ff4d4f;
  font-size: 24rpx;
}

.primary-btn {
  background: linear-gradient(135deg, #ff6b9d 0%, #ff8f70 100%);
  box-shadow: 0 8rpx 20rpx rgba(255, 107, 157, 0.28);
}

.primary-btn--hover {
  opacity: 0.9;
}

.wechat-btn {
  background: #07c160;
  padding: 26rpx;
  border-radius: 44rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 8rpx 20rpx rgba(7, 193, 96, 0.3);
  transition: opacity 0.2s;
}

.wechat-btn--hover {
  opacity: 0.8;
}

.btn-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #ffffff;
  letter-spacing: 2rpx;
}
</style>
