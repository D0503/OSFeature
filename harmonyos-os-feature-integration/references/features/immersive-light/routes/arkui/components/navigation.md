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

```typescript
Tabs({ barPosition: BarPosition.End }) {
  // TabContent
}
.vertical(false)
.barOverlap(true)
.barWidth(328)
.barFloatingStyle({
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

### 可滚动 Tab 页尾部避让

`barOverlap(true)` 会让原生 ArkUI 悬浮 TabBar 覆盖在 Tab 内容上方。每个 Tab 页只要包含 `List`、`Scroll`、`WaterFlow`、可滚动 `Grid` 或自定义滚动容器，就要在最后一个真实滚动项之后增加尾部空间，使最后一个可操作项及其点击、拖拽或手势热区能够完整滚到悬浮栏上方。

- `List` 可使用 `contentEndOffset`，或在最后追加不可交互的占位项；
- `Scroll + Column` 可在真实内容末尾增加 `Blank`、bottom padding 或等价空间；
- `WaterFlow`、`Grid` 和自定义滚动容器按各自布局方式增加末尾占位或内容 padding；
- 尾部高度按当前窗口中的实际遮挡计算，通常包含可见栏高、栏底部间距和必要操作间隔，但不能重复加入外层已经承担的系统安全区；
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
