# P6 数据闭环

更新时间：2026-05-15

## 1. 本阶段目标

P6 对应 MVP 路线中的“数据闭环”阶段，目标是：

- 为 MVP 关键转化路径补最小埋点
- 固化最小漏斗口径
- 让后续灰度观察有可落地的数据入口

## 2. 本次埋点范围

本次只覆盖 MVP 核心事件，不扩展成通用埋点平台。

已纳入的关键事件：

- `mini_program_app_download_click`
- `app_membership_exposure`
- `app_order_created`
- `app_payment_success`
- `app_weekly_report_open`
- `app_growth_archive_share`
- `app_knowledge_detail_share`
- `server_article_favorite`
- `server_community_post_create`
- `server_community_comment_create`

## 3. 实现方式

### 3.1 后端

新增：

- 表：`analytics_events`
- 接口：`POST /api/v1/analytics/events`
- 漏斗查询：`GET /api/v1/analytics/funnel?rangeDays=7`
- 激活查询：`GET /api/v1/analytics/activation-overview?rangeDays=7`
- 留存查询：`GET /api/v1/analytics/retention-overview?rangeDays=7`
- 获客归因查询：`GET /api/v1/analytics/acquisition-overview?rangeDays=7`
- 生产报告：`npm run ops:data:p6`

已完成生产部署：

- 已执行 `npm run db:push`
- 已创建 `analytics_events`
- 已重新构建并重启 `muying-api`

说明：

- `POST /analytics/events` 支持匿名或已登录用户
- `GET /analytics/funnel` 当前走管理口径，仅管理员可访问
- `GET /analytics/activation-overview` 当前走管理口径，仅管理员可访问
- `GET /analytics/retention-overview` 当前走管理口径，仅管理员可访问
- `GET /analytics/acquisition-overview` 当前走管理口径，仅管理员可访问

### 3.2 App

已接入：

- 会员页曝光
- 周报页打开
- 成长档案分享
- 知识详情打开

服务端自动记录：

- 下单创建
- 支付成功
- 生命周期资料就绪
- 文章收藏成功
- 社区发帖成功
- 社区评论成功

### 3.3 小程序

已接入：

- 所有 `openAppDownloadGuide(scene)` 触发的下载引导点击

这意味着以下关键引流触点都会进入同一事件口径：

- 社区页下载卡片
- 帖子详情下载卡片
- 知识详情下载卡片
- AI 问答额度触顶引导
- 我的页面下载卡片
- 知识详情页打开
- 知识详情页分享

## 4. 最小漏斗口径

当前标准漏斗顺序：

1. 小程序下载点击
2. 会员页曝光
3. 下单创建
4. 支付成功
5. 周报打开
6. 成长档案分享

说明：

- 这是 MVP 的最小经营漏斗，不代表完整用户旅程
- `steps` 保留事件次数口径，用于观察行为总量
- `uniqueSteps` 使用 `userId -> clientId -> sessionId` 优先级去重，用于观察接近用户数的转化
- `uniqueSummary.identityCoverageRate` 用于观察埋点身份覆盖，低于 0.8 时 P6 报告会进入 attention
- 后续可再补知识阅读、社区互动等中间行为

## 4.1 首日激活口径

P6+ 新增首日激活观测口径，对齐推广计划中的激活定义：

1. 完成生命周期资料设置
2. 完成至少 1 次 AI 提问或知识详情查看

事件口径：

- 生命周期资料就绪：`server_lifecycle_profile_ready`
- AI 提问：`app_chat_message_send`
- 知识详情查看：`app_knowledge_detail_open`

说明：

- `server_lifecycle_profile_ready` 只能由服务端内部写入，公共 analytics 接口不可伪造。
- 激活统计同样使用 `userId -> clientId -> sessionId` 身份优先级。
- P6 报告会输出 `activation.profileReadyUniqueCount`、`activation.activatedUniqueCount`、`activation.profileToActivationRate`。

## 4.2 D1 / D7 留存口径

P6+ 新增 cohort 留存观测口径：

1. 使用报告窗口内用户首次活跃日期作为 cohort 日
2. 用户在 cohort 日后第 1 天再次活跃，计入 D1 留存
3. 用户在 cohort 日后第 7 天再次活跃，计入 D7 留存

说明：

- 活跃事件复用 `analytics_events` 中已登记的客户端与服务端产品事件。
- 留存统计使用 `userId -> clientId -> sessionId` 身份优先级。
- 日期边界使用 UTC，避免服务端部署时区变化影响日报。
- ops 产品入口演练流量会从留存 cohort 中隔离。
- P6 报告会输出 `retention.d1RetentionRate`、`retention.d7RetentionRate`、`retention.identityCoverageRate`。
- P6 报告会输出 `retention.retentionBehaviorEventCount` 与 `retention.behaviorByEvent`，用于观察收藏、分享、社区互动等留存动作。

## 5. 观测方式

### 5.1 事件收集接口

`POST /api/v1/analytics/events`

请求示例：

```json
{
  "eventName": "app_membership_exposure",
  "source": "app",
  "page": "MembershipScreen",
  "clientId": "abc123",
  "sessionId": "session123",
  "properties": {
    "status": "free",
    "currentPlanCode": null
  }
}
```

### 5.2 漏斗接口

`GET /api/v1/analytics/funnel?rangeDays=7`

返回示例结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rangeDays": 7,
    "startAt": "2026-04-01T00:00:00.000Z",
    "endAt": "2026-04-06T00:00:00.000Z",
    "steps": [
      {
        "eventName": "mini_program_app_download_click",
        "label": "小程序下载点击",
        "count": 10,
        "conversionRate": 100
      }
    ],
    "uniqueIdentityPriority": ["userId", "clientId", "sessionId"],
    "uniqueSummary": {
      "firstStepUniqueCount": 8,
      "totalIdentifiedEvents": 25,
      "totalUnidentifiedEvents": 1,
      "identityCoverageRate": 0.9615
    },
    "uniqueSteps": [
      {
        "eventName": "mini_program_app_download_click",
        "label": "小程序下载点击",
        "uniqueCount": 8,
        "unidentifiedCount": 1,
        "conversionRate": 100
      }
    ]
  }
}
```

### 5.3 P6 生产报告

`npm run ops:data:p6`

默认输出：

- 终端 JSON
- `tmp/p6-data-closure-report.json`
- `tmp/p6-data-closure-summary.md`
- `tmp/p6-data-closure-history.jsonl`

可通过环境变量覆盖：

- `P6_OUTPUT_FILE`
- `P6_MARKDOWN_OUTPUT_FILE`
- `P6_HISTORY_FILE`

报告会汇总：

- `/health` 与 `/api/health`
- `/api/v1/analytics/funnel?rangeDays=7`
- `/api/v1/analytics/ai-overview?rangeDays=7`
- `/api/v1/analytics/activation-overview?rangeDays=7`
- `/api/v1/analytics/retention-overview?rangeDays=7`
- `/api/v1/ai/health`

状态含义：

- `pass`：漏斗、身份覆盖、支付与 AI 数据均满足关闭 P6 的最小条件
- `attention`：接口可用，但真实数据、支付、身份覆盖或 AI 健康仍需观察
- `blocker`：健康检查或漏斗结构异常，不能作为日报入口

说明：

- JSON 文件保留完整结构，适合脚本读取。
- Markdown 文件保留巡检摘要，适合人工日报或周报复制。
- JSONL 历史文件每次运行追加一行核心指标，适合后续做趋势看板。
- `canCloseP6Engineering` 表示工程闭环是否完成；`canCloseP6` 表示真实运营指标是否也达到关闭条件。

### 5.4 激活接口

`GET /api/v1/analytics/activation-overview?rangeDays=7`

返回核心结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rangeDays": 7,
    "activationDefinition": {
      "profileReadyEvent": "server_lifecycle_profile_ready",
      "valueActionEvents": ["app_chat_message_send", "app_knowledge_detail_open"],
      "identityPriority": ["userId", "clientId", "sessionId"]
    },
    "counts": {
      "profileReadyUniqueCount": 10,
      "aiQuestionUniqueCount": 6,
      "knowledgeOpenUniqueCount": 4,
      "valueActionUniqueCount": 8,
      "activatedUniqueCount": 5,
      "profileToActivationRate": 0.5,
      "identityCoverageRate": 1
    }
  }
}
```

### 5.5 留存接口

`GET /api/v1/analytics/retention-overview?rangeDays=7`

返回核心结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rangeDays": 7,
    "retentionDefinition": {
      "identityPriority": ["userId", "clientId", "sessionId"],
      "dayBoundary": "UTC",
      "returnWindows": [1, 7],
      "ignoredTrafficKinds": ["ops_product_entrypoint_smoke"]
    },
    "summary": {
      "cohortUserCount": 12,
      "d1EligibleCohortUserCount": 10,
      "d1RetainedUserCount": 4,
      "d1RetentionRate": 0.4,
      "d7EligibleCohortUserCount": 8,
      "d7RetainedUserCount": 2,
      "d7RetentionRate": 0.25,
      "identityCoverageRate": 0.9524,
      "ignoredOpsEventCount": 1,
      "retentionBehaviorEventCount": 6
    },
    "breakdown": {
      "retentionBehaviorByEvent": [
        { "key": "server_article_favorite", "count": 2 },
        { "key": "app_knowledge_detail_share", "count": 2 },
        { "key": "server_community_post_create", "count": 1 },
        { "key": "server_community_comment_create", "count": 1 }
      ]
    },
    "cohorts": [
      {
        "date": "2026-05-08",
        "cohortUserCount": 8,
        "d1Eligible": true,
        "d1RetainedUserCount": 4,
        "d1RetentionRate": 0.5,
        "d7Eligible": true,
        "d7RetainedUserCount": 2,
        "d7RetentionRate": 0.25
      }
    ]
  }
}
```

## 6. 当前限制

当前埋点体系仍然是 MVP 口径，保留这些约束：

- 只记录关键事件，不记录完整页面访问流
- 去重漏斗不是严格跨端归因，只能按当前事件携带的 `userId / clientId / sessionId` 合并
- 激活口径衡量的是当前报告窗口内同时出现资料就绪与价值动作的用户
- 留存 cohort 基于报告窗口内首次活跃日，不等同于真实注册日 cohort
- 服务端留存行为事件从后端成功动作写入；客户端知识分享事件仍依赖 App / 小程序发版
- 管理查询依赖管理员账号访问
- App / 小程序侧埋点代码已完成，但真正开始持续出数仍依赖下一次客户端发布

## 7. 本次验证

已完成：

- 本地 `npx prisma generate`
- 本地后端 `npm run build`
- 本地 `npm test -- --runInBand tests/analytics-service.test.ts tests/analytics-schema.test.ts tests/p6-data-closure-status.test.ts`
- 本地 `mobile` `npx tsc --noEmit`
- 本地 `mini-program` `npm run type-check`
- 生产 `POST /api/v1/analytics/events` smoke
- 生产 `GET /api/v1/analytics/funnel?rangeDays=7` smoke
- 生产 `POST /api/v1/payment/create-order` smoke
- 生产库事件聚合查询验证

生产验证结果：

- `app_weekly_report_open` 已写入
- `app_order_created` 已写入
- 漏斗接口可返回完整 steps 结构
- 激活接口可返回完整 activation overview 结构

## 8. 收口结论

P6 工程侧已完成：

- 最小漏斗埋点与去重漏斗
- AI 入口与服务端 AI 质量观测
- 首日激活观测
- D1 / D7 留存观测
- 留存行为分布
- 生产日报 JSON / Markdown / JSONL 输出
- 生产 smoke 与日报脚本验证

截至 2026-05-15，P6 仍有真实运营 attention 项：

- 小程序引流样本为 0
- 支付成功样本为 0
- AI degraded rate 高于关闭阈值

这些不再阻塞 P6 工程阶段关闭，进入 P7 运营观察与投放验证。

## 9. 下一步建议

后续若继续增强，建议顺序：

1. 把 `ops:data:p6` 固化到每日巡检流程
2. 增加日报 / 周报看板导出或管理后台页面
3. 按真实投放渠道继续补 acquisition campaign / source 维度

## 10. P7 承接

P7 已把 P6 的真实运营 attention 项升级为“运营观察与投放验证”工程入口：

- 新增 `GET /api/v1/analytics/acquisition-overview?rangeDays=7`
- 新增 `npm run ops:growth:p7`
- 默认输出：
  - `tmp/p7-growth-status-report.json`
  - `tmp/p7-growth-summary.md`
  - `tmp/p7-growth-history.jsonl`

P7 不改变 P6 关闭口径：`canCloseP6Engineering=true` 仍代表工程闭环完成，真实 acquisition / payment / AI degraded 等运营项继续由 P7 观察。
