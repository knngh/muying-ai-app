# 2026-10-27 网页与微信小程序上线前复核

## 结论与范围

本轮完成可自动化的代码检查、修复、生产构建与浏览器回归；仍有发布前必须核实的环境和原生验收事项，不能据此直接认定整个生产发布已通过。

工作区为 `/Volumes/ZGH/muying-ai-app-main-latest`，基于 `268318f19cfbaaeff122acee01052fa7c63be16e` 的未提交改动。没有部署、数据库迁移、微信代码上传或生产账号写操作。保留了用户原有的 `src/controllers/article.controller.ts` 改动；接手前后文件 SHA-256 均为 `cbdbc3a6994455733898df8e513ec74152072f78f987c777b2eeeef4595484c0`。

## 本轮修复

- 报告选图、成长相册选图和阶段卡保存到相册前增加微信隐私授权门槛，拒绝则不继续照片操作；同意必须来自平台 `agreePrivacyAuthorization` 按钮事件。日历原有授权链路保留。
- 新增照片授权覆盖检查并接入微信 smoke；修正 smoke 阶段编号。
- Jest、ESLint、Playwright 排除挂载盘 AppleDouble `._*` 元数据，报告文件测试过滤这些条目。
- Jest 对 Thrift 间接引入的 ESM-only uuid 单独转换，解决 Milvus 导入导致多个测试套件无法加载的问题；不为绕过测试修改业务服务。
- 知识检索回归显式检查本地检索降级路径，关闭外部改写/向量/重排，并断言没有 fetch 请求；避免读取开发配置后访问真实 AI 服务导致超时。
- AI 客户端审计适配当前小程序聊天页面不存在/关闭的发布状态；编译包不包含聊天、社区、会员、支付页面。
- 后端依赖安全升级并完成 Zod 4 相关 `issues`/`record` 迁移；运行基线设为 Node >=22.12，Docker 和 CI 使用 Node 22，部署脚本在安装/构建/重启前检查版本。
- 网页修补 DOMPurify、Vite、Cloudflare 工具链及其 undici 和 PostCSS 解析器传递依赖。
- 小程序修补 markdown-it 14.3.3、linkify-it、ws、PostCSS、qs、proxy-addr、body-parser、source-map-js 和压缩包处理依赖；sharp 作为构建依赖。DCloud/Vue 固定版本保持一致。
- 小程序 UI smoke 支持指定浏览器或使用 Playwright Chromium，每个工具路由从完整文档开始，避免仅修改 hash 参数而复用 uni-app onLoad 状态。

## 验证结果

| 范围 | 结果 | 边界 |
| --- | --- | --- |
| 后端 Jest | 112 个套件、787 个用例通过；2 个套件/26 个用例原本跳过 | 未开启需要独立数据库环境的集成测试 |
| 后端静态与构建 | lint、TypeScript build、部署脚本 bash 语法检查通过 | 服务器 Node 和依赖安装尚未验证 |
| 网页 | lint、typecheck、E2E 类型检查、生产 build、30 项 Playwright 回归通过 | 使用隔离 API fixtures，覆盖账号切换、私密状态、登录/刷新失败、日历/通知/导出、签到、知识搜索恢复和文章布局；不是生产写入验收 |
| 微信小程序 | type-check、3 处新增照片门槛检查、mp-weixin 和 H5 生产 build 通过 | Sass legacy API 存在工具链弃用警告；原生模拟器/真机尚未完成 |
| 小程序工具 UI | 15 个工具路由在 320/375/430 宽度通过，无页面 JS 错误和横向溢出 | H5 生产预览与微信原生组件行为不同 |
| 小程序本机记录 | 日记空内容校验、保存、刷新回读；金额精度校验、0.10+0.20=0.30、刷新回读通过 | 独立浏览器合成数据，后端请求拦截为 fixtures |
| 运行时加载与 LTS 回归 | Node 24.14 LTS 可加载 Milvus SDK 和 sharp 0.35.5，另一次全量回归同样为 112 个套件、787 个用例通过 | 未在生产服务器确认 Node 版本；精确最低版 Node 22.12 的临时下载验证未完成 |

本机证据包括 `/private/tmp/muying-jest-final.json`、`/private/tmp/muying-jest-final.log`、`/private/tmp/muying-jest-node24.json`、`/private/tmp/muying-launch-review-20261027/mini-local-review.json` 和同目录 13 张截图；网页 Playwright HTML 报告位于 `frontend/playwright-report/`。这些是本机生成材料，临时目录可能被系统清理。

## 依赖审计与处置边界

审计记录数包含依赖链传递项，不等于独立漏洞数量。

| 范围 | Critical | High | Moderate | Low | 剩余处置 |
| --- | ---: | ---: | ---: | ---: | --- |
| 后端 | 0 | 0 | 0 | 1 | esbuild 的 Windows 开发服务器文件读取公告；生产运行编译后的 Express 服务，单独跟踪开发工具补丁 |
| 网页 | 0 | 0 | 2 | 0 | React Router 6 的两个依赖记录；当前使用固定内部导航、客户端渲染，无 SSR 错误反序列化，仍需单独安排主版本迁移 |
| 小程序 | 0 | 9 | 3 | 22 | 高风险记录集中在 Vue server-renderer 及其 DCloud 传递链和 Vite；当前发布为微信编译包/H5 静态产物，未发现 server-renderer 在微信产物中的服务端渲染入口，但不能将完整依赖树称为无高危 |

小程序 Vite 5.4.21 补丁试验触发 DCloud 插件对 `vite@5.2.8` 的严格 peer 冲突，已恢复要求的版本；`npm ls --depth=0` 无 invalid 依赖。DCloud 编译器、Vue 和 Vite 应一起在独立升级窗口验证。开发服务器只绑定本机，不作为生产服务发布。此项复核日期为 2026-10-27，工具链风险在正式升级前持续跟踪。

完整审计本机证据：`/private/tmp/muying-backend-audit-final.json`、`/private/tmp/muying-web-audit-final.json`、`/private/tmp/muying-mini-audit-final.json`。

## 生产只读观察

- `https://beihu.me/health` 返回 200、`status=ok`、`database=ok`，接口具备 CSP、HSTS、nosniff、frame 限制头。
- 未登录请求 `/api/v1/auth/me` 返回 401，并有 `Cache-Control: no-store`。
- `https://hibeihu.com/` 与 `/version.json` 返回 200；线上版本为 `4322b2296a26265e547d8a8d001e54a1931e1207`，构建日期 2026-10-05，本轮修复尚未发布。
- 网页 `/api/v1/articles?contentType=authority&pageSize=2&sort=recommended` 返回 JSON、code=0、两篇文章及 pageSize=2，未回退为 SPA HTML。
- API 对正式域名和未列入清单的测试 Origin 都返回 `Access-Control-Allow-Origin: *`，同时 `Access-Control-Allow-Credentials: true`。浏览器不会接受这种组合的凭据跨域请求，来源范围也过宽；正式发布前应确认完整允许来源并设置生产 `CORS_ORIGIN`，不能未经确认直接替换生产配置。

## 发布前待完成

1. 在微信开发者工具“设置 -> 安全设置”开启服务端口，再运行 `npm --prefix mini-program run smoke:mp-weixin`。本机 CLI 当前退出码 246，明确报“工具的服务端口已关闭”；本轮没有通过原生预览/真机检查。
2. 在微信公众平台确认《用户隐私保护指引》已保存发布，并与日历照片、报告本机/私有归档、成长相册和海报保存的实际路径一致。真机验证首次同意、拒绝、再次打开，以及相册权限拒绝后恢复；拒绝不影响公开知识库浏览。
3. 确认生产 Node >=22.12，并核对 PM2 实际使用的 Node 二进制。当前没有取得可用服务器 SSH 会话。依赖与源码需同批发布，不能只替换新 Zod API 源码而保留旧 Zod 依赖。
4. 确认并收紧生产允许的 CORS 来源；验收正式域名、未允许来源、401 和缓存行为。
5. 用独立测试账号在受控环境补做真实登录、记录保存、报告私有访问/删除和订阅/支付等实际开放链路。26 个集成用例的跳过不能视为数据库/外部服务集成已通过。
6. 发布前形成干净提交、构建版本和回滚快照。当前构建 `dirty=true` 是工作区未提交的检查产物；正式发布应要求 `dirty=false` 并校验 `/version.json`。本轮没有执行部署或推送。

## 复现主要检查

```bash
npm run lint
npm run build
npm test -- --runInBand
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run typecheck:e2e
npm --prefix frontend run test:e2e -- --workers=2
npm --prefix mini-program run type-check
npm --prefix mini-program run smoke:privacy
npm --prefix mini-program run build:mp-weixin
npm --prefix mini-program run build:h5
```

小程序路由验收需要先启动本机 H5 生产预览，再在 `mini-program` 中设置 `NODE_PATH=../frontend/node_modules` 运行 `npm run smoke:tools`。浏览器可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定；默认使用系统 Chrome，未安装时使用 Playwright 已下载的 Chromium。

## 2026-10-28 发布准备补充

用户已授权提交、推送及后台和网页部署；微信小程序由用户自行发布，相关代码纳入提交但不上传微信。上述 10 月 27 日的观察和待办为当时记录，部署结果以本节之后的发布记录为准。

- 三端均重新执行 `npm ci`，确认直接依赖安装版本与锁文件一致。后端 lint、build 及 112 套件/787 用例再次通过；网页 lint、E2E 类型检查、生产构建和 30 项浏览器回归再次通过；小程序 type-check、照片隐私检查和微信构建再次通过。
- 已通过现有 SSH 密钥连接生产。生产 Node 为 20.20.2，已在 `/opt/muying-runtime/node-v22.23.4-linux-x64` 安装官方 Node 22.23.4 并核对 SHA-256；系统 Node 保持原样。发布时 API 和 authority worker 均需指定此绝对解释器路径。
- 对照生产源码、Prisma schema 和编译产物，219 个 JavaScript 文件字节一致，仅三处 Zod 兼容修改不同。生产已包含文章 slug 容错修复；数据库 schema 一致，不执行数据库迁移。
- 生产存在额外历史源码和编译文件，发布采用独立目录安装构建，保留历史文件与运行时 data、uploads、private-uploads、auth。切换前备份源码、依赖、构建、环境配置和 PM2 状态，失败恢复旧版本。
- 网页发布前版本为 `ce27c711-4eb2-446a-b4c4-5189e59fb1fc`；正式构建必须来自干净提交，发布后核验 `/version.json` 提交号、`dirty=false`、API 代理、401 缓存和浏览器深链接。
- 生产现有 `CORS_ORIGIN=*` 和未运行的数据库集成测试仍是原复核的明确边界；网页当前通过同源 Worker 代理 API。小程序平台隐私设置与真机验收由用户发布时完成。
