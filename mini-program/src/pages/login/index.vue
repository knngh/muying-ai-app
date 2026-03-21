<template>
  <view class="login-page">
    <view class="login-header">
      <text class="login-logo">母婴AI助手</text>
      <text class="login-subtitle">{{ isRegister ? '创建新账号' : '欢迎回来' }}</text>
    </view>

    <view class="login-form">
      <!-- Username -->
      <view class="form-item">
        <text class="form-label">用户名</text>
        <input
          v-model="form.username"
          class="form-input"
          placeholder="请输入用户名"
          type="text"
        />
      </view>

      <!-- Password -->
      <view class="form-item">
        <text class="form-label">密码</text>
        <input
          v-model="form.password"
          class="form-input"
          placeholder="请输入密码"
          password
        />
      </view>

      <!-- Register-only fields -->
      <!-- 注册专有字段 -->
      <view v-if="isRegister" class="register-fields">
        <view class="form-item">
          <text class="form-label">当前孕周 (可选)</text>
          <picker mode="selector" :range="weekOptions" @change="onWeekChange" class="form-picker">
            <view class="picker-value">
              <text :class="{'placeholder': !form.pregnancyWeek}">{{ form.pregnancyWeek ? '第 ' + form.pregnancyWeek + ' 周' : '请选择当前孕周' }}</text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">手机号</text>
          <input
            v-model="form.phone"
            class="form-input"
            placeholder="请输入手机号"
            type="number"
          />
        </view>
        <view class="form-item">
          <text class="form-label">邮箱</text>
          <input
            v-model="form.email"
            class="form-input"
            placeholder="请输入邮箱"
            type="text"
          />
        </view>
      </view>
      <!-- Submit -->
      <view
        :class="['submit-btn', submitting ? 'submit-btn-disabled' : '']"
        @tap="handleSubmit"
      >
        <text class="submit-btn-text">
          {{ submitting ? '提交中...' : (isRegister ? '注册' : '登录') }}
        </text>
      </view>

      <!-- Toggle -->
      <view class="toggle-row" @tap="toggleMode">
        <text class="toggle-text">
          {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
        </text>
      </view>

      <!-- 微信登录 -->
      <view class="submit-btn wechat-btn" @tap="handleWechatLogin" style="background: #07c160; margin-top: 30rpx;">
        <text class="btn-text" style="color: #fff;">微信一键登录</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { authApi } from '@/api/modules'
import { useAppStore } from '@/stores/app'
import type { User } from '@/api/types'

const appStore = useAppStore()

const isRegister = ref(false)
const submitting = ref(false)

const form = reactive({
  username: '',
  password: '',
  phone: '',
  email: '',
  pregnancyWeek: '',
})

const weekOptions = Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 周`)

const onWeekChange = (e: any) => {
  form.pregnancyWeek = String(e.detail.value + 1)
}

function toggleMode() {
  isRegister.value = !isRegister.value
  form.phone = ''
  form.email = ''
  form.pregnancyWeek = ''
}

// 微信登录逻辑
async function handleWechatLogin() {
  uni.showLoading({ title: '登录中...' })
  uni.login({
    provider: 'weixin',
    success: async (loginRes) => {
      // 实际上这里应该把 loginRes.code 发给你的后端去换取 token 和 openid
      // 例如：const res = await authApi.wechatLogin({ code: loginRes.code })
      console.log('WeChat login code:', loginRes.code)
      
      // 模拟微信登录成功后的跳转（在后端接口完成前）
      uni.hideLoading()
      uni.showToast({ title: '微信登录成功', icon: 'success' })
      setTimeout(() => {
        uni.switchTab({ url: '/pages/home/index' })
      }, 500)
    },
    fail: (err) => {
      uni.hideLoading()
      console.error('WeChat login failed:', err)
      uni.showToast({ title: '微信登录失败', icon: 'none' })
    }
  })
}
async function handleSubmit() {
  if (submitting.value) return

  if (!form.username.trim()) {
    uni.showToast({ title: '请输入用户名', icon: 'none' })
    return
  }
  if (!form.password.trim()) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return
  }

  submitting.value = true

  try {
    let result: { user: User; token: string }

    if (isRegister.value) {
      result = await authApi.register({
        username: form.username.trim(),
        password: form.password.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      }) as { user: User; token: string }
      
      if (form.pregnancyWeek) {
        uni.setStorageSync('userPregnancyWeek', form.pregnancyWeek)
      }
    } else {
      result = await authApi.login({
        username: form.username.trim(),
        password: form.password.trim(),
      }) as { user: User; token: string }
    }

    uni.setStorageSync('token', result.token)
    appStore.setUser(result.user)

    uni.showToast({
      title: isRegister.value ? '注册成功' : '登录成功',
      icon: 'success',
    })

    setTimeout(() => {
      uni.switchTab({ url: '/pages/home/index' })
    }, 500)
  } catch (error: unknown) {
    const err = error as { message?: string }
    uni.showToast({
      title: err.message || (isRegister.value ? '注册失败' : '登录失败'),
      icon: 'none',
      duration: 2000,
    })
  } finally {
    submitting.value = false
  }
}
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

/* Form */
.login-form {
  background-color: #ffffff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.08);
}

.form-item {
  margin-bottom: 32rpx;
}

.form-label {
  font-size: 26rpx;
  color: #333333;
  font-weight: 600;
  margin-bottom: 12rpx;
  display: block;
}

.form-input {
  width: 100%;
  height: 80rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  border: 1rpx solid #e0e0e0;
  border-radius: 12rpx;
  background-color: #f9f9f9;
  box-sizing: border-box;
}

.form-picker {
  width: 100%;
  height: 80rpx;
  padding: 0 24rpx;
  border: 1rpx solid #e0e0e0;
  border-radius: 12rpx;
  background-color: #f9f9f9;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.picker-value {
  font-size: 28rpx;
  color: #333333;
}

.picker-value .placeholder {
  color: #999999;
}

/* Submit */
.submit-btn {
  margin-top: 16rpx;
  background: linear-gradient(135deg, #ff6b9d, #c44dff);
  padding: 24rpx;
  border-radius: 44rpx;
  display: flex;
  justify-content: center;
}

.submit-btn-disabled {
  opacity: 0.6;
}

.submit-btn-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
}

/* Toggle */
.toggle-row {
  display: flex;
  justify-content: center;
  margin-top: 32rpx;
}

.toggle-text {
  font-size: 26rpx;
  color: #ff6b9d;
}
</style>
