# 质量模型

## 九个评分维度

每个维度按 0–100 评分，权重总和为 100。

| ID | 名称 | 权重 |
|---|---|---:|
| `technical_correctness` | 技术正确性 | 25 |
| `version_compatibility` | 版本兼容性 | 12 |
| `completeness` | 完整性 | 10 |
| `consistency` | 一致性 | 10 |
| `context_clarity` | 上下文清晰与歧义 | 10 |
| `logic_information_architecture` | 行文逻辑与信息架构 | 10 |
| `developer_usability` | 开发者易用性与可复现性 | 15 |
| `links_resources` | 链接资源 | 5 |
| `security_compliance` | 安全合规 | 3 |

如果某维度因证据不足无法评分，`score` 使用 `null`，不要猜测。总分仅在九个维度均可评分时计算为加权平均并四舍五入为整数。

## 开发者易用性必检项

必须逐项检查：

1. 前置条件是否容易发现。
2. 步骤依赖和执行顺序是否明确。
3. 代码是否可复制使用。
4. 是否缺少 import、变量、类型、资源或容器上下文。
5. 是否提供成功判据。
6. 是否提供失败排查路径。
7. 是否提供恢复或回滚路径。

## Finding 状态

- `confirmed`：证据链满足确认规则。
- `likely`：证据较强但尚未达到确认门槛。
- `ambiguous`：原文存在多种合理解释。
- `version_caveat`：结论依赖版本且范围没有被充分限定。
- `editorial`：主要是表达、结构或编辑问题，不主张技术事实错误。
- `pending`：需要外部页面、SDK、构建或设备验证。

## 严重度与置信度

严重度固定为：`Blocker`、`High`、`Medium`、`Low`、`Suggestion`。

置信度固定为：`certain`、`high`、`medium`、`low`。

严重度衡量问题对接入、运行、安全和理解的影响；置信度衡量当前证据对结论的支持强度。高严重度可以是低置信度，反之亦然。

## Verdict

`verdict.label` 固定为：

- `不合格`
- `证据不足`
- `基本合格但需修改`
- `合格但有提示`
- `合格`

## integrationGate

按以下顺序计算，命中即停止：

1. 存在 `confirmed` + `Blocker`，或影响工程接入的 `confirmed` / `likely` + `High`：`blocked`。
2. 核心技术主张缺少版本或独立证据，或技术正确性无法评分：`insufficient_evidence`。
3. 不阻断，但存在 `Medium`、`Low`、`pending`、`ambiguous` 或 `version_caveat`：`pass_with_warnings`。
4. 关键维度证据充分且没有 `Medium` 以上问题：`pass`。

`integrationAffecting` 和 `coreTechnicalClaim` 必须在 finding 中显式记录，以便校验器确定门禁。
