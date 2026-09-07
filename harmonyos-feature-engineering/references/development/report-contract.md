# 代码开发验证报告契约

固定文件名为 `development-verification-report.json` 和 `development-verification-report.md`。报告始终落盘：默认写入本次执行开始时的当前工作目录，用户指定输出目录时使用指定目录。构建日志、设备日志和截图索引放在同目录的 `evidence/`。

重复运行覆盖固定报告和同名内部证据文件，不得删除或覆盖 `evidence/` 中未登记的用户文件。

新报告版本 `verificationVersion=1.1`，兼容读取 1.0；旧报告没有实施信息时不自动补写。JSON 根字段为：`verificationVersion`、`mode`、`input`、`capabilityPackage`、`projectBaseline`、`changes`、`implementation`、`normativeBasis`、`compatibility`、`checks`、`evidence`、`pendingVerifications`、`verdict`。

`input` 只描述能力名、工程绝对路径、开发目标和可选 module/文件/product/build mode/device/navigation/faithfulness，不得包含文档、URL、审查报告或验证清单输入。

`capabilityPackage` 记录能力 ID、版本、锁摘要、场景 ID、技术路线、必需层、事实引用和冲突事实引用。`changes` 对每个触及文件记录状态、before/after SHA-256 和 unified diff；失败也不得删除这些信息。

## 代码实现步骤与依据

忠实性对勘前置门禁：构建或运行验证必须先注入 `faithfulness-judgment.json`（`--faithfulness`）：`schemaVersion`、`scenarioId`、`verdicts[]`（每项 `factId/verdict/basis`），verdict 仅 `faithful/unfaithful/cannot_determine`，必须恰好覆盖所选场景全部 `factRefs`；任一非 `faithful` 或缺失时脚本直接拒绝执行，不生成报告。判定材料来自 `verify-capability-sources.mjs crosscheck`（实时抓取官网 → officialBodySha256 漂移门禁 → anchor 锚点定位 → statement 与现网原文摘录并列）。

实施记录通过 CLI 的 `--implementation <JSON文件>` 或 `runDevelopmentVerification` 的 `options.implementation` 提供，结构如下。记录为执行描述，不能覆盖能力包规范；顺序即实施顺序。

```json
{
  "steps": [{
    "id": "STEP-001",
    "description": "在 entry 模块 metadata 中配置应用级沉浸光感开启。",
    "status": "applied",
    "locations": [{"path": "entry/src/main/module.json5", "version": "after", "lineStart": 10, "lineEnd": 13}],
    "basis": [
      {"type": "capability_fact", "factRefs": ["IL-F002"], "reason": "使用能力包规定的应用级配置键和值。"},
      {"type": "engineering_choice", "reason": "将配置放入现有 metadata 数组以保留工程其他配置。"}
    ]
  }]
}
```

- 步骤 `id` 唯一，`description` 非空；状态为 `applied`（已实施）、`partial`（部分实施）、`not_applied`（未实施）。不得将场景计划复制为已实施记录。
- `locations` 为非空数组，路径使用目标工程内 `/` 分隔的相对路径，行号为从 1 开始的闭区间；`version` 为 `before` 或 `after`，删除内容用 `before`。生成报告时补充位置的 before/after 哈希及 `correlation=matched/unverified`。关联要求区间覆盖实际 diff 的增加或删除行，纯上下文行不计入。
- `basis` 为非空数组，可混合 `capability_fact`、`engineering_choice`、`unresolved`。每项必须有具体 `reason`；仅能力包依据使用非空、不重复的 `factRefs`，引用所选路线内真实存在的事实。引用冲突事实的理由须说明采用的代码方案及待验证行为。
- 不能对应实际改动的 `applied` 步骤降为 `partial`，并在 `issues` 中标注原因；这表示记录未完全得到变更证据支持，不是自动判断代码功能完成。缺少基线时不能确认已实施。
- 报告的 `implementation.recordStatus` 为 `recorded`（有步骤）、`missing`（有改动或基线未知但无步骤）、`not_started`（基线对照没有变化且无步骤），并记录 `baselineAvailable`、`steps` 和 `uncoveredChanges`。变化文件只有被非 `not_applied` 步骤的匹配位置引用才算覆盖；遗漏文件必须列出，不能删除 diff。`recorded` 不表示覆盖完整或验证成功。
- `normativeBasis` 是从已校验能力包自动展开的事实数组，每项记录 `id`、`statement`、`normativeStatus`、`conflictGroup`、`usage` 和 `sources`。仅展开步骤直接引用的事实（`direct`）及其同组冲突事实（`conflict_context`）。每个来源含 `snapshotId`、`locator`、`sha256`、`officialUrl`、`title`、`retrievedAt`、`updatedAt`，未知元数据保持 `null`。

Markdown 在分层检查前展示步骤、位置、选择理由和能力包收录的官网快照依据，代码统一查看已有 diff。来源 URL 缺失时显示“官网链接缺失”；存在冲突时并列披露预期。SDK、构建、设备结果继续在验证证据中展示，不作为规范来源。报告结构校验不替代代码语义及来源引用的人工复核，实施记录完整性不参与总结果门禁。

## 验证结果

六个检查层固定为 `static`、`sdk`、`build`、`install`、`runtime`、`visual`，状态固定为 `passed`、`failed`、`blocked`、`not_run`、`inconclusive`。通过的必需层必须有关联证据；视觉通过必须关联截图、录屏或用户明确观察，或同时关联 `visual_judgment` 判定记录与其依据的 `screenshot`/`component_tree`。

自动判图证据：`component_tree` 保存 `devecocli ui layout --mode full` 的完整组件树，`visual_judgment` 保存模型判定记录（含 status、basis、evidence 引用与 matchedFactRefs）。`visual-judgment.json` 的 `visual.evidence` 必须引用存在的截图或组件树绝对路径；冲突场景由 `verdict.matchedFactRefs` 与冲突事实的交集驱动状态机（0 条 `failed`、多于 1 条 `inconclusive`、恰好 1 条 `passed_with_spec_conflict`）；判图不确定只能 `inconclusive`，且不得用判图结果改写能力包事实。

导航编排：`--navigate <route-steps.json>` 使用冻结步骤序列（schemaVersion、targetDescription、steps[].stepId/action/locator/expectPage）；动作仅限 `launch/tap/swipe/input/wait`，locator 仅限 `text/id/type`。导航在安装之后、截图采集之前执行；带 `expectPage` 的步骤以组件树核验当前页面，失败即停止在该步骤并记录 `stepId + expected + actual`（组件树存为 `component_tree` 证据，各命令存为 `device_log` 证据）；导航失败后跳过截图采集，视觉层保持 `not_run` 并说明失败步骤。路由切换不点返回键，重新推包从首页执行。

总结果：

- `passed`：场景所有必需层均通过。
- `passed_with_spec_conflict`：所有必需层通过，但实际只匹配冲突规范中的一个预期。
- `build_passed_runtime_pending`：静态、SDK、构建通过，必需运行或视觉层尚未执行；无设备属于此类。
- `inconclusive`：运行已执行，但证据不能区分预期，或必需层结果不充分。
- `failed`：已执行的必需层失败，或不匹配任何冲突预期。
- `blocked`：SDK、工程、授权或场景前提使核心验证无法开始。
