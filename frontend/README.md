# 母婴 AI 助手网页端

React 18、TypeScript、Vite 8、React Router 6、Zustand、CSS Modules / Tailwind 4；生长曲线使用 Recharts。需要 Node.js 22.12+。网页复用仓库 `shared/` 和 `src/data/` 中的类型与数据，不能只复制 `frontend/` 构建。

## 本地开发与验证

在本目录运行：

```bash
npm ci
npm run dev
npm run lint
npm run typecheck:e2e
npm run test:e2e
```

Playwright 自动构建生产版本并在 4178 端口预览。在 macOS 自动使用已安装的 Chrome；其他环境先运行 `npx playwright install --with-deps chromium`。也可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`。日常 E2E 拦截接口，不访问生产数据或调用 AI；覆盖账号隔离、错误恢复、日期、提醒、资料、知识库、工具和真实 Service Worker 生命周期。CI 工作流为 `.github/workflows/web.yml`。

开发 API 使用 `VITE_API_BASE_URL`，路径需以 `/api/v1` 结尾。部署时 `.env.production` 使用 `/api/v1`，由 Worker 同源转发到现有后端。需要本地完整代理时先构建，再运行 `npx wrangler dev --port 4188`。

## 发布与回滚

从干净提交构建，`dist/version.json` 自动记录 commit、dirty、builtAt；页面、版本文件和通知 Service Worker 使用重新验证缓存，认证/API 响应禁止缓存。

```bash
npm run build
npm run deploy
WEB_SMOKE_BASE_URL=https://beihu-web.beihu-website.workers.dev \
WEB_EXPECTED_COMMIT=<完整提交号> npm run smoke:deploy
```

发布检查核对版本、深链接、未登录 API、知识列表分页和通知脚本，不写用户数据。发布前记录 `npx wrangler deployments list` 的当前版本；异常时执行 `npx wrangler rollback <旧版本ID>`，再复核原网页与 API。具体记录见 [发布说明](../docs/web-release-20260928.md)。

## 真实业务验收

`npm run smoke:live` 为显式选择的验收，会注册专用账号、创建虚构记录并发送一次真实 AI 问题。凭据文件权限为 0600，不写入报告或代码；重复运行复用账号，但会新增业务记录。不用于 CI。

```bash
WEB_SMOKE_BASE_URL=http://127.0.0.1:4188 \
WEB_SMOKE_CREDENTIALS_FILE=/安全目录/web-smoke-credentials.json \
WEB_SMOKE_RESULT_FILE=/验收目录/web-smoke-result.json npm run smoke:live
```

## 日历提醒

用户主动点击开启网页通知后，网页打开期间每分钟及重新聚焦时检查近期提醒。网页新建事件默认提前一天，无时间的事件按设备本地时间 09:00 计算；按账号、事件与提醒版本去重，退出时关闭本应用已显示的提醒。浏览器后台节流可能延迟检查，关闭全部网页后不会继续轮询。尚未接入服务端 Web Push，系统日历 `.ics` 导出可作为补充。

## 依赖与后续认证

本轮已修复前端依赖的高危审计项；React Router 6 剩余两项中危建议升级需跨主版本，后续单独迁移，并持续复核。当前应用没有 SSR hydration，但不能据此认为所有相关风险都不存在。

账号密码、找回密码与设备会话的开源框架评估见 [认证升级方案](../docs/web-auth-upgrade.md)。
