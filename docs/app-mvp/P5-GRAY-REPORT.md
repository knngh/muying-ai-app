# P5 灰度上线记录

更新时间：2026-05-14

## 1. 阶段目标

P5 对应 MVP 路线中的“灰度上线与真实数据观察”阶段。

本阶段不再继续扩大 P4 功能范围，目标是：

- 用固定门禁验证生产版本可进入灰度
- 持续观察真实用户流量、AI 入口覆盖、会员与支付漏斗
- 遇到阻塞问题时回滚或热修
- 只有真实流量数据达到基本闭环后，才关闭 P5

## 2. 灰度门禁

新增命令：

```bash
SSH_IDENTITY_FILE=/Users/zhugehao/.ssh/id_server npm run ops:gray:p5
```

该命令会编排：

- `npm run ops:smoke:prod`
- `npm run ops:smoke:ai:entrypoints`
- `npm run ops:smoke:ai:ws`
- `npm run ops:knowledge:status`
- 生产 health / legacy health
- 管理员 AI overview / funnel
- 免费与会员演示账号状态

输出文件：

```bash
tmp/p5-gray-status-report.json
```

该文件为本地运行产物，不提交到仓库；阶段结论记录在本文档中。

## 3. 本次灰度门禁结果

执行时间：2026-05-14

结论：

- `status = attention`
- `canEnterGray = true`
- `canCloseP5 = false`
- `blockers = []`

含义：

- 当前生产版本可以进入 P5 灰度观察。
- 当前还不能关闭 P5，因为真实用户 AI 入口流量仍为 `0`，且 AI provider 当前全量走 fallback degraded。

## 4. 已通过项

生产命令结果：

- `main_smoke`：通过
- `ai_entrypoint_smoke`：通过
- `ai_websocket_smoke`：通过
- `knowledge_status`：通过

生产运行态：

- 主 health：`ok`
- legacy health：`ok`
- database：`ok`
- `muying-api`：online
- `muying-authority-worker`：online

演示账号：

- 免费账号：`status=free`，`aiLimit=3`，`remainingToday=3`
- 会员账号：`status=active`，`plan=quarterly`，`aiLimit=9999`，`remainingToday=9999`

AI 服务：

- `requestsStarted = 20`
- `responsesCompleted = 20`
- `requestErrors = 0`
- `completionRate = 1`
- `errorRate = 0`
- AI WebSocket smoke 通过
- AI 产品入口 ops smoke 覆盖完整

AI 入口覆盖：

- ops 入口已覆盖：
  - `home_suggested_question`
  - `weekly_report`
  - `knowledge_detail`
  - `knowledge_recent_ai`
  - `native`
- `opsEntrypointEvents = 72`
- 真实产品入口事件仍为 `0`

漏斗：

- `app_order_created = 63`
- `app_weekly_report_open = 63`
- `app_payment_success = 0`
- `mini_program_app_download_click = 0`
- `app_membership_exposure = 0`
- `app_growth_archive_share = 0`

## 5. Attention 项

当前 P5 attention 项：

1. 真实用户 AI 入口流量仍为 `0`
   - `realEntrySourceEventCount = 0`
   - `productEntrypointEvents = 0`
   - 说明当前只有 ops smoke 数据，还没有真实用户验证入口链路。

2. AI degraded rate 当前为 `1.0000`
   - 当前生产 AI 请求均通过 fallback 路由返回 rule-based/system 结果。
   - 这不影响 smoke 可用性，但灰度期间需要观察真实 provider 可用性、延迟和 fallback 原因。

## 6. P5 灰度策略

当前可以进入灰度，但应限定为小范围观察：

- 先使用内部/可信测试用户产生真实 App AI 入口流量
- 每日跑一次 `npm run ops:gray:p5`
- 每日检查 `ops:knowledge:status`
- 暂不扩大用户范围，直到真实入口事件大于 `0` 且没有 blocker

灰度推进阈值：

- 可继续灰度：
  - 主 smoke 通过
  - AI WS smoke 通过
  - AI entrypoint smoke 通过
  - `requestErrors = 0` 或 error rate 不超过 `20%`
  - `completionRate >= 0.9`
  - 无新增生产 5xx 主链路错误

- 保持观察：
  - 真实 AI 入口流量为 `0`
  - degraded rate 高但请求可完成
  - 支付成功仍为 `0` 且尚未做真实支付回调验证

- 回滚或热修：
  - 任一 smoke 命令失败
  - health/database 非 `ok`
  - AI completion rate 低于 `0.9`
  - AI error rate 高于 `0.2`
  - 免费用户 fallback 出现重复扣减
  - 入口 smoke 污染真实 `productEntrypointCoverage`

## 7. 当前残余风险

- 真实用户 AI 入口数据尚未产生，无法关闭 P5。
- AI provider 可用性仍不稳定，当前 degraded rate 为 `1`。
- 支付回调仍未做真实生产式验证。
- 小程序聊天 UI 当前仍关闭，完整小程序聊天埋点要等开关打开后验证。
- GitHub push 仍受认证限制，生产发布依赖同步脚本，服务器 git log 不能代表部署版本。

## 8. 下一步

P5 下一步不再是继续写新功能，而是进入真实灰度观察：

1. 安排内部用户从 App 真实点击首页建议提问、周报问 AI、知识详情问 AI、最近 AI 线索和原生聊天入口。
2. 跑 `npm run ops:gray:p5`，确认 `realEntrySourceEventCount > 0`。
3. 对齐客户端 `clientRequestId` 与服务端 `ai_request_started` 事件。
4. 观察 degraded rate 和 provider fallback 原因。
5. 真实支付回调验证另开受控任务，不混入本轮 AI 灰度门禁。

## 9. 阶段结论

P5 已启动。

当前状态是“可进入灰度，但不可关闭 P5”。关闭 P5 的前置条件是出现真实用户入口流量，并且连续观察期内没有 blocker。
