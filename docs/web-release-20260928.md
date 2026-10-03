# 2026-09-28 网页修复交付

## 范围

- 账号切换使用完整页面重建，清除私有内存状态与旧请求；跨标签页同步退出；起名收藏按账号保存。
- 资料请求循环、日期输入回填、日历月格、提醒参数、失败保留草稿均修复。
- 网页通知需要用户主动授权，网页打开时轮询；事件去重，退出时关闭已显示通知；提供 ICS 导出。
- 知识卡片布局、分类/阶段/搜索组合、失败重试、详情操作反馈、推荐排序、分页缓存隔离修复。推荐优先展示孕育实用主题，保留相关权威新闻。
- AI 历史正确读取后端 `list`；签到读取 `currentStreak` 并刷新积分记录。四个已有工具代码纳入版本管理。
- 新增 Web Quality CI、生产构建浏览器回归、构建版本文件、发布与真实业务验收脚本。

## 验证依据

- 原始构建：第一组回归 14 项中 13 项失败；新增工具回归也复现账号收藏隔离、积分刷新和签到字段错误。
- 修复后浏览器回归 30 项；前端 lint、测试类型检查、生产构建通过。
- 知识库相关后端测试 67 项通过，后端 build 和 lint 通过。
- 使用独立虚构账号，经本地 Worker 接真实生产 API：登录/资料/知识/生长/疫苗/签到/收藏/日历/AI 共 9 条流程通过，页面无未捕获异常。AI 验收验证返回与历史持久化，不代表医学内容质量全部通过。
- 生产知识库检查 pageSize 2/10、recommended/latest、关键词、分类与阶段组合，确认不串缓存且筛选生效。
- 全后端扩展检查发现与本轮修改无关的环境/仓库问题：macOS `._*.test.ts` 被 Jest 当作源码；AI 客户端审计依赖当前工作区缺失的 `mini-program/src/api/ai.ts`。在关闭外部 AI 改写/向量/重排的环境下，报告 783 个测试通过、1 个测试失败，另有 6 个 AppleDouble 文件测试套件编译失败、26 个跳过。未宣称全库测试通过。
- 前端依赖高危项已修复；`npm audit --audit-level=high` 可通过，仍有 React Router 6 相关 2 项中危，升级主版本单独处理。

实际运行证据位于本机 `/Users/zhugehao/muying-web-review-2026-09-28/`。报告不含测试账号密码或访问令牌。CI 配置已落库；远端 CI 结果须在推送后单独核验。

## 网页发布

环境：Cloudflare Worker `beihu-web`，地址 `https://beihu-web.beihu-website.workers.dev`。

1. 干净提交运行前端检查及 `npm run build`。
2. 保存 `npx wrangler deployments list` 当前版本。
3. `npm run deploy` 后核对 `/version.json` 的完整提交号且 `dirty=false`。
4. 设置 `WEB_SMOKE_BASE_URL`、`WEB_EXPECTED_COMMIT`，执行 `npm run smoke:deploy`。
5. 核对知识库内容、登录、深链接、API JSON、401 与 `no-store`、通知脚本 MIME。

本次发布前回滚版本为 `3cdce506-aa89-444c-9d65-24d48a9de32d`。紧急回滚在 frontend 目录执行：

```bash
npx wrangler rollback 3cdce506-aa89-444c-9d65-24d48a9de32d
```

旧版本没有新的版本文件，回滚后使用页面和 API 检查，不运行要求新 `/version.json` 的检查。

## 知识库后端发布

生产工作区已有大量历史变更。本轮只替换 `article.controller` 和新增 `authority-browse` 的源码及编译文件；没有数据库迁移。`knowledge-content-guard.ts` 与线上字节一致，未重复覆盖。仅重启 PM2 `muying-api`；不变更域名/nginx，也不执行全量 git reset/pull/sync。

最终知识库源码提交为 `8b6d447`。备份位置：

- 首次修复前：`/www/wwwroot/muying-web-releases/20260928-knowledge/before.tar.gz`
- 推荐主题排序补充前：`/www/wwwroot/muying-web-releases/20260928-knowledge-v2/before.tar.gz`

如需撤销全部知识库修复，在服务器恢复首次备份并删除本次新增 helper，然后重启 API：

```bash
cd /www/wwwroot/muying-ai-app
sudo tar -xzf /www/wwwroot/muying-web-releases/20260928-knowledge/before.tar.gz
sudo rm -f src/utils/authority-browse.ts dist/utils/authority-browse.js dist/utils/authority-browse.js.map dist/utils/authority-browse.d.ts dist/utils/authority-browse.d.ts.map
sudo pm2 restart muying-api
curl -fsS http://127.0.0.1:3000/health
```

每次发布目录保存 after.tar.gz、commit.txt 与健康结果；原始备份可完整恢复本轮涉及的旧文件。

## 支持边界

网页关闭后的后台推送尚未实现；浏览器或系统可关闭通知。现有身份仍为 JWT；Better Auth、邮箱找回和设备会话属于已完成选型评估的下一项迁移，详见 `web-auth-upgrade.md`。
