# 开发验证报告契约（verificationVersion 1.0）

固定文件名与落盘规则：默认写入**目标工程 `ohos-feature-engineering/<场景ID>/`**（与其他链路产物同在单一目录；`--output` 显式优先）。JSON 根字段：`verificationVersion`、`mode`、`input`、`capabilityPackage`、`projectBaseline`、`changes`、`implementation`、`normativeBasis`、`compatibility`、`checks`、`evidence`、`pendingVerifications`、`verdict`。

## 契约要点

- `input.criteria`：本次判据集文件路径（构建/运行必须注入）。
- `capabilityPackage`：`criteriaStrategy(fresh|reuse)`、`frozenAt`、`criteriaRefs[]`（本次判据 id）、`conflictingCriteriaRefs[]`；包结构完整性由 sessions/latest 完整性校验保证。
- `verdict.matchedCriteriaRefs`：冲突场景由判图/观察匹配的判据 id 驱动状态机（0 条 failed、>1 条 inconclusive、恰 1 条 passed_with_spec_conflict）。
- `implementation.steps[].basis[].type="criteria"` 且必须携带 `criteriaId`；引用本次判据集之外 id 时拒绝。
- `normativeBasis[]`：判据展开——`id/statement/normativeStatus(clear|conflicting)/derivation(fresh|reused)/conflictGroup/usage(direct|conflict_context)`，`sources[]` 含 `snapshotId/anchor/lines/sha256/officialUrl/title/frozenAt`，实现代码 → 判据 → 冻结快照原文 → 官网 URL 全链反查。

## 六层与证据

static/sdk/build/install/runtime/visual；`component_tree/visual_judgment/screenshot` 证据类型与视觉组合规则、导航编排（route-steps.json + expectPage 断言）、判图注入（visual-judgment.json）。
