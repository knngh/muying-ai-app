# P7 运营观察与投放验证

更新时间：2026-05-15

## 1. 阶段目标

P7 承接 P6 工程闭环后的真实运营观察项，目标是把“有没有真实流量、有没有激活、有没有支付、AI 是否适合放量”变成稳定日报，而不是继续扩展 MVP 功能范围。

P7 当前工程范围：

- 按渠道、活动、场景、入口拆分获客归因
- 监控获客归因字段覆盖率，避免真实流量丢失 `channel`、`campaign`、`scene` 或 `entrySource`
- 将 P6 当前日报和 P6 JSONL 历史汇总为 P7 增长观察报告
- 明确区分工程关闭和真实运营关闭

## 2. 新增接口

`GET /api/v1/analytics/acquisition-overview?rangeDays=7`

访问控制：

- 管理员鉴权
- 只读查询
- 复用现有 `rangeDays`，范围 `1-30`

核心口径：

- 获客事件：`mini_program_app_download_click`
- 激活事件：`server_lifecycle_profile_ready`、`app_chat_message_send`、`app_knowledge_detail_open`
- 付费事件：`app_order_created`、`app_payment_success`
- 留存行为：成长档案分享、知识分享、文章收藏、社区发帖、社区评论
- 身份优先级：`userId -> clientId -> sessionId`
- 隔离流量：`ops_product_entrypoint_smoke`

归因维度：

- `channel`
- `campaign`
- `scene`
- `entrySource`

归因质量：

- 只统计真实 `mini_program_app_download_click` 获客事件，不把激活、支付、留存事件混入口径
- 每个维度输出事件覆盖率和去重用户覆盖率
- 默认 `P7_ATTRIBUTION_COVERAGE_THRESHOLD=0.9`
- 任一维度事件覆盖率低于阈值时，P7 报告进入 `observe`，并提示检查小程序获客链接和分享参数

## 3. 新增生产报告

命令：

```bash
npm run ops:growth:p7
```

默认产物：

- `tmp/p7-growth-status-report.json`
- `tmp/p7-growth-summary.md`
- `tmp/p7-growth-history.jsonl`

可覆盖环境变量：

- `P7_OUTPUT_FILE`
- `P7_MARKDOWN_OUTPUT_FILE`
- `P7_HISTORY_FILE`
- `P6_HISTORY_FILE`
- `P7_RANGE_DAYS`
- `P7_ATTRIBUTION_COVERAGE_THRESHOLD`

报告会读取：

- 当前 P6 报告口径
- P6 JSONL 历史趋势
- P7 acquisition overview

## 4. 关闭口径

工程关闭：

- `canUseAsP7DailyReport=true`
- `canCloseP7Engineering=true`
- P6 工程闭环完成
- acquisition overview 可用
- P7 JSON / Markdown / JSONL 产物可生成

运营关闭：

- `canCloseP7=true`
- 真实 acquisition 样本非 0
- acquisition 到 activation 有样本
- acquisition 到 payment success 有样本
- 获客事件 `channel`、`campaign`、`scene`、`entrySource` 归因覆盖率达到阈值
- AI degraded rate 回到阈值内，或已明确接受 fallback 口径
- 无 blocker

当前不把运营样本不足伪装为阶段成功；样本不足时状态为 `observe`。

## 5. 下一步运营动作

- 为小红书、微信私域、抖音等入口统一传入 `channel`、`campaign`、`scene`
- 每天运行 `npm run ops:growth:p7`
- 观察 top acquisition segments 是否出现激活和支付
- 支付成功出现后再判断 monetization conversion
- AI provider 健康恢复或 fallback 策略明确前，不扩大投放；可用 `AI_HEALTH_TASK_ROLES=glm_classify,kimi_reason AI_HEALTH_STRICT=false npm run ops:ai:health` 同时验证主翻译通道和 OpenRouter 免费备选通道。

## 6. 验证

本地新增测试：

```bash
npm test -- --runInBand tests/analytics-service.test.ts tests/p7-growth-status.test.ts
```
