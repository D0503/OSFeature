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

底部间距、滚动尾项避让和响应式形态仍按接入前原生 Tabs 处理。只有悬浮栏实际遮挡内容时才给增强分支增加尾部空间，低版本与普通模式不继承这段补偿。

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

