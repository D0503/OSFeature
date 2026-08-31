# 沉浸光感兼容性与选型

## 版本矩阵

| 能力 | 起始版本 | 限制 |
|---|---:|---|
| HDS 沉浸光感 | HarmonyOS 6.1.0、API 23 | 用于 HDS 标题栏、底部页签等支持组件；Stage 模型 |
| ArkUI `ImmersiveMaterial` 与 `systemMaterial` | API 26 | 用于支持通用属性的组件、弹窗、菜单和自定义布局；Stage 模型 |
| API 26 应用级开关 | `targetAPIVersion >= 26.0.0` | 仅 `entry` 类型 module 的 `module.json5` 配置生效 |
| API 26 跨版本调用 | API 26 接口可用时 | 使用 `deviceInfo.apiAvailable('26.0.0')` 和材质能力判断保护 |

API 23～25 只选择 HDS 路线。API 26+ 可以继续用 HDS 承担导航框架，并用 ArkUI `uiMaterial` 扩展普通组件、弹窗和菜单。

## HDS 支持范围

| 组件 | 入口 | 作用 |
|---|---|---|
| `HdsNavigation` / `HdsNavDestination` | `TitleBarStyleOptions.systemMaterialEffect` | 标题栏返回按钮、菜单按钮材质 |
| `HdsTabs` | `HdsTabsFloatingStyle.systemMaterialEffect` | 悬浮胶囊式底部页签 |
| HDS 标题栏 | `scrollEffectOpts` | `GRADIENT_BLUR` 或 `IMMERSIVE_GRADIENT_BLUR` 滚动渐变模糊 |
| HDS 底部页签 | `barFloatingStyle.miniBar` | 可折叠 MiniBar，可与沉浸光感组合 |

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

API 26 设备能力判断使用 `uiMaterial.isImmersiveMaterialSupported()`；不支持时设置材质不会报错，但不会产生材质效果，因此必须保留普通背景色、边框等降级样式。

## 特殊限制

- API 23 及以前 SDK 的 Web 同层渲染场景中，内嵌 ArkUI 控件开启光感可能变透明；关闭该控件光感或关闭同层渲染。
- 应用级开关不能配置在非 `entry` module 后期待生效。
- API 26 接口不能只依靠编译配置判断运行设备支持，还要进行运行时能力判断。
- “沉浸光感”与窗口沉浸式、安全区、状态栏显隐无关；遇到后者应交由对应窗口适配流程。

## 选型检查清单

- 已确认最低 API 和目标 API；
- 已确认 Stage 模型与目标 module 类型；
- 已确认目标组件属于 HDS 或 ArkUI 支持范围；
- API 26 调用有版本和设备能力保护；
- 已为不支持设备和旧系统保留普通视觉样式；
- 没有混用 HDS 与 ArkUI 的 `MaterialLevel`。
