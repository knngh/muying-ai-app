# Release Runbook

更新时间：2026-05-26

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

### 4.1 上传图片专项冒烟

上传图片涉及 App / 小程序渲染层跨源加载、Nginx 反代缓存、后端静态文件响应头、日记保存与删除清理。发布图片上传、孕育记录、静态资源响应头或 Nginx 配置后，额外执行：

```bash
npm run ops:smoke:uploads
```

默认覆盖：

- `demo_postpartum_user` 登录
- 使用 multipart 字段名 `file` 上传图片
- 校验新图片响应头包含 `Cross-Origin-Resource-Policy: cross-origin`
- 校验新图片响应头包含 `Cache-Control: no-store, max-age=0` 且不含 `immutable`
- 保存产后记录并读回 `imageUrls`
- 删除记录并确认对应 `/uploads/...` 文件返回 404

### 4.2 Nginx `/uploads/` 反代要求

生产域名 `beihu.me` 的 `/uploads/` 必须单独关闭 Nginx proxy cache。用户上传图片可能被删除，且微信小程序渲染层会按 `Cross-Origin-Resource-Policy` 判断跨源图片；如果 `/uploads/` 命中旧 proxy cache，可能继续返回旧的 `same-origin` 或 `immutable` 响应头，导致小程序报 `net::ERR_BLOCKED_BY_RESPONSE`。

当前生产配置文件：

```bash
/www/server/panel/vhost/nginx/muying-api.conf
```

`server_name beihu.me` 的 HTTPS server 内需要保留：

```nginx
location /uploads/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache off;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
}
```

修改后执行：

```bash
sudo /www/server/nginx/sbin/nginx -t
sudo /www/server/nginx/sbin/nginx -s reload
```

验证任意存在的上传图片：

```bash
curl -sS -o /dev/null -D - https://beihu.me/uploads/<filename>.jpg
```

应看到：

```text
cross-origin-resource-policy: cross-origin
cache-control: no-store, max-age=0
```

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
- `/uploads/` 的 Nginx 反代配置属于服务器运行时配置，不随 `ops:sync:prod` 自动同步；重建服务器或重置宝塔站点配置后必须按 4.2 恢复

## 9. 相关文件

- [`APP-RELEASE-RUNBOOK.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/APP-RELEASE-RUNBOOK.md)
- [`MINI-PROGRAM-RELEASE-RUNBOOK.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/MINI-PROGRAM-RELEASE-RUNBOOK.md)
- [`P4-READINESS.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/P4-READINESS.md)
- [`P5-GRAY-REPORT.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/P5-GRAY-REPORT.md)
- [`P6-DATA-CLOSURE.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/P6-DATA-CLOSURE.md)
