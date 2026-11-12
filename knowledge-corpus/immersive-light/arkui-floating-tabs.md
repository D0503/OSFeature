---
title: "ArkUI 沉浸光感原生悬浮 Tabs"
summary: "说明原生 Tabs 的悬浮背板、默认 THIN 材质、API 分支、栏宽、断点与页签切换动画。"
createdAt: "2026-11-11"
updatedAt: "2026-11-12"
tags: ["HarmonyOS","沉浸光感","ArkUI","Tabs","barFloatingStyle","THIN"]
---

# ArkUI 沉浸光感原生悬浮 Tabs

适用于 Stage 模型的原生 ArkUI。编译 SDK、target 和启用材质的运行系统须达到 API 26。兼容更低版本时先保护新增接口调用。应用启动完成并退出加载页后，在版本保护内查询 `uiMaterial.isImmersiveMaterialSupported()`。应用级 `DISABLE` 会关闭材质，材质不可用时沿用普通视觉样式。

## 选择布局分支

API 26 及以上使用底部横向悬浮布局。材质关闭或设备不支持时，在悬浮布局内回退材质。低于 API 26 时保留原 Tabs、原侧边或底部布局、断点适配等原有设备适配。最低兼容版本已达到 26 时可直接使用悬浮布局。组件树分支由运行版本决定，设备与窗口形态由各分支内部处理。

## 配置悬浮栏和材质

`floatingBarBottomMargin` 根据目标窗口状态确定。显式构造材质时，从 `@kit.ArkUI` 导入 `uiMaterial`。

本文涉及的窗口沉浸状态、栏间距、安全区扩展、外层 padding 和滚动尾部避让，统一见[沉浸光感悬浮 Tab 布局与避让](floating-tab-layout-and-clearance.md)。

```typescript
Tabs({ barPosition: BarPosition.End }) {
  // TabContent
}
.vertical(false)
.barOverlap(true)
.barFloatingStyle({
  barBottomMargin: this.floatingBarBottomMargin,
  maskColor: Color.Transparent,
  adaptToHandedness: true
})
```

以下三个条件必须同时满足，否则悬浮背板材质不生效：

1. `barOverlap(true)`；
2. `vertical(false)`；
3. `barPosition: BarPosition.End`。

必须由工程显式配置 `barFloatingStyle` 并满足上述三个布局条件。悬浮样式生效后，系统默认启用 `THIN` 材质，不要求显式设置 `FloatingTabBarStyle.systemMaterial`。

接入分支默认在 `barFloatingStyle` 中显式设置 `maskColor: Color.Transparent`，不使用系统默认遮罩色，避免悬浮栏周围的内容被默认渐变遮罩染色或压暗。只有设计明确需要渐变遮罩时才配置非透明 `maskColor`，并可配合 `maskHeight` 控制遮罩高度；此时在方案中记录设计依据，并逐页验证滚动内容在遮罩区域的可视性。透明与其他遮罩配置只进入沉浸光感接入分支，低版本兼容分支保留接入前的遮罩与背景行为。

需要覆盖系统默认样式、赋色、反色、交互或点光源时，再显式配置：

```typescript
.barFloatingStyle({
  barBottomMargin: this.floatingBarBottomMargin,
  maskColor: Color.Transparent,
  systemMaterial: new uiMaterial.ImmersiveMaterial({
    style: uiMaterial.ImmersiveStyle.THIN
  })
})
```

无论采用默认还是显式材质，都不要再用 `barBackgroundColor` 或 `barBackgroundBlurStyle` 遮挡效果；`TabContent` 本身不支持沉浸光感。

应用级 `DEFAULT` 与 `ENABLE` 下，默认材质都依赖有效的悬浮形态。应用级 `DISABLE` 关闭材质。

## 栏宽、断点与切换动画

API 26 悬浮分支在所有断点、横竖屏和窗口尺寸下都保持底部横向Tab： `vertical(false)` 与 `BarPosition.End`。接入分支移除外层 `.barWidth(...)` 和侧栏切换条件及其专属布局配置，由 `barFloatingStyle.barWidth` 或系统默认行为控制栏宽。内容区宽度独立处理，复用原控制器、页签状态和事件。

接入沉浸光感悬浮分支时，删除接入前 Tabs 上的 `.animation(...)` 页签切换动效配置，例如 `.animation({ duration: 200, curve: Curve.EaseInOut })`。悬浮重叠布局与材质背板下不再保留切换动画，避免原有切换动效与悬浮材质渲染冲突或产生多余过渡。仅低版本兼容分支保留接入前的动画配置；材质关闭或设备不支持时仅回退材质，不恢复已删除的切换动画。
