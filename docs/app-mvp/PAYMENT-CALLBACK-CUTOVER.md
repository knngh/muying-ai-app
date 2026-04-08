# Payment Callback Cutover

更新时间：2026-04-06

## 1. 目标

把当前支付回调从“登录态 mock confirm fallback”切换到“真实签名校验优先”。

当前状态：

- 签名校验框架已上线
- 生产尚未配置支付回调密钥
- 生产当前仍允许 auth fallback

## 2. 生产需要配置的变量

在生产 `/www/wwwroot/muying-ai-app/.env` 中补齐：

```bash
WECHAT_PAYMENT_CALLBACK_SECRET=你的微信回调密钥
ALIPAY_PAYMENT_CALLBACK_SECRET=你的支付宝回调密钥
PAYMENT_CALLBACK_ALLOW_AUTH_FALLBACK=false
PAYMENT_CALLBACK_MAX_SKEW_SECONDS=300
```

说明：

- 切换到真实验签时，`PAYMENT_CALLBACK_ALLOW_AUTH_FALLBACK` 应设为 `false`
- 如仍在演示阶段，可临时保持 `true`

## 3. 签名格式

签名头：

- `X-Payment-Timestamp`
- `X-Payment-Signature`

签名串：

```text
provider=<provider>
timestamp=<timestamp>
orderNo=<orderNo>
tradeNo=<tradeNo>
paymentStatus=<paymentStatus>
amount=<amount>
```

算法：

- `HMAC-SHA256`

## 4. 本地生成签名

命令：

```bash
npx tsx scripts/generate-payment-callback-signature.ts \
  --provider wechat \
  --secret your-secret \
  --order-no SUB202604060001 \
  --trade-no WX-123 \
  --amount 19.9
```

输出会直接给出：

- `timestamp`
- `signature`
- 可用请求头

## 5. 切换步骤

1. 与支付网关确认回调密钥
2. 在生产 `.env` 写入密钥与 `PAYMENT_CALLBACK_ALLOW_AUTH_FALLBACK=false`
3. 执行服务端发布
4. 用自动化脚本执行签名回调验收
5. 确认未签名回调被拒绝

推荐命令：

```bash
PAYMENT_CALLBACK_SECRET=你的微信回调密钥 \
PAYMENT_USERNAME=demo_free_user \
PAYMENT_PASSWORD=Test123456! \
PROVIDER=wechat \
npm run ops:verify:payment-callback:prod
```

脚本会自动覆盖：

- 正确签名回调成功
- 错误签名 + `Authorization` 头不会 fallback
- 未签名 + `Authorization` 头不会 fallback
- 支付金额不匹配被拒绝
- 支付渠道不匹配被拒绝

说明：

- 如使用 `demo_free_user` 做验收，验收完成后应重新执行 seed，恢复公开演示账号状态
- 若验证支付宝，改为 `PROVIDER=alipay`，并传入对应支付宝回调密钥

## 6. 验收标准

应通过：

- 正确签名回调返回成功
- 错误签名回调返回拒绝
- 未签名回调返回拒绝
- 支付渠道不匹配返回拒绝
- 支付金额不匹配返回拒绝

## 7. 当前边界

- 当前仓库只提供回调签名框架，不包含第三方支付网关 SDK 接入
- 若要做到真实生产闭环，还需要对接实际网关回调字段与密钥下发方式
- 截至 2026-04-06，生产环境仍未配置真实回调密钥，因此尚未完成正式切换
