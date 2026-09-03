---
name: harmonyos-feature-engineering
description: 审查 HarmonyOS / 鸿蒙官方开发文档、本地 Markdown 文件或特性资料集的技术正确性、上下文歧义、行文逻辑、示例可执行性和开发者易用性；根据审查后的工程事实生成开发验证清单；或仅使用已发布能力包在指定 HarmonyOS 工程中接入、构建和分层验证系统特性。用户要求检查 developer.huawei.com 文档、规划代码实验，或在目标工程接入和验证沉浸光感时使用。代码开发验证首版只支持 ArkUI 沉浸光感 API 26，不用于第三方文章审稿、普通问答或 HDS API 23 接入。
metadata:
  short-description: 鸿蒙特性文档审查、验证规划与能力包驱动开发
---

# 鸿蒙特性工程

当前版本开放 `document-review`、只读的 `development-validation-planning` 和可修改工程的 `code-development-validation`。三个模式的依据和副作用相互隔离。

## 路由

- 用户要求审查 Markdown/HTML/TXT 单文件、文档目录或 `developer.huawei.com` URL：进入 `document-review`。不接受 `source-manifest.json` 作为用户输入；若它由 URL 快照工具生成，只作为目录内部完整性索引自动使用。
- 用户要求根据文档列出需要写代码验证的场景、最小工程实验、目标工程验证矩阵或验证清单：进入 `development-validation-planning`。若没有同一资料快照的有效审查报告，必须先执行 `document-review`。
- 用户同时要求审查与验证清单：先完成 `document-review`，再以该报告和同一资料快照生成清单。
- 用户提供特性名或 `featureId`、目标 HarmonyOS 工程绝对路径和自然语言开发目标，并要求接入、开发、构建或验证代码：进入 `code-development-validation`。
- 用户同时提供文档和工程接入目标：文档单独进入 `document-review`；代码实施仍只读取已发布能力包，文档不能临时覆盖能力包。
- 用户同时要求审查、清单与接入：先明确三个独立输出；审查报告和清单不作为当前代码运行依据，代码模式单独执行能力包门禁。
- HDS、API 23 或未注册特性接入请求：明确报告当前能力包不支持，不得借用旧 Skill 或模型记忆补齐。

## document-review 工作流

1. 完整阅读 [审查流程](references/review/workflow.md)、[质量模型](references/review/quality-model.md) 和 [证据规则](references/review/evidence-rules.md)。
2. 输入是 URL 时，必须先完整阅读 [URL 快照](references/review/url-snapshot.md)，使用 `scripts/snapshot-url.mjs` 转换成标准 Markdown 资料目录；不要直接跳到语义审查。
3. 按 [输入抽取](references/review/extraction.md) 使用 `scripts/prepare-review.mjs` 审查转换后的目录或原有本地输入。普通目录直接读取第一层受支持文档；URL 快照目录的内部索引由脚本自动识别，用户无需提供或理解该文件。
4. 根据 [文档类型](references/review/document-types.md) 判断页面职责。预检候选项只是线索，不得直接复制为最终 finding。
5. 执行双层审查：
   - 内部质量检查始终执行，包括矛盾、歧义、逻辑、结构、示例完整性和开发者易用性。
   - 对外部技术事实定向取证，默认最多抓取 12 个官方证据页面；不要递归抓取全部链接。
6. 按 [报告契约](references/review/report-contract.md) 先形成规范 JSON，再由 `scripts/render-report.mjs` 渲染 Markdown，并用 `scripts/validate-report.mjs` 校验。
7. 只有用户明确指定输出目录时才持久化快照和报告；否则在系统临时目录完成 URL 快照并在审查后清理。不得改写或复制本地源文档。

## development-validation-planning 工作流

1. 完整阅读 [验证规划流程](references/validation-planning/workflow.md) 和 [验证清单契约](references/validation-planning/checklist-contract.md)。
2. 必须读取同一资料快照的 `review-report.json`，并先用 `scripts/validate-report.mjs` 校验。不得只消费 findings；必须同时读取审查输入中的完整文档。
3. 将文档中的要求、约束、配置、API、示例、预期行为、例外、诊断、上下文和资源逐项登记为工程事实。保留相互冲突的事实，不得提前选边或改写成单一结论。
4. 对每条需要代码开发验证的工程事实至少创建一个验证项。验证项必须明确：最小工程或目标工程、前置条件、实现步骤、负向用例、验证层级、预期结果和应采集证据。
5. 选择验证环境：
   - 最小工程：API 可用性、配置语义、文档冲突裁决、隔离组件行为和版本回退。
   - 目标工程：真实架构接入、现有样式/状态交互、回归、性能和恢复路径。
   - 同时需要时拆成两个有依赖关系的验证项，先最小工程、后目标工程。
6. `integrationGate=blocked` 时仍可生成清单，也可规划用于裁决规范冲突的最小工程实验；其他接入验证项必须标记为被审查门禁阻塞，不得实施。
7. 按 [验证清单契约](references/validation-planning/checklist-contract.md) 先形成规范 JSON，用 `scripts/validate-validation-checklist.mjs` 校验，再由 `scripts/render-validation-checklist.mjs` 渲染 Markdown。
8. 只有用户明确指定输出目录时才生成 `development-validation-checklist.json` 和 `development-validation-checklist.md`；否则只在答复中给出清单，不落盘、不创建工程、不执行验证。

## code-development-validation 工作流

1. 完整阅读 [能力包契约](references/capabilities/package-contract.md) 和 [代码开发验证流程](references/development/workflow.md)。使用 `scripts/validate-capability-package.mjs` 核验锁文件，再用 `scripts/resolve-capability.mjs` 根据特性名和自然语言目标解析唯一场景。
2. 无法唯一匹配时列出候选场景并要求用户选择；在场景唯一前不得修改工程。运行时只读取 `references/capabilities/` 中已发布包，禁止读取 Markdown/URL 输入、审查报告、验证清单或旧 `harmonyos-os-feature-integration`。
3. 对沉浸光感完整阅读能力包 [入口](references/capabilities/immersive-light/entry.md)、[实施规则](references/capabilities/immersive-light/implementation.md)、[验证规则](references/capabilities/immersive-light/validation.md)，以及所选场景引用的最小资产。
4. 使用 `scripts/inspect-development-project.mjs` 扫描绝对工程路径、Stage 模型、module 类型、product、target/compatible API、本机 SDK、目标组件、能力信号和现有未提交修改。首版只接受 ArkUI API 26；应用级 metadata 只能位于 entry module。
5. API、SDK 或 target 低于 26 时停止实施并输出升级要求。修改 SDK、target 或 compile 配置前必须单独获得用户授权；未知值不得猜测为兼容。
6. 确定最小触及文件，用 `scripts/snapshot-project-files.mjs capture` 记录 before SHA-256、组件树、状态、事件和普通样式基线。已有脏文件必须局部合并，不得覆盖用户修改。
7. 按场景规则使用 `apply_patch` 做最小改动。目标工程只保留用户要求的最终状态；default/enable/disable 对照、冲突裁决和配置矩阵只能在系统临时目录的最小工程或副本中进行。
8. 依次运行场景静态规则、SDK 符号核验和 `devecocli build`。构建失败仅对与本次改动有明确位置和证据的问题定向修复，最多两轮；仍失败时停止，保留改动和 diff。
9. 用户要求运行验证时，先用 `devecocli device list` 查询设备。唯一设备可运行；多个设备要求选择；无设备时不创建/下载模拟器。使用 `devecocli run` 安装运行，禁止自动添加 `--uninstall`。
10. 视觉结论必须来自截图、录屏、可复查日志或用户明确观察。没有观察证据时不得标记视觉通过；构建通过不等于视觉成功。
11. 用 `scripts/snapshot-project-files.mjs compare` 生成 before/after 哈希与精确 diff。按 [报告契约](references/development/report-contract.md) 形成 JSON，使用 `scripts/validate-development-report.mjs` 校验，再由 `scripts/render-development-report.mjs` 渲染。
12. 只有用户指定输出目录时才生成 `development-verification-report.json`、`development-verification-report.md` 和 `evidence/`。未指定时在答复中返回结果、分层证据、待验证项和精确改动，不落盘报告。

## 硬性边界

- 本地文件来源不等于官方事实；来源身份与技术正确性必须分开判断。
- 外部技术事实只有获得同版本 API 参考、官方关联页、SDK 声明、官方示例或可复现构建支持时，才可标记 `confirmed`。
- 同一资料集内直接、可定位的自相矛盾可凭两个独立原文位置标记 `confirmed`，但只确认“文档内部冲突”，不确认哪一方技术上正确。
- 模型记忆和第三方内容不能单独支撑 `confirmed`。
- 抓取时间未知必须保持 `null` / `not-recorded`；本地修改时间不能冒充官网抓取时间。
- 静态检查始终执行。仅有明确 SDK 或隔离工程时才构建；编译、模拟器和真机结果必须分别记录。
- 清单中的预期结果只能来自工程事实；SDK、构建、模拟器和真机是验证手段，不得静默覆盖官网规范。实际结果与规范不一致时应记录为规范—实现偏差。
- 清单生成时只能使用 `not_run` 或 `blocked`，不得把计划项写成已经通过或失败。
- 不得把预检正则命中、搜索摘要、页面标题或链接文本当作技术证据。
- 代码开发验证中的官网事实来自能力包且不可由 SDK、构建或设备结果反向篡改；实际结果不一致时记录规范—实现偏差。
- `ready` 只表示能力包可执行，不表示已经真机验证。`disable` 的两条冲突事实必须保留为多预期，不得提前选边。
- 代码模式不得接受文档路径作为工程依据，不得运行时依赖旧 Skill，不得迁入 HDS 事实或旧包的冲突裁决。
- 不得默认修改 SDK/target、下载或创建模拟器、卸载设备应用、回滚用户文件。失败后保留最小改动、before/after 哈希和 diff。
- `devecocli build` 的定向修复最多两轮；设备运行不得使用 `--uninstall`。

## 资源

- `scripts/prepare-review.mjs`：规范化单文件、文档目录或官网 URL，并产生可追溯预检数据。
- `scripts/snapshot-url.mjs`：把官网 URL 转换为带内部完整性索引、哈希和抓取证据的 Markdown 快照目录。
- `scripts/fetch-doc.mjs`：安全抓取官方页面，记录规范 URL、时间、方式和正文哈希。
- `scripts/parse-doc.mjs`：独立解析 Markdown / HTML。
- `scripts/validate-report.mjs`：校验枚举、评分、证据链和门禁映射。
- `scripts/render-report.mjs`：从通过校验的 JSON 生成固定名称的两份报告。
- `scripts/validate-validation-checklist.mjs`：校验事实覆盖、验证层级、依赖顺序和门禁约束。
- `scripts/render-validation-checklist.mjs`：从通过校验的 JSON 生成固定名称的验证清单。
- `references/capabilities/registry.json`：已发布特性、别名、版本和能力包入口。
- `references/capabilities/immersive-light/`：自包含 ArkUI API 26 沉浸光感规范事实、场景、资产和锁文件。
- `scripts/validate-capability-package.mjs`：校验能力包结构、事实覆盖、冲突多预期、文件哈希和路径安全。
- `scripts/resolve-capability.mjs`：把特性名和自然语言目标路由到唯一开发场景。
- `scripts/inspect-development-project.mjs`：扫描工程、SDK、模块、API、目标组件和脏文件并形成兼容门禁。
- `scripts/snapshot-project-files.mjs`：捕获触及文件基线并产生 before/after 哈希和 unified diff。
- `scripts/verify-development.mjs`：编排静态、SDK、构建和可选设备运行层；不会自动修改代码、升级 SDK、创建模拟器或卸载应用。
- `scripts/validate-development-report.mjs`：校验六层状态、证据、总结果和两轮修复上限。
- `scripts/render-development-report.mjs`：生成固定名称的代码开发验证报告。

## 完成标准

- 报告覆盖九个质量维度，并清楚区分严重度和置信度。
- 每个 finding 都有稳定编号、原文位置、被检验主张、证据、影响和修改建议。
- 未获得独立版本化证据的核心技术主张不得误标为 `confirmed`。
- `integrationGate` 与 findings、证据充分性严格一致。
- 指定输出目录时只生成 `review-report.json`、`review-report.md`；URL 证据另存至其 `evidence/` 子目录。
- 验证清单完整登记审查范围内的工程事实，所有标记为需要开发验证的事实都被验证项覆盖，排除内容有明确理由。
- 验证项明确环境与静态、SDK、构建、模拟器、真机层级；视觉行为不得只用编译结果确认。
- 指定输出目录时，验证规划只生成 `development-validation-checklist.json` 和 `development-validation-checklist.md`。
- 代码开发验证只消费已通过锁校验的能力包，且所选场景唯一；首版路线为 ArkUI API 26，HDS 不得混入。
- 工程实施前完成兼容门禁和触及文件基线；已有未提交修改未被覆盖，失败后的变更仍可精确审计。
- 静态、SDK、构建、安装、运行、视觉分别记录；没有设备时完整核心构建的结果只能是 `build_passed_runtime_pending`，不能误报 `passed`。
- 只有全部必需层有通过证据才是 `passed`；冲突场景只匹配一个规范预期时为 `passed_with_spec_conflict`。
- 指定输出目录时只生成固定报告和 `evidence/`；所有构建/设备日志与截图索引带路径和 SHA-256。
