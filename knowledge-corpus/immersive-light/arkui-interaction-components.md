---
title: "ArkUI 沉浸光感按钮、选择控件与通用组件"
summary: "说明 Button、Select、Toggle、Slider、Chip、ChipGroup 和 SegmentButton 的材质入口、预设行为、生效区域、交互和关闭方式。"
createdAt: "2026-11-11"
updatedAt: "2026-11-11"
tags: ["HarmonyOS","沉浸光感","ArkUI","Button","Select","Toggle","Slider","ChipGroup","SegmentButton","systemMaterial"]
---

# ArkUI 沉浸光感按钮、选择控件与通用组件

适用于 Stage 模型的原生 ArkUI。编译 SDK、target 和启用材质的运行系统须达到 API 26。兼容更低版本时先保护新增接口调用。应用启动完成并退出加载页后，在版本保护内查询 `uiMaterial.isImmersiveMaterialSupported()`。应用级 `DISABLE` 会关闭材质，材质不可用时沿用普通视觉样式。

部分交互控件采用内部预设，传入的材质只承担开启标记。应用级 `DEFAULT` 下，表中控件需要按组件入口显式启用。应用级 `ENABLE` 的默认行为如下。

| 组件 | 应用级 `ENABLE` 默认 | 组件级入口 | 关键限制 |
|---|---|---|---|
| Button | 不开启 | `systemMaterial` | 接入时必须显式设置 `.backgroundColor(Color.Transparent)`，避免默认蓝色背景影响材质效果；仅在 Navigation/NavDestination 标题栏或有效的底部横向悬浮 TabBar 内生效；`lightEffect` 会替代默认按压态和悬浮态；自动反色需要系统颜色资源 |
| Select | 按钮和菜单都开启 | 按钮 `systemMaterial`，菜单 `menuSystemMaterial` | 两个入口相互独立；按钮默认 `ULTRA_THIN` 并开启交互与流光，菜单默认 `THICK` |
| Toggle | 开启 | `systemMaterial` | Checkbox 当前不支持；Switch 参数只是开启标记并使用内部预设；Button 类型按 Button 规则 |
| Slider | 开启 | `systemMaterial` | 参数只是开启标记；`undefined` 恢复原 Slider；交互效果要求 `SliderBlockType.DEFAULT` 且 `SliderStyle` 非 `NONE` |
| Chip / ChipGroup / ChipGroupV2 | 开启，默认 `ULTRA_THIN` | Chip 使用 `systemMaterial`；ChipGroup/ChipGroupV2 使用 `backgroundSystemMaterial`、`selectedBackgroundSystemMaterial`、`iconBackgroundSystemMaterial` | 先核对目标所在生效区域；ChipGroup/ChipGroupV2 三个入口分别控制普通、选中和图标背景 |
| SegmentButton/V2 | 开启，默认 `THIN` | 对应 Options 的 `backgroundSystemMaterial` | SegmentButton 的 capsule 且 multiply=true 不支持；MultiCapsuleSegmentButtonV2 不支持沉浸光感；受支持的 V2 开启后支持选中项跟随拖拽 |

## 自动反色

`Button` 中的图标建议优先使用 `SymbolGlyph($r('sys.symbol.xxx'))`，而非 `Image()`；`xxx` 替换为目标 SDK 中实际可用且语义匹配的系统符号资源名。

`colorInvert: true` 只会处理支持反色的系统资源。Button、ChipGroup、SegmentButton 的文字或图标若使用硬编码颜色，不应承诺自动反色。深浅色模式下逐项检查选中、未选中、禁用、按压和悬浮状态。

Button、Chip/ChipGroup/ChipGroupV2、SegmentButton 等普通交互组件不能仅凭接口存在就放在任意内容区；应位于 Navigation/NavDestination 标题栏或有效的底部横向悬浮 TabBar。Select、Toggle、Slider 属于官方明确允许在页面内全部区域生效的组件。普通容器也应核对目标组件是否支持材质，以及节点实际所在区域。

## 交互保留

开启 `interactive` 或 `lightEffect` 前记录原点击态、悬浮态、拖拽反馈和禁用态。材质接管视觉反馈后，业务事件仍须保持原行为；低算力或不支持设备上要保留原反馈，不能让关键操作只剩流光提示。

## 关闭规则

- Select 等通用入口明确关闭时使用 `uiMaterial.Material.empty`；
- Slider 的 `undefined` 是官方声明的恢复原样式方式；
- Toggle Switch、Slider 等预设组件不要根据传入的 `style`、`interactive` 值推断最终视觉参数；
- 应用级 `DISABLE` 时所有显式材质均不生效。

## 通用组件的生效区域与样式顺序

通用材质的参数、生效区域和属性覆盖规则，详见[ArkUI 沉浸光感通用材质](arkui-common-material.md)。

普通容器按支持情况使用 `systemMaterial`，生效区域为原生 Navigation 或 NavDestination 标题栏，以及有效的底部横向悬浮 TabBar。遇到 `Material inactive: out of scope. Use component in navigation title bar or Tabbar.` 时，检查节点的真实位置和组件支持范围，保留业务所需的普通样式。

显式构造材质时从 `@kit.ArkUI` 导入 `uiMaterial`。通用入口可先声明普通背景样式，再设置材质。后置的不透明背景和背景模糊可能遮挡材质。赋色使用带透明度的 `materialColor`，需要自定义阴影时核对 `applyShadow`。Button 显式接入时按表使用透明背景，材质回退路径保留原按钮样式和交互。

应用级 `DEFAULT` 或 `ENABLE` 下，显式材质参数覆盖组件默认效果。通常用 `uiMaterial.Material.empty` 明确关闭，`undefined` 恢复该组件在当前应用状态下的默认行为。Slider 的例外按上文执行，Select 的按钮和菜单分别配置。
