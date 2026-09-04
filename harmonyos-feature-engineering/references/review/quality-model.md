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

## 版本兼容性必检链

审查“高版本编译、低版本运行”的示例时，必须分开核对四类事实：

1. `compatibleSdkVersion`：最低安装/运行版本，决定低于哪个版本不能安装或运行。
2. `targetSdkVersion`：目标 API 行为与版本隔离基线，不代表设备实际提供高版本符号。
3. 实际编译 SDK（显式 `compileSdkVersion` 或工具链配套 SDK）：决定编译时能引用哪些 API；不得把运行时判断当成低版本 SDK 的编译保护。
4. `deviceInfo.sdkApiVersion`：实际设备系统 API 版本，只能保护其控制流真正包围的高版本符号访问与调用。

版本关系应核对为 `compatibleSdkVersion ≤ targetSdkVersion ≤ compileSdkVersion`。若 `compileSdkVersion` 未显式配置，记录实际工具链 SDK，不得假定它等于 target 或 compatible。

对 `.newApi(deviceInfo.sdkApiVersion >= N ? value : undefined)` 这类写法，版本判断只选择参数值，`.newApi(...)` 调用仍是无条件组件链的一部分。若 `.newApi` 本身从 N 才提供，应列为高风险候选；只有 SDK 声明、可复现构建或低版本运行证据才能进一步确认其具体失败阶段和行为。正确的兼容结构必须让低版本控制流不访问或调用新 API 本身，而不只是给它传 `undefined`。

## Finding 状态

- `confirmed`：证据链满足确认规则；内部一致性问题还必须证明两个原子命题作用域完全相同且结果互斥。
- `likely`：证据较强但尚未达到确认门槛。
- `ambiguous`：原文存在多种合理解释。
- `version_caveat`：结论依赖版本且范围没有被充分限定。
- `editorial`：主要是表达、结构或编辑问题，不主张技术事实错误。
- `pending`：需要外部页面、SDK、构建或设备验证。

## 严重度与置信度

严重度固定为：`Blocker`、`High`、`Medium`、`Low`、`Suggestion`。

置信度固定为：`certain`、`high`、`medium`、`low`。

严重度衡量问题对接入、运行、安全和理解的影响；置信度衡量当前证据对结论的支持强度。高严重度可以是低置信度，反之亦然。

严重度必须绑定具体失败路径：

- `Blocker` / `High`：照文档实施可导致无法安装、无法构建、启动或运行失败、核心行为错误、安全/数据风险，或指定能力无法接入。
- `Medium`：会产生明显行为偏差、兼容缺口或较高排障成本，但不必然阻断接入。
- `Low`：机制解释或边界不够精确，但按示例实施通常仍能得到可用结果。
- `Suggestion`：格式、措辞或维护体验问题。

不能写出从原文到工程失败的完整路径时，不得仅因“与关联文档措辞不同”给出 High。算力档位、组件类型或处理优先级尚未对齐时，先标记范围差异或待确认，不要把轻微机制表述问题放进关键结论。

## 报告排序

所有 finding 统一保留并展示，不做筛选、隐藏或“关键/次要/提示”分组。JSON 与 Markdown 均按严重度 `Blocker > High > Medium > Low > Suggestion` 排序；同一严重度保持原始顺序。排序只影响呈现顺序，不改变 finding 状态、置信度、评分或 `integrationGate`。

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
