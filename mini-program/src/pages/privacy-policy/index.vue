<template>
  <view class="privacy-policy-page">
    <view class="policy-header">
      <text class="policy-title">贝护妈妈用户隐私保护指引</text>
      <text class="policy-subtitle">最后更新日期：2026年09月02日</text>
    </view>

    <scroll-view class="policy-content" scroll-y>
      <view class="policy-section">
        <text class="section-title">一、我们收集的信息</text>
        <view class="policy-item">
          <text class="item-label">1. 微信登录信息</text>
          <text class="item-desc">使用微信快捷登录时，小程序取得微信登录凭证 code 并发送到服务端；服务端向微信换取 OpenID，用于识别账号、保存登录时间和登录 IP。当前版本不调用微信昵称、头像、手机号、定位、通讯录或微信运动接口。</text>
        </view>
        <view class="policy-item">
          <text class="item-label">2. 账号登录信息</text>
          <text class="item-desc">在支持账号注册或登录的端，您主动填写的用户名和密码会用于账号认证；密码仅以哈希形式保存。当前微信小程序优先使用微信快捷登录，不要求您填写手机号或邮箱。</text>
        </view>
        <view class="policy-item">
          <text class="item-label">3. 孕育档案信息</text>
          <text class="item-desc">您主动填写的孕育阶段、孕周、预产期、宝宝出生日期、宝宝性别、喂养方式、照护角色、发育关注和家庭备注等信息，用于生成日历、提醒和阶段内容。这些可能涉及孕育或健康状况的敏感信息只在您主动填写后处理。</text>
        </view>
        <view class="policy-item">
          <text class="item-label">4. 孕育记录与使用记录</text>
          <text class="item-desc">您主动保存的日记文字、待办、完成状态、时间线、收藏和阅读历史会与账号关联。使用拍照或相册功能时，我们仅处理您主动选择或拍摄并上传的照片，用于保存孕育记录。</text>
        </view>
        <view class="policy-item">
          <text class="item-label">5. 日志与埋点信息</text>
          <text class="item-desc">为保障安全、排查故障和改进服务，服务端可能记录请求时间、IP 地址、用户代理、接口访问结果和错误日志；小程序还会生成本地客户端 ID、会话 ID 和页面事件。我们不以这些信息推断您的精确位置。</text>
        </view>
      </view>

      <view class="policy-section">
        <text class="section-title">二、信息的使用目的</text>
        <view class="policy-item">
          <text class="item-desc">我们使用上述信息提供微信登录、孕育日历、知识库浏览、阶段提醒、记录保存、收藏与阅读历史等功能，并用于账号安全、反滥用、故障排查和服务质量分析。孕育或健康信息不会用于医疗诊断，也不会用于与本服务无关的广告画像。</text>
        </view>
      </view>

      <view class="policy-section">
        <text class="section-title">三、信息的共享与委托处理</text>
        <view class="policy-item">
          <text class="item-desc">我们不会出售或出租个人信息。为完成登录和基础设施服务，必要信息可能由以下服务商按我们的指示处理：微信开放平台用于登录凭证换取 OpenID；生产环境启用对象存储时，腾讯云 COS 用于孕育记录照片的存储和访问。我们仅提供实现功能所需的最少信息，并要求服务商履行保密和安全义务。</text>
        </view>
        <view class="policy-item">
          <text class="item-desc">如法律法规、司法机关或监管机构依法要求，我们可能在必要范围内披露相关信息，并在法律允许范围内告知您。</text>
        </view>
      </view>

      <view class="policy-section">
        <text class="section-title">四、信息的存储与保护</text>
        <view class="policy-item">
          <text class="item-desc">账号、档案、记录和收藏保存在服务端数据库；照片默认保存在服务端上传目录，生产环境也可能保存在腾讯云 COS。生产环境接口使用 HTTPS 传输，账号密码使用哈希保存，并通过访问控制、上传类型和数量限制等措施降低风险。我们仅在实现服务、履行法定义务或处理争议所需期间保留信息。</text>
        </view>
        <view class="policy-item">
          <text class="item-desc">您删除孕育记录时，关联照片会进入清理流程；注销账号后，我们会按法律要求和业务清理流程删除或匿名化可删除的信息，依法需要留存的日志除外。</text>
        </view>
      </view>

      <view class="policy-section">
        <text class="section-title">五、您的权利</text>
        <view class="policy-item">
          <text class="item-label">访问、更正和删除</text>
          <text class="item-desc">您可以在“我的”页面查看或修改昵称、孕周和预产期等资料，也可以删除自己的记录。申请查询、更正、删除或注销账号，请发送邮件至 support@beihu.me，并说明账号和请求内容；我们会核验身份后处理。</text>
        </view>
        <view class="policy-item">
          <text class="item-label">撤回同意</text>
          <text class="item-desc">您可以拒绝照片上传授权、停止填写档案或删除已保存的记录。撤回同意不影响撤回前基于同意处理的合法性；拒绝照片授权不影响知识库和日历浏览。</text>
        </view>
        <view class="policy-item">
          <text class="item-label">投诉与联系</text>
          <text class="item-desc">如对个人信息处理有疑问、投诉或举报，请通过 support@beihu.me 联系我们，我们会在合理期限内答复。</text>
        </view>
      </view>

      <view class="policy-section">
        <text class="section-title">六、未成年人保护</text>
        <view class="policy-item">
          <text class="item-desc">本服务主要面向孕妇、家长和照护者。我们不会故意收集未满 14 周岁未成年人的个人信息；如发现误收集，会在核实后及时删除或采取法律要求的保护措施。</text>
        </view>
      </view>

      <view class="policy-section">
        <text class="section-title">七、指引更新与生效</text>
        <view class="policy-item">
          <text class="item-desc">业务或法律要求发生变化时，我们会在本页面更新指引并标注更新日期。重大变化会在使用相关功能前以适当方式提示。本指引最后更新于 2026 年 9 月 2 日。</text>
        </view>
      </view>

      <view class="policy-footer">
        <text class="footer-text">请在使用需要个人信息的功能前阅读并理解本指引。</text>
        <text class="footer-text">微信公众平台后台的《用户隐私保护指引》需与本页面和实际代码保持一致。</text>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.privacy-policy-page {
  min-height: 100vh;
  background-color: #f7f9fa;
}

.policy-header {
  padding: 40rpx 30rpx;
  background-color: #ffffff;
  border-bottom: 1rpx solid #eeeeee;
}

.policy-title,
.policy-subtitle {
  display: block;
  text-align: center;
}

.policy-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333333;
}

.policy-subtitle {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #999999;
}

.policy-content {
  padding: 0 30rpx;
}

.policy-section {
  margin-bottom: 30rpx;
  overflow: hidden;
  background-color: #ffffff;
  border-radius: 16rpx;
}

.section-title {
  display: block;
  padding: 25rpx 30rpx 20rpx;
  border-bottom: 1rpx solid #eeeeee;
  color: #333333;
  font-size: 30rpx;
  font-weight: 600;
}

.policy-item {
  padding: 20rpx 30rpx;
}

.policy-item:not(:last-child) {
  border-bottom: 1rpx solid #f5f5f5;
}

.item-label {
  display: block;
  margin-bottom: 12rpx;
  color: #333333;
  font-size: 26rpx;
  font-weight: 600;
}

.item-desc {
  color: #666666;
  font-size: 24rpx;
  line-height: 1.7;
}

.policy-footer {
  padding: 30rpx;
  color: #999999;
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
}

.footer-text {
  display: block;
  margin-bottom: 15rpx;
}
</style>
