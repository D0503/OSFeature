# harmonyos-feature-integration —— HarmonyOS OS 新特性接入 Skill

本 Skill 通过注册表路由和标准化能力包，完成鸿蒙系统新特性的识别选型、工程接入、兼容回退、验证与排障。当前注册 6 类能力，包含 13 条接入路线。

当用户要求接入或排查已注册的系统新特性时，按“识别特性 → 验证本机 SDK → 扫描工程 → 兼容性与 SDK 门禁 → 加载能力包 → 方案或实施 → 静态验证 → 构建 → 安装启动 → 目标页导航 → 运行与视觉验证 → 交付报告”的数据流执行，每一步保留文件证据。仅设计方案或诊断问题时，不修改工程。

- 运行环境：Windows / macOS / Linux，Node.js 18+
- 实际接入还需要：可读取的 HarmonyOS Stage 模型工程、本机 HarmonyOS SDK（含可验证的 `sdk-pkg.json`）、可用的签名与设备环境
- 主入口：[SKILL.md](harmonyos-feature-integration/SKILL.md)；特性注册表：[feature-registry.json](harmonyos-feature-integration/references/feature-registry.json)

以下 API 版本以当前能力包为准。版本门槛满足不代表设备、权限、系统开关或外部服务已满足运行条件。

## 实现的功能

### 1. 沉浸光感（immersive-light）

为应用提供沉浸光感系统材质接入。支持两条**可组合**路线：

| 路线 | 版本门槛 | 适用范围 |
|---|---|---|
| `hds` | API 23+（材质能力门槛；HdsNavigation/HdsNavDestination 组件自 API 18、HdsTabs 自 API 20） | UI Design Kit / HDS 标题栏、悬浮导航Tab（HdsTabs）、底部页签等 HDS 组件 |
| `arkui` | API 26+（compile 与 target 均须达到 26） | 原生 ArkUI Navigation/Tabs、普通组件、弹窗、菜单、Toast、交互组件，基于 `uiMaterial`/`systemMaterial` |

能力包括：路线判断与升级接入选项、从原生 `Tabs`/自研悬浮导航迁移到 `HdsTabs` 的代码资产、ArkUI 能力门禁与场景材质工厂，以及材质未生效、组件透明、视觉属性冲突、性能问题的排查。低版本分支保留原组件树、布局与交互；达到路线门槛后的设备能力、系统开关与算力处理遵循能力包专项规则，不因材质不可用自动切回原导航结构。

支持内容区标题或分类栏滚动后由标题栏接替显示的场景入口，按 ArkUI 路线核验 API26 前置条件；普通列表内部 sticky 吸顶不据此触发，也不自动扩大到全工程材质改造。

**边界**：不处理窗口沉浸式、系统栏显隐或安全区布局——"窗口沉浸式"不是"沉浸光感"。

### 2. 平行视界（easygo-parallel）

应用尚未适配原生分栏时，通过 `easy_go.json` 配置在宽屏窗口并排显示两个页面的系统兼容方案。`router` 与 `navigation` 为**互斥**技术路线（导航模式/购物模式为路线内部交互方式）：

- API 23：支持开发者配置（新接入默认 `enableReducedContainerSize=true`）
- API 24：可调用 `UIContext.isEasySplit()` 查询分栏状态
- API 26：增强配置（默认 `drawableRectHook=true`）

接入时自动扫描开屏广告页、启动页、隐私协议页等独立路由页面并加入 `fullScreenPages`；其余配置项（全屏页、购物模式过渡页等）必须与用户逐项确认后写入，不静默使用默认值。

**边界**：不等同于 Navigation 原生双栏、应用多窗口或通用自适应布局；已有原生分栏的目标不叠加两套分栏。

### 3. 智感握姿（smart-reach）

把高频且单手难触达的操作放到易操作区。三条路线**可组合**：

| 路线 | 版本门槛 | 适用目标 |
|---|---|---|
| `native-component` 系统组件原生适配（如 HdsTabs） | 当前实例 API 23 | 提供原生跟手属性的组件 |
| `operating-hand` 操作手感知 | API 15 | 自定义组件随触控操作手变化 |
| `holding-hand` 握持手感知 | API 20 | 自定义悬浮按钮等随握持手变化 |

一个组件只能有一个位置决策者，不自动订阅两种事件竞争位置。低频、非操作类组件以及广告或诱导类按钮不建议接入。

**特殊限制：视觉验证仅限真机**——握持手、操作手和原生跟手都需要真实人手握持与触控，模拟器一律不采集、不导入、不判定。

### 4. 智能体框架服务（agent-framework-kit）

唯一接入路线 `function-component`：通过系统 Function 图标或按钮拉起指定智能体。应用要求 API 20，元服务及 `ICON_ABOVE_TITLE` 要求 API 21；支持 Stage、Phone/Tablet 真机、中国境内（不含港澳台），不支持模拟器。

提供图标/按钮示例、可选可用性查询、初始化参数重建、事件清理、兼容回退及排障。创建 Agent、关联应用、手动签名与测试发布提供开发者操作指引；工程实现不扩展至 A2A、AgentExtensionAbility 或后端。入口详见 [能力包](harmonyos-feature-integration/references/features/agent-framework-kit/README.md)。真机验收要求点击、对话框打开与关闭证据，构建或按钮显示不能证明拉起成功。

### 5. 闪控窗／球（float-view-ball）

支持独立闪控窗、独立闪控球，以及用户明确要求的窗球绑定切换：

| 路线 | 基础版本门槛 | 适用范围 |
|---|---|---|
| `float-view` | API26 | 独立闪控窗：页面加载、模板与尺寸、启动停止、状态和窗口变化监听、用户点击恢复主窗口 |
| `floating-ball` | API20 | 独立闪控球：创建、启动、内容更新、点击恢复与停止清理 |
| `binding` | API26 | 窗球绑定：准备两端、绑定、选择首次展示、停止、双端终态清理与可选解绑 |

绑定只选择 `binding` 路线，内部复用并检查两端能力；同时选择两条独立路线不代表绑定。球的应用内可见性接口需要 API24，销毁监听、文字颜色及动画等可选能力需要 API26，按实际使用接口提高门槛。

`ohos.permission.FLOAT_VIEW` 和 `ohos.permission.USE_FLOAT_BALL` 均为受限 ACL 权限，须按路线[申请 ACL](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)并核对宿主声明及签名 profile。窗还须取得用户授权，球不是运行时用户弹框权限。首次修改工程前与最终交付时均须提醒权限要求。两端仅在应用前台启动，设备和窗口模式按能力包核验；仅闪控球可按文档条件使用模拟器，不推定窗或绑定支持模拟器。

**边界**：普通全局悬浮窗、悬浮按钮和画中画不自动命中。用户明确要求闪控窗防窥时，再加载独立防窥能力并分别核验门禁。详见[闪控窗／球能力包](harmonyos-feature-integration/references/features/float-view-ball/README.md)。

### 6. 防窥保护（dlp-anti-peep）

通过 Device Security Kit 感知窥视状态，按业务需要隐藏金融字段、短视频个性化内容或即时通讯信息，也可覆盖指定窗口。支持两条可组合路线：`status-observation` 状态感知 API20、`system-mask` 系统防窥蒙层 API21；设置弹框和再次风险提示为 API23 可选能力。需要支持防窥保护的 Phone 真机、Stage 模型、人脸识别和系统/应用开关。**防窥保护不支持元服务**，目标为元服务时停止该能力接入，不能仅凭 Stage 或 API 版本认定可用。

接入前确认保护目标、是否需要系统蒙层以及是否需要引导开启防窥的设置弹窗，只补问未明确项。`ohos.permission.DLP_GET_HIDE_STATUS` 是受限 ACL 权限：本地调试在自动签名时同意权限申请，上架使用须向开发者中心[申请 ACL](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)；两种场景均须声明权限并核对签名 profile。实施前与最终交付均须说明这些要求，设置弹窗不能替代 ACL 申请。

能力包包含场景选型、逐项版本门禁、状态未知与异常处理、每次页面进入的蒙层去重、订阅清理及真机验收。普通防截屏或自定义隐私遮罩不自动命中。详见 [防窥保护能力包](harmonyos-feature-integration/references/features/dlp-anti-peep/README.md)。

### 通用能力

- **升级接入**：所选路线及已有、计划新增接口共同确定 `requiredApi`，SDK 与有效 compile 至少达到 `requiredApi`，target 至少达到 `requiredApi` 与已声明 `minTargetApi` 的最大值。任一不足都提供升级选项，由用户确认；已有更高版本不降低，compatible 保持原值。无需新增 `compileSdkVersion`，已有显式配置不足时调整既有值。这是 Skill 的统一接入策略，不等同于接口另有官方 target 硬门槛；写入版本配置前须核对目标 SDK 与配套构建工具支持的类型、格式及映射，不能直接写入 API 等级或自行拼接版本号。
- **用户路线决策**：存在多条可用路线或升级选项（`decisionRequired`）时，必须把可选方式、建议路线和理由一并列给用户确认。
- **源程序回退基线**：按 `fallbackPolicy` 保留接入前组件树或业务路径，以及适用的布局、状态、数据、导航、事件、生命周期和普通样式；不以另一套简化实现替代原功能。
- **验证闭环**：`verify-development.mjs` 按执行参数完成静态与 SDK 检查、ohpm/Hvigor 构建（`--no-daemon`）、安装启动、目标页导航与截图采集。实施代理主动传入具备条件的执行开关，AI 分析失败并修复本次接入问题、读取证据后补录判定；脚本不自动修代码，也不因截图成功判定视觉通过。最终只交付一份 `integration-report.md` 及其引用截图。
- **未注册特性**：如"碰一碰"等未注册能力，只返回注册边界，不生成猜测性实现，也不借用名称相近能力的资料。

## 具体可实现的功能

以下为本 Skill 当前可落地到工程中的能力清单，按已确认的业务目标、组件或页面范围与路线实施。整体接入沉浸光感时，逐实例盘点并记录处理结论，默认开启、无需修改或不适用的组件也说明去向，不以首页截图代替其他页面和浮层证据。

### 沉浸光感

**HDS 路线（API 23+）**：

- HDS 标题栏沉浸材质
- 悬浮导航Tab 接入
- 迁移改造：从原生 `Tabs` 或自研悬浮导航迁移到 `HdsTabs`（含低版本保留原组件分支的迁移规则）

**ArkUI 路线（API 26+，compile 与 target 均须达 26）**：

- 应用级开启：entry 模块 `module.json5` metadata 配置 MaterialState（DEFAULT/ENABLE/DISABLE 整体策略）；
- ArkUI 底部 Tab 沉浸光感接入
- 原生 Navigation 标题栏接入
- 内容区标题或分类栏滚动后切换到标题栏显示，按目标交互接入，不扩展到普通列表内部吸顶
- 弹窗/浮层/按钮/交互等组件接入：Toast、Popup、Tips、Menu、Dialog、Sheet、Button、Select、Toggle、Slider、Chip/ChipGroup、SegmentButton、Text 长按选择菜单（SelectionMenu、copyOption）、CalendarPickerDialog、DatePickerDialog、TextPickerDialog、TimePickerDialog、等组件接入
- 设备能力查询与低算力设备回退

### 平行视界

- 基础分栏接入（API 23+）：`easy_go.json` 配置 `wideWindowMode: routerSplit / navigationSplit`，宽屏窗口左右并排显示两个页面；
- Router 路线接入
- Navigation 路线接入

### 智感握姿

- 系统组件原生跟手接入：如 `HdsTabs` 底部页签原生属性随操作手移动（API 23）；
- 操作手感知接入
- 握持手感知接入
- 原组件位移模式：目标组件本身随有效手别平移（贴边组件屏外绕行、底部宽组件屏内平移）；
- 新增同步跟手组件模式：仅在用户明确选择时，保留原组件不动，在易操作区新增同功能组件（如来电横幅在握持手侧增加接听/挂断按钮组，两组共享业务状态与防重复提交）

### 智能体框架服务

- Function 图标入口与携带 title/queryText 的按钮入口；
- 可选可用性查询、对话框打开/关闭监听、初始化配置重建与兼容回退；
- Agent 创建、应用关联、手动签名及真机测试发布操作指引；

### 闪控窗／球

- 独立窗：`FloatViewController.ets` 封装创建、页面准备、启动、尺寸/模板更新、状态/尺寸/矩形监听、恢复主窗口与停止；
- 独立球：`FloatingBallController.ets` 封装创建、启动、内容更新、点击与状态监听、停止；
- 绑定：`FloatViewBallController.ets` 复用两端基础资产，按 `prepare → bind → start('view' 或 'ball') → stop → 双端 STOPPED → release` 管理生命周期，`unbind` 为可选显式解绑操作；
- 按实际模板限制选择窗口尺寸，复用真实 UIAbilityContext、业务页面与状态，串行调用并处理重复点击和失败清理；
- 用户明确要求窗防窥时，分别加载和验证窗球、防窥能力。

### 防窥保护

- 查询应用防窥开关与窥视状态，订阅和退订状态变化；
- 按金融、短视频、即时通讯等已确认业务规则隐藏、暂停或恢复内容，未知状态与异常保留原业务策略；
- 按用户选择对目标窗口触发系统蒙层，处理每次页面进入的蒙层去重；
- 可选应用内设置弹框与再次风险提示，分别落实 API23 守卫和主动触发条件；
- `AntiPeepUtils.ets` 完整文件需要 API23 编译 SDK，API20/21 工程按实际范围提取所需函数与导入，不能仅凭运行守卫保留新版本符号。

## 实现机制与能力包

Skill 由 AI 编排、机器契约与执行脚本协作：AI 按注册表识别需求、加载资料、修改工程与判读证据；`profile.json` 声明可检查规则；Node.js 脚本扫描工程、评估兼容性、验证源码、构建和采集设备证据。自然语言识别和工程修改由 AI 完成，CLI 接收明确的特性 ID 与路线。

一个能力包位于 `references/features/<特性ID>/`，包含：

| 组成 | 职责 |
|---|---|
| `README.md` | 定位、边界、来源、任务与资料加载入口 |
| `profile.json` | 路线与 API 门槛、模块要求、组合策略、可选能力、回退规则、约束与文档映射 |
| 兼容、实施与回退文档 | 前置条件、改动位置、生命周期、异常处理和原程序保留行为 |
| `assets-catalog.md` 与 `assets/` | 工具类、代码片段、配置样例及使用说明 |
| 验证与排障文档 | 静态、构建、运行、视觉和负向场景，以及现象与根因定位 |
| `routes/`（按需） | 各路线独立的实现、资产与验证资料 |

具体文档可以按能力拆分或合并，以入口和 profile 映射为准。注册表、通用工作流、检查脚本与评测集位于能力包之外；新增能力需要配套检查和回归评测，资料齐备并通过校验后才能注册为 `ready`。

## 目录结构

```text
仓库根目录/
├── harmonyos-feature-integration-README.md  # 本说明
└── harmonyos-feature-integration/
    ├── SKILL.md                           # Skill 主入口
    ├── assets/templates/                  # 接入方案、报告与能力包模板
    ├── evals/                             # 行为评测定义、回归脚本与 fixtures
    ├── references/
    │   ├── feature-registry.json          # 特性注册表
    │   ├── feature-package-contract.md    # 能力包契约
    │   ├── workflows/                     # 发现、门禁、设计、实施、验证、排障
    │   ├── shared/                        # 兼容性、设备、证据与输出契约
    │   └── features/                      # 六个能力包
    │       ├── immersive-light/           # hds / arkui
    │       ├── easygo-parallel/           # router / navigation
    │       ├── smart-reach/               # native-component / operating-hand / holding-hand
    │       ├── agent-framework-kit/       # function-component
    │       ├── float-view-ball/           # float-view / floating-ball / binding
    │       └── dlp-anti-peep/             # status-observation / system-mask
    └── scripts/
        ├── inspect-project.mjs           # SDK 与工程扫描
        ├── check-compatibility.mjs       # 兼容性与升级选项
        ├── verify-integration.mjs        # 实施后静态验证
        ├── verify-development.mjs        # 构建、运行、取证与报告
        ├── validate-structure.mjs        # Skill 结构与注册表校验
        ├── validate-feature-package.mjs  # 能力包契约校验
        └── lib/                          # 专项检查器、构建、导航及报告实现
```

## 工具脚本

以下命令在 `harmonyos-feature-integration` 目录执行：

| 任务 | 命令 |
|---|---|
| 扫描 SDK 与工程 | `node scripts/inspect-project.mjs --project <工程> --sdk <SDK目录>` |
| 判断兼容性与路线 | `node scripts/check-compatibility.mjs --project <工程> --feature <特性ID> --sdk <SDK目录>` |
| 实施后静态检查 | `node scripts/verify-integration.mjs --project <工程> --feature <特性ID> --route <路线ID> --sdk <SDK目录>` |
| 结构校验 | `node scripts/validate-structure.mjs` |
| 能力包校验 | `node scripts/validate-feature-package.mjs --feature <特性ID>` |

SDK 自动定位有效时可省略 `--sdk`；定位失败或清单无效时先明确路径，不仅凭工程 target 版本判断可编译。SDK 根清单只用于版本门禁，具体接口可编译性由源码检查及实际构建确认。

完整工程验证由 AI 按[验证闭环](harmonyos-feature-integration/references/workflows/verification.md)准备真实改造记录和导航计划，并调用：

```text
node scripts/verify-development.mjs --project <工程> --feature <特性ID> --route <路线ID> --goal <目标> --changes <改造记录.json> --sdk <SDK目录> --product <产品> --module <模块> --build-mode debug --execute-build --execute-run --device <设备> --navigate <导航.json> --capture-screenshot --capture-layout
```

`--route` 每次明确一条，组合路线与多个目标依次执行并汇总。`--resume` 仅补录判定、导入或补采截图，不重新构建、安装或导航；修复代码后须重新执行完整验证。截图和运行证据经 AI 实际读取后，通过 `--resume <runId> --judgment <判定.json>` 补录，证据 ID 与 SHA-256 须匹配本轮记录。退出码 0 仅表示没有确定失败，仍可能存在未验证或未确认项。

手动验证先用 `--manual-evidence` 导入安装、导航与运行证据，再按返回的证据 ID 补录判定；逐场景明细放在 `runtime.observations`。报告正文从结构化记录生成，不直接修改正文补结论。低版本回退截图使用 `--import-screenshot <路径> --screenshot-purpose fallback`，随后补录 `fallback` 判定，保留原设备的运行与视觉结论。`--module` 只填模块名，如 `entry`。

最终交付默认位于 `<工程>/os-feature-integration/`，包含一份 `integration-report.md` 及其引用的 `evidence/*.png`；报告覆盖改造汇总、类别或路线与模式、视觉验证结果、升级与兼容。过程日志、组件树与合并状态保存在系统临时目录，不生成额外 JSON 汇总报告。重验更新同一改造项当前结果，保留首次已知的接入前版本。

## Skill 维护

新增特性前完整读取[能力包契约](harmonyos-feature-integration/references/feature-package-contract.md)。先在注册表外完成能力入口、profile、资料、资产、检查器及正负向评测，达到契约要求后再以 `ready` 状态注册。

`evals/` 用于维护 Skill 时的评测和回归测试。以下命令在 `harmonyos-feature-integration` 目录执行：

| 维护任务 | 命令 |
|---|---|
| Skill 结构校验 | `node scripts/validate-structure.mjs` |
| 能力包校验 | `node scripts/validate-feature-package.mjs --feature <特性ID>` |
| 冒烟测试 | `node evals/run-smoke-tests.mjs` |
| 智感握姿专项测试 | `node evals/run-smart-reach-tests.mjs` |
| 平行视界专项测试 | `node evals/run-easygo-tests.mjs` |
| 智能体框架服务专项测试 | `node evals/run-agent-framework-tests.mjs` |
| 工具测试 | `node evals/run-tool-tests.mjs` |
| 验证执行器测试 | `node evals/run-development-tests.mjs` |
| 统一 target 升级策略测试 | `node evals/run-target-upgrade-tests.mjs` |
| 窗球与防窥专项测试 | `node evals/run-window-privacy-tests.mjs` |
| 闪控窗控制器测试 | `node evals/run-float-view-controller-tests.mjs` |
| 闪控球控制器测试 | `node evals/run-floating-ball-controller-tests.mjs` |
| 窗球绑定控制器测试 | `node evals/run-float-view-ball-controller-tests.mjs` |
| 防窥工具资产测试 | `node evals/run-anti-peep-utils-tests.mjs` |
| 手动验证证据测试 | `node evals/run-manual-verification-tests.mjs` |

`evals.json` 是行为评测定义，场景数量和脚本退出成功不能替代目标工程的构建、真机交互与视觉验收。

## 测试人员的测试步骤

### 第一步：环境准备

1. Node.js 18+（`node -v` 确认）。
2. 切换到 `harmonyos-feature-integration` 目录；Skill 工具脚本无需安装额外 npm 依赖，目标工程仍按其 ohpm 依赖构建。
3. 如涉及端到端验证，需准备：HarmonyOS SDK、可构建的 Stage 模型测试工程、签名与目标设备。智感握姿视觉、智能体框架服务和防窥效果必须使用能力包要求的真机；闪控窗和绑定不推定模拟器可用。
4. 智能体框架服务还需真实 Agent、应用关联及有效测试发布或正式发布；窗球与防窥需核对受限 ACL 权限、签名及实际授权，防窥还需支持该能力的 Phone、人脸识别与系统/应用开关，且不支持元服务。

### 第二步：端到端接入验证（需真实工程与设备）

1. **安装 Skill**：将仓库中的 `harmonyos-feature-integration/` 目录复制到测试环境约定的 opencode 技能目录，Windows 为 `C:\Users\<用户名>\.config\opencode\skills\harmonyos-feature-integration`（macOS/Linux 为 `~/.config/opencode/skills/harmonyos-feature-integration/`），确保 `SKILL.md` 位于该目录根；重新打开测试会话加载 Skill。
2. **准备模板工程**：在 DevEco Studio 中使用组件模板创建测试工程（如"快递物流"模板，自带底部 Tab 首页），在 opencode 中打开该工程作为当前工作目录。
3. **逐特性实测示例**：在 opencode 中分别使用以下提示词，验证特性路由、SDK 门禁、路线确认、工程实施与验证闭环：

   | 特性 | 测试工程 | 提示词 |
   |---|---|---|
   | 沉浸光感 | 快递物流模板 | 请使用harmonyos-feature-integration，对当前工程实现底部tab接入沉浸光感 |
   | 沉浸光感 | 已创建的 Stage 测试工程 | 请使用 harmonyos-feature-integration，为当前工程标题栏接入沉浸光感，先检查 SDK 与工程版本，再说明可选路线。 |
   | 平行视界 | 综合商城模板 | 请使用harmonyos-feature-integration，对当前工程实现平行视界 |
   | 智感握姿 | 综合新闻模板 | 请使用harmonyos-feature-integration，为首页发表按钮接入智感握姿。悬浮球本身随握持手左右换侧，保留支持纵向拖拽，横向拖拽去除，不新增按钮 |
   | 智能体框架服务 | 综合商城模板，已准备真实 Agent | 请使用 harmonyos-feature-integration，在首页搜索按钮旁接入“购物助手”智能体按钮，使用我提供的真实 agentId，并在 Phone/Tablet 真机验证点击、打开和关闭。 |
   | 闪控球 | 记账模板 | 请使用harmonyos-feature-integration，在明细页面添加一个按钮，点击创建添加闪控球，点击闪控球可以快速拉起应用明细页面，并打开记账面板。 |
   | 窗球绑定 | 金融理财模板 | 请使用harmonyos-feature-integration，在产品详情页【加自选】按钮旁新增操作图标：加入悬浮对比 / 取消悬浮对比。a.点击「加入悬浮对比」：创建常规态闪控窗，将当前产品加入闪控对比列表并在窗内展示；点击「取消悬浮对比」，将该产品从闪控窗对比列表中移除。b. 闪控窗尺寸规则：随对比产品数量增加自动撑开，达到配置最大高度后不再继续增高。c. 模板切换：闪控窗配备切换箭头，支持在两种展示模板间切换：Mini 态：横向多产品一行排布，仅展示产品名称、七日年化；数量较多时启用跑马灯滚动。常规态：单品分行展示，呈现产品更多信息。d. 闪控窗与闪控球绑定联动，支持互相切换唤起；闪控球默认展示对比列表里第一个产品的名称与七日年化信息。 |
   | 防窥保护 | 记账模板，支持防窥的 Phone 真机与普通应用工程 | 请使用harmonyos-feature-integration，为资产页面接入防窥保护，当非机主窥视时，资产页面所有金额变为*号。 |
   | 防窥保护 | 金融理财模板，支持防窥的 Phone 真机与普通应用工程 | 请使用harmonyos-feature-integration，在理财购买页面接入防窥保护，当非机主窥视时，页面剩余额度和可用额度变为*号，并在推荐人代码下增加一行防窥蒙层的开关，点击开启后，当非机主窥视时，拉起防窥蒙层。 |

4. **结果验收**：每个场景完成后核对是否产出 `<工程>/os-feature-integration/integration-report.md` 及其引用截图，并逐项核对 SDK、静态、构建、安装、目标页导航、运行、视觉和回退结果。构建通过不代表视觉通过，未完成的项标注未验证或未确认；组合路线分别验收，绑定使用 `binding` 验证两端与切换生命周期，权限提醒与最终报告保持一致。

