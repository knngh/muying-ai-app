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

但当前系统仍缺这些本机工具：

- Android Studio
- Android SDK
- CocoaPods
- iOS SDK
- Java

所以现在项目结构已经具备预览条件，但这台机器的原生运行环境还没配齐，直接执行 `run-android` / `run-ios` 仍会被系统依赖卡住。

## 备注

- 当前生成的原生项目包名/工程名来自临时 RN 壳：
  - Android `applicationId`: `com.muyingaiappshell2`
  - iOS Xcode 工程名: `MuyingAiAppShell2`
- 这不影响本地预览。
- 如果后续要正式打包上架，建议统一重命名为正式 App 标识。
