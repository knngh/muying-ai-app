# TypeSafe Jev 接入说明

本文记录贝护后端对 TypeSafe Jev 的最小接入方式。当前 Jev 用于工具记录回顾中的固定选项归类、静态起名候选评测及一句话记账草稿；小程序和网页都不能直接调用 TypeSafe，也不能接触 API key。

## 已核验的官方协议

2026-09-21 按官方文档核验：

- API：[`POST /v1/systemone`](https://docs.typesafe.ai/api)，地址为 `https://api.typesafe.ai/v1/systemone`，使用 `Authorization: Bearer <API_KEY>`。
- 模型：[`jev-1.13.0`](https://docs.typesafe.ai/models)。`jev-latest` 和 `jev-preview` 是会移动的别名；生产业务固定版本，升级时单独评测。
- 输入：`state` 加 `questions`。Choice 的 `criteria` 最多 255 个选项；响应包含 `choice`、完整 `probabilities` 和 `confidence`。
- 限制：Jev 只接收文本或 JSON，不接收图片、音频和视频；数字计算、日期排序、计数应由代码完成；它不适合自由生成长文本。详见 [`Jev 1.13 jaggedness`](https://docs.typesafe.ai/model-jaggedness/jev-1.13)。

中文业务还需要用真实的脱敏样本持续评测。官方文档明确英语是主要训练语言，因此本地的合成冒烟只能证明协议和样例链路可用，不能作为中文准确率或医疗安全证明。

## 配置

在后端 `.env`（该文件已被 Git 忽略）设置：

```dotenv
TYPESAFE_API_KEY=<从 TypeSafe 控制台取得的密钥>
TYPESAFE_MODEL=jev-1.13.0
```

`.env.example` 只保留空的占位值。不要把密钥放进 `mini-program/.env*`、`frontend/.env*`、小程序代码、日志、埋点或提交记录。生产环境通过部署平台的密钥管理注入，不复制到仓库。

`src/config/env.ts` 会把 `TYPESAFE_API_KEY` 计入 AI provider 检测；没有其它 AI key 时，不会再误报“未配置任何 AI provider”。这只是启动提示，不会在启动日志中输出密钥。

## 后端调用

适配器位于 [`src/services/typesafe.service.ts`](../src/services/typesafe.service.ts)，入口是：

```ts
askJevChoices(state, {
  category: {
    instructions: '选择最符合原文的类别；不能从原文没有的内容推断。',
    options: {
      feeding: '奶粉、辅食或喂养用品',
      supplies: '尿布或日用品',
      unknown: '其它或无法判断',
    },
  },
});
```

适配器固定做以下边界处理：

1. 本地校验输入，限制问题数、选项数和请求体大小。
2. 禁止 HTTP 重定向，设置 12 秒超时。
3. 用 Zod 校验供应商响应，确认问题 ID、Choice 值、概率范围和概率总和。
4. 不记录或透传供应商错误正文，避免上游回显用户输入或凭据。
5. 只返回决策结果，不向 Jev 暴露数据库写入、分享、消息发送或权限能力。

Jev 的概率只用于提示“需要复核”，不能直接当作业务阈值，也不能让模型决定金额、日期、计数、曲线百分位、疫苗程序或医学结论。

## 工具侧接入约束

每个工具先由代码提取候选值，再让 Jev 在闭集候选中选择。程序负责原文复制、单位/日期校验、计算和组装草稿，用户逐项确认后才进入正式保存接口。

- 图片先走独立 OCR，语音先走 ASR，之后才把文本候选交给 Jev。
- 记账金额、报告数值、日期和计数不能由模型创造；没有候选时保留“未说明”，回普通表单。
- 周记、交接单、海报和纪念卡使用固定模板加真实数据，不让 Jev 生成长文或新增事实。
- 起名工具使用已审核的静态名字库；Jev 只做候选分类/筛选，不生成新名字、出处或寓意。
- 任何超时、429、529、响应解析失败或低置信结果都回退到手工录入，并保留原文。

当前适配器挂在工具回顾、起名评测和记账候选接口。微信端通过 `VITE_TOOL_AI_ENABLED` 控制工具 AI 入口；2026-09-22 生产构建已开启，记账后端于 2026-09-23 部署，微信包尚未上传。回顾链路只发送用户主动选择的日期、数字和文字，不发送产检原图或儿童照片。正式开放前，必须完成主体/服务资质、隐私政策、供应商数据处理条件、保存期限、删除流程和小程序审核核验。

## 本地验证

协议单测不需要网络：

```bash
npm test -- --runInBand tests/typesafe.test.ts
npm run build
npm run lint -- --quiet
```

使用本机 `.env` 的合成中文冒烟（不会读取数据库或写入业务数据）：

```bash
npm run ops:smoke:typesafe
```

脚本覆盖普通支出、金额更正、退款、无关文本和“仅计划未付款”五类输入。输出只包含样例 ID、模型版本、耗时、选择结果和 token 用量，不打印 API key 或上游错误正文。

## 升级与回滚

升级模型时先把 `TYPESAFE_MODEL` 指向固定版本，在脱敏样本集上比较类别、金额候选、日期候选和拒答/回退率，再发布到灰度环境。出现供应商异常时，将工具能力开关关闭即可，用户仍可读取历史记录和使用普通表单；不要把 `jev-latest` 直接用于需要稳定复核阈值的生产链路。
