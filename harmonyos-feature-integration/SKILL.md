---
name: harmonyos-feature-integration
description: 为 HarmonyOS / 鸿蒙 OS 新特性提供注册表驱动的识别、接入设计、工程实现、兼容性处理、验证和排障。只要用户要求接入或排查已注册的新系统特性，尤其提到沉浸光感、悬浮导航Tab、Immersive Light、HDS 沉浸材质、uiMaterial、systemMaterial、平行视界、智感握姿、Smart Reach、adaptToHandedness、智能体框架服务、Agent Framework Kit、FunctionComponent、闪控窗、闪控球、floatView、floatingBall、防窥保护、DlpAntiPeep、系统防窥蒙层、setAntiPeepMaskLayer、requestAntiPeepOptions、publishAntiPeepInformation，都应使用本 Skill。当前支持沉浸光感的 API 23 HDS / API 26 ArkUI 路线，以及平行视界（easyGo、easy_go.json）的 Router / Navigation 接入、API 23 基础配置、API 24 状态查询与 API 26 增强配置；智感握姿的系统组件原生适配（如 HDS，当前实例 API 23）、操作手感知（API 15）与握持手感知（API 20）；通过 Function 组件拉起智能体（应用 API 20、元服务 API 21），开发 Agent 和关联应用等前置操作提供指导。工程 API 低于路线所需版本时，可提供升级本机 SDK（无需显式配置 compileSdkVersion）并按路线要求调整 targetSdkVersion、保持 compatibleSdkVersion 兼容旧版本的接入选项。不要用于普通 ArkUI 开发、HarmonyOS 官方文档质量审查或窗口沉浸式与安全区适配。
---

# HarmonyOS OS 新特性接入

通过注册表识别 HarmonyOS 新特性，并只加载命中特性的能力包。注册表中的能力都必须具备可执行资料；不完整能力在完成前不得注册。

结构校验和工具脚本支持 Windows、macOS、Linux，需要 Node.js 18+。实际接入需要可读取的 HarmonyOS Stage 模型工程；构建与运行能力取决于项目本身的 SDK、签名、设备和工具环境。

## 输入范围

处理已注册 HarmonyOS 新特性的方案设计、工程实现、兼容性判断、验证和故障排查。用户可以使用正式名称、注册别名或注册 ID 描述特性。

以下任务不属于本 Skill：

- 与系统新特性无关的普通 ArkUI 页面、组件或业务功能开发；
- 窗口沉浸式、状态栏、安全区或全屏布局适配；“窗口沉浸式”不是“沉浸光感”；
- 未注册新特性的 API 选择、工程改造或代码实现。

## 注册表路由

1. 完整读取 [特性注册表](references/feature-registry.json)。
2. 用用户输入匹配特性的 `id`、`displayName` 或 `aliases`。中文名称允许出现在较长请求中；ASCII 名称忽略大小写并去除首尾空白。
3. 不得依靠技术猜测把未命中名称映射到已注册能力。
4. 命中后完整读取注册项的 `entry`，再按入口文件的任务路由加载所需资料。

场景入口：用户要求“内容区滚动时，内容标题固定到标题栏”“分类栏滚入标题栏”或沉浸光感标题栏滚动吸顶时，按注册别名进入 `immersive-light`，加载[滚动内容切换到标题栏](references/features/immersive-light/routes/arkui/components/navigation.md#可选滚动内容切换到标题栏)及其 ArkUI 前置门禁。已在沉浸光感改造上下文中时，后续同义请求沿用该路由。此入口针对标题栏接替显示；普通列表内部吸顶、sticky 分组不据此触发，也不因命中场景自动扩大到全工程材质改造。

注册项的 `status` 必须为 `ready`。结构校验失败代表 Skill 资料损坏，应报告校验错误并停止，而不是绕过入口拼装实现。

## 固定数据流

按“识别特性 → 验证本机 SDK → 扫描工程 → 兼容性与 SDK 门禁 → 加载能力包 → 方案或实施 → 静态验证 → 构建 → 安装启动 → 目标页导航 → 运行与视觉验证 → 交付报告”执行。每一步保留文件证据和无法确认项，后一步不得覆盖前一步的限制。本机 SDK 未定位、根清单无效或 API 低于路线门槛时，不得仅凭工程版本选择路线。

### 升级接入与路线决策（通用）

适用于所有已注册特性，规则细节见 [兼容性模型](references/shared/compatibility-model.md)：

- 兼容性门禁返回 `upgrade_available` 时，应按[通用兼容性规则](references/shared/compatibility-model.md#升级接入对所有特性通用)提供升级接入选项，由用户确认后实施，不直接终止接入。所有低版本、不支持、未授权或特性关闭路径都必须保留接入前的源程序状态；普通样式只是视觉维度之一，不能替代原布局、交互、数据和业务行为。
- 升级 `targetSdkVersion` 时，先核实目标 SDK 及配套构建工具的版本配置规范，再按规定的字段类型和值写入。依据使用本机对应版本的配置 schema、官方模板或官方配置文档；不得将 API 等级直接当作配置值，也不得自行拼接版本号。具体格式核验规则见[兼容性模型](references/shared/compatibility-model.md)。
- 存在多条可用路线或任何升级选项（`decisionRequired` 为 true）时，必须把可选接入方式、建议路线和理由一并列给用户，由用户决定路线。
- 仅一条可用路线且无需升级时，给出建议路线和理由即可继续。
- 能力包声明 `routeComposition.mode: composable` 时，多条路线可以同时选中。使用 `selectedRoutes` 加载每条路线自己的实现、资产与验证资料；`recommendedRoute` 只表示主要建议，不得据此丢弃工程中仍在使用的补充路线。

互斥能力包声明 `routeComposition.mode: exclusive`，`selectedRoutes` 最多一项。平行视界的配置字段与可选 API 还可能提高 `requiredApi`；按能力包评估计划新增字段，不只检查基础路线门槛。

### 未注册特性

没有匹配项时，说明该特性当前未注册以及需要先完成能力包，不提供具体 API、代码或兼容性结论。不得自动新增注册项，也不得借用名称相近能力的资料。

## 执行规则

先按任务完整读取对应通用工作流：

| 任务 | 必读工作流 |
|---|---|
| 扫描工程 | [工程发现](references/workflows/project-discovery.md) |
| 判断能否接入 | [可行性门禁](references/workflows/feasibility-check.md) |
| 只设计方案 | [接入方案](references/workflows/integration-design.md) |
| 修改工程 | [工程实施](references/workflows/implementation.md) |
| 验证结果 | [验证闭环](references/workflows/verification.md) |
| 排查问题 | [故障排查](references/workflows/troubleshooting.md) |

### 方案设计

读取能力入口和兼容性资料，先验证本机 SDK 根清单与 API 版本，再扫描用户工程中可发现的 compile/target/compatible API、模型、module、组件体系与目标位置。输出 SDK 证据、可选路线与升级选项、建议路线和理由、改动范围、兼容降级、性能风险和验证计划，不修改文件。存在多条路线或升级选项时，路线须由用户确认后写入方案。

### 工程实现

用户明确要求实现时：

1. 先读取能力入口指定的兼容性资料，再按 `selectedRoutes` 读取每条选中路线自己的实现、资产和验证资料；共享资料只读取一次；
2. 检查实际工程和本机 SDK 根清单，不假设文件路径、组件类型或 SDK 版本；
3. 修改范围保持在用户请求与已确认路线内，复用工程现有架构与类型；
4. 按能力包 `fallbackPolicy` 为旧版本、不支持设备、未授权和特性关闭路径保留接入前的源程序状态；只在满足条件的增强分支接入新特性；
5. 按[验证闭环](references/workflows/verification.md)运行 `verify-development.mjs`，自动执行具备条件的静态检查、SDK 检查和构建。本次接入引起的检查或编译错误，由 AI 分析检查结果和日志、最小修改并重新验证构建；只有遇到无法自行解决的阻断时才报告具体原因。通过后明确设备并继续安装、导航和截图。智感握姿视觉验证仅真机：先引导开发者完成握姿动作，再采集截图或导入开发者真机截图，模拟器一律不判定；
6. 按[验证闭环](references/workflows/verification.md)完成证据补录、判定与交付一致性核对，并按[输出契约](references/shared/output-contracts.md)交付报告及截图。

### 故障排查

先记录现象、API、设备、系统设置、目标组件和相关配置，再加载能力包的兼容性与排障资料。用可检查证据区分版本门禁、设备能力、配置状态、属性冲突和性能问题；用户只要求诊断时不直接修改工程。

## 当前已注册能力

当前注册表包含沉浸光感、平行视界、智感握姿、智能体框架服务、闪控窗／球和防窥保护能力。普通分栏或自适应布局不等于平行视界；普通单手布局、一般手势识别或单独出现 HdsTabs 不等于智感握姿，不能据此自动命中。智感握姿的视觉验证只能使用真机：模拟器不采集、不导入、不判定，须按[验证闭环](references/workflows/verification.md)引导开发者本人完成握姿动作，再由执行器截图或导入开发者真机截图后补录。版本、组件、设备和降级事实从注册项 `profile` 与能力包读取，不在主文件复制。

智能体框架服务仅实现 Function 组件拉起智能体；开发 Agent、关联应用与测试发布等前置操作按能力包提供指导。A2A、AgentExtensionAbility 或后端开发请求即使命中 Kit 名称，也不属于当前实现范围；普通 Agent/Function 请求不能据此自动命中。其运行与视觉验证必须使用已确认的 Phone/Tablet 真机，按能力包采集点击、打开及关闭证据，不能以按钮显示替代拉起成功。

闪控窗／球提供 float-view、floating-ball、binding 三条路线；绑定只选 binding，内部检查两端能力，同时选择窗球独立路线不代表绑定。用户明确要求闪控窗防窥时，从[闪控窗能力包](references/features/float-view-ball/README.md)加载防窥联动资料，各自门禁分别核验。防窥保护是独立能力，按能力包选择金融字段、短视频、即时通讯等业务状态响应、系统蒙层及可选设置与风险提示。普通全局悬浮窗、悬浮按钮、画中画、防截屏或隐私遮罩不自动映射到这两个能力。防窥效果只接受已确认的 Phone 真机证据；闪控球按能力包的模拟器条件验证，不推定闪控窗或绑定支持模拟器。

防窥接入需求模糊或可选能力未明确时，必须先按[接入前澄清](references/features/dlp-anti-peep/README.md#接入前澄清)主动询问保护目标、是否需要系统蒙层及设置弹窗，并说明对应版本条件；只补问缺失项，确认接入范围后再实施。

## 资源加载表

| 当前任务 | 必读资源 |
|---|---|
| 所有新特性请求 | [references/feature-registry.json](references/feature-registry.json) |
| 命中已注册能力 | 注册项的 `entry` 以及入口指定的任务资料 |
| 工程、SDK 扫描和兼容性判断 | 运行 `node scripts/inspect-project.mjs --project <path> [--sdk <path>]` 与 `node scripts/check-compatibility.mjs --project <path> --feature <id> [--sdk <path>]`；自动定位失败时必须显式传入 `--sdk` |
| 实施后静态验证 | 运行 `node scripts/verify-integration.mjs --project <path> --feature <id> [--sdk <path>]` |
| 工程验证闭环与报告 | 按[验证闭环](references/workflows/verification.md)调用 `scripts/verify-development.mjs`，采集目标页证据并补录判定 |
| 输出计划或报告 | [共享输出契约](references/shared/output-contracts.md) 与 `assets/templates/` |
| 检查 Skill 结构 | 运行 `node scripts/validate-structure.mjs` |
| 检查已注册能力包 | 运行 `node scripts/validate-feature-package.mjs --feature <id>` |

## 完成标准

- 路由结论能回溯到注册表中的唯一匹配项；
- 路由结论同时能回溯到本机 `sdk-pkg.json`、有效 compile API（未显式配置时取已验证的活动 SDK）和能力包 `routes[].minApi`；
- 存在多条路线或升级选项时，路线与升级决定已交由用户确认；
- 可组合能力的 `selectedRoutes` 覆盖实际目标组件，各路线结果分别验证；
- 实现只使用能力入口明确提供的版本、接口和限制；
- 没有把沉浸光感、窗口沉浸式或其他新特性混为一谈；
- 方案和实现包含旧版本、不支持设备、未授权及系统禁用状态的分支，并保留接入前的源程序状态；
- 已执行可用的静态检查和构建，并明确未完成的真机验证；
- 未注册能力只返回注册边界，不生成猜测性实现。
