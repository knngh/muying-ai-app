# 2026-10-28 后台与网页生产发布

## 已发布版本

- 工作区：`/Volumes/ZGH/muying-ai-app-main-latest`。
- 生产代码提交：`6c29991a736e9d8410c7c81df5944ecd0891289a`，已推送 `origin/main`。之后的日历测试修正和本记录不改变生产代码。
- 网页：<https://hibeihu.com>，Cloudflare Worker `beihu-web`；版本 `9f98b92f-2fee-4b0c-a59e-e162359359b7`。`/version.json` 返回上述代码提交且 `dirty=false`。
- 后台：<https://beihu.me/health>；API 和 `muying-authority-worker` 使用 `/opt/muying-runtime/node-v24.22.1-linux-x64/bin/node`，PM2 已保存。系统 `/usr/bin/node` 保留 20.20.2，其他应用不受运行时替换影响。
- 微信小程序修改已提交，编译和隐私检查通过；按用户要求，没有上传、预览或发布微信代码。

## 发布与配置变化

修补依赖、Zod 4 兼容、测试环境隔离和照片隐私授权，详见 [上线前复核](launch-review-20261027.md)。服务器按锁文件安装并通过 `--engine-strict`，Prisma Client 生成和 TypeScript 构建成功。Milvus 的 Parquet 传递依赖要求 Node >=24.18，因此后端 package、Docker、CI 和部署检查最终统一到 Node 24 基线。

生产源码和编译文件已与本机核对。保留历史额外文件，以及 `data`、`uploads`、`private-uploads` 和独立 `auth` 目录；没有数据库 schema 变更或迁移。先在独立发布目录安装构建、用临时本机端口检查，再切换依赖和构建目录。最终补充 API 的 `private, no-store, max-age=0` 策略，覆盖未认证错误响应。

生产 `CORS_ORIGIN` 从 `*` 收紧到现有正式配置中的来源：`https://hibeihu.com`、`https://beihu-web.beihu-website.workers.dev`、`https://beihu.me`。源站检查确认这些来源得到相应允许头，未列入清单的来源不返回允许头；无 Origin 的原生客户端和服务端调用仍可用。网页继续使用同源 Worker 代理。

网页资产通过 `frontend/public/.assetsignore` 排除挂载盘 AppleDouble 和 `.DS_Store` 文件。线上请求历史元数据路径已回退为 HTML，不再返回其二进制内容。

## 验证结果

- 最终 Node 24.22.1 全量后端检查：113 个套件、789 个用例通过，26 个依赖独立集成环境的用例保持跳过；lint 和 build 通过。新增两个用例先复现未登录响应缺少缓存限制，再验证修复。
- 网页 lint、E2E 类型检查、生产构建、30 项隔离 API 浏览器回归通过。远端 Web Quality 同样通过：<https://github.com/knngh/muying-ai-app/actions/runs/40628984987>。
- 发布后 `smoke:deploy` 通过：提交号、干净构建、API JSON 与分页、401/no-store、通知脚本、robots、动态 llms.txt、sitemap、文章正文与结构化数据、登录/知识库/工具深链接。
- 正式网页在 1440px 和 375px 各检查首页、知识库、文章、登录、生长工具、疫苗工具和日历，共 14 个场景；无页面脚本错误、横向溢出。受保护页面按未登录状态跳转登录，没有用合成数据写生产账户。
- 源站健康检查 `status=ok`、`database=ok`；后台直连及网页代理的账户和私有记录接口均返回 401，并有 `no-store`。两项 PM2 进程在线，实际 `/proc/<pid>/exe` 指向 Node 24.22.1。发布后没有发现新的类型、语法、模块加载或端口占用错误；主动访问未登录接口产生的授权错误属于验收请求。
- CI 环境缺失 ripgrep 已补齐，测试使用独立占位配置；原日历用例依赖东八区固定时间，已改为构造设备本地时间，并分别在 UTC、Asia/Shanghai、America/Phoenix 通过。GitHub 默认 CodeQL 的 JavaScript/TypeScript 分析通过；Android Java/Kotlin 自动分析因 React Native Gradle 插件解析失败，不属于本次网页/后台部署，未改其扫描设置。

本机证据：`/private/tmp/muying-release-final-jest.json`、`/private/tmp/muying-web-final-smoke-20261028.log`、`/private/tmp/muying-production-api-final-20261028.json`、`/private/tmp/muying-production-browser-20261028/results.json` 及同目录 14 张截图。临时目录可能被系统清理。

## 回滚

后台回滚快照在服务器 `/www/backups/muying-20261028-8400a6d`，目录权限 700，环境和 PM2 快照受限访问。包括原源码/构建归档、原依赖目录、原 `.env`、原 PM2 状态、最终文件哈希和只读验收记录。回滚脚本恢复原依赖、构建、源码和配置，并将本应用两项 PM2 解释器恢复为原系统 Node；不会清理用户数据目录。

```bash
python3 /www/backups/muying-20261028-8400a6d/rollback.py
curl -fsS http://127.0.0.1:3000/health
```

网页回滚到发布前 Worker 版本，在 `frontend` 目录运行：

```bash
npx wrangler rollback ce27c711-4eb2-446a-b4c4-5189e59fb1fc
```

回滚脚本已核对恢复路径和原依赖快照，没有为了测试回滚而主动撤回已验收的生产版本。

## 尚存验收边界

本次不包含微信公众平台隐私配置、原生真机验收或微信发布；不将跳过的数据库集成用例视为通过，也没有执行真实支付、订单或生产用户记录写入验收。小程序工具链残留依赖风险、网页 React Router 6 的中危记录和后端开发工具低危记录沿用上线前复核中的处置说明。
