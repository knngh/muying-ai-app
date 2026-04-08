# Release Runbook

更新时间：2026-04-06

## 1. 目标

这份 runbook 用于执行当前生产环境的标准服务端发布与冒烟。

适用范围：

- 生产主后端
- 目录：`/www/wwwroot/muying-ai-app`
- 进程：`muying-api`

## 2. 预检查

发布前先确认：

- 本地代码已完成构建验证
- 已同步需要上线的代码到生产目录
- 当前生产 `.env` 无需改动，或已提前完成修改
- 如本次包含 schema 变化，确认可执行 `db:push`
- 如本次要启用真实支付回调验签，需提前配置：
  - `WECHAT_PAYMENT_CALLBACK_SECRET`
  - `ALIPAY_PAYMENT_CALLBACK_SECRET`
  - `PAYMENT_CALLBACK_ALLOW_AUTH_FALLBACK=false`

## 3. 标准发布命令

### 3.0 先同步代码

```bash
npm run ops:sync:prod
```

说明：

- 只同步当前后端发布所需的核心目录与文件
- 不同步 `node_modules`、`dist`、`.git`

### 3.1 常规发布

```bash
npm run ops:deploy:prod
```

### 3.2 含依赖变化

```bash
npm run ops:deploy:prod -- --with-install
```

### 3.3 含数据库 schema 变化

```bash
npm run ops:deploy:prod -- --with-db-push
```

### 3.4 含依赖和 schema 双变化

```bash
WITH_INSTALL=true WITH_DB_PUSH=true npm run ops:deploy:prod
```

### 3.5 一键 release

```bash
npm run ops:release:prod
```

如依赖变化：

```bash
npm run ops:release:prod -- --with-install
```

如 schema 变化：

```bash
npm run ops:release:prod -- --with-db-push
```

## 4. 发布后冒烟

```bash
npm run ops:smoke:prod
```

默认覆盖：

- 健康检查
- 免费 / 会员 demo 账号
- 会员状态
- 今日额度
- 周报权限
- 支付建单
- 社区帖子与评论
- analytics 事件写入
- analytics 漏斗查询

## 5. 演示数据重置

需要重置演示状态时，在生产目录执行：

```bash
cd /www/wwwroot/muying-ai-app
npm run db:seed
npm run seed:community
```

## 6. 回滚口径

当前提供保守的文件级回滚脚本，只用于“已存在备份文件”的目标文件恢复。

标准方式：

```bash
npm run ops:rollback:prod -- \
  --backup-file /www/wwwroot/muying-ai-app/src/controllers/community.controller.ts.bak-20260406-p3 \
  --target-file /www/wwwroot/muying-ai-app/src/controllers/community.controller.ts
```

如需密码登录：

```bash
SSH_PASSWORD='你的密码' npm run ops:rollback:prod -- \
  --backup-file /www/wwwroot/muying-ai-app/src/controllers/community.controller.ts.bak-20260406-p3 \
  --target-file /www/wwwroot/muying-ai-app/src/controllers/community.controller.ts
```

默认行为：

- 恢复目标文件
- 重新 `npm run build`
- 重新 `pm2 restart muying-api`

可选参数：

- `--skip-build`
- `--skip-restart`

说明：

- 当前是文件级回滚，不是整站版本回滚
- 若涉及 schema 变化，回滚前需要先评估数据库兼容性，不能盲目反向修改
- 若没有可用备份文件，应先从上一个稳定版本重新同步代码，再执行 `npm run ops:deploy:prod`

## 7. 使用方式

如果机器已配置 SSH key：

- 直接运行上述脚本即可

如果需要密码登录：

```bash
SSH_PASSWORD='你的密码' npm run ops:release:prod
```

## 8. 当前已知边界

- `ops:sync:prod` 只同步后端发布所需的核心文件，不是全仓库镜像同步
- `ops:sync:prod` 当前只同步后端发布需要的核心文件，不同步 mobile / mini-program 客户端代码
- 默认生产主机为 `212.64.29.211`
- 默认进程为 `muying-api`
- `ops:deploy:prod` 与 `ops:rollback:prod` 均支持 `SSH_PASSWORD`
- 当前 smoke 中支付只验证到建单，不执行真实支付回调
- 当前仓库已支持支付回调签名框架；若生产未配置回调密钥，回调仍会走登录态 fallback

## 9. 相关文件

- [`APP-RELEASE-RUNBOOK.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/APP-RELEASE-RUNBOOK.md)
- [`MINI-PROGRAM-RELEASE-RUNBOOK.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/MINI-PROGRAM-RELEASE-RUNBOOK.md)
- [`P4-READINESS.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/P4-READINESS.md)
- [`P5-GRAY-REPORT.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/P5-GRAY-REPORT.md)
- [`P6-DATA-CLOSURE.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/P6-DATA-CLOSURE.md)
