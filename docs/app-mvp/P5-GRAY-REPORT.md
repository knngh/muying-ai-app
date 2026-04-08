# P5 灰度上线记录

更新时间：2026-04-06

## 1. 本阶段目标

P5 对应 MVP 路线中的“灰度上线”阶段，目标是：

- 对当前生产版本执行正式 smoke
- 观察运行态与错误日志
- 判断是否具备继续观察或进入后续数据闭环阶段的条件

## 2. 本次灰度范围

本次灰度基于当前生产目录：

- 路径：`/www/wwwroot/muying-ai-app`
- 进程：`muying-api`
- 运行方式：`PM2 + dist/app.js`

本阶段延续前序已部署修复：

- 社区评论 / 回复作者 `isVerifiedMember` 返回补齐

## 3. 生产 smoke 结果

### 3.1 健康检查

已验证：

- `GET /health`

结果：

- `status = ok`
- `database = ok`

### 3.2 登录与会员链路

使用账号：

- `demo_free_user / Test123456!`
- `demo_vip_user / Test123456!`

已验证：

- `POST /api/v1/auth/login`
- `GET /api/v1/subscription/status`
- `GET /api/v1/quota/today`
- `GET /api/v1/report/weekly/latest`

结果：

- 免费账号登录成功
- 免费账号会员状态为 `free`
- 免费账号 AI 额度为 `3/天`
- 免费账号访问周报被正确拦截
- 会员账号登录成功
- 会员账号状态为 `active`
- 会员账号当前套餐为 `quarterly`
- 会员账号 AI 额度为 `9999/天`
- 会员账号可正常读取最新周报

### 3.3 支付建单链路

已验证：

- `POST /api/v1/payment/create-order`

结果：

- 成功创建一笔 `monthly` + `wechat` 订单
- 返回状态为 `pending`

说明：

- 本阶段仍未执行支付回调
- 目的是避免直接污染生产演示账号支付状态

### 3.4 社区链路

已验证：

- `GET /api/v1/community/posts?page=1&pageSize=3&sort=latest`
- `GET /api/v1/community/posts/98/comments?page=1&pageSize=2`

结果：

- 社区帖子列表正常返回
- 帖子作者对象正常返回 `isVerifiedMember`
- 评论作者对象正常返回 `isVerifiedMember`
- 回复作者对象正常返回 `isVerifiedMember`

## 4. 运行态观察

### 4.1 PM2 状态

已确认：

- `muying-api` 状态为 `online`
- `unstable restarts = 0`
- `uptime` 正常连续增长

### 4.2 请求日志

本次 smoke 对应请求均已在 `pm2` out log 中看到正常访问记录：

- 登录
- 健康检查
- 会员状态
- 配额
- 周报
- 支付建单
- 社区列表
- 评论列表

本次未见 5xx。

### 4.3 错误日志

最近错误日志主要是：

- `GET /`
- `GET /favicon.ico`
- `PROPFIND /`

这些均来自外部扫描或无效请求，表现为应用层 404，不属于当前 MVP 主链路故障。

## 5. 阶段结论

P5 当前可判定为通过。

更准确地说：

- 生产核心主链路可用
- 新修复的社区评论作者标识已稳定生效
- 运行态未发现新的阻塞性错误
- 当前版本可继续保持灰度观察

## 6. 当前残余风险

当前没有阻塞上线的问题，但仍保留以下已知约束：

- 支付回调链路尚未在生产执行式验证
- 生产部署仍依赖手工步骤，没有仓库内统一发布脚本
- 错误日志会持续混入扫描流量带来的 404 噪音

## 7. 下一步

建议进入 P6 数据闭环。

优先顺序：

1. 增加关键转化埋点
2. 建最小漏斗看板
3. 继续观察会员、支付、AI、社区链路
