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
.barFloatingStyle({
  systemMaterial: new uiMaterial.ImmersiveMaterial({
    style: uiMaterial.ImmersiveStyle.ULTRA_THIN
  })
})
```

以下三个条件必须同时满足，否则悬浮背板材质不生效：

1. `barOverlap(true)`；
2. `vertical(false)`；
3. `barPosition: BarPosition.End`。

应用级 `ENABLE` 不会自动给底部 Tabs 开启材质，必须通过 `FloatingTabBarStyle.systemMaterial` 显式设置。设置后不要再用 `barBackgroundColor` 或 `barBackgroundBlurStyle` 遮挡材质；`TabContent` 本身不支持沉浸光感。

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
- `popupBackground` 和 `popupBackgroundBlurStyle` 未主动设置或为 `undefined` 时，才允许默认材质；
- 两个背景属性与沉浸光感互斥，主动设置后材质不生效；
- 高、中算力设备显示 `THICK`，低算力设备降级为普通白色背景；
- 组件级可通过 `systemMaterial` 设置，但仍需保留普通背景路径。

## 路由判定

- 扫描到 `HdsTabs`：选择 HDS；
- 扫描到原生 `Tabs`、`FloatingTabBarStyle.systemMaterial` 或 ArkUI `uiMaterial`：选择 ArkUI；
- 同一工程两类组件都需要改造：同时选择 HDS 与 ArkUI。

## 来源

- [组件适配沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)
- [Navigation 示例20](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navigation#示例20设置systemmaterial开启标题栏材质效果)
- [Tabs 示例24](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#示例24tabbar悬浮样式)
