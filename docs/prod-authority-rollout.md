# 可信 AI 生产上线指令

## 目标

把当前版本按三模型路由和权威知识库优先模式上线到生产。

包含：

- `GLM 5 + Kimi 2.5 + MiniMax 2.5`
- 小程序社区下线，知识库主入口上线
- 权威来源抓取、审核、发布

## 一、生产环境变量

参考：

- [`.env.example`](/Users/zhugehao/muying-ai-app-main-latest/.env.example)
- [`.env.production`](/Users/zhugehao/muying-ai-app-main-latest/.env.production)

最关键的是这几组：

```env
AI_ROUTING_ENABLED=true
AI_DEFAULT_MODEL=glm-5

AI_GLM_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_GLM_KEY=your-bailian-api-key
AI_GLM_MODEL=glm-5
AI_GLM_PROVIDER=glm

AI_KIMI_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_KIMI_KEY=your-bailian-api-key
AI_KIMI_MODEL=kimi-k2.5
AI_KIMI_PROVIDER=kimi

AI_MINIMAX_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_MINIMAX_KEY=your-bailian-api-key
AI_MINIMAX_MODEL=minimax-2.5
AI_MINIMAX_PROVIDER=minimax
```

## 二、服务器执行顺序

### 1. 拉代码并安装依赖

```bash
git pull origin main
npm install
cd mini-program && npm install && cd ..
```

### 2. 校验与构建

```bash
npx prisma validate
npm run build
cd mini-program && npm run type-check && cd ..
```

### 3. 如 schema 有变更，推送数据库结构

```bash
npm run db:push
```

### 4. 首次同步权威内容

全量单源测试：

```bash
AUTHORITY_SOURCE_ID=who AUTHORITY_SYNC_MODE=incremental npm run sync:authority
```

全量跑全部来源：

```bash
AUTHORITY_SYNC_MODE=incremental npm run sync:authority
```

### 5. 查看审核队列

```bash
AUTHORITY_PUBLISH_STATUS=review AUTHORITY_REVIEW_LIMIT=20 npm run review:authority -- list
```

### 6. 发布审核通过的文档

```bash
AUTHORITY_DOCUMENT_IDS=12,18,23 npm run review:authority -- publish
```

拒绝低质量或不适合上线的文档：

```bash
AUTHORITY_DOCUMENT_IDS=24,25 npm run review:authority -- reject
```

### 7. 重建发布快照

```bash
npm run review:authority -- export
```

### 8. 重启服务

按你的进程管理方式执行，例如：

```bash
pm2 restart all
```

## 三、一条命令跑主流程

仓库已新增脚本：

```bash
bash scripts/prod-authority-rollout.sh
```

常用示例：

只同步并列出审核队列：

```bash
AUTHORITY_SYNC_MODE=incremental bash scripts/prod-authority-rollout.sh
```

同步后直接发布指定文档：

```bash
AUTHORITY_PUBLISH_IDS=12,18,23 bash scripts/prod-authority-rollout.sh
```

需要一起执行 `db push`：

```bash
DB_PUSH=true AUTHORITY_PUBLISH_IDS=12,18,23 bash scripts/prod-authority-rollout.sh
```

## 四、上线后验收

后端：

```bash
curl "https://your-domain/api/v1/articles?contentType=authority&page=1&pageSize=5"
curl "https://your-domain/api/v1/articles/authority-your-slug"
```

小程序：

- 首页第三卡进入知识库，不再进入社区
- 底部 tab 出现“知识库”
- 知识库列表优先展示权威机构来源
- 详情页出现“查看机构原文”
- 社区页打开后显示“暂时下线”

AI：

- `green` 普通知识问题可正常出答
- `yellow` 中风险问题走 `Kimi -> MiniMax`
- `weak retrieval / FAQ` 走 `GLM`
- `red` 高风险问题必须直接止损
