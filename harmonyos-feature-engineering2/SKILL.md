---
name: harmonyos-feature-engineering2
description: 资料审阅（document-review）与官网冻结驱动的判据现提式开发（code-development-validation）。能力包只登记场景、官网入口与判据骨架；开发时按“冻结本次官网内容 → 现提判据 → 从判据生成代码 → 构建运行”执行，判据权威来源是每次冻结的官网现网页。当前覆盖沉浸光感、平行视界、互动卡片/服务卡片和闪控窗/闪控球。
metadata:
  short-description: 资料审阅与官网冻结判据现提开发
---

# 鸿蒙特性工程（官网冻结 · 判据现提）

**能力包不预存规范事实**。它只登记场景路由、官网入口映射、判据需求骨架与冲突监测点；每次开发时实时抓取官网、冻结快照、现提判据，代码从判据生成。判据的权威来源始终是本次冻结快照。

两个模式的依据与副作用相互隔离：审阅只产出 findings 与门禁；开发只消费冻结快照与本次判据。

最终交付只保留 **Demo、截图和报告**。开始前读取 [最终产物保留规则](references/development/delivery-policy.md)：快照、判据、基线、日志等仅在临时工作目录使用，报告归纳必要证据后清理；不保存历史基线。

## 路由

- 用户要求审查 Markdown/HTML/TXT 单文件、文档目录或 `developer.huawei.com` URL，或要求审查某次开发冻结的官网快照：进入 `document-review`。
- 用户提供特性名、目标 HarmonyOS 工程绝对路径和自然语言开发目标，要求接入、开发、构建或验证：进入 `code-development-validation`（六步链路）。
- 开发目标先按能力定位：沉浸光感读取 [沉浸光感场景与资料映射](references/development/scenario-routing.md)，平行视界读取 [平行视界场景与资料映射](references/development/easygo-parallel-routing.md)，互动卡片/服务卡片读取 [互动卡片场景与资料映射](references/development/live-form-routing.md)，闪控窗/闪控球读取 [闪控窗场景与资料映射](references/development/float-view-routing.md)。“沉浸光感典型场景：搜索框标题栏具有沉浸光感效果”对应 IL-S013，“内容区标题栏开启沉浸光感”对应 IL-S014；平行视界基础/运行态/增强字段分别按 API 23/24/26 路线核对；互动卡片须先区分场景动效、趣味交互和普通服务卡片；闪控窗须区分单窗、闪控球联动、防窥保护和全链路盯盘，不能把它们自动合并。缺工程路径仍可先定位场景和章节，实施前补齐路径。
- 只询问接口、支持范围、设计建议或两套 Kit 差异时，按场景映射读取相关资料并解释，不创建工程、不执行构建。用户要求多个效果时分别解析目标，不能用单个最高分丢弃其他需求。
- 同一场景内的效果也支持多选和“全部效果”；“最小充分判据”限制每项效果的取证范围，不限制目标数量。用户已明确多个或全部目标时直接规划；需要询问范围时允许一次选择多个，并提供全部选项，不能要求“只选哪个效果”。
- 同时要求多模式输出时先明确独立产物；审查报告不作为开发的直接判据，开发判据只能来自本次冻结快照现提。

## document-review 工作流（资料审阅）

1. 完整阅读 [审查流程](references/review/workflow.md)、[质量模型](references/review/quality-model.md) 和 [证据规则](references/review/evidence-rules.md)。输入是 URL 时先按 [URL 快照](references/review/url-snapshot.md) 用 `scripts/snapshot-url.mjs` 生成资料目录。
2. 输入支持三种形态：本地单文件/目录、官网 URL、**本轮临时冻结快照目录**（`<本轮临时目录>/<featureId>/frozen/snapshots/`，用于现提判据前审阅冲突与歧义）。
3. 按 [输入抽取](references/review/extraction.md) 用 `scripts/prepare-review.mjs` 预检，双层审查（内部质量始终执行；外部技术事实定向取证，默认最多 12 个官方页面）。
4. findings 按严重度排序保留全部；按 [报告契约](references/review/report-contract.md) 形成 JSON，运行 `scripts/render-report.mjs` 自动校验并渲染。独立校验器用于诊断。始终生成 `review-report.json/md`，不得改写源文档。
5. 版本保护写法等自登记工程判断按 [工程验证规则](references/engineering-verification-rules.md) 执行——它们不是官网事实，不得进入能力包或开发判据。

## code-development-validation 工作流（六步链路，程序编排）

**同一 Demo 优先**：能共用工程的验证目标通过参数、状态或页面切换执行；复用、编号与拆分规则统一见下述执行复用文档。

执行前读取 [本轮执行复用](references/development/fast-execution.md)：本轮共用临时官网缓存与已校验判据，官网 URL 去重并发抓取。运行时变体复用构建与安装，构建输入变化时重新构建。

1. **场景解析与多选**：完整阅读 [能力包契约](references/development/capability-contract.md) 与 [报告契约](references/development/report-contract.md)。将用户明确提出的多个目标分别解析，使用 `scripts/lib/capability-tools.mjs` 的 `resolveScenarios` 汇总全部场景；明确选择的多个场景均保留。目标有歧义时展示候选，允许用户一次选择一个或多个场景，不能强制单选或只保留最高分。场景未确定前不修改工程；多场景编排与共用 Demo 规则见 [本轮执行复用](references/development/fast-execution.md#多场景编排)。
2. **冻结快照**：`node scripts/freeze-snapshot.mjs --feature <特性ID> --scenario <ID1,ID2> --work-dir <本轮临时目录> --output <本轮临时目录>/<featureId>/frozen`。同特性所选场景共用本轮快照，官网 URL 去重抓取；任一不可达即阻塞，不得回退历史缓存。
3. **现提判据**：`node scripts/derive-criteria.mjs materials --feature <特性ID> --scenario <ID> --frozen <目录> --output <本轮临时目录>` 生成本轮材料。逐条阅读冻结原文，为每个 required topic 现提至少一条判据，statement 忠实原文、anchor 逐字命中；对每个冲突监测点给出 persists/resolved/changed 结论，persists 时两侧判据成对标注 conflictGroup。`node scripts/derive-criteria.mjs validate --feature <特性ID> --scenario <ID> --frozen <目录> --draft <草稿> --output <本轮临时目录>` 校验锚点、主题覆盖与冲突结论，生成仅含 fresh 判据的 `criteria-<场景ID>.json`。
4. **生成代码**：阅读 [官网依据开发](references/development/official-implementation.md)，按用户意图区分 Demo 与现有工程，使用本次判据和适用的官方示例实施。Demo 还须阅读 [Demo 自动开发、调参与验证](references/development/demo-validation-workflow.md)：优先复用同一工程，验证点仅覆盖目标效果；沉浸光感 Demo 使用 `assets/backing.png` 并执行背景门禁。修改前登记基线与实施计划，修改后校验真实代码、实施记录和判据来源。交付 Demo 前执行纯净源检查。
5. **构建运行与累计报告**：逐场景执行 `node scripts/verify-development.mjs --project <共用工程绝对路径> --scenario <所选ID> --goal <该场景目标> --criteria <该场景本轮判据> --frozen <本轮冻结目录> --baseline <基线文件> --implementation <该场景实施记录> --output <同一报告交付目录> [--execute-build] [--execute-run --device <设备>]`。复用条件满足时共享构建和安装，各场景分别导航、采集与判定。Demo 在特性目录交付两份各自独立的报告：开发验证报告累计各场景六层检查和实施依据；设备效果报告按 Demo、环境、场景和参数变体记录观察。同编号、同环境、同场景复测才替换对应设备效果结果。报告目录显式指定，清理其中非报告、非引用截图的过程文件。
6. **交付与清理**：按最终产物保留规则汇总报告，保留 Demo 和报告引用的截图，清理本次临时过程文件。

## 硬性边界

- 验证支持模拟器与真机。按 [验证环境选择](references/development/validation-environment.md) 结合用户选择、本次判据和设备能力确定环境；选择模拟器时先用 `scripts/list-installed-emulators.mjs` 读取全部已安装实例并展示名称、类型、系统版本和状态，必须等待用户明确选择（即使只有一个候选也不自动选）。模拟器支持且覆盖目标判据时可完成验证，硬件或视觉效果需要真机时单独标注待验证项。模拟器同样执行安装、运行和证据采集，不自动退化为仅构建。

- 审阅的外部技术事实只有同版本官方证据支撑才可 `confirmed`；模型记忆与第三方内容不能单独支撑；抓取时间未知保持 null。
- 自登记工程验证规则（见 [工程验证规则](references/engineering-verification-rules.md)）仅限审阅模式使用。

- 冲突监测点结论为 persists 时必须保留双预期（两条判据同 conflictGroup），验证按 `passed_with_spec_conflict/inconclusive/failed` 状态机裁决，不得提前选边。
- 构建与运行前的判据校验由程序强制；判图结论只能匹配判据预期，不得反向改写判据。
- 构建由脚本直接调用 ohpm 与 Hvigor，同步和打包均使用 `--no-daemon`；不改工程配置，不以 `devecocli build` 替换该执行器。工具链定位与失败处理见 [官网依据开发](references/development/official-implementation.md#构建失败归因)。
- 真机安装运行前检查签名配置：目标工程 `signingConfigs` 缺失或 product 未引用签名配置时，先提示用户配置签名（DevEco Studio 自动签名，或登录华为开发者账号后 `devecocli signature generate`）并等待完成，不得自行生成签名密码材料或直接执行真机构建；用户配置后的签名文件变化登记基线，视为环境前置而非实施改动。Demo 场景详见 [Demo 自动开发、调参与验证](references/development/demo-validation-workflow.md)。
- 构建与运行前还强制执行官网实施依据 applied 门禁，必须提供 `--baseline`、`--implementation` 和本轮临时目录的 `--frozen`。工程选择不能豁免契约，现有工程不做示例结构一致性门禁。来源与覆盖校验不代表语义已正确；AI 对照和实际运行分别验证。
- 构建失败先按 [失败归因](references/development/official-implementation.md#构建失败归因) 只读分析，再决定是否修复。确认官网文档问题时，必须停止修改和重试、保留现场并直接报告证据；不得替换方案、删除功能或改写判据以求编译通过。Demo 和现有工程均适用。只有用户之后明确要求绕过官网问题，才另行处理。
- 实施记录引用不存在的判据 id 时拒绝；报告契约要求 criteriaRefs/conflictingCriteriaRefs/frozenAt。开发汇总报告显式写入交付目录，截图须在 Markdown 中直接展示。

## 资源

- 审阅命令入口见 [审查流程](references/review/workflow.md)，开发实施入口见 [官网依据开发](references/development/official-implementation.md)，Demo 目录、背景素材、实验计划和设备报告入口见 [Demo 工作流](references/development/demo-validation-workflow.md)。
- `capabilities/<featureId>/scenarios.json` 登记各特性的场景、官网入口与实验骨架；按路由读取对应能力包。
- `scripts/lib/capability-tools.mjs` 负责能力包加载、场景解析与契约校验。

## 完成标准

- 最终目录仅包含 Demo、截图与报告；过程文件已清理，报告无临时附件链接。冻结/判据文件只要求在执行期间生成和校验，必要来源摘要保存在报告中。

- 审阅产出覆盖九个质量维度的完整 findings 与 `integrationGate`，可从 `confirmed` 反查证据。
- Demo 分别交付开发验证报告和设备效果报告，均提供 Markdown 与结构化 JSON。
- 开发报告可从代码行反查判据、判据反查冻结快照锚点、快照反查官网 URL 与哈希。
