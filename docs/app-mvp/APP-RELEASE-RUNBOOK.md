# App Release Runbook

更新时间：2026-04-06

## 1. 目标

这份 runbook 用于当前 React Native App 的发布前自检、构建准备与提测口径。

适用范围：

- 目录：`mobile`
- 当前仓库内可确认命令：`lint`、`test`、`android`、`ios`、`start`

## 2. 发布前检查

执行前确认：

- 已完成目标功能联调
- 已确认 App API 地址、鉴权、会员与周报链路可用
- 已确认本次是否包含新页面、新埋点或新导航入口

## 3. 本地校验

在 `mobile` 目录执行：

```bash
npx tsc --noEmit
npm run lint
npm run test
```

说明：

- `npx tsc --noEmit` 用于 TypeScript 静态校验
- `npm run lint` 用于代码风格和常见问题检查
- `npm run test` 用于 Jest 测试

## 4. 本地联调

按目标平台执行：

```bash
npm run android
```

或：

```bash
npm run ios
```

如需单独启动 Metro：

```bash
npm run start
```

联调建议至少覆盖：

- 登录
- 首页
- AI 对话
- 社区列表 / 帖子详情
- 会员页
- 周报页
- 成长档案页

## 5. 提测 / 发版交付口径

当前仓库未提供自动打包、签名、上传商店脚本，因此发布以人工流程为准。

建议交付物：

- 本次变更说明
- 测试范围与结果
- 风险点与回退口径
- 对应后端版本 / 接口依赖说明

## 6. 回退口径

当前没有 App 自动回滚脚本。

最小回退方式：

1. 切回上一个稳定代码版本
2. 重新执行 `npx tsc --noEmit`、`npm run lint`、`npm run test`
3. 重新生成安装包并走人工发布流程

## 7. 当前边界

- 当前仓库只确认了开发运行命令，未内置 Fastlane、Gradle release、Xcode archive 自动化脚本
- 客户端埋点代码已接入仓库，但持续数据采集依赖下一次客户端正式发版
- 若本次依赖新后端能力，必须与服务端发布窗口一起校准

## 8. 相关文件

- [`MVP-COMPLETE.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/MVP-COMPLETE.md)
- [`P6-DATA-CLOSURE.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/P6-DATA-CLOSURE.md)
- [`RELEASE-RUNBOOK.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/RELEASE-RUNBOOK.md)
