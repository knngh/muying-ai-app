# P4 上线准备复核

更新时间：2026-04-06

## 1. 本阶段目标

P4 对应 MVP 路线中的“上线准备”阶段，目标是：

- 复核生产环境变量
- 复核数据库 schema / seed
- 复核服务器部署入口
- 固化演示账号、演示路径和发布口径

## 2. 复核结论

P4 已完成，可进入 P5 灰度上线。

当前结论：

- 生产环境关键配置已具备
- MVP 会员相关核心表已存在于生产数据库
- 演示账号与演示周报口径已对齐
- 服务端真实部署方式已确认
- 已修复一个真实运维漂移：生产 `db:seed` 脚本路径错误

## 3. 生产环境复核

### 3.1 环境变量

已在生产机 `/www/wwwroot/muying-ai-app/.env` 复核并确认存在：

- `NODE_ENV`
- `PORT`
- `HOST`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `WECHAT_APPID`
- `WECHAT_APPSECRET`
- `AI_GATEWAY_*`
- `AI_ROUTING_ENABLED`
- `AI_GENERAL_*`
- `AI_MEDICAL_PRIMARY_*`

说明：

- 当前代码启动强依赖仅为 `JWT_SECRET` 和 `DATABASE_URL`
- 生产 `.env` 已覆盖 MVP 运行所需关键项

### 3.2 PM2 与运行态

生产服务实际运行方式已确认：

- 目录：`/www/wwwroot/muying-ai-app`
- 进程：`muying-api`
- 启动目标：`dist/app.js`
- Node：`18.20.8`
- 进程管理：`pm2`

运行态复核结果：

- `pm2 show muying-api` 状态为 `online`
- `GET /health` 正常
- 最近日志中未发现启动失败
- 错误日志中的主要噪音为外部扫描访问 `/` 与 `/favicon.ico` 产生的 404

## 4. 数据库与 seed 复核

### 4.1 生产数据库结构

通过 `prisma db pull --print` 已确认生产数据库存在 MVP 核心表：

- `subscriptions`
- `payment_orders`
- `user_daily_quotas`
- `ai_weekly_reports`

这说明会员、支付、配额、周报的核心数据结构已在生产库中落地。

### 4.2 演示账号与演示数据

当前标准演示账号：

- 免费账号：`demo_free_user / Test123456!`
- 会员账号：`demo_vip_user / Test123456!`

与 seed 口径一致：

- `demo_free_user` 重置后为免费态，AI 额度 `3/天`
- `demo_vip_user` 重置后为季度会员，AI 额度 `9999/天`
- `demo_vip_user` 会生成一份演示周报

### 4.3 已修复的 seed 漂移

本次复核发现：

- 生产 `package.json` 中 `db:seed` 一度指向错误路径

已处理：

- 已将生产目录中的 `package.json` 对齐到当前仓库版本
- 当前生产脚本为：
  - `db:seed -> tsx prisma/seed.ts`
  - `seed:community -> tsx src/scripts/seed-community.ts`

## 5. 真实部署口径

### 5.1 当前权威部署方式

当前生产并不是依赖仓库内自动化部署脚本完成上线。

实际可用口径是：

1. 同步代码到 `/www/wwwroot/muying-ai-app`
2. 如依赖变更则执行 `npm install`
3. 如 schema 变更则执行 `npm run db:push`
4. 执行 `npm run build`
5. 执行 `pm2 restart muying-api`
6. 执行 smoke test

### 5.2 当前仓库状态说明

已确认：

- 有 `Dockerfile`
- 没有可直接复用的仓库级部署脚本
- 没有 `docker-compose.yml`
- 当前生产主路径仍是 `PM2 + 本地目录构建`

因此：

- `docs/phase4-report.md` 中关于 `docker-compose` 的表述不应作为当前生产口径
- P5 应继续沿用 PM2 灰度方式，而不是切换到未验证的容器流程

## 6. 标准操作命令

### 6.1 重置演示数据

在生产目录执行：

```bash
cd /www/wwwroot/muying-ai-app
npm run db:seed
npm run seed:community
```

用途：

- 重置 `demo_free_user`
- 重置 `demo_vip_user`
- 重置社区演示内容

### 6.2 服务端发布

优先使用：

```bash
npm run ops:deploy:prod
```

如依赖变更：

```bash
npm run ops:deploy:prod -- --with-install
```

如数据库 schema 变化：

```bash
npm run ops:deploy:prod -- --with-db-push
```

底层等价命令：

```bash
cd /www/wwwroot/muying-ai-app
npm run build
pm2 restart muying-api
```

如依赖变化：

```bash
cd /www/wwwroot/muying-ai-app
npm install
npm run build
pm2 restart muying-api
```

如数据库 schema 变化：

```bash
cd /www/wwwroot/muying-ai-app
npm run db:push
npm run build
pm2 restart muying-api
```

### 6.3 发布后 smoke

优先使用：

```bash
npm run ops:smoke:prod
```

最小 smoke 清单：

- `GET /health`
- `POST /api/v1/auth/login`
- `GET /api/v1/subscription/status`
- `GET /api/v1/quota/today`
- `GET /api/v1/report/weekly/latest`
- `POST /api/v1/payment/create-order`
- `GET /api/v1/community/posts`
- `GET /api/v1/community/posts/:postId/comments`

## 7. 演示路径

推荐演示顺序：

1. 使用 `demo_free_user` 登录
2. 查看会员状态与今日额度
3. 触发周报权限拦截
4. 进入会员页并创建订单
5. 使用 `demo_vip_user` 登录
6. 查看会员状态、AI 周报、社区会员标识
7. 展示成长档案摘要与小程序引流路径

## 8. 当前风险

当前没有阻塞 P5 的问题，但有 3 个需要记住的现实约束：

- 当前生产部署仍依赖手工步骤，没有仓库内一键部署脚本
- 历史文档里有 Docker / docker-compose 表述，但与当前生产事实不完全一致
- 支付回调链路本次未在生产执行，避免污染演示账号状态

## 9. 下一步

P4 可以视为完成。

建议顺序：

1. 进入 P5 灰度上线
2. 按本文件的标准命令执行服务端发布
3. 发布后立即做生产 smoke
4. 观察 AI、支付、配额、社区链路
