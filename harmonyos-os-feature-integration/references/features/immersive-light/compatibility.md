# 沉浸光感兼容性与选型

## 版本矩阵

| 能力 | 起始版本 | 限制 |
|---|---:|---|
| HDS 组件家族起点 | HarmonyOS 5.1.0、API 18 | 表示 HDS 组件开始出现，不代表沉浸光感材质可用 |
| `HdsNavigation` / `HdsNavDestination` 组件 | HarmonyOS 5.1.0、API 18 | 仅为导航组件自身的起始版本；Stage 模型 |
| `HdsTabs` 组件 | HarmonyOS 6.0.0、API 20 | 仅为页签组件自身的起始版本；Stage 模型 |
| HDS 沉浸光感材质接口 | HarmonyOS 6.1.0、API 23 | `hdsMaterial`、`systemMaterialEffect`、`barFloatingStyle` 等能力从此版本可用；Stage 模型 |
| ArkUI `ImmersiveMaterial` 与 `systemMaterial` | API 26 | 用于支持通用属性的组件、弹窗、菜单和自定义布局；Stage 模型 |
| API 26 应用级开关 | `targetAPIVersion >= 26.0.0` | 仅 `entry` 类型 module 的 `module.json5` 配置生效 |
| API 26 跨版本调用 | API 26 接口可用时 | 使用 `deviceInfo.apiAvailable('26.0.0')` 和材质能力判断保护 |
| 升级接入（通用） | 工程低于路线门槛时 | 升级 `targetSdkVersion`/`compileSdkVersion` 至 23（HDS）或 26（ArkUI），`compatibleSdkVersion` 保持不变；低版本设备需运行时保护，并保留源程序接入前的布局、交互和普通视觉样式；是否升级与路线由用户决定 |

这里必须区分“组件存在”和“特性可用”：API 18 工程可以使用 `HdsNavigation`，API 20 工程可以使用 `HdsTabs`，但二者都不能证明沉浸光感材质已可用。沉浸光感的 HDS 路线门槛仍是 API 23。API 23～25 只选择 HDS 材质路线；API 26+ 可以继续用 HDS 承担导航框架，并用 ArkUI `uiMaterial` 扩展普通组件、弹窗和菜单。工程 API 低于 23 时按通用[兼容性模型](../../shared/compatibility-model.md)的升级接入处理，不直接判为不支持。

路线采用可组合模型。`availableRoutes` 表示版本与本机 SDK 允许考虑的路线，`selectedRoutes` 表示根据工程组件信号和当前目标实际加载的路线。API 26 工程若同时改造 HDS 导航/页签与 ArkUI 普通组件，应返回 `selectedRoutes: ["hds", "arkui"]` 并分别加载两套资料；`recommendedRoute` 只是主要建议和旧接口兼容字段，不表示必须二选一。

## 本机 SDK 举证

选路前必须验证实际参与构建的本机 SDK，不以工程 target API 代替：

- HDS 路线要求 SDK 根目录 `sdk-pkg.json` 的 `apiVersion` 达到 23；
- ArkUI 路线要求 SDK 根目录 `sdk-pkg.json` 的 `apiVersion` 达到 26；
- 路线阶段不扫描 `.d.ts`、`.d.ets`、SDK 子包或具体接口符号；具体接口由实施后的源码检查和真实工程构建确认；
- 工程 `compileSdkVersion` 也必须达到路线门槛。`compatibleSdkVersion` 决定旧设备范围，`targetSdkVersion` 决定目标行为，两者都不能单独证明接口可编译。

本机 SDK 路由只比较根清单 API 与沉浸光感路线门槛 23，不通过扫描 HDS 组件符号推断材质能力。工程扫描发现 `HdsNavigation` 或 `HdsTabs` 时，只能说明项目采用了相应组件体系；若 SDK 或有效 compile API 仍处于 18～22，结果应为可升级接入，而不是 HDS 沉浸光感已支持。

## HDS 支持范围

| 组件 | 入口 | 作用 |
|---|---|---|
| `HdsNavigation` / `HdsNavDestination` | `TitleBarStyleOptions.systemMaterialEffect` | 标题栏返回按钮、菜单按钮材质 |
| `HdsTabs` | `HdsTabsFloatingStyle.systemMaterialEffect` | 悬浮胶囊式底部页签 |
| HDS 标题栏 | `scrollEffectOpts` | `GRADIENT_BLUR` 或 `IMMERSIVE_GRADIENT_BLUR` 滚动渐变模糊 |
| HDS 底部页签 | `barFloatingStyle.miniBar` | 可折叠 MiniBar，可与沉浸光感组合 |

MiniBar 核心能力从 API 23 起可用，但 `barLayoutMode` 及 `HdsBarLayoutMode` 从 API 24 起才可用。工程需要兼容 API 23 时，可以使用 MiniBar，但必须省略 `barLayoutMode`；若同时需要自定义 MiniBar 与 TabBar 的横向或纵向排列，则用 `deviceInfo.sdkApiVersion >= 24` 建立单独的运行时分支。MiniBar 在 TV 设备上不生效，不能把它作为关键操作的唯一入口。

HDS 材质接口覆盖 Phone、Tablet、PC/2in1。默认优先使用 `ADAPTIVE` 材质类型和等级；自定义档位前先调用 `hdsMaterial.getSystemMaterialTypes()` 查询设备能力。

## ArkUI 支持范围

API 26 起，所有支持通用属性的组件可以显式使用 `systemMaterial`。弹出类和选择类入口包括：

| 场景 | 接口 |
|---|---|
| Toast | `ShowToastOptions.systemMaterial` |
| Popup | `PopupOptions.systemMaterial` |
| Tips | `TipsOptions.systemMaterial` |
| Sheet | `SheetOptions.systemMaterial` |
| Menu | `MenuOptions.systemMaterial`，适用于 `bindMenu` 和 `openMenu` |
| Dialog | 对应 Options 的 `systemMaterial` |
| Select | 按钮使用 `systemMaterial`，下拉菜单使用 `menuSystemMaterial` |

Toast 未主动指定材质时的默认表现仍会受到应用 `MaterialState` 和背景、模糊、阴影等冲突样式影响，不能只凭默认值断言最终视觉效果。

## 应用级 MaterialState

API 26 应用级开关只在 `entry` module 且 `targetAPIVersion >= 26.0.0` 时生效。

| 配置值 | 枚举 | 行为 |
|---|---|---|
| `default` | `MaterialState.DEFAULT` | 部分系统组件在没有冲突样式时采用默认材质 |
| `enable` | `MaterialState.ENABLE` | 扩大默认启用材质的组件范围 |
| `disable` | `MaterialState.DISABLE` | 全局禁止；显式 `systemMaterial` 也不生效 |

用 `uiMaterial.getMaterialInfo()` 读取实际配置。关闭单个组件使用 `uiMaterial.Material.empty`；`undefined` 表示恢复系统默认，不等价于明确关闭。

## 两套 MaterialLevel

不要混用同名类型：

| API | 含义 |
|---|---|
| `hdsMaterial.MaterialLevel` | 开发者选择的视觉强度：`EXQUISITE`、`GENTLE`、`SMOOTH`、`ADAPTIVE` |
| `uiMaterial.MaterialLevel` | 设备算力档位；通过 `getGlobalMaterialLevel()` 获取，不可修改 |

API 26 设备能力判断使用 `uiMaterial.isImmersiveMaterialSupported()`；不支持时设置材质不会报错，但不会产生材质效果。回退路径必须继续使用组件接入前的属性、状态、事件和业务行为，并保留原背景色、边框等普通视觉样式，不能只补一个背景色就视为已完成兼容。

## 特殊限制

- `compatibleSdkVersion` 低于 23 时，HDS 组件在低版本设备不可用，需要按运行时判断做整树条件降级，而不只是属性级保护。
- 整树降级的运行时判断必须使用低版本即可用的 API（`deviceInfo.sdkApiVersion`，@since 8）；`deviceInfo.apiAvailable` 自 API 26 起存在，在低版本设备上调用会崩溃，禁止用作 API 26 以下的降级开关。
- 低版本整树分支必须保留源程序接入前的体验，不能用一个固定底部普通 `Tabs` 取代原有响应式导航。源程序若在不同断点、横竖屏或窗口模式下切换 `vertical`、`barPosition`、`barWidth`、`barHeight`、`divider` 等属性，降级分支继续沿用原有判断和值，并保留原控制器、自定义 TabBar、页签顺序和事件。
- API 23 及以前 SDK 的 Web 同层渲染场景中，内嵌 ArkUI 控件开启光感可能变透明；关闭该控件光感或关闭同层渲染。
- 应用级开关不能配置在非 `entry` module 后期待生效。
- API 26 接口不能只依靠编译配置判断运行设备支持，还要进行运行时能力判断。
- “沉浸光感”与窗口沉浸式、安全区、状态栏显隐无关；遇到后者应交由对应窗口适配流程。

## 选型检查清单

- 已确认最低 API 和目标 API；
- 涉及升级或多条路线时，升级决定与路线选择已由用户确认；
- 已确认 Stage 模型与目标 module 类型；
- 已确认目标组件属于 HDS 或 ArkUI 支持范围；
- `selectedRoutes` 已覆盖所有实际目标组件；组合路线按 HDS、ArkUI 分别实施和验证；
- API 26 调用有版本和设备能力保护；
- 已为不支持设备和旧系统保留普通视觉样式；
- 低版本组件替换分支保留源程序原有的断点、横竖屏、窗口模式、导航位置和交互行为；
- 没有混用 HDS 与 ArkUI 的 `MaterialLevel`。
