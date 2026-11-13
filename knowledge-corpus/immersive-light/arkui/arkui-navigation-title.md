---
title: "ArkUI 沉浸光感 Navigation 标题栏与内容避让"
summary: "说明 Navigation 与 NavDestination 标题栏和按钮的材质配置、滚动模糊、顶部安全区及首项内容避让。"
createdAt: "2026-11-11"
updatedAt: "2026-11-11"
tags: ["HarmonyOS","沉浸光感","ArkUI","Navigation","NavDestination","标题栏","contentStartOffset"]
---

# ArkUI 沉浸光感 Navigation 标题栏与内容避让

适用于 Stage 模型的原生 ArkUI。编译 SDK、target 和启用材质的运行系统须达到 API 26。兼容更低版本时先保护新增接口调用。应用启动完成并退出加载页后，在版本保护内查询 `uiMaterial.isImmersiveMaterialSupported()`。应用级 `DISABLE` 会关闭材质，材质不可用时沿用普通视觉样式。

## 配置标题栏材质

- 应用级 `ENABLE` 时默认使用 `ULTRA_THIN`；非 `ENABLE` 状态下不自动生效；
- 组件级入口是 `NavigationTitleOptions.systemMaterial`；
- 接入标题栏沉浸光感时，默认在标题栏选项中配置 `scrollEffectOptions: { scrollEffectType: ScrollEffectType.GRADUAL_BLUR }`，启用滚动渐变模糊；
- **标题栏中的按钮默认接入沉浸光感**：返回键和非自定义 Menu 使用标题栏选项的材质入口；自定义标题或菜单须进入 Builder 内，逐个为受支持的实际按钮配置材质，不能用整个 `titleBuilder` 根容器的材质代替按钮接入；Search、选择类等其他组件按各自规则处理；
- `barStyle: BarStyle.STACK` 与材质没有硬依赖，但可让内容延伸到标题栏区域，是推荐组合；
- `undefined` 会恢复当前 MaterialState 下的标题栏默认行为；明确关闭使用 `Material.empty`。

最小形态：

```typescript
.title('首页', {
  systemMaterial: new uiMaterial.ImmersiveMaterial({
    style: uiMaterial.ImmersiveStyle.ULTRA_THIN,
    colorInvert: true,
    interactive: true,
    lightEffect: {}
  }),
  barStyle: BarStyle.STACK,
  scrollEffectOptions: {
    scrollEffectType: ScrollEffectType.GRADUAL_BLUR
  }
})
```

## 窗口状态与顶部安全区

追踪目标窗口实际执行的 `setWindowLayoutFullScreen`、初始化顺序及后续切换。窗口已开启沉浸式时复用现有布局。窗口未开启沉浸式时，通过 `.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])` 让目标布局延伸到状态栏下方，保留窗口原有全局设置。

逐层覆盖主页面容器 → Navigation 或 NavDestination → 页面根容器 → 真实滚动容器。遇到自定义组件或 Builder 时检查内部布局。首屏背景图需要延伸时，继续检查滚动容器内部的背景绘制链，例如 Scroll → 内容 Builder → Stack → Image。可操作的首项仍需避让。

与底部悬浮 Tabs 共用的节点用一次调用合并 `[SafeAreaEdge.BOTTOM, SafeAreaEdge.TOP]`，并保留原有仍适用的类型与方向。安全区扩展随目标页面和实际布局分支生效。

窗口状态判断和安全区扩展的共用规则，详见[沉浸光感悬浮 Tab 布局与避让](../shared/floating-tab-layout-and-clearance.md#窗口沉浸状态与栏间距)中的「窗口沉浸状态与栏间距」。

## 自定义标题高度与内容避让

两条路线的共用要求见[沉浸光感标题栏内容避让与自定义标题](../shared/shared-title-clearance.md#标题栏内容避让与自定义标题)。

搜索区域随滚动收缩时，结合内容起始偏移、标题高度、位移、透明度与搜索组件材质。实现见[ArkUI 沉浸光感标题栏滚动联动正例](arkui-title-scroll.md#正例一搜索框标题栏随滚动收缩)中的「正例一：搜索框标题栏随滚动收缩」。

先检查首项及其操作热区。需要避让时，在真实滚动容器设置 `contentStartOffset`，或在滚动内容内添加可随内容移出视口的顶部占位。一个避让量只计一次。保持滚动视口可延伸到标题栏下方，避免用容器外层顶部 padding 下移视口。

自定义标题声明高度，并让 Builder 根容器 `.height(this.titleHeight)` 与其匹配。

```typescript
NavDestination() {
  Scroll() {
    // 页面内容
  }
  .contentStartOffset(this.totalTitleHeight)
}
.title({ builder: this.titleBuilder, height: this.titleHeight }, {
  barStyle: BarStyle.STACK,
  scrollEffectOptions: {
    scrollEffectType: ScrollEffectType.GRADUAL_BLUR
  }
})
```

`totalTitleHeight` 是初始避让高度，`titleHeight` 是当前标题高度。按实际布局与字体确定尺寸。

## 可选：滚动内容切换到标题栏

仅在内容标题或分类栏滚入标题栏后需要接替显示时，使用页面共享状态切换内容区和标题栏的两个展示位置。内容区使用 `Visibility.Hidden` 保留占位，标题栏使用固定承接容器，避免切换改变测量位置和滚动范围。

位置判断、回切和分类状态共享的实现见[ArkUI 沉浸光感标题栏滚动联动正例](arkui-title-scroll.md#正例二内容分类栏滚入标题栏后接替显示)中的「正例二：内容分类栏滚入标题栏后接替显示」。

在页面组件中维护切换状态，使用同一布局帧、同一窗口坐标系测得的内容占位顶部与标题栏承接位置比较，统一转换为 vp。以下方法接收已完成测量的坐标；`switchTolerance` 是可按工程调整的回切容差，避免临界位置反复切换：

```typescript
@Local showTitle: boolean = false
@Local selectedIndexes: number[] = [0]
private switchTolerance: number = 2

private updateTitlePlacement(contentTopVp: number, titleSlotTopVp: number): void {
  if (!Number.isFinite(contentTopVp) || !Number.isFinite(titleSlotTopVp)) {
    return
  }
  if (!this.showTitle && contentTopVp <= titleSlotTopVp) {
    this.showTitle = true
  } else if (this.showTitle && contentTopVp > titleSlotTopVp + this.switchTolerance) {
    this.showTitle = false
  }
}
```

实施时配套处理：

- 为内容占位和始终存在的标题栏承接容器设置页面实例内唯一的 ID；布局就绪后，用 `getUIContext().getComponentUtils().getRectangleById(id).windowOffset.y` 读取两者坐标，再通过 `px2vp` 转换。不要用标题文字的高度代替窗口坐标，也不要测量切换后已移除的标题文字节点。节点未就绪或测量失败时保留当前状态，等待有效布局后重测。
- 真实滚动容器的 `onDidScroll` 触发位置更新，读取滚动布局完成后的几何位置；不累计 `yOffset` 后再从当前窗口坐标中重复扣减。嵌套滚动时，实际影响该内容位置的滚动容器都要触发更新。
- 内容区使用 `.visibility(this.showTitle ? Visibility.Hidden : Visibility.Visible)`；标题 Builder 内按 `showTitle` 显示原标题或对应内容。隐藏副本不应继续响应操作或被无障碍重复读取，切换时核对焦点。
- 分类等可交互内容的选中值、筛选条件和回调由页面统一持有，两处展示绑定同一状态。例如将 `ClassifyComponent` 改为接收页面的 `selectedIndexes` 和更新回调，不能让两个实例各自保留独立 `@Local` 选中值。原有业务回调只执行一次。
- 保持 `.title({ builder, height })` 与 Builder 根容器高度一致，内容起始偏移按前述避让规则设置；该切换逻辑不修改标题高度。切勿在阈值相等时将位置比例写入 `titleHeight`。
- 页面重新显示、数据或图片改变布局、窗口尺寸和字体变化后重新测量；标题栏按钮继续按各自入口配置沉浸光感，内容切换本身不赋予普通内容区按钮标题栏材质生效域。
