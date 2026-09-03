# 代码开发验证清单契约

`development-validation-checklist.json` 是唯一规范数据源；Markdown 必须由它渲染。契约版本为 `1.0`，模式固定为 `development-validation-planning`。

## 顶层结构

```json
{
  "checklistVersion": "1.0",
  "mode": "development-validation-planning",
  "input": {},
  "sourceIntegrity": {},
  "reviewGate": "blocked",
  "scope": {},
  "summary": {},
  "coverage": {},
  "engineeringFacts": [],
  "items": [],
  "executionOrder": []
}
```

`input` 包含 `kind`、`value`、`feature`、`reviewReport` 和 `reviewReportSha256`。`reviewReport` 必须是已校验报告的绝对路径；未知哈希不可伪造，使用 `null`，但持久化清单前应计算并填写。

`sourceIntegrity` 复制审查报告的 `status`、`manifestUsed`、`items` 和 `warnings`，不得用重新解释的状态替换。`reviewGate` 必须等于审查报告的 `integrationGate`。

`scope` 包含：

- `description`：本次清单覆盖范围；
- `targetProject`：绝对路径或 `null`；
- `environments`：`minimal_project`、`target_project` 的非空组合；
- `requestedFocus`：用户特别关注的验证场景数组。

## 工程事实

每项结构：

```json
{
  "id": "FACT-001",
  "statement": "文档中的独立工程主张",
  "role": "expected_behavior",
  "consistencyStatus": "conflicting",
  "reviewFindingRefs": ["DOC-001"],
  "sourceRefs": [
    {
      "source": "绝对路径或规范 URL",
      "section": "章节",
      "line": 45,
      "quote": "必要的短摘录",
      "sha256": null
    }
  ],
  "developmentValidationRequired": true,
  "validationRationale": "为什么需要或不需要写代码验证"
}
```

`role`：`requirement`、`constraint`、`configuration`、`api_contract`、`code_example`、`expected_behavior`、`exception`、`diagnostic`、`context`、`resource`。

`consistencyStatus`：`consistent`、`conflicting`、`ambiguous`、`pending_review`。这表示文档内部状态，不代表 SDK 或运行验证结果。

每个需要开发验证的事实必须至少被一个清单项引用。

## 覆盖信息

`coverage` 包含：

- `sourceUnits`：本次范围内拆分出的正文、表格行、列表项和代码块数量；
- `representedSourceUnits`：已进入事实台账的内容单元数量；
- `factsRequiringValidation`：需要开发验证的事实数；
- `factsCoveredByChecklist`：已被清单项覆盖的上述事实数；
- `uncoveredFactRefs`：必须为空；
- `exclusions`：未进入事实台账的内容，每项含 `source`、`locator`、`unitCount`、`reason`。

必须满足 `sourceUnits = representedSourceUnits + exclusions.unitCount 之和`。事实覆盖数由校验器机械计算。

## 验证项

```json
{
  "id": "DEVVAL-001",
  "title": "应用级开启后切换为关闭",
  "purpose": "normative_resolution",
  "category": "state_transition",
  "factRefs": ["FACT-001", "FACT-002"],
  "reviewFindingRefs": ["DOC-001"],
  "environment": "minimal_project",
  "preconditions": ["使用文档目标版本 SDK"],
  "implementationSteps": ["建立可观察的 ENABLE 基线", "切换为 DISABLE 并重新运行"],
  "negativeCases": ["组件级显式开启时重复验证"],
  "verifications": [
    {
      "level": "device",
      "objective": "观察状态切换后的真实行为",
      "procedure": "分别运行配置并记录同一组件画面",
      "expectedResult": "并列记录文档中互相冲突的两个预期，不提前裁决",
      "evidenceToCollect": "配置、设备版本、录屏和运行日志"
    }
  ],
  "dependencies": [],
  "blocking": true,
  "readiness": "ready",
  "blockedBy": [],
  "executionStatus": "not_run"
}
```

`purpose`：`normative_resolution`、`sdk_conformance`、`integration_validation`、`compatibility_validation`、`nonfunctional_validation`。

`category`：`document_conflict`、`api_availability`、`configuration`、`component_integration`、`state_transition`、`visual_behavior`、`compatibility`、`fallback`、`performance`、`recovery`、`regression`。

`level`：`static`、`sdk`、`build`、`simulator`、`device`。每项必须包含 `static` 和 `build`；API/配置/兼容项还需 `sdk`；组件、状态、视觉、回退、恢复、回归项还需模拟器或真机；性能项必须有真机。

初始 `executionStatus` 只能为 `not_run` 或 `blocked`。`readiness=ready` 时 `blockedBy` 为空且状态为 `not_run`；`readiness=blocked` 时至少有一个阻塞原因且状态为 `blocked`。阻塞原因：`review_gate`、`target_project`、`sdk`、`device`、`source_conflict`。

当审查门禁为 `blocked`，只有 `purpose=normative_resolution` 的实验可以保持 ready；其他项必须含 `review_gate`。目标工程项在 `targetProject=null` 时必须含 `target_project`。

`document_conflict` 项必须是 `normative_resolution`，引用至少两个 `conflicting` 事实和两个独立原文位置。

## 顺序与汇总

`executionOrder` 必须恰好包含每个 `DEVVAL-*` ID 一次；依赖项必须排在消费者之前，且依赖图不得有环。

`summary` 由内容机械对应：`totalFacts`、`developmentFacts`、`checklistItems`、`readyItems`、`blockedItems`。校验器拒绝不一致的计数。

## 文件输出

只有用户明确指定输出目录时才生成：

- `development-validation-checklist.json`
- `development-validation-checklist.md`

不得修改或复制本地源文档，不得创建最小工程或目标工程，也不得把计划项标记为已验证。
