# 代码开发验证规划流程

此模式把已审查的官方文档转换成“需要通过写代码验证什么”的清单。它只规划，不创建工程、不修改目标工程、不执行验证，也不把任何计划项标记为通过。

## 输入前提

必须同时具备：

1. 与本次资料快照对应的完整 Markdown 单文件或文档目录；
2. 通过 `scripts/validate-report.mjs` 校验的 `review-report.json`；
3. 用户给出的目标工程路径（可选）。没有目标工程时仍可规划最小工程验证，目标工程项应标记为环境阻塞。

报告只提供问题、证据和门禁，不能代替完整文档。生成清单时必须阅读审查范围内的全部正文、表格、代码和版本声明。

## 1. 建立工程事实台账

按章节依次拆分可独立判断的内容单元，登记为 `engineeringFacts`：

- 要求、限制、适用范围、版本门槛；
- 配置项、API、枚举、默认值、优先级；
- 示例代码展示的调用方法和依赖；
- 预期视觉、交互、状态转换、错误与回退行为；
- 例外、不支持项、性能建议和排障条件；
- 说明上下文和外部资源。

同义重复可以指向同一事实的多个来源位置；条件、版本或作用域不同的内容不得合并。相互冲突的说法必须保留为两个事实，均标记 `conflicting`，并关联对应 `DOC-*` finding。官网文档是规范依据，因此清单中的“预期结果”忠实记录文档说法；在验证前不得判定哪一条是正向真值。

纯导航、版权或重复面包屑等不形成工程事实的内容可排除，但必须写入 `coverage.exclusions`，给出位置、数量和理由。覆盖计数必须闭合。

## 2. 判断是否需要代码开发验证

以下事实通常设为 `developmentValidationRequired=true`：

- API/枚举/配置是否被当前 SDK 接受；
- 示例能否补齐 import、变量、资源后构建；
- 默认值、优先级、开启/关闭、恢复默认等状态语义；
- 组件支持范围、互斥属性、视觉和交互表现；
- 版本兼容、低版本回退、不支持分支；
- 性能约束、失败恢复和目标工程回归；
- 文档冲突需要 SDK 或运行实验裁决。

纯概念背景或外部导航资源可以不要求代码验证，但应说明理由。文档中缺失的信息不能被模型记忆补成工程事实，应保留为待确认事实或关联审查 finding。

## 3. 形成验证项

每条需验证事实至少由一个 `DEVVAL-*` 项覆盖。可合并事实的前提是它们能在同一环境、同一代码路径和同一判据下验证；不要把一个庞大组件矩阵塞进无法定位结果的单项。

每项必须包含：

- 一条可单独发送给被测 Skill 的自然开发者请求 `developerPrompt`；
- `purpose` 与 `category`；
- 被覆盖的 `factRefs`；
- 若实验用于裁决未决事实，明确填写 `resolutionFactRefs`；
- `minimal_project` 或 `target_project` 环境；
- 可发现的前置条件和顺序明确的实现步骤；
- 负向用例；
- 分层验证动作、文档预期结果和要采集的证据；
- 前置项依赖、是否阻断接入、当前就绪状态。

需要“隔离语义 + 真实接入”时拆为两个条目：最小工程项先执行，目标工程项通过 `dependencies` 依赖前者。

`developerPrompt` 用于黑盒验证能力包，不是清单操作说明。模拟开发者不知道 `DEVVAL-*`、`FACT-*`、`DOC-*`、能力包场景 ID、文档 finding 和预期答案。提示词应像真实请求一样只给出目标、工程上下文、组件、版本限制或已观察症状；不得写成“根据某条目验证某结论”，也不得把内部实施步骤和判据全部泄露给被测 Skill。

示例：弹窗接入项可写“帮我创建一个 HarmonyOS Demo，给 Popup、Dialog 和 Toast 接入沉浸光感，每个组件都能单独触发”；低版本项可写“这个工程需要支持 API 25 及以上，请接入沉浸光感，并保证低版本保持原来的界面和交互”。内部事实和预期结果仍留在清单其他字段中。

## 4. 选择验证层级

- `static`：检查 import、符号、变量、资源、配置结构和版本分支。所有项必需。
- `sdk`：在指定 SDK 中定位类型、字段、枚举、签名和 since 信息。API、配置和兼容性项必需。
- `build`：使用明确 SDK 构建最小或目标工程。所有项必需；构建通过只确认可编译性。
- `simulator`：验证可由模拟环境可靠呈现的状态或交互。结果与真机分开记录。
- `device`：验证真实系统行为、视觉材质、设备能力档位、性能和系统设置影响。

组件接入、状态转换、视觉、回退、恢复和回归项至少包含一种运行层验证。性能项必须包含真机层。视觉效果不得仅凭 SDK 符号存在或构建通过确认。

## 5. 应用事实级门禁

`reviewGate` 继续原样记录，用来说明整个审查结果的风险水平，但不再把 `blocked` 自动扩散到全部验证项。按以下顺序逐项判断：

1. 为每个事实计算 `gate.status`。文档内部为 `conflicting`、`ambiguous`、`pending_review`，关联已确认 Blocker、影响接入的 confirmed/likely High，或外部核心技术主张缺少同版本独立证据时，标记为 `requires_resolution`；否则为 `usable`。
2. `gate.findingRefs` 只收录实际导致该事实未决的审查 finding，包括形成冲突、歧义或待审状态的 finding。其他 Medium/Low 或仅编辑性问题继续保留在 `reviewFindingRefs`，但不自动变成门禁。
3. 对每个验证项，从 `factRefs` 的未决事实中减去本项要通过实验裁决的 `resolutionFactRefs`。仍有未决事实时，标记 `blocked/fact_gate`；没有时不得添加 `fact_gate`。
4. `normative_resolution`、`sdk_conformance`、`compatibility_validation` 可以裁决事实；普通接入和非功能验证只能消费事实，不能用 `resolutionFactRefs` 绕过门禁。
5. 文档冲突裁决必须在最小工程中并列保留所有冲突预期。实验结果记录规范—实现关系，不提前改写官网事实。

示例：`disable` 两条互斥描述对应 FACT-001/FACT-002，Popup 支持范围对应独立的 FACT-003。报告即使整体为 `blocked`，Popup 基础构建项只引用 FACT-003 时仍可 `ready`；普通接入项若引用 FACT-001 则为 `blocked/fact_gate`；专门裁决冲突并将 FACT-001/FACT-002 放入 `resolutionFactRefs` 的最小工程实验可 `ready`。

环境门禁独立计算。目标工程项没有明确路径时加入 `target_project`；SDK 或设备前提不满足时分别加入 `sdk`、`device`。多个阻塞原因可以并存。

## 6. 输出与复核

先按 [清单契约](checklist-contract.md) 创建 JSON，再运行：

```text
node scripts/validate-validation-checklist.mjs <development-validation-checklist.json>
node scripts/render-validation-checklist.mjs <development-validation-checklist.json> [output-directory]
```

未提供输出目录时写入本次执行开始时的当前工作目录；显式目录优先。

最后复核：事实覆盖是否闭合、冲突是否保留、每项是否只受其引用事实影响、裁决事实是否明确、依赖是否有环、验证层级是否足够、所有初始状态是否仅为 `not_run` / `blocked`，以及目标工程为空时是否误标为可执行。
