<template>
  <view class="trust-page">
    <view class="hero-card">
      <text class="hero-kicker">上线版本说明</text>
      <text class="hero-title">我们如何处理公开资料</text>
      <text class="hero-desc">
        贝护妈妈当前小程序优先提供孕育资料库、孕周日历和基础档案。内容用于帮助理解公开资料，不提供问诊、诊断、治疗、处方或个人化用药服务。
      </text>
    </view>

    <view class="section-card">
      <text class="section-title">内容来源</text>
      <text class="section-text">
        资料库优先收录中国政府网、国家卫健委、中国疾控、国家疾控局等中国公开资料，同时补充 WHO、CDC、AAP、ACOG、NHS 等公开机构内容。
      </text>
      <text class="section-text">
        每篇详情页会展示来源机构、来源更新时间、同步时间和可复制的来源链接，方便你回到原始资料核对。
      </text>
    </view>

    <view class="section-card">
      <text class="section-title">中文辅助阅读</text>
      <text class="section-text">
        国际来源内容会保留原文，并提供中文辅助阅读。译文只用于降低阅读门槛，涉及检查结果、个人情况或线下安排时，请以机构原文和线下专业意见为准。
      </text>
      <text class="section-text">
        如果译文正在生成或质量不足，页面会优先展示原文摘要、来源信息和中文导读，不会把未通过清洗的模板内容直接展示给用户。
      </text>
    </view>

    <view class="warning-card">
      <text class="warning-title">这些情况请优先线下确认</text>
      <text class="warning-text">孕期出血、持续腹痛、规律宫缩、破水、胎动明显减少。</text>
      <text class="warning-text">孕期或婴幼儿高热、精神差、呼吸困难、抽搐、严重呕吐或脱水。</text>
      <text class="warning-text">新生儿黄疸加重、吃奶明显变差、嗜睡或反应异常。</text>
      <text class="warning-text">任何检查异常、持续不适和个体化判断，都应优先联系线下医疗机构确认。</text>
    </view>

    <view class="section-card">
      <text class="section-title">隐私与使用范围</text>
      <text class="section-text">
        小程序当前不要求上传身份证件、真实姓名或其他敏感身份材料。不登录也可以先浏览知识库和孕周日历；需要保存记录、待办或阶段信息时才会使用登录状态。
      </text>
      <text class="section-text">
        当前版本以资料检索、译文阅读和个人记录为主，不开放社区发布、在线咨询、会员付费或外部网页跳转入口。
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'

const sharePayload = {
  title: '贝护妈妈内容可信说明',
  path: '/pages/trust-center/index',
}

onShareAppMessage(() => sharePayload)
onShareTimeline(() => ({ title: sharePayload.title, query: '' }))
</script>

<style scoped>
.trust-page {
  min-height: 100vh;
  background: #f7f9fa;
  padding: 32rpx;
  box-sizing: border-box;
}

.hero-card,
.section-card,
.warning-card {
  border-radius: 28rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-sizing: border-box;
}

.hero-card {
  background: linear-gradient(135deg, #fff4e8 0%, #f4fbf8 100%);
  border: 1rpx solid rgba(214, 161, 92, 0.18);
}

.hero-kicker {
  display: block;
  color: #9a6a28;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.hero-title {
  display: block;
  margin-top: 12rpx;
  color: #263238;
  font-size: 42rpx;
  font-weight: 800;
  line-height: 1.25;
}

.hero-desc,
.section-text,
.warning-text {
  display: block;
  color: #5f6f7c;
  font-size: 27rpx;
  line-height: 1.75;
}

.hero-desc {
  margin-top: 18rpx;
}

.section-card {
  background: #fffcf8;
  border: 1rpx solid #edf1f3;
}

.section-title,
.warning-title {
  display: block;
  margin-bottom: 16rpx;
  color: #263238;
  font-size: 31rpx;
  font-weight: 800;
}

.section-text + .section-text,
.warning-text + .warning-text {
  margin-top: 12rpx;
}

.warning-card {
  background: #fff7f3;
  border: 1rpx solid rgba(224, 112, 83, 0.2);
}

.warning-title {
  color: #b94b35;
}

.warning-text {
  color: #7d4c40;
}
</style>
