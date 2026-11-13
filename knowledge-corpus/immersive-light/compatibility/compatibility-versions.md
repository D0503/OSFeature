---
title: "沉浸光感版本矩阵与本机 SDK 举证"
summary: "版本矩阵、本机 SDK 举证"
createdAt: "2026-11-13"
updatedAt: "2026-11-13"
tags: ["HarmonyOS","沉浸光感","兼容性"]
---

# 沉浸光感版本矩阵与本机 SDK 举证

## 版本矩阵

| 能力 | 起始版本 | 限制 |
|---|---:|---|
| HDS 组件家族起点 | HarmonyOS 5.1.0、API 18 | 表示 HDS 组件开始出现，不代表沉浸光感材质可用 |
| `HdsNavigation` / `HdsNavDestination` 组件 | HarmonyOS 5.1.0、API 18 | 仅为导航组件自身的起始版本；Stage 模型 |
| `HdsTabs` 组件 | HarmonyOS 6.0.0、API 20 | 仅为页签组件自身的起始版本；Stage 模型 |
| HDS 沉浸光感材质接口 | HarmonyOS 6.1.0、API 23 | `hdsMaterial`、`systemMaterialEffect`、`barFloatingStyle` 等能力从此版本可用；Stage 模型 |
| ArkUI `ImmersiveMaterial` 与 `systemMaterial` | API 26，且 `targetAPIVersion >= 26.0.0` | 用于原生 Navigation/Tabs、支持通用属性的组件、弹窗和交互组件；Stage 模型 |
| API 26 应用级开关 | ArkUI 路线门禁已满足 | 额外要求配置位于 `entry` 类型 module 的 `module.json5` |
| API 26 跨版本调用 | `compatibleSdkVersion < 26` | 使用 `deviceInfo.apiAvailable('26.0.0')` 保护新增接口调用和配置；涉及组件、布局或导航结构变化时使用组件树分支，进入 API 26 路径后再做材质能力判断 |
| 升级接入（通用） | 工程低于路线门槛时 | 安装或切换本机 SDK，并将 `targetSdkVersion` 升至 23（HDS）或 26（ArkUI），无需显式配置 `compileSdkVersion`，`compatibleSdkVersion` 保持不变；低版本设备需运行时保护，并保留源程序接入前的布局、交互和普通视觉样式；是否升级与路线由用户决定 |

这里必须区分“组件存在”和“特性可用”：API 18 工程可以使用 `HdsNavigation`，API 20 工程可以使用 `HdsTabs`，但二者都不能证明沉浸光感材质已可用。沉浸光感的 HDS 路线门槛仍是 API 23。API 23～25 只选择 HDS 材质路线；API 26+ 可以继续用 HDS 承担 HDS 导航，并用 ArkUI `uiMaterial` 改造原生 Navigation/Tabs、普通组件、弹窗和交互组件。工程 API 低于 23 时按 Skill 的通用「兼容性模型」的升级接入处理，不直接判为不支持。

路线采用可组合模型。`availableRoutes` 表示版本与本机 SDK 允许考虑的路线，`selectedRoutes` 表示根据工程组件信号和当前目标实际加载的路线。API 26 工程若同时改造 HDS 导航/页签与 ArkUI 普通组件，应返回 `selectedRoutes: ["hds", "arkui"]` 并分别加载两套资料；`recommendedRoute` 只是主要建议和旧接口兼容字段，不表示必须二选一。

## 本机 SDK 举证

工程版本配置按 Skill 的「兼容性模型」核实目标 SDK 及配套构建工具的规定后写入。API 23 的 `"6.1.0(23)"` 和 API 26 的 `"26.0.0"` 是格式示例，不代替对目标版本规范的核验。工具内部归一化的 API 数值仅用于门禁比较，不直接作为生成配置的值。无需新增 `compileSdkVersion`；`compatibleSdkVersion` 保留原值与格式，除非已明确决定提高最低兼容版本。

选路前必须验证实际参与构建的本机 SDK，不以工程 target API 代替：

- HDS 路线要求 SDK 根目录 `sdk-pkg.json` 的 `apiVersion` 达到 23；
- ArkUI 路线要求 SDK 根目录 `sdk-pkg.json` 的 `apiVersion` 达到 26；
- 路线阶段不扫描 `.d.ts`、`.d.ets`、SDK 子包或具体接口符号；具体接口由实施后的源码检查和真实工程构建确认；
- 有效 compile API 也必须达到路线门槛；无需显式配置 `compileSdkVersion`，未配置时取已验证的活动 SDK API。`compatibleSdkVersion` 决定旧设备范围，`targetSdkVersion` 决定目标行为，两者都不能单独证明接口可编译。

本机 SDK 路由只比较根清单 API 与沉浸光感路线门槛 23，不通过扫描 HDS 组件符号推断材质能力。工程扫描发现 `HdsNavigation` 或 `HdsTabs` 时，只能说明项目采用了相应组件体系；若 SDK 或有效 compile API 仍处于 18～22，结果应为可升级接入，而不是 HDS 沉浸光感已支持。
