# 报告契约

`review-report.json` 是唯一规范数据源；`review-report.md` 必须由它渲染。契约版本为 `1.0`，模式固定为 `document-review`。

## 顶层字段

```json
{
  "reviewVersion": "1.0",
  "mode": "document-review",
  "input": {},
  "sourceIntegrity": {},
  "verdict": {},
  "integrationGate": "pass_with_warnings",
  "dimensions": [],
  "findings": [],
  "evidence": [],
  "pendingVerifications": []
}
```

这些字段必须全部存在，不允许使用另一套旧报告字段代替。

## input 与 sourceIntegrity

`input` 至少包含：

- `kind`：`file`、`directory` 或 `url`。`source-manifest.json` 不是外部输入类型；URL 快照目录可在内部使用完整性索引。
- `value`：绝对路径或请求 URL。
- `reviewedSources`：本次实际审查的来源数量。

`sourceIntegrity` 至少包含：

- `status`：`verified`、`partial` 或 `failed`。
- `manifestUsed`：布尔值。
- `items`：每个输入快照的路径/URL、SHA-256 与抓取元数据。
- `warnings`：字符串数组。

未知官网抓取时间必须为 JSON `null`，不能用本地文件时间填充。

## verdict 与 dimensions

`verdict` 包含 `label`、`score`、`summary`。`label` 使用质量模型固定枚举；九个维度都可评分时，`score` 是按权重加权并四舍五入的整数，否则为 `null`。

`dimensions` 必须恰好包含九项。每项包含 `id`、`name`、`weight`、`score` 和 `notes`。ID、权重和顺序遵循 [质量模型](quality-model.md)。

## findings

每项至少包含：

```json
{
  "id": "DOC-001",
  "title": "简短标题",
  "dimension": "consistency",
  "status": "confirmed",
  "severity": "High",
  "confidence": "certain",
  "integrationAffecting": true,
  "coreTechnicalClaim": true,
  "claimScope": "internal_consistency",
  "location": {
    "source": "绝对路径或规范 URL",
    "section": "章节",
    "line": 45,
    "quote": "必要的短摘录"
  },
  "claim": "被检验的明确主张",
  "analysis": "为什么构成问题",
  "evidenceRefs": ["EVID-001", "EVID-002"],
  "impact": "对开发者或接入的影响",
  "recommendation": "可执行的修改建议",
  "suggestedRewrite": "可选建议改写"
}
```

`claimScope` 固定为 `internal_consistency`、`external_technical` 或 `editorial`。`suggestedRewrite` 可省略，其余字段不得省略。

状态：`confirmed`、`likely`、`ambiguous`、`version_caveat`、`editorial`、`pending`。

严重度：`Blocker`、`High`、`Medium`、`Low`、`Suggestion`。置信度：`certain`、`high`、`medium`、`low`。

## evidence

每项包含：

- `id`：`EVID-001` 形式的稳定编号。
- `type`：`target`、`internal`、`official_api`、`official_guide`、`sdk`、`build`、`simulator` 或 `device`。
- `source`：绝对路径、规范 URL、SDK 路径或验证环境。
- `locator`：章节、行号、符号或日志定位。
- `claim`：该证据具体支持什么。
- `version`：明确版本；未知时为 `null`。
- `capturedAt`：官网抓取/验证时间；未知时为 `null`。
- `sha256`：正文、文件或日志哈希；未知时为 `null`。

外部技术事实的 `confirmed` 必须引用至少一个外部独立证据。内部冲突的 `confirmed` 必须引用至少两个目标/内部证据。

## pendingVerifications

每项包含 `id`、`claim`、`reason`、`requiredEvidence` 和 `priority`。优先级固定为 `high`、`medium`、`low`。

## integrationGate

门禁必须由 findings 与证据充分性机械映射：`blocked`、`insufficient_evidence`、`pass_with_warnings`、`pass`。映射顺序见 [质量模型](quality-model.md)，校验器会拒绝不一致的值。

## 文件输出

只有用户明确提供输出目录时才落盘。目录中固定生成：

- `review-report.json`
- `review-report.md`
- `evidence/`：仅在 URL 抓取证据需要持久化时创建

本地输入不复制，只在报告中记录绝对路径和 SHA-256。不得修改原始 Markdown。
