# HBuilderX 预览说明

这个目录本身就是 `uni-app` 工程，直接用 HBuilderX 打开 `/mini-program` 即可，不要打开仓库根目录。

## 打开方式

1. 打开 HBuilderX。
2. 选择 `文件 -> 打开目录`。
3. 选择 `/Users/zhugehao/muying-ai-app-main-latest/mini-program`。

## 运行到微信小程序

1. 确认已安装微信开发者工具。
2. 在 HBuilderX 中打开 `/mini-program/src/manifest.json`。
3. 在 `微信小程序` 配置里确认 `appid`：
   - 当前值：`wx77c66576e02a48dc`
4. 菜单选择 `运行 -> 运行到小程序模拟器 -> 微信开发者工具`。
5. 首次运行时，HBuilderX 会要求关联微信开发者工具安装路径。

## 运行到 App

1. 在 HBuilderX 中打开 `/mini-program/src/manifest.json`。
2. 检查 `appid`、应用名称、图标、启动页配置。
3. 菜单选择：
   - `运行 -> 运行到手机或模拟器 -> Android`
   - 或 `运行 -> 运行到手机或模拟器 -> iOS`
4. 如果本地没有原生运行环境，可以用：
   - `发行 -> 原生App-云打包`

## 命令行验证

项目也可以直接用命令行验证：

```bash
cd /Users/zhugehao/muying-ai-app-main-latest/mini-program
npm install
npm run type-check
npm run dev:mp-weixin
```

## 注意

- `manifest.json` 和 `pages.json` 在 `src/` 目录下，这是当前 `uni-app vite` 项目的正常布局。
- 如果 HBuilderX 版本过旧，可能无法正确识别 vite 工程。建议使用 HBuilderX 4.x 的较新版本。
- 这个目录用于 `uni-app / 小程序 / App` 预览；仓库里的 `/mobile` 是 React Native，不走 HBuilderX。
