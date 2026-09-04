# 代码开发验证清单契约

`development-validation-checklist.json` 是唯一规范数据源；Markdown 必须由它渲染。契约版本为 `1.2`，模式固定为 `development-validation-planning`。

## 顶层结构

```json
{
  "checklistVersion": "1.2",
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
  "gate": {
    "status": "requires_resolution",
    "findingRefs": ["DOC-001"],
    "reason": "两条同作用域规范事实互斥，使用前必须先裁决"
  },
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

`gate` 是事实级门禁：

- `usable`：该事实可被普通验证项直接消费；`findingRefs` 必须为空。
- `requires_resolution`：该事实存在未决冲突、歧义、待审状态，或关联了阻断性审查 finding；普通验证项在消费前必须先裁决。
- `findingRefs` 只列真正导致该事实受限的 `DOC-*`：包括形成 `conflicting/ambiguous/pending_review` 状态的关联 finding，以及其他阻断性 finding。不得把报告中的不相关问题扩散到此事实。
- `reason` 说明为何可用或为何待裁决。审查报告来源完整性失败或技术正确性无法评分时，受影响事实也必须为 `requires_resolution`，即使没有可填写的 finding。

其他阻断性 finding 包括：已确认的 `Blocker`、影响接入且为 `confirmed/likely High` 的问题，以及缺少同版本独立证据的外部核心技术主张。其余 Medium/Low/编辑性问题仍保留在引用链中；除非它明确形成该事实的冲突、歧义或待审状态，否则不自动阻塞事实。

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
  "developerPrompt": "帮我创建一个 HarmonyOS Demo，先全局开启沉浸光感，再切换为关闭，并比较应用默认材质和组件显式材质的表现。",
  "purpose": "normative_resolution",
  "category": "state_transition",
  "factRefs": ["FACT-001", "FACT-002"],
  "resolutionFactRefs": ["FACT-001", "FACT-002"],
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

`developerPrompt` 是发送给被测 Skill 的黑盒评测输入，必须模拟不了解清单内部结构的真实开发者：

- 使用自然语言描述开发、接入、兼容、排障或验证诉求，并能脱离本报告独立理解；
- 可以包含真实开发者会给出的工程路径、组件名称、版本要求、已有症状和验收要求；
- 不得包含 `DEVVAL-*`、`FACT-*`、`DOC-*`、`IL-S*` 等内部 ID；
- 不得提及审查报告、验证清单、finding、事实引用、能力包内部场景或评测标准答案；
- 不得使用“根据上述”“执行该条目”等只有读取本报告才成立的指代；
- 只描述用户目标或已经观察到的症状，不把待验证的冲突结论、失败原因或正确实现直接告诉被测 Skill。

条目中的 `factRefs`、`reviewFindingRefs`、`resolutionFactRefs`、验证步骤、规范预期和证据要求属于评测者依据，不得自动拼接进 `developerPrompt`。一个提示词对应本项要观察的核心开发行为即可，不需要复述全部验证矩阵。

`purpose`：`normative_resolution`、`sdk_conformance`、`integration_validation`、`compatibility_validation`、`nonfunctional_validation`。

`category`：`document_conflict`、`api_availability`、`configuration`、`component_integration`、`state_transition`、`visual_behavior`、`compatibility`、`fallback`、`performance`、`recovery`、`regression`。

`level`：`static`、`sdk`、`build`、`simulator`、`device`。每项必须包含 `static` 和 `build`；API/配置/兼容项还需 `sdk`；组件、状态、视觉、回退、恢复、回归项还需模拟器或真机；性能项必须有真机。

`resolutionFactRefs` 表示本项不是直接依赖这些事实实施能力，而是专门收集证据来裁决它们。它必须是 `factRefs` 的子集，且只能引用 `requires_resolution` 事实。仅 `normative_resolution`、`sdk_conformance`、`compatibility_validation` 可以声明该字段；普通 `integration_validation` 和 `nonfunctional_validation` 不得借此绕过门禁。

`reviewFindingRefs` 必须等于本项全部 `factRefs` 所关联 finding 的并集，防止漏掉问题，也防止把不相关 finding 扩散到本项。

初始 `executionStatus` 只能为 `not_run` 或 `blocked`。`readiness=ready` 时 `blockedBy` 为空且状态为 `not_run`；`readiness=blocked` 时至少有一个阻塞原因且状态为 `blocked`。阻塞原因：`fact_gate`、`target_project`、`sdk`、`device`。

`reviewGate` 仅保留审查报告的整体风险快照，不直接决定每个条目的 readiness。条目逐项计算：

1. 从 `factRefs` 中找出所有 `requires_resolution` 事实；
2. 减去本实验明确声明要裁决的 `resolutionFactRefs`；
3. 如果仍有事实未决，条目必须为 `blocked` 并包含 `fact_gate`；
4. 如果没有未决消费事实，不得因为整体 `reviewGate=blocked` 添加 `fact_gate`。

因此，一个报告可以整体为 `blocked`，但不依赖问题事实的 Popup 基础构建项仍为 `ready`；消费 `disable` 冲突事实的普通接入项为 `blocked`；专门裁决该冲突且把两侧事实都列入 `resolutionFactRefs` 的最小工程实验仍为 `ready`。目标工程项在 `targetProject=null` 时另由 `target_project` 阻塞。

`document_conflict` 项必须是 `normative_resolution` 和 `minimal_project`，引用至少两个 `conflicting` 事实和两个独立原文位置，并在 `resolutionFactRefs` 中包含全部冲突事实。

## 顺序与汇总

`executionOrder` 必须恰好包含每个 `DEVVAL-*` ID 一次；依赖项必须排在消费者之前，且依赖图不得有环。

`summary` 由内容机械对应：`totalFacts`、`developmentFacts`、`checklistItems`、`readyItems`、`blockedItems`。校验器拒绝不一致的计数。

## 文件输出

清单始终生成。默认输出目录是本次执行开始时的当前工作目录；用户明确指定输出目录时使用指定目录：

- `development-validation-checklist.json`
- `development-validation-checklist.md`

不得修改或复制本地源文档，不得创建最小工程或目标工程，也不得把计划项标记为已验证。
重复运行覆盖两份固定清单文件，不得修改同目录中的其他用户文件。
