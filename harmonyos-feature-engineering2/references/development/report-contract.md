# 开发验证汇总报告契约

本报告记录六层检查、实施依据、构建诊断和证据，不代替 Demo 的设备效果报告；后者按验证点和参数变体记录模拟器/真机观察，两份报告独立交付。

最终交付遵循 [最终产物保留规则](delivery-policy.md)：下述快照、基线、构建副本和日志路径仅用于过程校验。交付前将必要来源、原文摘录和错误摘要写进报告，移除已清理附件的链接，保留截图链接；不要求单独保留这些过程文件。

固定文件名与落盘规则：显式以 `--output <报告交付目录>` 指定汇总目录，写入 `development-verification-report.json` 和 `development-verification-report.md`。脚本未指定 `--output` 时写入目标工程 `ohos-feature-engineering/` 仅作兼容默认值；skill 流程不依赖该默认值。

汇总 JSON 根字段为 `collectionVersion: "1.0"`、`mode: "code-development-validation"`、`project`、`reports[]`。每个条目保留 `verificationVersion: "1.0"` 的单目标契约，字段为：`verificationVersion`、`mode`、`input`、`capabilityPackage`、`projectBaseline`、`changes`、`implementation`、`normativeBasis`、`compatibility`、`checks`、`evidence`、`pendingVerifications`、`verdict`。

## 契约要点

- 构建/运行时必须通过 `--criteria` 注入本次判据集；交付报告不保存临时判据文件路径。判据 ID、来源、锚点和哈希由 `capabilityPackage` 与 `normativeBasis` 保留。
- `capabilityPackage`：`criteriaStrategy(fresh)`、`frozenAt`、`criteriaRefs[]`（本次判据 id）、`conflictingCriteriaRefs[]`；包结构由场景契约校验。
- `verdict.matchedCriteriaRefs`：冲突场景由判图/观察匹配的判据 id 驱动状态机（0 条 failed、>1 条 inconclusive、恰 1 条 passed_with_spec_conflict）。
- `implementation.steps[].basis[].type="criteria"` 且必须携带 `criteriaId`；引用本次判据集之外 id 时拒绝。
- `normativeBasis[]`：判据展开——`id/statement/normativeStatus(clear|conflicting)/derivation(fresh)/conflictGroup/usage(direct|conflict_context)`，`sources[]` 含 `snapshotId/anchor/lines/sha256/officialUrl/title/frozenAt`，实现代码 → 判据 → 冻结快照原文 → 官网 URL 全链反查。

## 六层与证据

实施记录新增 `developmentMode` 与 `requirements`，字段和模式规则见 [官网依据开发](official-implementation.md)。`existing` 步骤支持已有代码满足要求。历史记录和报告可继续渲染；新构建要求完整的来源、区段覆盖与对照记录。报告简要展示模式、官网来源和未解决项，完整映射保留在 JSON；程序校验不能证明语义等价。

static/sdk/build/install/runtime/visual；`component_tree/visual_judgment/screenshot` 证据类型与视觉组合规则、导航编排（route-steps.json + expectPage 断言）、判图注入（visual-judgment.json）。

## 合并与展示

可选 `buildInputs[]` 保存本轮构建前的代码与冻结正文副本及全文件哈希。构建失败时新增 `buildDiagnosis`，分类与证据契约见 [构建失败归因](official-implementation.md#构建失败归因)。初次为 unknown，后续通过 `record-build-diagnosis.mjs` 以日志路径和哈希唯一定位并更新条目，不重建、不改判据；官网问题必须 stop_repair，原构建及总结果保持 failed，设备层保持 not_run。旧报告未包含这些字段时继续兼容。

- `render-development-report.mjs` 接受单目标报告或汇总报告，读取输出目录已有的报告再合并。同工程按能力、路线、场景、开发目标、target、module 识别条目；相同条目重跑替换，不同目标保留，不混入其他工程。
- 多选场景逐项调用 `verify-development.mjs --scenario <所选ID>`，分别传入对应判据、实施记录和场景目标，共用工程与输出目录；各场景门禁独立执行。设备效果报告以 `demoId + deviceType + scenarioId` 区分条目，新增场景追加，同组合复测替换，Markdown 锚点包含场景 ID。历史单目标 JSON 可逐份传给渲染脚本合并；已有单目标根结构也可直接读取。
- Markdown 只有一个报告标题和结果总览，再按自然语言开发目标展示详细结论、实施依据、分层检查、变化、待验证项和证据。场景 ID 保留在 JSON 内用于追溯，不用于拆分报告文件。
- `validate-development-report.mjs` 同时支持单目标及汇总 JSON，逐项校验报告与工程归属。

## 截图与证据文件

- 每次验证的原始日志、组件树和截图先写入 `evidence/<运行唯一标识>/`，不同运行不会覆盖同名证据；日志与组件树仅为过程材料，交付前将必要摘要和哈希写进报告后清理。
- 渲染时将截图按内容哈希复制到 `evidence/images/`，在 Markdown 对应目标的证据部分使用 `![说明](<evidence/images/文件名>)` 直接展示。汇总 JSON 的截图证据路径指向这份副本，证据 ID、哈希、采集时间及关联保持不变。
- 查看或分享时一并携带 Markdown、JSON 和报告引用的 `evidence/images/` 截图。非截图证据的执行期路径只作审计记录，不在交付 Markdown 中生成文件链接；已登记截图文件缺失时明确显示“截图文件缺失，无法预览”，不生成虚假图片或损坏的预览链接。
- 截图只提供观察材料，不自动把视觉状态改为通过；视觉结论仍由实际观察或判图证据支持。
