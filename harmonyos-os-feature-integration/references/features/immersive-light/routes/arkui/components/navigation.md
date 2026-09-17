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
.barWidth(328)
.barFloatingStyle({
  barBottomMargin: this.floatingBarBottomMargin,
  adaptToHandedness: true
})
```

以下三个条件必须同时满足，否则悬浮背板材质不生效：

1. `barOverlap(true)`；
2. `vertical(false)`；
3. `barPosition: BarPosition.End`。

必须由工程显式配置 `barFloatingStyle` 并满足上述三个布局条件。悬浮样式生效后，系统默认启用 `THIN` 材质，不要求显式设置 `FloatingTabBarStyle.systemMaterial`。

需要覆盖系统默认样式、赋色、反色、交互或点光源时，再显式配置：

```typescript
.barFloatingStyle({
  barBottomMargin: this.floatingBarBottomMargin,
  systemMaterial: new uiMaterial.ImmersiveMaterial({
    style: uiMaterial.ImmersiveStyle.THIN
  })
})
```

无论采用默认还是显式材质，都不要再用 `barBackgroundColor` 或 `barBackgroundBlurStyle` 遮挡效果；`TabContent` 本身不支持沉浸光感。

### 悬浮 TabBar 宽度与左右边距

工程改造时，ArkUI 悬浮 TabBar 默认设置 `.barWidth(328)`，宽度为 328vp，居中并保持左右留白一致。栏宽按以下规则选择：

| Tab 数量与工程条件 | 当前断点 | `.barWidth()` |
|---|---|---:|
| Tab 数量不超过 4，或工程没有一多断点 | 任意 | 328 |
| Tab 数量大于 4，且工程已有一多断点 | `sm` | 328 |
| Tab 数量大于 4，且工程已有一多断点 | 其他已识别断点 | 360 |

- Tab 数量按实际显示的页签计算；沿用工程已有断点状态与监听，页签数量或断点变化时同步更新栏宽。断点尚未确定时使用 328vp。
- 只有工程已有一多断点时才使用下面的条件写法，字段替换为工程的实际页签数量和断点变量；没有断点时直接使用 `.barWidth(328)`。

```typescript
.barWidth(this.tabCount > 4 && !!this.currentBreakpoint && this.currentBreakpoint !== 'sm' ? 360 : 328)
```

- 这里约束的是悬浮 TabBar 背板。`Tabs` 内容容器可以保持 `.width('100%')`，不要将整页 `TabContent` 一并缩窄。定位时复用工程已有水平边距，避免重复计入外层缩进，并检查窄窗口下的可用空间。
- 该调整应用于悬浮分支；普通 Tabs 回退分支保留接入前的宽度和边距。

### 普通与悬浮分支的外层 padding

按[共享外层避让规则](../../../shared/validation.md#普通与悬浮-tab-的外层避让)追踪 padding 的用途。普通 Tab 用于避让导航条的 `windowBottomPadding` 只保留在普通分支；悬浮分支由栏底部间距负责，不能继续缩小整个 Tabs 的内容区域。两个分支共用父容器时，对这项 padding 使用工程实际悬浮布局条件，例如 `bottom: this.useFloatingTab ? 0 : this.vm.windowModel.windowBottomPadding`。其他用途的 padding 逐项判断；显式与默认 `barBottomMargin` 均需核对，不能因祖先存在 padding 就将 margin 清零。

### 可滚动 Tab 页尾部避让

先按[共享验证规则](../../../shared/validation.md#悬浮-tab-的滚动尾部避让)追踪真实滚动容器。页面与滚动视口应延伸到悬浮栏下方；补偿放在实际列表内容末尾，不能在页面外层增加 bottom padding 来缩短内容区。子组件内的列表独立滚动时，进入该子组件处理；下方 `Scroll + Column` 示例仅适用于 Scroll 确实负责内容滚动的情形。

`barOverlap(true)` 会让原生 ArkUI 悬浮 TabBar 覆盖在 Tab 内容上方。每个 Tab 页只要包含 `List`、`Scroll`、`WaterFlow`、可滚动 `Grid` 或自定义滚动容器，就要在最后一个真实滚动项之后增加尾部空间，使最后一个可操作项及其点击、拖拽或手势热区能够完整滚到悬浮栏上方。

- `List` 可使用 `contentEndOffset`，或在最后追加不可交互的占位项；
- `Scroll + Column` 可在真实内容末尾增加 `Blank`、bottom padding 或等价空间；
- `WaterFlow`、`Grid` 和自定义滚动容器按各自布局方式增加末尾占位或内容 padding；
- 遮挡补偿默认使用 `barHeight + barBottomMargin`，使用最终实际配置的栏间距，ArkUI Tabs 未设置时默认 28vp，再结合必要的操作间隔；外层已经承担的系统安全区不要重复加入；
- 有动态显隐时按最大可见遮挡保留稳定空间，或让尾部空间与栏高同步，并验证动画中没有跳动和不可点击区；
- 无滚动内容的页面不机械增加空白，所有 Tab 页必须逐页检查，不能只处理默认页。

```typescript
Scroll() {
  Column() {
    this.buildSourceContent()

    // 位于最后一个真实滚动项之后。
    Blank()
      .height(this.floatingTabOcclusionHeight)
  }
}
```

这段空间只属于实际使用 `barOverlap(true)` 的 ArkUI 悬浮重叠分支。API 26 以下或其他回退路径如果恢复普通非悬浮 Tabs，就继续保留接入前的响应式形态、滚动范围和 padding；设备不支持或业务关闭材质时，如果页面仍保留普通样式的重叠悬浮栏，尾部避让仍然需要。悬浮栏定位所使用的外层 padding 或栏外边距，与滚动内容尾部避让是两种职责，必须按组件层级分别计算。

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

## 来源

- [组件适配沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)
- [Navigation 示例20](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navigation#示例20设置systemmaterial开启标题栏材质效果)
- [Tabs 示例24](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#示例24tabbar悬浮样式)
