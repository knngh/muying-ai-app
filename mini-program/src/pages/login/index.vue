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

      <view v-if="loginStep === 'week'" class="form-item">
        <text class="form-label">当前孕周 <text class="required">*</text></text>
        <picker mode="selector" :range="weekOptions" @change="onWeekChange" class="form-picker">
          <view class="picker-value">
            <text :class="{'placeholder': !pregnancyWeek}">{{ pregnancyWeek ? '第 ' + pregnancyWeek + ' 周' : '点击选择当前孕周' }}</text>
          </view>
        </picker>
      </view>

      <view
        class="submit-btn wechat-btn"
        hover-class="wechat-btn--hover"
        hover-start-time="20"
        hover-stay-time="80"
        @tap="loginStep === 'auth' ? handleWechatLogin() : savePregnancyWeek()"
      >
        <text class="btn-text">{{ loginStep === 'auth' ? '微信一键登录' : '保存并进入' }}</text>
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
const weekOptions = Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 周`)

const onWeekChange = (e: any) => {
  const selectedOption = weekOptions[Number(e.detail.value)] || ''
  pregnancyWeek.value = selectedOption.replace(/\D/g, '')
}

const navigateHome = () => {
  uni.showToast({ title: '登录成功', icon: 'success' })
  setTimeout(() => {
    uni.switchTab({ url: '/pages/home/index' })
  }, 500)
}

const shouldSelectPregnancyWeek = (targetUser?: User | null) => {
  if (!targetUser) return true
  return !targetUser.dueDate
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

        console.log('[Login] API 返回:', JSON.stringify(res))

        if (!res || !res.token) {
          uni.hideLoading()
          uni.showToast({ title: '登录异常：未获取到凭证', icon: 'none' })
          console.error('[Login] res.token 为空, res =', res)
          return
        }

        uni.setStorageSync('token', res.token)
        appStore.setUser(res.user)
        await appStore.fetchUser()
        const latestUser = appStore.user || res.user

        const savedToken = uni.getStorageSync('token')
        console.log('[Login] token 已保存, 验证读取:', savedToken ? '成功' : '失败')

        uni.hideLoading()

        if (shouldSelectPregnancyWeek(latestUser)) {
          loginStep.value = 'week'
          uni.showToast({ title: '请选择当前孕周', icon: 'none' })
          return
        }

        syncPregnancyWeekStorage(latestUser?.dueDate)
        navigateHome()
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

.picker-value .placeholder {
  color: #999999;
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
