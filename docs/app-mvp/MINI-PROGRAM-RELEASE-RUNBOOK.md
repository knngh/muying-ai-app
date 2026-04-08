# Mini Program Release Runbook

更新时间：2026-04-06

## 1. 目标

这份 runbook 用于当前 uni-app 小程序版本的发布前校验、构建输出与提审口径。

适用范围：

- 目录：`mini-program`
- 当前仓库内可确认命令：`type-check`、`build:mp-weixin`、`build:app`

## 2. 发布前检查

执行前确认：

- 已确认本次目标平台，默认以微信小程序为主
- 已完成接口联调
- 已确认登录、社区、AI、日历、个人中心主链路可用

## 3. 本地校验

在 `mini-program` 目录执行：

```bash
npm run type-check
```

如目标为微信小程序，执行：

```bash
npm run build:mp-weixin
```

如需 App 侧构建产物，执行：

```bash
npm run build:app
```

## 4. 提审前联查

建议至少人工检查：

- 登录 / 退出登录
- AI 对话
- 社区列表 / 详情
- 帖子评论
- 日历页
- 个人中心
- 打开 App 下载引导

## 5. 提审 / 发布口径

当前仓库未提供小程序自动上传或自动提审脚本，因此发布以人工流程为准。

建议交付物：

- 构建时间与 commit 标识
- 本次变更说明
- 测试范围与结果
- 是否依赖服务端同步上线

## 6. 回退口径

当前没有小程序自动回滚脚本。

最小回退方式：

1. 切回上一个稳定代码版本
2. 重新执行 `npm run type-check`
3. 重新执行 `npm run build:mp-weixin`
4. 使用上一个稳定包重新提审 / 发布

## 7. 当前边界

- 当前仓库没有微信开发者工具上传自动化脚本
- 当前仓库没有版本号自动递增与提审自动化
- App 下载引导相关埋点已接入仓库，但线上持续采集依赖新版本实际发布

## 8. 相关文件

- [`MVP-COMPLETE.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/MVP-COMPLETE.md)
- [`P6-DATA-CLOSURE.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/P6-DATA-CLOSURE.md)
- [`RELEASE-RUNBOOK.md`](/Users/zhugehao/muying-ai-app-main-latest/docs/app-mvp/RELEASE-RUNBOOK.md)
