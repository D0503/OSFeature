# ArkUI 导航类组件

本文件只覆盖原生 ArkUI `Navigation`、`NavDestination`、`Tabs` 和 `AlphabetIndexer`。`HdsNavigation`、`HdsTabs` 与 MiniBar 读取 HDS 路线。

## Navigation 标题栏

- 应用级 `ENABLE` 时默认使用 `ULTRA_THIN`；非 `ENABLE` 状态下不自动生效；
- 组件级入口是 `NavigationTitleOptions.systemMaterial`；
- 材质范围是返回键和非自定义 Menu，自定义标题或自定义菜单要分别处理自身背景；
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
  barStyle: BarStyle.STACK
})
```

## 原生底部 Tabs

原生 `Tabs` 的悬浮材质属于 ArkUI API 26 路线，不是 `HdsTabs`：

先按[窗口沉浸状态规则](../../../shared/validation.md#窗口沉浸状态与栏间距)核对目标窗口。ArkUI Tabs 的 `barBottomMargin` 默认 28vp；接入时已开启窗口沉浸式显式设置 28vp，未开启时显式设置 0vp，并为所有一级 Tab 页及滚动容器的完整父组件链配置底部 `expandSafeArea`。不自动开启全局窗口沉浸式，状态不明确时先核对调用链。以下 `this.floatingBarBottomMargin` 表示工程按已确认状态设置的值。

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

### 悬浮分支的页签切换动画

接入沉浸光感悬浮分支时，删除接入前 Tabs 上的 `.animation(...)` 页签切换动效配置，例如 `.animation({ duration: 200, curve: Curve.EaseInOut })`。悬浮重叠布局与材质背板下不再保留切换动画，避免原有切换动效与悬浮材质渲染冲突或产生多余过渡。仅低版本兼容分支保留接入前的动画配置；材质关闭或设备不支持时仅回退材质，不恢复已删除的切换动画。

### 悬浮 TabBar 栏宽与断点

接入时删除外层 `.barWidth(...)`，让 `barFloatingStyle.barWidth` 的配置或默认行为自动生效，不额外添加固定宽度。`Tabs` 内容容器可以保持 `.width('100%')`，不要将整页 `TabContent` 一并缩窄。

按[共享栏宽与断点规则](../../../shared/validation.md#悬浮-tab-栏宽与断点)，沉浸光感接入分支在所有断点、横竖屏和窗口尺寸下均使用 `vertical(false)` 与 `BarPosition.End`，移除侧栏切换条件及其专属布局配置。仅低版本兼容分支保留原有响应式形态和栏宽；材质关闭或设备不支持时，材质回退不恢复侧边 Tab。

### 普通与悬浮分支的外层 padding

按[共享外层避让规则](../../../shared/validation.md#普通与悬浮-tab-的外层避让)追踪 padding 的用途。普通 Tab 用于避让导航条的 `windowBottomPadding` 只保留在普通分支；悬浮分支由栏底部间距负责，不能继续缩小整个 Tabs 的内容区域。两个分支共用父容器时，对这项 padding 使用工程实际悬浮布局条件，例如 `bottom: this.useFloatingTab ? 0 : this.vm.windowModel.windowBottomPadding`。其他用途的 padding 逐项判断；显式与默认 `barBottomMargin` 均需核对，不能因祖先存在 padding 就将 margin 清零。

### 可滚动 Tab 页尾部避让

先按[共享验证规则](../../../shared/validation.md#悬浮-tab-的滚动尾部避让)追踪真实滚动容器。页面与滚动视口应延伸到悬浮栏下方；补偿放在实际列表内容末尾，不能在页面外层增加 bottom padding 来缩短内容区。子组件内的列表独立滚动时，进入该子组件处理，先查清已有补偿和各窗口模式下的滚动职责再修改。

`barOverlap(true)` 会让原生 ArkUI 悬浮 TabBar 覆盖在 Tab 内容上方。每个 Tab 页只要包含 `List`、`Scroll`、`WaterFlow`、可滚动 `Grid` 或自定义滚动容器，就要在最后一个真实滚动项之后增加尾部空间，使最后一个可操作项及其点击、拖拽或手势热区能够完整滚到悬浮栏上方。

- `List` 可使用 `contentEndOffset`，或在最后追加不可交互的占位项；
- `Scroll + Column` 只有确实负责该内容滚动、尾部空间随内容滚动且不挤占子列表视口时，才使用内容末尾 padding 或占位；
- `WaterFlow`、`Grid` 和自定义滚动容器按各自布局方式增加末尾占位或内容 padding；
- 遮挡补偿默认使用 `barHeight + barBottomMargin`，使用最终实际配置的栏间距，ArkUI Tabs 未设置时默认 28vp，再结合必要的操作间隔；外层已经承担的系统安全区不要重复加入；
- 有动态显隐时按最大可见遮挡保留稳定空间，或让尾部空间与栏高同步，并验证动画中没有跳动和不可点击区；
- 无滚动内容的页面不机械增加空白，所有 Tab 页必须逐页检查，不能只处理默认页。

优先修改真实列表已有的尾部配置，先核对是否已经包含本次补偿。外层 Scroll 为 None、内部 Tabs/List 负责滚动时，不能在 Tabs/List 后方追加兄弟 Blank；这会挤占滚动视口并产生固定底部空白。Scroll 内容末尾占位只有在确认该 Scroll 实际滚动且不挤占子列表视口时才适用；逐页检查组件路径、已有补偿和滚动效果。

这段空间只属于实际使用 `barOverlap(true)` 的 ArkUI 悬浮重叠分支。API 26 以下兼容分支继续保留接入前的响应式形态、滚动范围和 padding；设备不支持或业务关闭材质时保持底部布局，普通样式的重叠悬浮栏仍然需要尾部避让。悬浮栏定位所使用的外层 padding 或栏外边距，与滚动内容尾部避让是两种职责，必须按组件层级分别计算。

## AlphabetIndexer

- 应用级 `ENABLE` 时提示弹窗默认使用 `THICK`；
- `popupBackground`、`popupBackgroundBlurStyle` 均未设置或为 `undefined` 时，提示弹窗默认开启沉浸光感，材质样式为 `THICK`；
- 两个背景属性与沉浸光感互斥，主动设置后材质不生效；
- 高、中算力设备显示 `THICK`，低算力设备降级为普通白色背景；
- 提示弹窗通过上述背景属性条件控制默认材质，回退时保留普通背景路径。

## 路由判定

- 扫描到 `HdsTabs`：选择 HDS；
- 扫描到原生 `Tabs` 的有效悬浮形态、`FloatingTabBarStyle.systemMaterial` 或 ArkUI `uiMaterial`：选择 ArkUI；
- 同一工程两类组件都需要改造：同时选择 HDS 与 ArkUI。
