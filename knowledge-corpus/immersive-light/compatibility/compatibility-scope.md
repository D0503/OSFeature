---
title: "沉浸光感支持范围与特殊限制"
summary: "HDS 与 ArkUI 支持范围、应用级 MaterialState、MaterialLevel、特殊限制"
createdAt: "2026-11-13"
updatedAt: "2026-11-13"
tags: ["HarmonyOS","沉浸光感","兼容性"]
---

# 沉浸光感支持范围与特殊限制

## HDS 支持范围

| 组件 | 入口 | 作用 |
|---|---|---|
| `HdsNavigation` / `HdsNavDestination` | `TitleBarStyleOptions.systemMaterialEffect` | 标题栏返回按钮、菜单按钮材质 |
| `HdsTabs` | `HdsTabsFloatingStyle.systemMaterialEffect` | 悬浮胶囊式底部页签 |
| HDS 标题栏 | `scrollEffectOpts` | `GRADIENT_BLUR` 或 `IMMERSIVE_GRADIENT_BLUR` 滚动渐变模糊 |
| HDS 底部页签 | `barFloatingStyle.miniBar` | 可折叠 MiniBar，可与沉浸光感组合 |

MiniBar 核心能力从 API 23 起可用，但 `barLayoutMode` 及 `HdsBarLayoutMode` 从 API 24 起才可用。工程需要兼容 API 23 时，可以使用 MiniBar，但必须省略 `barLayoutMode`；若同时需要自定义 MiniBar 与 TabBar 的横向或纵向排列，则用 `deviceInfo.apiAvailable(24)` 建立单独的运行时分支。MiniBar 在 TV 设备上不生效，不能把它作为关键操作的唯一入口。

HDS 材质接口覆盖 Phone、Tablet、PC/2in1。默认优先使用 `ADAPTIVE` 材质类型和等级；自定义档位前先调用 `hdsMaterial.getSystemMaterialTypes()` 查询设备能力。

## ArkUI 支持范围

API 26 起，达到 target API 26 的工程可为支持的组件显式设置材质。原生导航、弹出类和选择类入口包括：

| 场景 | 接口 |
|---|---|
| Navigation/NavDestination 标题栏 | `NavigationTitleOptions.systemMaterial`；推荐同时使用 `BarStyle.STACK` |
| 原生 Tabs 底部悬浮栏 | 有效 `barFloatingStyle` 默认使用 `THIN`；组件级自定义可用 `FloatingTabBarStyle.systemMaterial`；要求 `barOverlap(true)`、`vertical(false)`、`BarPosition.End`；`maskColor` 接入时默认显式透明 |
| AlphabetIndexer 提示弹窗 | `popupBackground`、`popupBackgroundBlurStyle` 均未设置或为 `undefined` 时默认开启；主动设置背景属性与材质互斥 |
| Toast | `ShowToastOptions.systemMaterial` |
| Popup | `PopupOptions.systemMaterial` |
| Tips | `TipsOptions.systemMaterial` |
| Sheet | `SheetOptions.systemMaterial` |
| Menu | 对应实际调用入口的 Options，例如 `ContextMenuOptions.systemMaterial`；不得用泛化类型代替 |
| Dialog | 对应 Options 的 `systemMaterial` |
| Select | 按钮使用 `systemMaterial`，下拉菜单使用 `menuSystemMaterial` |
| Toggle、Slider | `systemMaterial`；部分类型只把参数作为开启标记，按组件矩阵处理 |
| ChipGroup | `backgroundSystemMaterial`、`selectedBackgroundSystemMaterial`、`iconBackgroundSystemMaterial` |
| SegmentButton/V2 | 对应 Options 的 `backgroundSystemMaterial` |

Toast 未主动指定材质时的默认表现仍会受到应用 `MaterialState` 和背景、模糊、阴影等冲突样式影响，不能只凭默认值断言最终视觉效果。

## 应用级 MaterialState

ArkUI 路线本身要求 `targetAPIVersion >= 26.0.0`；应用级开关在此基础上只对 `entry` module 生效。

| 配置值 | 枚举 | 行为 |
|---|---|---|
| `default` 或未配置 | `MaterialState.DEFAULT` | target 升级到 26+ 后，受支持组件可能采用系统默认材质；不能视为“无配置即无变化” |
| `enable` | `MaterialState.ENABLE` | 扩大默认启用材质的组件范围 |
| `disable` | `MaterialState.DISABLE` | 全局禁止；显式 `systemMaterial` 也不生效 |

用 `uiMaterial.getMaterialInfo()` 读取实际配置。关闭普通组件使用 `uiMaterial.Material.empty`；`undefined` 表示恢复组件在当前 MaterialState 下的默认行为，不等价于统一关闭。Slider 等组件的专属语义按 Skill 的 ArkUI 组件矩阵（`routes/arkui/component-profile.json`） 处理。

## 两套 MaterialLevel

不要混用同名类型：

| API | 含义 |
|---|---|
| `hdsMaterial.MaterialLevel` | 开发者选择的视觉强度：`EXQUISITE`、`GENTLE`、`SMOOTH`、`ADAPTIVE` |
| `uiMaterial.MaterialLevel` | 设备算力档位；通过 `getGlobalMaterialLevel()` 获取，不可修改 |

API 26 设备能力判断使用 `uiMaterial.isImmersiveMaterialSupported()`；不支持时设置材质不会报错，但不会产生材质效果。回退路径必须继续使用组件接入前的属性、状态、事件和业务行为，并保留原背景色、边框等普通视觉样式，不能只补一个背景色就视为已完成兼容。

## 特殊限制

- `compatibleSdkVersion` 低于 23 时，HDS 组件在低版本设备不可用，需要按运行时判断做整树条件降级，而不只是属性级保护。
- SDK 26.0.0+ 编译时，整树降级优先使用 `deviceInfo.apiAvailable` 检查运行设备版本：API 26+ 使用完整版本字符串，API 26 以下的公共接口使用数字 API 等级。该接口的编译 SDK 门槛不等于运行设备门槛；旧 SDK 无此声明时才沿用 `sdkApiVersion`，或确认升级编译 SDK。
- 低版本整树分支必须保留源程序接入前的体验，不能用一个固定底部普通 `Tabs` 取代原有响应式导航。源程序若在不同断点、横竖屏或窗口模式下切换 `vertical`、`barPosition`、`barWidth`、`barHeight`、`divider` 等属性，降级分支继续沿用原有判断和值，并保留原控制器、自定义 TabBar、页签顺序和事件。
- API 23 及以前 SDK 的 Web 同层渲染场景中，内嵌 ArkUI 控件开启光感可能变透明；关闭该控件光感或关闭同层渲染。
- 应用级开关不能配置在非 `entry` module 后期待生效。
- API 26 接口不能只依靠编译配置判断运行设备支持，还要进行运行时能力判断。
- “沉浸光感”与窗口沉浸式、安全区、状态栏显隐无关；遇到后者应交由对应窗口适配流程。
