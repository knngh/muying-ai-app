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

## 3. 实现方式

### 3.1 后端

新增：

- 表：`analytics_events`
- 接口：`POST /api/v1/analytics/events`
- 漏斗查询：`GET /api/v1/analytics/funnel?rangeDays=7`
- 生产报告：`npm run ops:data:p6`

已完成生产部署：

- 已执行 `npm run db:push`
- 已创建 `analytics_events`
- 已重新构建并重启 `muying-api`

说明：

- `POST /analytics/events` 支持匿名或已登录用户
- `GET /analytics/funnel` 当前走管理口径，仅管理员可访问

### 3.2 App

已接入：

- 会员页曝光
- 周报页打开
- 成长档案分享

服务端自动记录：

- 下单创建
- 支付成功

### 3.3 小程序

已接入：

- 所有 `openAppDownloadGuide(scene)` 触发的下载引导点击

这意味着以下关键引流触点都会进入同一事件口径：

- 社区页下载卡片
- 帖子详情下载卡片
- 知识详情下载卡片
- AI 问答额度触顶引导
- 我的页面下载卡片

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

报告会汇总：

- `/health` 与 `/api/health`
- `/api/v1/analytics/funnel?rangeDays=7`
- `/api/v1/analytics/ai-overview?rangeDays=7`
- `/api/v1/ai/health`

状态含义：

- `pass`：漏斗、身份覆盖、支付与 AI 数据均满足关闭 P6 的最小条件
- `attention`：接口可用，但真实数据、支付、身份覆盖或 AI 健康仍需观察
- `blocker`：健康检查或漏斗结构异常，不能作为日报入口

## 6. 当前限制

当前埋点体系仍然是 MVP 口径，保留这些约束：

- 只记录关键事件，不记录完整页面访问流
- 去重漏斗不是严格跨端归因，只能按当前事件携带的 `userId / clientId / sessionId` 合并
- 管理查询依赖管理员账号访问
- App / 小程序侧埋点代码已完成，但真正开始持续出数仍依赖下一次客户端发布

## 7. 本次验证

已完成：

- 本地 `npx prisma generate`
- 本地后端 `npm run build`
- 本地 `npm test -- --runInBand tests/analytics-service.test.ts`
- 本地 `npm test -- --runInBand tests/p6-data-closure-status.test.ts`
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

## 8. 下一步建议

P6 当前已具备最小闭环能力，并新增生产日报入口。

后续若继续增强，建议顺序：

1. 把 `ops:data:p6` 固化到每日巡检流程
2. 补知识详情打开、社区发帖评论等中间行为
3. 增加日报 / 周报看板导出或管理后台页面
