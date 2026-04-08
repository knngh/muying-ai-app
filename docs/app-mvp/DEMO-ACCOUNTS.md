# MVP 演示账号

## 账号列表

- 免费演示账号
  - 用户名：`demo_free_user`
  - 密码：`Test123456!`
  - 预期状态：免费用户，AI 额度 `3/天`

- 会员演示账号
  - 用户名：`demo_vip_user`
  - 密码：`Test123456!`
  - 预期状态：季度会员，AI 额度 `9999/天`

- 历史测试账号
  - 用户名：`testuser`
  - 密码：`Test123456!`
  - 预期状态：会员用户，用于社区会员标识和接口联调

## 推荐演示路径

1. 使用 `demo_free_user` 登录
2. 查看会员状态、今日额度，确认是免费用户
3. 在 App 会员页选择套餐并下单
4. 触发 mock 支付回调后，重新查看会员状态和额度
5. 使用 `demo_vip_user` 登录，直接查看 AI 周报、会员权益和社区会员标识

## 备注

- `prisma/seed.ts` 会稳定重置 `demo_free_user` 和 `demo_vip_user` 的状态。
- `demo_free_user` 每次 seed 后会清空订阅、订单和周报历史，恢复为纯免费用户。
- `demo_vip_user` 每次 seed 后会恢复为季度会员，并生成一份演示周报。
- 标准重置命令：
  - `npm run db:seed`
  - `npm run seed:community`
