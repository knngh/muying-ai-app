# P8 知识库持续补充计划

更新时间：2026-05-09

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

2026-05-09 更新：

- P2 知识运营已完成生产收口：`ops:knowledge:status` 返回 `status=ok`，`actionItems=[]`，`nextActions=[]`。
- 生产权威覆盖率已达到 `76.05%`，高于 P2 目标 `60%`。
- 翻译失败已清零，翻译缓存 invalid entries 已清零。
- `chinacdc-nutrition` 已达 `15/10 healthy`。
- `mayo-clinic-zh` 仍为 `0/10`，但生产服务器访问 Mayo sitemap 上游返回 `403 Access Denied`，已降级为外部访问阻断，不再作为 P2 阻塞项。
- 下一阶段进入 P3 知识运营：目标是把权威覆盖率推进到 `80%+`，并把权威增强 QA 转化为可运营的推广素材候选池。

5000 QA 任务不是已经完成的“一次性任务”，而是分成两层：

- 旧 5000 QA 数据集：目前是 3346 条可检索的基础问答库，但不是权威增强版。
- 权威知识补充链路：生产 worker 已持续运行，正在把 WHO / CDC / AAP / ACOG / NHS / 国内权威与医疗平台内容同步、发布、向量化和翻译预热。

原始关键问题：

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

2026-05-08 已修复生产同步脚本：`ops:sync:prod` 不再打包同步 `data/`，避免本地旧 `authority-knowledge-cache.json` / 翻译缓存 / QA 快照覆盖生产运行态数据。同步期间曾把生产 authority cache 覆盖成本地旧 229 条；已立即用服务器 MySQL 执行 `AUTHORITY_VECTOR_PUBLISH_ENABLED=false npm run review:authority -- export` 重建快照，恢复后 `chinacdc-nutrition=15/10 healthy`，权威快照当前 `1077` 条。MySQL 中 `published` 全部 + `review` 非 red 理论为 `1810` 条，导出阶段会继续经 `shouldFilterAuthoritySourceUrl` 和 `getAuthorityKnowledgeDropReason` 过滤高风险/低质内容，所以文件条数低于 MySQL 可导出状态行数是当前规则结果。

2026-05-08 最终复测：`SSH_IDENTITY_FILE=/Users/zhugehao/.ssh/id_server npm run ops:knowledge:status` 在服务器 MySQL 路径跑通，daily ops 子命令为 `6/6` 成功，生产状态仍为 `attention`。权威覆盖率 `51.81% < 60%`；`mayo-clinic-zh` 仍因服务器访问 sitemap `403 text/html` 为 `0/10 missing`；`chinacdc-nutrition` 保持 `15/10 healthy`；翻译缓存 `cacheEntries=636`、`invalidCacheEntries=0`、`failureEntries=20`（retryable `15`，blocked `5`），下一步只能做小批量、带 sourceUpdatedAt 校验的失败重试。

2026-05-09 P2 最终收口：生产使用服务器 `.env` / MySQL 路径复跑 `SSH_IDENTITY_FILE=/Users/zhugehao/.ssh/id_server npm run ops:knowledge:status`，返回 `status=ok`，daily ops 子命令失败数为 `0`，`actionItems=[]`，`nextActions=[]`。权威覆盖率已提升到 `76.05%`（`2388` covered，`752` missing），翻译失败为 `0`，invalid translation cache 为 `0`，translation cache entries 为 `628`。`mayo-clinic-zh` 仍因服务器访问 sitemap 上游 `403 Access Denied` 为 `0/10`，但已作为外部访问阻断记录，不再触发 P2 行动项。`chinacdc-nutrition` 保持 `15/10 healthy`。

2026-05-09 P3 起步切片：`ops:knowledge:report` 新增 `promotion.safeQuestionCandidates`，从 `expanded-qa-data-5000.enriched.json` 中生成“推广素材可用问题库”候选。候选规则是：必须有官方权威引用，`red` 风险排除，`green` 标记为 `general_education`，`yellow` 标记为 `care_boundary` 并附带“仅用于科普与就医准备，不作为诊断或治疗建议。”边界说明。`ops:knowledge:status` 也会在摘要里展示该候选池概览。

2026-05-09 P3-2 切片：`promotion.safeQuestionCandidates` 从“直接筛原始问句”升级为“标准化推广选题生成”。原始 QA 如果是病例式、个人经历式或问诊表单式内容，不会直接进入候选；系统只在通过官方引用、风险等级、内容 guard 后，按结构化分类 / topic / 阶段信号生成标准题名，例如“6 个月宝宝添加辅食要注意什么？”“孕中期胎动怎么数？”“宝宝发热什么时候需要就医？”。同时新增 `authorityReferenceMismatch` 排除统计，候选题必须和官方引用主题匹配，避免用不相关权威来源支撑推广题。

2026-05-09 P3-3 切片：新增首访阶段推荐问题入口。后端公开只读接口 `GET /api/v1/ai/knowledge/recommended-questions` 从 `promotion.safeQuestionCandidates` 读取安全候选，支持 `stage` / `limit` 查询，并在缺少 ops report 时回落到保守默认题库；服务层会重新规范化展示阶段，避免原始 `targetStage` 过宽导致“宝宝辅食”等育儿题推给孕期用户。小程序首页已挂载阶段推荐卡片，优先展示接口候选，点击后进入权威知识库搜索对应问题；`yellow` 候选只作为科普与就医准备入口展示边界说明。

2026-05-09 P3-4 切片：阶段归一化已前移到 `ops:knowledge:report` 生成 `promotion.safeQuestionCandidates` 时执行，接口层和报告层共用同一套 `knowledge-promotion-stage` 规则。运营报告里的候选题不再保留原始宽泛 `target_stage`：例如“6 个月宝宝添加辅食要注意什么？”只归到 `6-12-months`，“哺乳期喂养要注意什么？”归到 `postpartum`，“宝宝发热什么时候需要就医？”只归到宝宝阶段，不再混入孕早 / 孕中 / 孕晚阶段。

2026-05-09 P3-5 切片：翻译预热遇到 AI Gateway `usage limit exceeded` / weekly quota 429 时，错误会保留上游响应体中的 `resets at ...` 时间；翻译失败缓存和重试计划会把这类失败阻塞到真实额度重置时间，而不是按默认 1 小时退避反复进入 retryable。当前生产额度重置点是 `2026-05-11T00:00:00+08:00`，在此之前该类失败应作为 quota-limited blocked failure 处理。

2026-05-09 P3-6 切片：翻译预热新增 AI Gateway 周额度全局熔断。只要失败缓存里存在未过期的 `usage limit exceeded` reset 时间，`warmPublishedAuthorityTranslations()` 的常规批量预热会直接返回 `quotaBlocked=true` / `quotaResetAt=...`，本轮不再选择新的文章调用 AI Gateway，避免 authority worker 每 15 分钟继续制造新的 429 失败和日志噪音；指定 `SLUG` 的人工重试仍保留原有显式操作语义。

2026-05-09 P3-7 切片：新增 Modal Direct `zai-org/GLM-5.1-FP8` 作为免费 GLM 任务通道，权威翻译默认优先 `glm_classify`，再回退 `minimax_render` / `kimi_reason`。如果 GLM 首选通道配置为 Modal Direct，旧 MiniMax 周额度 429 熔断不会阻止新的免费 GLM 翻译预热继续推进。

2026-05-09 P3-8 切片：生产直连 Modal Direct 与生产应用 `callTaskModelDetailed("glm_classify")` 均实测通过，路由为 `modal-direct / zai-org/GLM-5.1-FP8`。实测发现该模型会先产生 `reasoning_content`，`max_tokens` 太小时可能返回 HTTP 200 但最终 `message.content` 为空；AI Gateway 已为 Modal Direct 保留至少 `1000` completion token，并把空正文视为失败，避免小任务或翻译预热误判成功。

2026-05-10 P3-9 切片：生产确认 Modal Direct 短问答可用，但批量翻译仍会遇到 `Too many concurrent requests` / timeout。已把翻译失败退避收敛到共享工具：Modal 并发失败按 `2h * attempts`、timeout / empty response 按 `4h * attempts` 保守退避（最长 `12h`），并让报告按新退避时间重新评估旧失败，避免 1 小时后反复把同一批失败推成 retryable。

2026-05-10 P3-10 切片：扩展 `promotion.safeQuestionCandidates` 标准化推广题库，新增孕期用药、孕吐、配方奶喂养、疫苗接种时间、疫苗接种后反应、宝宝便秘、宝宝咳嗽等可运营选题。候选仍必须先通过官方/权威引用、非 red 风险、内容 guard、主题引用对齐和安全输出形态检查；系统优先生成标准题名，避免把病例式、个人化或治疗诉求原问句直接作为推广素材。

2026-05-10 P3-11 切片：`promotion.safeQuestionCandidates` 的持久化候选容量已从通用 `SAMPLE_LIMIT` 中拆出，默认保留最多 `100` 条安全候选，避免运营候选总数已增长但推荐 API 只能读取报告前 20 条样本。普通 coverage / translation / review 样本仍沿用 `SAMPLE_LIMIT`，推广候选可用 `PROMOTION_CANDIDATE_LIMIT` 单独调整。

2026-05-10 P3-12 切片：新增 `ops:ai:health` AI provider 健康探针，默认验证 `glm_classify` 是否能经生产配置调用 `zai-org/GLM-5.1-FP8` 并返回预期短答案，输出 `tmp/ai-provider-health-report.json`。报告只包含 role、provider、model、耗时、短答案和脱敏错误摘要，不输出 API key；可通过 `AI_HEALTH_TIMEOUT_MS` / `AI_HEALTH_TASK_ROLE` / `AI_HEALTH_EXPECTED_ANSWER` 调整探测参数。

2026-05-10 P3-13 切片：`ops:knowledge:daily` 已接入 `ops:ai:health`，每日知识运营报告会在 `remediation.aiProviderHealth` 中展示 GLM 5.1 / Modal Direct 的健康状态、路由、模型和耗时。探针失败不会被误判成日报命令崩溃，而是进入 `nextActions`，让后续查看 `ops:knowledge:status` 时同时看到知识库状态与免费翻译通道可用性。

2026-05-10 P3-14 切片：修正翻译失败日报误报。`retry:authority-translation-failures` 现在会区分 `actionableRetryableFailures` 和因 `source_updated_at_mismatch` / 记录缺失导致的 `staleRetryableFailures`；`ops:knowledge:daily` 只有在存在实际可选择重试的失败时才把 translation cache 标成行动项，避免旧失败记录已不可重试时让生产状态长期停在 `attention`。

2026-05-10 P3-15 切片：`KNOWLEDGE_DAILY_APPLY_FIXES=true npm run ops:knowledge:daily` 现在会对 `retry:authority-translation-failures` 同步启用 `PRUNE_STALE=true`，在受控修复流程中清理因 `source_updated_at_mismatch` / 权威记录缺失导致的陈旧翻译失败缓存，避免旧失败长期堆积但又不可执行。

2026-05-10 P3-16 切片：修正 apply fixes 模式下 `mayo-clinic-zh` 的误报。生产服务器访问 Mayo sitemap 已确认是上游 `403` 外部阻断，非 dry-run 低覆盖源刷新会因 preflight 失败跳过该源；日报现在会把 `mayo-clinic-zh` 的 `preflight_failed` 继续降级为外部阻断，不再重新产生 source coverage 行动项。

2026-05-10 P3-17 切片：权威增强匹配规则已加固，避免用泛化问诊词、孕期阶段词或跨生命周期的单一症状词制造错误引用。生产快照 dry-run 说明，单纯降低 `MIN_SCORE` 只能把覆盖率从 `76.05%` 推到约 `78.3%`，且样本中出现“孕早期胎儿偏小误配梅毒筛查”“儿童咳嗽误配产后漏尿”等不安全命中；加固后本地生产快照 dry-run 为 `75.83%`（`2381/3140`），少量回退用于移除弱匹配。因此 80%+ 目标不能靠降阈值完成，下一步应补新生儿、发育、儿童症状等高缺口主题的更具体权威来源或主题规则。

2026-05-10 P3-18 切片：`ops:knowledge:report` 的 `coverage` 新增 `target80` 摘要，直接输出 P3 80% 目标对应的 `targetCovered`、`additionalCoveredNeeded`，以及缺权威引用 QA 的 topic / category / risk 分布。后续补源或定向匹配规则应优先按该字段定位新生儿、发育、儿童症状等高缺口队列。

2026-05-10 P3-19 切片：覆盖分母继续做质量清理，新增对治疗医院选择、亲子归属判断、成人腰椎/产后乳房美容类错类记录的 dataset guard。生产快照 dry-run 显示过滤数从 `166` 增至 `173`，目标分母从 `3140` 收至 `3133`，覆盖率为 `75.93%`；该切片不靠弱匹配增加引用，只移除不适合进入知识库运营和推广分母的记录。

2026-05-10 P3-20 切片：修正 `ops:knowledge:daily` 与 `ops:knowledge:report` 的覆盖审计文件口径漂移。daily 生成的本轮审计文件会通过 `COVERAGE_AUDIT_FILE` 显式传给 report，同时把 `OUTPUT_FILE` 对齐到 `KNOWLEDGE_REPORT_FILE`，避免日报刚生成新 guard 口径但运营报告仍读取旧 `tmp/authority-coverage-audit.json`。

2026-05-10 P3-21 切片：`ops:knowledge:report` 的 `coverage.target80` 缺口分析已和 dataset guard 对齐，guard 排除的错类 / 越界记录不再进入 topic/category/risk 缺口分布；同时新增只读 `candidateAuthority.byMissingTopic` 摘要，按缺口 topic 展示现有权威文章数量、来源分布和样例标题，用于判断下一步是补源还是细化安全匹配规则。

2026-05-10 P3-22 切片：`coverage.target80.candidateAuthority.byMissingTopic` 继续补充缺口 QA 样例、缺口分类分布和建议动作。若同 topic 已有权威源，标记 `inspect_matching_rules`，优先诊断安全匹配规则；若同 topic 没有权威源，标记 `add_authority_sources`，再进入补源流程。该切片仍只读，不改变权威增强匹配阈值或生产数据。

2026-05-11 P3-23 切片：根据 P3-22 暴露的缺口样例，dataset guard 新增 `personal_treatment_request` 和 `diagnosed_case_followup` 分流，用于排除具体用药/药膏/治疗方案请求，以及已确诊严重疾病后的个人病例追问；普通疫苗反应、宝宝发热、孕期就医边界等仍保留在知识库覆盖目标中。该切片继续按质量收紧分母，不靠降低匹配阈值提升覆盖。

2026-05-11 P3-24 切片：AI provider 健康探针区分“临时上游 5xx 降级”和“配置/认证/答案错误失败”。Modal Direct / GLM 5.1 返回 503 这类上游短暂不可用时，`ops:ai:health` 输出 `status=degraded` 并保留错误摘要，但每日知识状态不再因此进入 `attention`；401、配置缺失、答案不匹配仍保持失败告警。

2026-05-11 P3-25 切片：AI provider 健康探针继续补齐超时降级语义。已配置 provider 的健康探针超时会记录为 `degraded` 并补齐绑定的 provider/model 元数据，避免 Modal Direct 上游慢响应把每日知识状态误报为 attention；生产复测时 Modal Direct 返回 503，daily 仍保持 `status=ok`。

2026-05-11 P3-26 切片：根据 target80 缺口样例继续收紧 dataset guard，新增低信息病例表单、成人产后/妇科个案、胎儿/宝宝 B 超测量估重计算、误食/呼吸困难等急症个案分流，并扩展严重确诊病例追问识别。该切片继续优先清理不适合自动覆盖目标和推广池的记录，不靠放宽权威匹配提升覆盖。

2026-05-11 P3-27 切片：补窄版疫苗反应权威匹配规则。`预防针`、`百白破/白百破`、`打完针后红肿/低烧/小红疙瘩` 等婴幼儿接种后问题，在 QA 和候选权威同为 `vaccination` topic 且阶段不冲突时，可匹配官方疫苗接种权威资料；该规则不放宽全局阈值，也不把泛化宝宝词单独作为有效匹配。

2026-05-11 P3-27 质量收口：生产 `/tmp` 预览发现接种后反应 QA 会误匹配 ChinaCDC 国家免疫规划方案页。已补回归测试并收紧反应护理意图：候选权威必须包含接种后反应/副作用/发热红肿/护理等信号；`国家免疫规划`、`免疫程序调整`、`贯彻`、`目标和任务`、`政策解读` 等政策/规划页不能单独给疫苗反应 QA 记为覆盖，有护理页竞争时优先护理页。

## 7.1 P3：知识运营与推广联动

目标：在 P2 已完成的基础上，把权威覆盖继续推进到 `80%+`，并让知识库成果直接服务安全推广。

任务：

1. 继续修补 `752` 条缺权威引用的 QA，优先处理高频分类和推广入口会展示的阶段问题。
2. 维持每日 `ops:knowledge:status` 为 `ok`，翻译失败和 invalid cache entries 保持为 `0`。
3. 使用 `promotion.safeQuestionCandidates` 作为推广素材问题池，运营只从官方引用充足、风险边界明确的问题里选题。
4. 对 `yellow` 候选只做科普与就医准备表达，不做诊断、治疗、疗效或承诺式转化文案。
5. `mayo-clinic-zh` 暂不作为刷新任务推进；除非服务器出口访问策略改变，继续把它作为外部阻断源记录。
6. P3-2 已完成标准化推广选题生成：候选题不直接复用病例问句，且必须通过官方引用主题匹配。
7. P3-4 已完成候选池阶段归一化前移：运营报告、推荐 API、小程序首页推荐入口使用一致的阶段语义，避免把育儿题推给孕期用户或把哺乳期题推给宝宝辅食阶段。
8. P3-5 已完成 AI Gateway 周额度 429 退避修正：带 reset 时间的额度失败不会在重置前反复触发翻译重试行动项。
9. P3-6 已完成翻译预热全局额度熔断：额度重置前常规 worker 预热会暂停选新任务，避免继续消耗失败缓存和告警注意力。
10. P3-7 已完成免费 Modal Direct GLM 翻译优先路由：生产可用 `AI_MODAL_DIRECT_KEY` / `AI_GLM_KEY` 指向 `zai-org/GLM-5.1-FP8`，让翻译任务优先走免费通道。
11. P3-8 已完成 Modal Direct 真实可用性验证与网关保护：生产直连和应用网关均能返回正确答案，网关会为该 reasoning 模型保留足够输出预算并拒绝空答案。
12. P3-9 已完成 Modal Direct 翻译失败保守退避：短问答可用性不等于批量翻译容量，worker / daily ops 不应在短退避后反复冲击免费通道。
13. P3-10 已完成安全推广候选题扩展：候选池新增更多高频标准题名，但继续要求官方引用对齐和内容 guard 通过后才可进入运营素材池。
14. P3-11 已完成推广候选池容量拆分：推荐 API 读取的 `candidates` 不再被通用报告样本数截断。
15. P3-12 已完成 AI provider 健康探针：后续可直接跑 `npm run ops:ai:health` 验证 GLM 5.1 / Modal Direct 可用性。
16. P3-13 已完成 AI provider 健康摘要接入每日知识状态：`ops:knowledge:status` 可直接展示 `remediation.aiProviderHealth`，用于判断免费 GLM 通道是否可支撑翻译预热与后续运营任务。
17. P3-14 已完成翻译失败 retryable 误报修正：旧失败缓存如果已和当前权威记录版本不匹配，不再被当成需要人工重试的生产行动项。
18. P3-15 已完成陈旧翻译失败缓存清理接入：daily ops 的 apply fixes 模式会自动修剪不可重试的 stale failure。
19. P3-16 已完成 Mayo preflight 误报修正：apply fixes 模式跳过上游 403 阻断源时仍保持生产状态健康。
20. P3-17 已完成权威增强弱匹配加固：泛化问诊词和阶段词不再单独构成有效匹配，儿童阶段 QA 不会匹配到纯孕产/产后阶段权威文章；80%+ 覆盖推进改走主题补源或更具体规则。
21. P3-18 已完成 80% 覆盖缺口摘要：运营报告可直接查看还差多少条以及缺口 topic/category/risk 分布。
22. P3-19 已完成覆盖分母错类清理：治疗医院选择、亲子归属判断、成人腰椎/产后乳房美容类记录不再进入知识库覆盖目标。
23. P3-20 已完成 daily/report 覆盖审计文件对齐：每日状态会读取同一轮刚生成的 coverage audit。
24. P3-21 已完成 target80 缺口诊断增强：缺口 breakdown 按 guard 后分母统计，并补充缺口 topic 对应的现有权威源候选摘要。
25. P3-22 已完成 target80 缺口行动分流：缺口 topic 会输出 QA 样例、分类分布和 `inspect_matching_rules` / `add_authority_sources` 建议动作。
26. P3-23 已完成治疗诉求和严重确诊病例分流：个人用药/治疗请求与已确诊严重疾病追问不再进入自动覆盖目标。
27. P3-24 已完成 AI health 降级语义：Modal Direct 临时 5xx 不再把每日状态拉成 attention，真实配置/认证/答案错误仍告警。
28. P3-25 已完成 AI health 超时降级语义：已配置 provider 的健康探针超时会记录为 `degraded` 并带上绑定的 provider/model 元数据，避免 Modal Direct 上游慢响应把每日状态误报为 attention。
29. P3-26 已完成 target80 缺口质量清理：低信息病例表单、成人产后/妇科个案、B 超测量估重计算、误食/呼吸困难急症个案和复杂确诊追问不再进入自动覆盖目标。
30. P3-27 已完成窄版疫苗反应权威匹配与政策页误匹配收口：婴幼儿接种后红肿、低烧、皮疹等问题可匹配同 topic 官方护理/副作用资料，但国家免疫规划、免疫程序调整、政策解读等页面不能单独作为反应护理覆盖依据。

默认读取 `tmp/knowledge-ops-report.json` 中 `sourceCoverage.watchedSources` 的 `missing` / `low` 源，先 dry-run 打印将刷新列表；显式 `DRY_RUN=false` 后按源调用现有 `sync:authority` 能力刷新。可用 `AUTHORITY_SOURCE_IDS=mayo-clinic-zh,chinacdc-nutrition` 限定源。

翻译缓存清理默认扫描 `data/authority-translation-cache.json`，输出 `tmp/authority-translation-cache-clean-report.json`；显式 `DRY_RUN=false` 后才删除 prompt leak / 占位符 / 空正文缓存条目，让它们重新进入翻译预热队列。

翻译失败重试默认扫描 `data/authority-translation-failures.json`，输出 `tmp/authority-translation-failure-retry-report.json`；显式 `DRY_RUN=false` 后才重试已到期 failure。可用 `LIMIT=1` 做单条验证，或用 `SLUG=authority-aap-121` 限定目标。

输出文件：

- `tmp/authority-coverage-audit.json`
- `tmp/knowledge-ops-report.json`
- `tmp/knowledge-daily-ops-report.json`
- `tmp/authority-review-summary.json`（生产状态脚本会生成）
- `tmp/authority-translation-failure-retry-report.json`
- `tmp/ai-provider-health-report.json`

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
