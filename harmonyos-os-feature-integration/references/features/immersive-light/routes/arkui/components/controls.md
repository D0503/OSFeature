# ArkUI 按钮与选择类组件

这类组件不能只套用通用材质工厂；部分组件使用内部预设视觉参数，传入的材质只承担开启标记。

| 组件 | 应用级 `ENABLE` 默认 | 组件级入口 | 关键限制 |
|---|---|---|---|
| Button | 不开启 | `systemMaterial` | `lightEffect` 会替代默认按压态和悬浮态；自动反色需要系统颜色资源 |
| Select | 按钮和菜单都开启 | 按钮 `systemMaterial`，菜单 `menuSystemMaterial` | 两个入口相互独立；按钮默认 `ULTRA_THIN` 并开启交互与流光，菜单默认 `THICK` |
| Toggle | 开启 | `systemMaterial` | Checkbox 当前不支持；Switch 参数只是开启标记并使用内部预设；Button 类型按 Button 规则 |
| Slider | 开启 | `systemMaterial` | 参数只是开启标记；`undefined` 恢复原 Slider；交互效果要求 `SliderBlockType.DEFAULT` 且 `SliderStyle` 非 `NONE` |
| ChipGroup | 开启，默认 `ULTRA_THIN` | `backgroundSystemMaterial`、`selectedBackgroundSystemMaterial`、`iconBackgroundSystemMaterial` | 三个入口分别控制普通、选中和图标背景 |
| SegmentButton/V2 | 开启，默认 `THIN` | 对应 Options 的 `backgroundSystemMaterial` | capsule 且 multiply=true 不支持；V2 开启后支持选中项跟随拖拽 |

## 自动反色

`colorInvert: true` 只会处理支持反色的系统资源。Button、ChipGroup、SegmentButton 的文字或图标若使用硬编码颜色，不应承诺自动反色。深浅色模式下逐项检查选中、未选中、禁用、按压和悬浮状态。

## 交互保留

开启 `interactive` 或 `lightEffect` 前记录原点击态、悬浮态、拖拽反馈和禁用态。材质接管视觉反馈后，业务事件仍须保持原行为；低算力或不支持设备上要保留原反馈，不能让关键操作只剩流光提示。

## 关闭规则

- Select 等通用入口明确关闭时使用 `uiMaterial.Material.empty`；
- Slider 的 `undefined` 是官方声明的恢复原样式方式；
- Toggle Switch、Slider 等预设组件不要根据传入的 `style`、`interactive` 值推断最终视觉参数；
- 应用级 `DISABLE` 时所有显式材质均不生效。

## 来源

- [组件适配沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)
- [开启沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-enable)

