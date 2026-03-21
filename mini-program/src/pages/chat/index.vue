<template>
  <view class="coming-soon-page">
    <view class="content-wrapper">
      <!-- 动态插画区域 -->
      <view class="illustration-container">
        <view class="glow-circle"></view>
        <view class="icon-wrapper">
          <text class="main-emoji">🤖</text>
        </view>
        <!-- 悬浮装饰 -->
        <text class="float-item float-1">💬</text>
        <text class="float-item float-2">✨</text>
        <text class="float-item float-3">🩺</text>
      </view>

      <!-- 文字信息区 -->
      <view class="text-container">
        <text class="title">AI 专属母婴答疑</text>
        <text class="subtitle">即将上线</text>
        
        <view class="desc-box">
          <text class="desc-text">我们正在紧急接入顶级三甲医院专家知识库与强大的 RAG 检索模型。</text>
          <text class="desc-text">很快，您就可以随时随地获得精准、安全、贴心的孕产育儿解答。</text>
        </view>
      </view>

      <!-- 底部装饰按钮 -->
      <view class="action-container" @tap="goBack">
        <button class="back-btn">先去看看孕育时间轴</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
const goBack = () => {
  uni.switchTab({ url: '/pages/calendar/index' })
}
</script>

<style scoped>
.coming-soon-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f0f4ff 0%, #ffffff 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx;
  margin-top: -100rpx; /* 稍微往上偏移居中 */
}

/* === 动态插画 === */
.illustration-container {
  position: relative;
  width: 400rpx;
  height: 400rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 60rpx;
}

.glow-circle {
  position: absolute;
  width: 280rpx;
  height: 280rpx;
  background: radial-gradient(circle, rgba(123, 156, 255, 0.2) 0%, rgba(123, 156, 255, 0) 70%);
  border-radius: 50%;
  animation: pulse 3s infinite ease-in-out;
}

.icon-wrapper {
  z-index: 2;
  font-size: 160rpx;
  width: 220rpx;
  height: 220rpx;
  background: #ffffff;
  border-radius: 60rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 20rpx 40rpx rgba(123, 156, 255, 0.2);
  transform: rotate(-5deg);
  animation: float-main 4s infinite ease-in-out;
}

.float-item {
  position: absolute;
  font-size: 60rpx;
  opacity: 0.9;
  z-index: 3;
}

.float-1 { top: 20rpx; right: 20rpx; animation: float-sub 3s infinite ease-in-out; }
.float-2 { bottom: 40rpx; left: 0rpx; animation: float-sub 3.5s infinite ease-in-out reverse; }
.float-3 { top: 100rpx; left: 20rpx; font-size: 50rpx; animation: float-sub 4s infinite ease-in-out 1s; }

/* === 动画定义 === */
@keyframes pulse {
  0% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.4); opacity: 1; }
  100% { transform: scale(1); opacity: 0.6; }
}

@keyframes float-main {
  0% { transform: translateY(0) rotate(-5deg); }
  50% { transform: translateY(-20rpx) rotate(0deg); }
  100% { transform: translateY(0) rotate(-5deg); }
}

@keyframes float-sub {
  0% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-15rpx) scale(1.1); }
  100% { transform: translateY(0) scale(1); }
}

/* === 文字信息 === */
.text-container {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.title {
  font-size: 52rpx;
  font-weight: 900;
  color: #333;
  margin-bottom: 16rpx;
  letter-spacing: 2rpx;
}

.subtitle {
  font-size: 28rpx;
  color: #fff;
  background: linear-gradient(90deg, #7b9cff 0%, #5a80ff 100%);
  padding: 8rpx 30rpx;
  border-radius: 30rpx;
  font-weight: bold;
  margin-bottom: 60rpx;
  box-shadow: 0 8rpx 20rpx rgba(123, 156, 255, 0.3);
}

.desc-box {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  padding: 40rpx;
  border-radius: 30rpx;
  width: 100%;
  box-sizing: border-box;
}

.desc-text {
  display: block;
  font-size: 28rpx;
  color: #666;
  line-height: 1.8;
  margin-bottom: 10rpx;
}

/* === 按钮 === */
.action-container {
  margin-top: 80rpx;
  width: 100%;
}

.back-btn {
  background-color: #ffffff;
  color: #7b9cff;
  border: 2rpx solid #e0e8ff;
  border-radius: 50rpx;
  font-size: 32rpx;
  font-weight: bold;
  height: 90rpx;
  line-height: 86rpx;
  box-shadow: 0 10rpx 20rpx rgba(0,0,0,0.03);
  transition: all 0.2s;
}

.back-btn:active {
  background-color: #f0f4ff;
  transform: scale(0.98);
}
</style>
