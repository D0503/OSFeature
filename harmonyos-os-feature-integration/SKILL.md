---
name: harmonyos-os-feature-integration
description: 为 HarmonyOS / 鸿蒙 OS 新特性提供注册表驱动的识别、接入设计、工程实现、兼容性处理、验证和排障。只要用户要求接入或排查已注册的新系统特性，尤其提到沉浸光感、悬浮导航Tab、Immersive Light、HDS 沉浸材质、uiMaterial、systemMaterial，都应使用本 Skill。当前已支持沉浸光感的 API 23 HDS 路线和 API 26 ArkUI 路线。工程 API 低于路线所需版本时，可提供升级 targetSdkVersion 并保持 compatibleSdkVersion 兼容旧版本的接入选项。不要用于普通 ArkUI 开发、HarmonyOS 官方文档质量审查或窗口沉浸式与安全区适配。
---

# HarmonyOS OS 新特性接入

通过注册表识别 HarmonyOS 新特性，并只加载命中特性的能力包。注册表中的能力都必须具备可执行资料；不完整能力在完成前不得注册。

结构校验和工具脚本支持 Windows、macOS、Linux，需要 Node.js 18+。实际接入需要可读取的 HarmonyOS Stage 模型工程；构建与运行能力取决于项目本身的 SDK、签名、设备和工具环境。

## 输入范围

处理已注册 HarmonyOS 新特性的方案设计、工程实现、兼容性判断、验证和故障排查。用户可以使用正式名称、注册别名或注册 ID 描述特性。

以下任务不属于本 Skill：

- 与系统新特性无关的普通 ArkUI 页面、组件或业务功能开发；
- HarmonyOS 官方文档质量审查，此类任务应使用 `harmonyos-doc-review`；
- 窗口沉浸式、状态栏、安全区或全屏布局适配；“窗口沉浸式”不是“沉浸光感”；
- 未注册新特性的 API 选择、工程改造或代码实现。

## 注册表路由

1. 完整读取 [特性注册表](references/feature-registry.json)。
2. 用用户输入匹配特性的 `id`、`displayName` 或 `aliases`。中文名称允许出现在较长请求中；ASCII 名称忽略大小写并去除首尾空白。
3. 不得依靠技术猜测把未命中名称映射到已注册能力。
4. 命中后完整读取注册项的 `entry`，再按入口文件的任务路由加载所需资料。

注册项的 `status` 必须为 `ready`。结构校验失败代表 Skill 资料损坏，应报告校验错误并停止，而不是绕过入口拼装实现。

## 固定数据流

按“识别特性 → 验证本机 SDK → 扫描工程 → 兼容性与 SDK 门禁 → 加载能力包 → 方案或实施 → 静态验证 → 项目构建 → 交付报告”执行。每一步保留文件证据和无法确认项，后一步不得覆盖前一步的限制。本机 SDK 未定位、根清单无效或 API 低于路线门槛时，不得仅凭工程版本选择路线。

### 升级接入与路线决策（通用）

适用于所有已注册特性，规则细节见 [兼容性模型](references/shared/compatibility-model.md)：

- 工程 API 或已验证的本机 SDK 低于特性路线所需版本时，兼容性门禁返回 `upgrade_available`，这不是终止结论：应提供“安装或切换到达到路线 API 门槛的本机 SDK，升级 `targetSdkVersion` 与 `compileSdkVersion` 至路线门槛、`compatibleSdkVersion` 保持不变”的接入选项。所有低版本、不支持、未授权或特性关闭路径都必须保留接入前的源程序状态；普通样式只是视觉维度之一，不能替代原布局、交互、数据和业务行为。
- 存在多条可用路线或任何升级选项（`decisionRequired` 为 true）时，必须把可选接入方式、建议路线和理由一并列给用户，由用户决定路线。
- 仅一条可用路线且无需升级时，给出建议路线和理由即可继续。
- 能力包声明 `routeComposition.mode: composable` 时，多条路线可以同时选中。使用 `selectedRoutes` 加载每条路线自己的实现、资产与验证资料；`recommendedRoute` 只表示主要建议，不得据此丢弃工程中仍在使用的补充路线。

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
5. 执行工程可用的静态检查和构建；
6. 区分编译结果与真机视觉验证，未验证内容明确列出。

### 故障排查

先记录现象、API、设备、系统设置、目标组件和相关配置，再加载能力包的兼容性与排障资料。用可检查证据区分版本门禁、设备能力、配置状态、属性冲突和性能问题；用户只要求诊断时不直接修改工程。

## 当前已注册能力

当前注册表只包含沉浸光感能力。版本、组件、设备和降级事实从注册项 `profile` 与能力包读取，不在主文件复制。

## 能力包扩展

新增特性前完整读取 [能力包契约](references/feature-package-contract.md)。先在注册表外完成并验证全部资料，达到契约要求后再以 `ready` 状态注册。

## 资源加载表

| 当前任务 | 必读资源 |
|---|---|
| 所有新特性请求 | [references/feature-registry.json](references/feature-registry.json) |
| 命中已注册能力 | 注册项的 `entry` 以及入口指定的任务资料 |
| 工程、SDK 扫描和兼容性判断 | 运行 `node scripts/inspect-project.mjs --project <path> [--sdk <path>]` 与 `node scripts/check-compatibility.mjs --project <path> --feature <id> [--sdk <path>]`；自动定位失败时必须显式传入 `--sdk` |
| 实施后静态验证 | 运行 `node scripts/verify-integration.mjs --project <path> --feature <id> [--sdk <path>]` |
| 输出计划或报告 | [共享输出契约](references/shared/output-contracts.md) 与 `assets/templates/` |
| 新增能力包 | [references/feature-package-contract.md](references/feature-package-contract.md) |
| 检查 Skill 结构 | 运行 `node scripts/validate-structure.mjs` |
| 检查已注册能力包 | 运行 `node scripts/validate-feature-package.mjs --feature <id>` |
| 运行冒烟测试 | 运行 `node evals/run-smoke-tests.mjs` |
| 运行工具测试 | 运行 `node evals/run-tool-tests.mjs` |

## 完成标准

- 路由结论能回溯到注册表中的唯一匹配项；
- 路由结论同时能回溯到本机 `sdk-pkg.json`、工程 `compileSdkVersion` 和能力包 `routes[].minApi`；
- 存在多条路线或升级选项时，路线与升级决定已交由用户确认；
- 可组合能力的 `selectedRoutes` 覆盖实际目标组件，各路线结果分别验证；
- 实现只使用能力入口明确提供的版本、接口和限制；
- 没有把沉浸光感、窗口沉浸式或其他新特性混为一谈；
- 方案和实现包含旧版本、不支持设备、未授权及系统禁用状态的分支，并保留接入前的源程序状态；
- 已执行可用的静态检查和构建，并明确未完成的真机验证；
- 未注册能力只返回注册边界，不生成猜测性实现。
