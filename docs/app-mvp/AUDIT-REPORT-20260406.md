# MVP 审查报告

更新时间：2026-04-06

## 1. 范围

本次审查覆盖：

- MVP P0-P6 新增与变更的服务端主链路
- 会员 / 支付 / 配额 / 周报 / analytics 相关 API
- App / 小程序新增埋点接入
- 发布、回滚、测试口径

审查维度：

- 代码审查
- 安全审查
- 逻辑审查
- API 审查

## 2. 总结论

当前 MVP 主体已完成，且经过本轮审查与修复后，关键线上风险已从“可被直接触发”下降到“可控边界内”。

本轮结论：

- 已发现并修复 4 个高优先级问题
- 已补齐最小自动化回归保护
- 默认测试口径已收敛为可离线执行
- 当前剩余风险主要集中在“真实支付闭环未验证”和“客户端新埋点尚未正式发布”

## 3. 已修复问题

### 3.1 Critical：支付确认接口可被越权调用

问题：

- 支付确认接口原本未要求登录
- 只要知道 `orderNo`，理论上就能触发会员开通闭环

影响：

- 存在越权确认订单风险
- 会直接影响会员状态与支付链路可信度

已修复：

- `POST /api/v1/payment/callback/wechat`
- `POST /api/v1/payment/callback/alipay`

修复方式：

- 路由层增加 `authMiddleware`
- 服务层增加 `order.userId === req.userId` 归属校验

相关文件：

- [`payment.routes.ts`](/Users/zhugehao/muying-ai-app-main-latest/src/routes/payment.routes.ts)
- [`payment.controller.ts`](/Users/zhugehao/muying-ai-app-main-latest/src/controllers/payment.controller.ts)
- [`subscription.service.ts`](/Users/zhugehao/muying-ai-app-main-latest/src/services/subscription.service.ts)

### 3.2 High：订单查询缺少归属隔离

问题：

- 登录用户可通过任意 `orderNo` 查询订单详情

影响：

- 会导致订单状态、金额、套餐信息泄露

已修复：

- `GET /api/v1/payment/order/:orderNo`

修复方式：

- 服务层增加订单归属校验

相关文件：

- [`payment.controller.ts`](/Users/zhugehao/muying-ai-app-main-latest/src/controllers/payment.controller.ts)
- [`subscription.service.ts`](/Users/zhugehao/muying-ai-app-main-latest/src/services/subscription.service.ts)

### 3.3 High：AI 请求在参数校验前扣额度

问题：

- HTTP AI 路由原本先执行额度扣减，再执行 body 校验

影响：

- 非法请求也会消耗免费额度
- 容易被误触发或被滥用

已修复：

- `POST /api/v1/ai/ask`
- `POST /api/v1/ai/ask/stream`
- `POST /api/v1/ai/chat`
- `POST /api/v1/ai/chat/stream`

修复方式：

- 路由顺序调整为：`validate -> quotaCheckMiddleware -> controller`

相关文件：

- [`ai.routes.ts`](/Users/zhugehao/muying-ai-app-main-latest/src/routes/ai.routes.ts)

### 3.4 Medium：公共 analytics 接口允许伪造 server 来源

问题：

- 公共 `POST /api/v1/analytics/events` 之前允许 `source: server`

影响：

- 客户端可伪造服务端事件
- 会污染漏斗统计

已修复：

- 公共 schema 仅允许 `app` / `mini_program`
- `server` 事件只能从服务端内部服务写入

相关文件：

- [`analytics.schema.ts`](/Users/zhugehao/muying-ai-app-main-latest/src/schemas/analytics.schema.ts)
- [`analytics.service.ts`](/Users/zhugehao/muying-ai-app-main-latest/src/services/analytics.service.ts)

### 3.5 Medium：WebSocket 越界/紧急响应会误扣额度

问题：

- WebSocket 流式链路中，越界问题和紧急问题会在返回固定响应前先扣额度

影响：

- 用户体验与额度语义不一致

已修复：

- 先做越界 / 紧急判断
- 只有进入正常 AI 对话链路时才扣额度

相关文件：

- [`websocket.service.ts`](/Users/zhugehao/muying-ai-app-main-latest/src/services/websocket.service.ts)

## 4. 新增回归保护

本轮新增了两组后端回归测试：

- [`mvp-route-guards.test.ts`](/Users/zhugehao/muying-ai-app-main-latest/tests/mvp-route-guards.test.ts)
- [`mvp-security-regressions.test.ts`](/Users/zhugehao/muying-ai-app-main-latest/tests/mvp-security-regressions.test.ts)
- [`analytics-service.test.ts`](/Users/zhugehao/muying-ai-app-main-latest/tests/analytics-service.test.ts)
- [`subscription-quota.test.ts`](/Users/zhugehao/muying-ai-app-main-latest/tests/subscription-quota.test.ts)

覆盖点：

- 支付回调必须鉴权
- 订单查询必须做归属隔离
- AI 路由必须先校验再扣额度
- analytics 公共写入不允许伪造 `server`
- analytics 漏斗统计与转化率计算
- 免费 / 会员额度消费边界

## 5. 测试口径

当前测试口径分为两层：

### 5.1 默认离线回归

命令：

```bash
npm test
```

当前行为：

- 默认跑可离线执行的回归测试
- 不依赖本地 MySQL

### 5.2 显式集成测试

命令：

```bash
npm run test:integration
```

说明：

- 原有 `auth.test.ts` 与 `user-community.test.ts` 依赖真实数据库
- 现在改为显式开关，不再默认阻塞本地测试

相关文件：

- [`package.json`](/Users/zhugehao/muying-ai-app-main-latest/package.json)
- [`auth.test.ts`](/Users/zhugehao/muying-ai-app-main-latest/tests/auth.test.ts)
- [`user-community.test.ts`](/Users/zhugehao/muying-ai-app-main-latest/tests/user-community.test.ts)

## 6. 当前剩余风险

当前仍有 4 个需要明确记住的边界：

- 支付回调签名框架已落地，但生产若未配置回调密钥，仍会走 auth fallback，不等于真实支付网关验签闭环
- App / 小程序新埋点代码尚未完成正式客户端发版，持续出数还未真正开始
- analytics 漏斗当前按事件计数，不是按用户去重
- 默认自动化测试仍以离线回归为主，未覆盖完整数据库集成场景

## 7. 建议后续动作

建议优先顺序：

1. 发布带埋点的 App / 小程序客户端
2. 在生产观察 7 天最小漏斗数据
3. 补真实支付回调签名校验与实单验收
4. 逐步补会员 / 支付 / analytics 的服务层单元测试
5. 在有独立测试库后恢复完整集成测试常态化执行

## 8. 本轮验证记录

已执行并通过：

- `npm run build`
- `npx tsc --noEmit`（`mobile`）
- `npm run type-check`（`mini-program`）
- `npm test -- --runInBand`
- `npm run test:unit`
