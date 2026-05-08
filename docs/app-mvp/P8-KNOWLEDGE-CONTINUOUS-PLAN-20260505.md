# P8 知识库持续补充计划

更新时间：2026-05-05

## 1. 当前后台状态

本次已直接检查生产服务器：

- 生产目录：`/www/wwwroot/muying-ai-app`
- 主 API：`muying-api` online
- 权威知识 worker：`muying-authority-worker` online
- worker 模式：`AUTHORITY_SYNC_MODE=incremental`
- worker 间隔：`AUTHORITY_SYNC_INTERVAL_MINUTES=360`
- 翻译预热：`AUTHORITY_TRANSLATION_SYNC_ENABLED=true`
- 翻译预热间隔：`AUTHORITY_TRANSLATION_WARMUP_INTERVAL_MINUTES=15`

生产数据现状：

- `data/expanded-qa-data-5000.json`
  - 当前实际条数：3346
  - 来源：`cMedQA2数据集`
  - `is_verified=true`：0
  - 最近更新时间：2026-04-30 17:04:09
- `data/expanded-qa-data-5000.enriched.json`
  - 生产不存在
- `data/authority-knowledge-cache.json`
  - 当前条数：1799
  - 当前均标记为已发布 / 可信来源快照
  - 最近更新时间：2026-05-05 21:04:41
- `data/authority-translation-cache.json`
  - 当前缓存约 670 条
  - 最近更新时间：2026-05-05 21:11:11
- `data/authority-translation-failures.json`
  - 当前失败记录约 25 条

## 2. 直接结论

5000 QA 任务不是已经完成的“一次性任务”，而是分成两层：

- 旧 5000 QA 数据集：目前是 3346 条可检索的基础问答库，但不是权威增强版。
- 权威知识补充链路：生产 worker 已持续运行，正在把 WHO / CDC / AAP / ACOG / NHS / 国内权威与医疗平台内容同步、发布、向量化和翻译预热。

当前最关键的问题：

- 线上问答检索对常见 query 仍优先命中 `cMedQA2数据集`。
- 5000 QA 自身没有生成 `enriched` 版本，权威覆盖率审计为 0。
- 权威库已经增长到 1799 条，但尚未反向增强每条 QA 的 `references` / `source_class` / `is_verified` 字段。
- 生产目录 Git commit 仍显示 `d2fdfac`，但目录存在大量同步出来的未跟踪文件；生产不是干净 git 工作区，后续发布要继续使用 `ops:sync:prod` / `ops:deploy:prod` 流程，不要在服务器直接用 git 状态判断版本完整性。

## 3. 本次已补检查能力

新增脚本：

```bash
npm run ops:knowledge:status
```

用途：

- 统计生产 QA / 权威快照 / 翻译缓存数量。
- 查看 `muying-authority-worker` 运行状态。
- 查看最近 worker 日志。
- 查看权威内容 review 队列样本。

如本地 SSH key 未自动命中，可显式指定：

```bash
SSH_IDENTITY_FILE=/Users/zhugehao/.ssh/id_server npm run ops:knowledge:status
```

## 4. 生产 dry-run 审计结果

已执行：

```bash
npm run clean:knowledge-base
npm run audit:authority-coverage
```

结果：

- QA 清洗 dry-run：
  - total：3346
  - kept：3328
  - removed：18
  - 删除原因：
    - `sensational_clickbait`：9
    - `pseudo_medical_gender_selection`：5
    - `high_sensitivity_dataset_topic`：4
- 权威覆盖审计：
  - total：3346
  - authorityCovered：0
  - missingAuthorityCoverage：3346
  - coverageRate：0

缺口最高的分类：

- `pregnancy-early`：1207
- `parenting-0-1`：798
- `common-symptoms`：397
- `pregnancy-mid`：153
- `nutrition-baby`：107

## 5. P0：今天优先收口

目标：先让线上基础问答库不继续暴露明显低质 / 高敏 / 伪医学内容。

已完成：

- 已回写生产 QA 清洗结果。
- 已自动保留备份：
  - `/www/wwwroot/muying-ai-app/data/expanded-qa-data-5000.json.bak-2026-05-05T13-16-00-933Z`
- 已重启 `muying-api`，让 `knowledge.service.ts` 重新载入清洗后的 QA 文件。
- 已在生产服务器执行知识库 smoke：

```bash
RUN_MUTATION_SMOKE=false npm run ops:smoke:knowledge
```

验收结果：

- `expanded-qa-data-5000.json` 从 3346 条收口到 3328 条。
- 删除的 18 条有报告可追溯。
- 知识搜索接口可用。
- 权威 worker 保持 online。
- 知识库列表、详情、翻译 endpoint、标准日程均通过 smoke。

额外发现：

- 翻译 endpoint 对 `authority-who-7` 返回的 `translatedTitle` 混入了模型提示 / 推理残留文本。
- 本地代码已有 `hasTranslationPromptLeak` 生成阶段拦截，但生产缓存里仍存在旧坏缓存。
- 已补生产展示层兜底：扩大 prompt leak 检测，覆盖 `<think>`、`Let me translate`、`Provide complete translations` 等指令/推理残留。
- 已窄同步修复到生产并重启 `muying-api`，没有覆盖生产清洗后的 QA 数据。
- 复测 `authority-who-7` 翻译 endpoint：旧坏缓存被丢弃，返回 `processing`，不再展示污染标题。
- 复跑生产 `RUN_MUTATION_SMOKE=false npm run ops:smoke:knowledge` 已通过。

## 6. P1：持续任务下一步

目标：不再只把权威库作为“旁路文章库”，而是开始反向增强 QA 检索结果。

任务：

1. 增加 QA enrichment 脚本：
   - 输入：`expanded-qa-data-5000.cleaned.json`
   - 输入：`authority-knowledge-cache.json`
   - 输出：`expanded-qa-data-5000.enriched.json`
2. 每条 QA 尝试补齐：
   - `references`
   - `source_class`
   - `source_org`
   - `risk_level_default`
   - `target_stage`
   - `topic`
3. 先按分类做批量增强：
   - `pregnancy-early`
   - `parenting-0-1`
   - `common-symptoms`
4. 让 `knowledge.service.ts` 优先读取 `.enriched.json` 的现有逻辑在生产真正生效。
5. 翻译缓存质量继续治理：
   - 已增加缓存读取阶段的 prompt leak 丢弃逻辑，避免旧缓存继续展示。
   - 已补批量清理脚本，删除包含提示词泄漏 / `<think>` / 任务说明 / 占位符的缓存条目。
   - 清理条目应重新进入预热队列。
6. 增加审计阈值：
   - P1 目标覆盖率：先达到 30%
   - P2 目标覆盖率：达到 60%
   - P3 目标覆盖率：达到 80%+

## 7. P2：权威库持续运营

目标：把 worker 从“能持续跑”提升为“可运营、可观测、可干预”。

2026-05-06 已补 P2 初版运营脚本：

```bash
npm run audit:authority-coverage
npm run ops:knowledge:report
AUTHORITY_PUBLISH_STATUS=review npm run review:authority -- summary
```

2026-05-07 已补低覆盖源干预入口：

```bash
npm run ops:knowledge:daily
KNOWLEDGE_DAILY_APPLY_FIXES=true npm run ops:knowledge:daily
npm run ops:authority:refresh-low-coverage
DRY_RUN=false npm run ops:authority:refresh-low-coverage
npm run clean:authority-translation-cache
DRY_RUN=false npm run clean:authority-translation-cache
npm run retry:authority-translation-failures
DRY_RUN=false npm run retry:authority-translation-failures
```

`ops:knowledge:daily` 会顺序生成覆盖审计、review summary、知识运营报告，并 dry-run 低覆盖源刷新、翻译缓存清理和翻译失败重试计划，最后输出 `tmp/knowledge-daily-ops-report.json`。默认不修改权威源和翻译缓存；显式 `KNOWLEDGE_DAILY_APPLY_FIXES=true` 才会把低覆盖源刷新、翻译缓存清理和翻译失败重试切到非 dry-run。

生产状态入口 `ops:knowledge:status` 会通过 SSH 进入服务器应用目录执行 `ops:knowledge:daily`，DB 依赖项直接使用服务器 `.env` / MySQL 配置，不依赖本地 `localhost:3306`。

2026-05-07 生产验证：`SSH_IDENTITY_FILE=/Users/zhugehao/.ssh/id_server npm run ops:knowledge:status` 已在服务器跑通 `ops:knowledge:daily`，5 个 daily ops 子命令失败数为 0；当前状态为 `attention`，权威覆盖率 51.81%，`mayo-clinic-zh` / `chinacdc-nutrition` 仍为 0/10，翻译缓存 dry-run 发现 47 条 invalid cache entries。

2026-05-07 已补低覆盖源 dry-run discovery probe：`ops:authority:refresh-low-coverage` 默认仍只列计划；显式 `AUTHORITY_SOURCE_DRY_RUN_PROBE_DISCOVERY=true` 时会只做 URL 发现预检并输出 `discoveryProbe.discovered` 和少量 `sampleUrls`，不抓正文、不入库、不改缓存。`ops:knowledge:status` 默认开启该预检，便于区分 source 覆盖低是发现阶段、抓取归一化阶段还是发布统计阶段的问题。

2026-05-07 服务器 discovery probe 实测：`chinacdc-nutrition` 可发现 6 条候选 URL（下一步可做受控非 dry-run 同步）；`mayo-clinic-zh` 服务器侧仍发现 0 条，本地同规则可发现 162 条，需继续定位服务器运行时筛选 / sitemap 解析差异。

2026-05-08 已补低覆盖源 entry 级 discovery 诊断：`ops:authority:refresh-low-coverage` 在 dry-run probe 时会输出每个 sitemap entry 的 HTTP 状态、content-type、`locCount`、嵌套 sitemap 数量、过滤后候选数和样例 URL。`ops:knowledge:daily` 默认开启该只读 probe，并把关键结果提升到 `nextActions`。

2026-05-08 服务器 MySQL 路径复测：`SSH_IDENTITY_FILE=/Users/zhugehao/.ssh/id_server npm run ops:knowledge:status` 跑通，daily ops 子命令失败数仍为 0，状态为 `attention`，覆盖率仍为 51.81%。`mayo-clinic-zh` 三个 sitemap entry 在服务器均返回 `403 text/html`，所以当前不是本地匹配规则导致的 0 发现，而是服务器出口访问 Mayo sitemap 被上游阻断；在解决访问策略前不应对该源执行非 dry-run 刷新。`chinacdc-nutrition` 仍可发现 6 条候选 URL，适合下一步做限定单源、受控非 dry-run 刷新。

2026-05-08 已补非 dry-run 低覆盖源刷新安全门：`ops:authority:refresh-low-coverage` 在真正调用 `syncAuthoritySource` 前默认执行 discovery preflight。只有发现候选 URL 大于 0 的源才会继续刷新；如果 entry 被上游阻断或发现为 0，会在报告中以 `reason=preflight_failed` 跳过，避免把 `mayo-clinic-zh` 这类 403 源和 `chinacdc-nutrition` 一起误刷新。可通过 `AUTHORITY_SOURCE_PREFLIGHT_DISCOVERY=false` 显式关闭，但默认不建议关闭。

2026-05-08 已修复 `chinacdc-nutrition` 发现与归一化规则：新增 ChinaCDC 营养栏目入口 `swyy` / `wlyy`，扩展营养/饮食/体重/微量元素等标题匹配，限制 ChinaCDC 分页只在当前栏目内继续，避免把站点首页导航当成分页；同时补 TRS_Editor 页面标题和正文抽取，避免文章标题被解析成“中国疾病预防控制中心”。生产同步后 dry-run discovery 从 6 条提升到 31 条；限定单源非 dry-run 刷新结果为 `discovered=31` / `fetched=31` / `normalized=13` / `published=13` / `failed=18`，向量发布完成。复测 `ops:knowledge:status` 后 `chinacdc-nutrition` 已从 `7/10 low` 变为 `15/10 healthy`。

2026-05-08 P2 状态：低覆盖源治理完成 `chinacdc-nutrition` 子项，但 P2 全部未完成。生产状态仍为 `attention`，权威覆盖率仍为 `51.81% < 60%`；剩余关键阻塞是 `mayo-clinic-zh` 服务器访问 sitemap 仍为 `403 text/html`，以及翻译缓存 dry-run 仍发现 46 条 invalid cache entries、15 条 translation failures。

2026-05-08 已在生产执行翻译缓存非 dry-run 清理：`DRY_RUN=false npm run clean:authority-translation-cache`，扫描 `673` 条缓存，保留 `623` 条，删除 `50` 条，删除原因均为 `prompt_leak`。复测 `SSH_IDENTITY_FILE=/Users/zhugehao/.ssh/id_server npm run ops:knowledge:status` 后，daily ops 子命令失败数为 `0`，生产状态仍为 `attention`，权威覆盖率仍为 `51.81% < 60%`；翻译缓存 invalid entries 已降为 `0`，但因坏缓存删除后需要重新预热，`missingFreshTranslations=986`，translation failures 为 `19`（retryable `13`，blocked `6`）。`mayo-clinic-zh` 三个 sitemap entry 仍为服务器侧 `403 text/html`。

2026-05-08 已补翻译失败重试入口：`retry:authority-translation-failures` 默认只读 `data/authority-translation-failures.json` 并输出 `tmp/authority-translation-failure-retry-report.json`，列出 retryable / blocked failure；显式 `DRY_RUN=false` 后才按小批量重试，并复用现有 `warmPublishedAuthorityTranslations` 的成功清理和失败退避逻辑。`ops:knowledge:daily` 已接入该入口，生产状态脚本会展示 `remediation.translationFailureRetry`。

默认读取 `tmp/knowledge-ops-report.json` 中 `sourceCoverage.watchedSources` 的 `missing` / `low` 源，先 dry-run 打印将刷新列表；显式 `DRY_RUN=false` 后按源调用现有 `sync:authority` 能力刷新。可用 `AUTHORITY_SOURCE_IDS=mayo-clinic-zh,chinacdc-nutrition` 限定源。

翻译缓存清理默认扫描 `data/authority-translation-cache.json`，输出 `tmp/authority-translation-cache-clean-report.json`；显式 `DRY_RUN=false` 后才删除 prompt leak / 占位符 / 空正文缓存条目，让它们重新进入翻译预热队列。

翻译失败重试默认扫描 `data/authority-translation-failures.json`，输出 `tmp/authority-translation-failure-retry-report.json`；显式 `DRY_RUN=false` 后才重试已到期 failure。可用 `LIMIT=1` 做单条验证，或用 `SLUG=authority-aap-121` 限定目标。

输出文件：

- `tmp/authority-coverage-audit.json`
- `tmp/knowledge-ops-report.json`
- `tmp/knowledge-daily-ops-report.json`
- `tmp/authority-review-summary.json`（生产状态脚本会生成）
- `tmp/authority-translation-failure-retry-report.json`

任务：

1. 每日生成 `authority-coverage-audit.json`。
2. 每日生成翻译缓存命中 / 失败摘要。
3. review 队列按风险分层：
   - red：人工审核
   - yellow：抽样审核
   - green：默认发布
4. 优先修复 source 覆盖低的问题：
   - `mayo-clinic-zh` 当前服务器发现 0，entry 诊断显示 sitemap 入口均为 403，上游访问阻断优先于规则修复。
   - `chinacdc-nutrition` 已完成受控单源刷新并达到健康阈值：当前服务器 `15/10 healthy`。
   - 已补 `ops:knowledge:report` 的 `missing` / `low` / `healthy` 状态与 `minimumPublishedRecords` 阈值。
   - 已补 `ops:authority:refresh-low-coverage`，把低覆盖告警转成可执行的单源刷新动作。
5. 调整用户检索排序（2026-05-06 已完成初版）：
   - 普通 QA 可作为召回补充
   - 权威来源应在医疗/护理类 query 中加权靠前
   - 强症状 query 如果头部结果全是普通数据集，不再短路 AI / 向量权威补充
   - 最终返回前对医疗、护理、孕产、疫苗、喂养、睡眠等意图做权威优先重排

## 8. 当前不做的事

- 不把 5000 QA 直接标记为 verified。
- 不把高风险问答自动发布为权威答案。
- 不直接在生产服务器手工编辑数据文件。
- 不把 review 队列里 red 内容批量发布。
