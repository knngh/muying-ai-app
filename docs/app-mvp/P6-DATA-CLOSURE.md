# P6 数据闭环

更新时间：2026-04-06

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
- 后续可再补 AI 提问、知识阅读、社区互动等中间行为

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
    ]
  }
}
```

## 6. 当前限制

当前埋点体系仍然是 MVP 口径，保留这些约束：

- 只记录关键事件，不记录完整页面访问流
- 漏斗统计当前基于事件次数，不是严格用户去重漏斗
- 管理查询依赖管理员账号访问
- App / 小程序侧埋点代码已完成，但真正开始持续出数仍依赖下一次客户端发布

## 7. 本次验证

已完成：

- 本地 `npx prisma generate`
- 本地后端 `npm run build`
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

P6 当前已具备最小闭环能力。

后续若继续增强，建议顺序：

1. 把漏斗统计升级为按 `userId / clientId` 去重
2. 补 AI 提问、知识详情打开、社区发帖评论等中间行为
3. 增加日报 / 周报看板导出
