---
title: "HDS 沉浸光感悬浮 Tab 避让与低版本回退"
summary: "底部间距、滚动尾部避让与低版本回退"
createdAt: "2026-11-13"
updatedAt: "2026-11-13"
tags: ["HarmonyOS","沉浸光感","HDS"]
---

# HDS 沉浸光感悬浮 Tab 避让与低版本回退

## 底部间距归一化

按[沉浸光感悬浮 Tab 布局与避让](../shared/floating-tab-layout-and-clearance.md#普通与悬浮-tab-的外层避让)核对布局用途与分支。

若两个分支共用的外层容器原本通过 `windowBottomPadding` 为普通 Tab 避让导航条，可将该容器的属性按实际悬浮分支条件设置：

```typescript
.padding({
  bottom: this.useFloatingTab ? 0 : this.vm.windowModel.windowBottomPadding
})
```

`useFloatingTab` 应替换为工程实际决定悬浮布局的条件，不仅是材质开关；这里的 0 只针对普通 Tab 导航条避让用途的外层 padding。

## 滚动 Tab 页尾部避让

按[沉浸光感悬浮 Tab 布局与避让](../shared/floating-tab-layout-and-clearance.md#悬浮-tab-的滚动尾部避让)核对真实滚动容器和尾部补偿。

无已有尾部间距时的 List 示例；已有配置在原处调整，保留基础间距且不重复补偿：

```typescript
List() {
  LazyForEach(this.dataSource, (item: ItemModel) => {
    ListItem() {
      this.buildSourceItem(item)
    }
  })
}
.contentEndOffset(this.floatingTabOcclusionHeight)
```

## 低版本分支必须保留源程序体验

当 `compatibleSdkVersion < 23` 时，HDS 与普通 `Tabs` 是两棵运行时条件组件树。HDS 分支统一为底部悬浮，低版本普通 `Tabs` 分支必须保留接入前源程序的行为：

- 继续使用原有断点、横竖屏和窗口模式条件，保持对应的底部横向栏或侧边纵向栏；
- 原样迁移这些条件控制的 `vertical`、`barPosition`、`barMode`、`barWidth`、`barHeight`、`divider` 和背景属性；
- 保留原控制器、当前索引、页签顺序、自定义 TabBar、双击、隐藏、刷新和页面切换回调；
- 只把公共 `TabContent` 抽成 Builder 复用，不要为了减少重复而丢失两个分支不同的导航外观和交互；
- 在 API 23 以下设备分别覆盖原工程支持的手机、平板/大窗口、横屏、分屏与自由窗口矩阵。

因此不能把能力包示例中的某个固定栏宽、栏高或 `BarPosition.End` 直接复制到所有普通 `Tabs` 降级分支。实施前先保存接入前 Tabs 属性与行为清单，实施后逐项对照。
