# 开发验证汇总报告契约

固定文件名与落盘规则：所有目标统一写入**目标工程 `ohos-feature-engineering/development-verification-report.json` 和 `development-verification-report.md`**；`--output` 指定汇总目录。

汇总 JSON 根字段为 `collectionVersion: "1.0"`、`mode: "code-development-validation"`、`project`、`reports[]`。每个条目保留 `verificationVersion: "1.0"` 的单目标契约，字段为：`verificationVersion`、`mode`、`input`、`capabilityPackage`、`projectBaseline`、`changes`、`implementation`、`normativeBasis`、`compatibility`、`checks`、`evidence`、`pendingVerifications`、`verdict`。

## 契约要点

- `input.criteria`：本次判据集文件路径（构建/运行必须注入）。
- `capabilityPackage`：`criteriaStrategy(fresh|reuse)`、`frozenAt`、`criteriaRefs[]`（本次判据 id）、`conflictingCriteriaRefs[]`；包结构完整性由 sessions/latest 完整性校验保证。
- `verdict.matchedCriteriaRefs`：冲突场景由判图/观察匹配的判据 id 驱动状态机（0 条 failed、>1 条 inconclusive、恰 1 条 passed_with_spec_conflict）。
- `implementation.steps[].basis[].type="criteria"` 且必须携带 `criteriaId`；引用本次判据集之外 id 时拒绝。
- `normativeBasis[]`：判据展开——`id/statement/normativeStatus(clear|conflicting)/derivation(fresh|reused)/conflictGroup/usage(direct|conflict_context)`，`sources[]` 含 `snapshotId/anchor/lines/sha256/officialUrl/title/frozenAt`，实现代码 → 判据 → 冻结快照原文 → 官网 URL 全链反查。

## 六层与证据

static/sdk/build/install/runtime/visual；`component_tree/visual_judgment/screenshot` 证据类型与视觉组合规则、导航编排（route-steps.json + expectPage 断言）、判图注入（visual-judgment.json）。

## 合并与展示

- `render-development-report.mjs` 接受单目标报告或汇总报告，读取输出目录已有的报告再合并。同工程按能力、路线、场景、开发目标、target、module 识别条目；相同条目重跑替换，不同目标保留，不混入其他工程。
- 多场景 CLI 按顺序执行并使用同一输出目录。历史单目标 JSON 可逐份传给渲染脚本合并；已有单目标根结构也可直接读取。
- Markdown 只有一个报告标题和结果总览，再按自然语言开发目标展示详细结论、实施依据、分层检查、变化、待验证项和证据。场景 ID 保留在 JSON 内用于追溯，不用于拆分报告文件。
- `validate-development-report.mjs` 同时支持单目标及汇总 JSON，逐项校验报告与工程归属。

## 截图与证据文件

- 每次验证的原始日志、组件树和截图写入 `evidence/<运行唯一标识>/`，不同运行不会覆盖同名证据。
- 渲染时将截图按内容哈希复制到 `evidence/images/`，在 Markdown 对应目标的证据部分使用 `![说明](<evidence/images/文件名>)` 直接展示。汇总 JSON 的截图证据路径指向这份副本，证据 ID、哈希、采集时间及关联保持不变。
- 查看或分享时一并携带 Markdown 和 `evidence/`。没有截图时保留实际证据；已登记截图文件缺失时明确显示“截图文件缺失，无法预览”，不生成虚假图片或损坏的预览链接。
- 截图只提供观察材料，不自动把视觉状态改为通过；视觉结论仍由实际观察或判图证据支持。
