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
   - 后续可补批量清理脚本，删除包含提示词泄漏 / `<think>` / 任务说明的缓存条目。
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

输出文件：

- `tmp/authority-coverage-audit.json`
- `tmp/knowledge-ops-report.json`
- `tmp/authority-review-summary.json`（生产状态脚本会生成）

任务：

1. 每日生成 `authority-coverage-audit.json`。
2. 每日生成翻译缓存命中 / 失败摘要。
3. review 队列按风险分层：
   - red：人工审核
   - yellow：抽样审核
   - green：默认发布
4. 优先修复 source 覆盖低的问题：
   - `mayo-clinic-zh` 当前发现 0
   - `chinacdc-nutrition` 当前发现 0
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
