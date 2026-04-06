# Mobile 本机预览说明

当前 `/mobile` 已补齐 React Native 原生工程壳，目录里现在包含：

- `android/`
- `ios/`
- `metro.config.js`
- `babel.config.js`
- `index.js`
- `app.json`

## 先决条件

### Android

- 安装 Android Studio
- 安装 Android SDK
- 配置 `ANDROID_HOME` / `ANDROID_SDK_ROOT`
- 启动一个 Android 模拟器，或连接一台已开启开发者模式的真机
- 安装 Java 17 或兼容版本

### iOS

- 安装 Xcode
- 安装 CocoaPods
- 安装 iOS Simulator，或连接真机

## macOS 推荐安装命令

这台机器在 2026-04-06 已验证可直接安装下面这些依赖：

```bash
brew install openjdk@17 cocoapods watchman
brew install --cask android-studio android-commandlinetools
```

Shell 环境变量建议补到 `~/.zshrc`：

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="/opt/homebrew/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

Android SDK 常用组件可用下面命令安装：

```bash
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" "emulator" "system-images;android-34;google_apis;arm64-v8a"
```

## 安装依赖

```bash
cd /Users/zhugehao/muying-ai-app-main-latest/mobile
npm install
```

## iOS 额外步骤

```bash
cd /Users/zhugehao/muying-ai-app-main-latest/mobile/ios
pod install
```

如果系统里还没有 `pod`，先安装 CocoaPods。

## 启动 Metro

```bash
cd /Users/zhugehao/muying-ai-app-main-latest/mobile
npm run start
```

## 运行 Android

```bash
cd /Users/zhugehao/muying-ai-app-main-latest/mobile
npm run android
```

## 运行 iOS

```bash
cd /Users/zhugehao/muying-ai-app-main-latest/mobile
npm run ios
```

## 当前环境检查结果

在这台机器上我已经验证：

- React Native CLI 可以识别项目
- JS / TS 层可通过编译检查
- 原生项目目录存在且被 `react-native config` 正常识别
- 已安装 `openjdk@17`、`cocoapods`、`watchman`
- 已安装 `Android Studio`、`android-commandlinetools`
- 已安装 Android `platform-tools`、`build-tools;34.0.0`、`platforms;android-34`、`emulator`、`system-images;android-34;google_apis;arm64-v8a`

但当前系统仍缺这些本机工具：

- 可用的 Xcode / iOS SDK

所以现在 Android 侧依赖已基本齐备，iOS 仍会被完整 `Xcode.app` 缺失卡住。

## Android 模拟器补充

- 如果 `avdmanager` 在本机上无法正常创建 AVD，直接打开 Android Studio。
- 进入 `More Actions` -> `Virtual Device Manager`。
- 新建一个 `Pixel 8` 或相近机型。
- 系统镜像选择 `Android 14 / API 34 / Google APIs / ARM64`。
- 创建后可执行：

```bash
emulator -list-avds
emulator @<你的AVD名称>
```

## 当前正式标识

- React Native 模块名: `BeihuMama`
- Android `applicationId`: `com.knngh.beihumama`
- iOS Bundle Identifier: `com.knngh.beihumama`
- iOS Xcode 工程名: `BeihuMama`
