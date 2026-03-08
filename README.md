# 母婴AI日历 · 小程序 & App

基于「日历 → 问答 → 产品推荐」漏斗的 uni-app 项目，一套代码可编译为 **微信小程序** 与 **App**（及 H5）。

## 产品结构

| 模块     | 路径           | 说明 |
|----------|----------------|------|
| 日历入口 | `pages/index`  | 今日母婴日历、阶段展示，引导进入问答 |
| AI 问答  | `pages/qa`     | 对话式育儿问答，带参考来源与免责 |
| 产品推荐 | `pages/recommend` | 场景化推荐（孕期/辅食/新生儿等） |
| 我的     | `pages/mine`   | 阶段设置、关于与免责说明 |

## 技术栈

- **uni-app**（Vue 3 + TypeScript + Vite）
- 编译目标：`mp-weixin`（微信小程序）、`app`（iOS/Android）、`h5`

## 快速开始

### 1. 安装依赖

```bash
cd muying-ai-app
npm install
```

若安装失败或版本不兼容，可先用官方模板创建再覆盖本项目的 `src`：

```bash
npx degit dcloudio/uni-preset-vue#vite-ts base-app
cd base-app && npm install
# 将本项目的 src 目录完整复制到 base-app 下覆盖，再运行 npm run dev:h5 / dev:mp-weixin
```

### 2. 运行

```bash
# H5 开发
npm run dev:h5

# 微信小程序（需先安装微信开发者工具）
npm run dev:mp-weixin
```

### 3. 发布

```bash
# 构建微信小程序
npm run build:mp-weixin

# 构建 H5
npm run build:h5
```

构建完成后：

- 微信小程序：用微信开发者工具打开 `dist/dev/mp-weixin` 或 `dist/build/mp-weixin`，上传代码并提交审核。
- App：需使用 **HBuilderX** 打开本项目，菜单「发行」→「原生 App-云打包」生成安装包。

## 宝塔部署（H5 网页版）

若需将 H5 版本部署到自己的服务器，可参考 **[宝塔部署详细教程](docs/宝塔部署教程.md)**，包含：本地构建、上传、Nginx 配置、HTTPS、常见问题等。

## 配置微信小程序 AppID

在 `src/manifest.json` 的 `mp-weixin.appid` 中填入你的小程序 AppID（开发阶段可先用测试号）。

## 后续对接

- **日历内容**：在 `src/api/calendar.ts` 中对接权威数据源或自有后端。
- **问答**：在 `src/api/qa.ts` 中对接 RAG/预设问答库或大模型 API，保持「参考来源 + 免责」展示。
- **推荐**：在 `src/api/recommend.ts` 中按场景对接淘宝联盟/京东 CPS 等，商品跳转在 `ProductCard.vue` 中实现。

## 合规说明

- 问答回答均需标注「参考来源」，并展示「本建议仅供参考，不能替代医生诊断」。
- 产品推荐为场景化推荐，需在「我的」或相关页保留免责说明。

## 目录说明

```
src/
├── api/           # 接口与类型（日历、问答、推荐）
├── components/    # 日历卡片、对话气泡、商品卡片
├── pages/         # 四栏：日历、问答、推荐、我的
├── static/        # tabBar 图标等静态资源
├── App.vue
├── main.ts
├── manifest.json  # 应用与小程序/App 配置
├── pages.json     # 路由与 tabBar
└── uni.scss       # 全局样式变量
```
