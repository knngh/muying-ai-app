# 权威数据库全量抓取方案

## 目标

为母婴可信 AI 建立一套可持续运行的权威来源数据库，而不是临时爬虫。

目标结果：

- 只从白名单权威机构同步内容
- 能做首次全量抓取，也能做后续增量同步
- 原始数据、清洗数据、发布数据三层分离
- 进入问答检索链路的内容都带完整可信元数据
- 高风险主题进入人工审核，不允许抓到即上线

## 适用当前仓库的落点

当前仓库已有：

- 答疑编排层：[src/services/trusted-ai.service.ts](/Users/zhugehao/muying-ai-app-main-latest/src/services/trusted-ai.service.ts)
- 知识检索层：[src/services/knowledge.service.ts](/Users/zhugehao/muying-ai-app-main-latest/src/services/knowledge.service.ts)
- 现有导入脚本：[src/scripts/import-knowledge.ts](/Users/zhugehao/muying-ai-app-main-latest/src/scripts/import-knowledge.ts)

建议新增：

- `src/config/authority-sources.ts`
- `src/services/authority-discovery.service.ts`
- `src/services/authority-fetch.service.ts`
- `src/services/authority-normalize.service.ts`
- `src/services/authority-publish.service.ts`
- `src/workers/authority-sync.worker.ts`
- `src/scripts/sync-authority-sources.ts`

## 一、来源白名单

第一版只接入白名单：

- `who.int`
- `cdc.gov`
- `healthychildren.org`（AAP 面向家长内容）
- `acog.org`
- `mayoclinic.org`
- `nhs.uk`
- `nih.gov`
- `fda.gov`
- `nhc.gov.cn`

每个来源只允许配置中的域名被抓取，任何跳转到非白名单域名的页面默认丢弃。

## 二、来源注册表

新增配置表或配置文件，字段至少包括：

```ts
interface AuthoritySourceConfig {
  id: string
  org: string
  baseUrl: string
  allowedDomains: string[]
  discoveryType: 'rss' | 'sitemap' | 'api' | 'index_page' | 'pdf_index'
  entryUrls: string[]
  region: 'US' | 'UK' | 'CN' | 'GLOBAL'
  audience: string[]
  topics: string[]
  enabled: boolean
  fetchIntervalMinutes: number
  maxPagesPerRun: number
  parserId: string
}
```

原则：

- 先配来源，再写适配器
- 不允许自由输入任意网址进入生产同步链

## 三、全量抓取分层

### Layer 1：Discovery 发现层

职责：

- 从 RSS / Sitemap / API / 栏目页找出候选 URL
- 只产生“待抓取 URL 列表”

输出表：

- `authority_discovered_urls`

核心字段：

- `source_id`
- `url`
- `discovered_at`
- `priority`
- `status`

### Layer 2：Fetch 原文层

职责：

- 下载 HTML / PDF / JSON 原文
- 记录 `etag / last_modified / content_hash`
- 做条件请求，避免重复抓取

输出表：

- `authority_raw_documents`

核心字段：

- `source_id`
- `url`
- `http_status`
- `content_type`
- `etag`
- `last_modified`
- `content_hash`
- `fetched_at`
- `raw_body`

### Layer 3：Normalize 清洗层

职责：

- 用站点适配器提取正文、标题、更新时间、摘要
- 统一成可信知识文档结构

输出表：

- `authority_normalized_documents`

核心字段：

- `source_org`
- `source_url`
- `title`
- `updated_at`
- `audience`
- `topic`
- `region`
- `risk_level_default`
- `summary`
- `content_text`
- `metadata_json`

### Layer 4：Publish 发布层

职责：

- 判断是否允许进入线上知识库
- 对高风险内容做人工审核
- 已发布内容才进入检索和向量索引

输出表：

- `authority_published_documents`

核心字段：

- `normalized_document_id`
- `publish_status` (`draft` / `review` / `published` / `rejected`)
- `review_reason`
- `published_at`

## 四、适配器策略

不要做一个万能爬虫。每个机构单独适配器。

建议目录：

- `src/services/authority-adapters/who.adapter.ts`
- `src/services/authority-adapters/cdc.adapter.ts`
- `src/services/authority-adapters/aap.adapter.ts`
- `src/services/authority-adapters/acog.adapter.ts`

每个适配器只做四件事：

1. 判断 URL 是否可处理
2. 提取标题
3. 提取正文
4. 提取 `updated_at / topic / audience`

统一输出：

```ts
interface NormalizedAuthorityDocument {
  sourceOrg: string
  sourceUrl: string
  title: string
  updatedAt?: string
  audience: string
  topic: string
  region: string
  riskLevelDefault: 'green' | 'yellow' | 'red'
  summary: string
  contentText: string
}
```

当前仓库已落地的适配器：

- `WHO`
- `CDC`
- `AAP / HealthyChildren`
- `ACOG`
- `NHS`

## 五、首次全量抓取策略

首次全量抓取不要“抓整个站”，而是按专题和栏目范围做受控全量。

建议顺序：

1. Pregnancy / Prenatal care
2. Newborn care
3. Infant feeding
4. Common symptoms
5. Vaccination
6. Breastfeeding

每个来源在首次全量时限制：

- 时间窗口：近 5 到 8 年
- 页数上限：每个来源 5,000 页以内
- PDF 数量上限：每个来源 300 份以内

原因：

- 真正有价值的是当前仍有效的临床内容
- 全站历史内容大部分对在线答疑没有检索价值

## 六、增量同步策略

全量跑完后切换增量。

增量逻辑：

1. 先跑 `discovery`
2. 比较 URL 是否已存在
3. 对已存在 URL 发条件请求
4. `etag / last_modified / hash` 任一变化才重新清洗
5. 内容无变化则只刷新 `last_seen_at`

建议频率：

- RSS / API：每 2 到 6 小时
- Sitemap：每 12 小时
- Index page：每天 1 次

## 七、最小审核发布流程

当前代码已经支持：

- `sync:authority`
  - 抓取并写入 `authority_discovered_urls / authority_raw_documents / authority_normalized_documents`
- `review:authority`
  - `list`：列出待审核文档
  - `publish <ids...>`：发布指定文档
  - `reject <ids...>`：拒绝指定文档
  - `export`：重建发布快照与向量索引

示例：

```bash
npm run sync:authority
npm run review:authority -- list
npm run review:authority -- publish 12 18 23
AUTHORITY_PUBLISH_STATUS=all npm run review:authority -- list
```
- PDF index：每天 1 次

## 七、发布门槛

以下内容允许自动发布：

- 通识教育类
- 低风险护理类
- 疫苗日程、营养、睡眠、发育里明确的标准信息

以下内容必须人工审核：

- 用药
- 症状判断
- 何时就医
- 出血、宫缩、破水、呼吸困难、抽搐、黄疸、发热等风险主题
- 涉及新生儿危险征象的页面

以下内容直接拒绝：

- 来源域名不匹配
- 无法提取正文
- 更新时间缺失且内容明显陈旧
- 页面正文过短
- 转载页、聚合页、广告页、搜索结果页

## 八、向量化与检索接入

已发布文档才允许进入向量库。

切分后每个 chunk 必带：

- `source_org`
- `source_url`
- `updated_at`
- `audience`
- `topic`
- `risk_level_default`
- `region`
- `authoritative = true`
- `source_type = 'authority'`

这样当前 [src/services/knowledge.service.ts](/Users/zhugehao/muying-ai-app-main-latest/src/services/knowledge.service.ts) 就能直接利用这些字段做可信优先检索。

## 九、调度方案

不要在 Web 进程里跑抓取。

建议：

- `cron` 负责定时触发
- `BullMQ + Redis` 负责任务队列
- `worker` 真正执行同步

任务拆分：

- `authority:discover`
- `authority:fetch`
- `authority:normalize`
- `authority:publish`
- `authority:index`

这样单个站点失败不会拖垮整个同步任务。

## 十、服务器部署方案

最简生产结构：

1. API 服务
- 提供业务接口，不参与抓取

2. Sync Worker
- 负责发现、抓取、清洗、发布

3. Redis
- 任务队列与去重锁

4. MySQL
- 原文、清洗文档、发布状态、审计日志

5. Object Storage（可选）
- 存 PDF、原始 HTML 快照、解析失败样本

## 十一、审计与回溯

每次同步必须留日志：

- `run_id`
- `source_id`
- `discovered_count`
- `fetched_count`
- `normalized_count`
- `published_count`
- `rejected_count`
- `failed_count`

每条线上答案应能回查：

- 用到了哪些 `authority_published_documents`
- 来源版本是什么
- 更新时间是什么

## 十二、建议的迭代顺序

### P0

- 建来源注册表
- 接入 2 个来源：`WHO`、`CDC`
- 打通 `discovery -> fetch -> normalize -> publish`
- 只支持 HTML 页面

### P1

- 接入 `AAP`、`ACOG`、`NHS`
- 增加 PDF 抓取与解析
- 增加审核台

### P2

- 全量接入更多权威来源
- 自动专题分类
- 自动风险默认级别推断
- 与线上检索排序联动

## 十三、对当前项目的直接建议

先不要一上来做“全站全量爬虫”。

第一版只做：

1. `WHO + CDC`
2. 近 5 年
3. 重点专题：孕期、新生儿、发热、腹泻、喂养、疫苗
4. HTML 优先
5. 高风险内容强制人工审核

这样 1 到 2 周内就能做出可信数据库第一版，而不是陷入一个长期不可控的爬虫工程。
