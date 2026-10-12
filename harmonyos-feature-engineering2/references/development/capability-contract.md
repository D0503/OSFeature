# 能力包契约

## 目录结构

```
capabilities/<feature>/
  scenarios.json            # 场景注册契约
capabilities/registry.json  # 能力注册表
```

## scenarios.json

单目标自动匹配由 `resolveScenario` 执行；多目标或用户多选由 `resolveScenarios` 汇总，明确选择的 ID 须属于当前能力包。每个场景独立冻结判据主题覆盖与冲突结论，多个场景可共用 Demo 工程；场景 ID 不分配独立工程。

- `entryPoints[]`：官网入口全集——`snapshotId`（唯一）、`officialUrl`（华为开发者官网 HTTPS）、`title`（必填）。
- `routes[] / safety / verification / projectSignals`：技术路线门槛、安全策略与六层验证策略。
- `routes[].intentPatterns?`：明确命名路线或 Kit 的词。命中时只考虑相应路线及 `crossRoute` 场景；没有显式路线时不得仅凭共用枚举值认定 HDS。
- `scenarios[]`：每个场景 ID 使用 `<能力前缀>-S<三位以上序号>`（如 `IL-S001`、`EP-S001`），并必须包含——
  - `id / displayName / route / intentPatterns / targets`：路由信息；
  - `intentGroups?`：组内全部词命中、组间任意一组成立；单词组表示需要优先识别的专有词。`intentPriority?` 默认 1；2 用于明确专题需求，3 用于故障或跨 Kit 约束。先比较组优先级再比较普通匹配分，同级同分保留歧义。英文标识符按边界匹配，混合中文别名忽略空格。
  - `crossRoute?`：跨 Kit 差异核验场景可绕过显式路线过滤；它不能授权切换用户指定的 Kit，实施须转入已确定路线的目标场景。
  - `sources[]`：该场景需要的官网入口（⊆ entryPoints）；
  - `criteriaSpec.required[]`：判据需求骨架——`topic`（稳定主题名）、`hint`（本次提取的主题提示，非规范事实）、`mustResolve`；
  - `criteriaSpec.conflictProbes[]`：冲突监测点——`id`、`topic`、`positions`；现提时必须逐一给结论；
  - `expectedOutcomeTemplates[]`：运行预期模板（`assertion` + `criteriaTopics`）；
  - `demoValidation?`：Demo 对比实验骨架。`layoutPolicy=single_page_preferred`；`backgroundResource?` 仅在特性确有固定视觉衬底时指定（沉浸光感使用 `app.media.backing`），不能作为所有特性的模板依赖；`scopePolicy` 固定使用提示词强相关选择，并可将版本、设备能力、性能等判据类型保留为前提而排除出组件效果计划；`points[]` 包含稳定编号、标题、`criteriaTopics`、执行方式（`single_page|rebuild_per_variant`）和参数变体。仅为呈现目标效果而必须实现的组件交互、测试数据或页面状态使用 `demoSetupRequirements[]`，固定 `enforcement=implementation_and_static_gate`、`countsAsFeatureValidation=false`，不得要求真机结果或进入报告验证点；只有提示词把交互行为本身作为特性效果时才使用 `interactionRequirements[]` 并逐项回填结果。`defaultEquivalence?` 声明默认变体、显式默认样式变体及 `visual_equivalent` 对照，适用范围见 [Demo 工作流](demo-validation-workflow.md) 的默认等价对照步骤；它只描述需要验证什么及如何控制变量，不是规范事实；报告预期必须从本次冻结判据生成；
  - `implementation / staticRules / negativeCases / requiredChecks`：实施与验证规则；
- **包内不预存任何规范事实正文**；判据在每次开发时从冻结快照现提。

## 设计要点

| 维度 | 机制 |
|---|---|
| 规范事实 | 判据每次现提，每轮从现网重新冻结和提取 |
| 忠实性 | 现提即锚定（anchor 必须命中本次快照） |
| 冲突监测 | 冲突监测点＋persists 时双判据成对标组 |
| 快照 | 本轮临时保存正文与哈希，交付前清理 |
