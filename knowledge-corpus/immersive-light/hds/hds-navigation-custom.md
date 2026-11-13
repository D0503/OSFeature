---
title: "HDS 沉浸光感标题栏自定义区域与显隐"
summary: "自定义区域、组件级安全区、动态显隐与标题栏菜单"
createdAt: "2026-11-13"
updatedAt: "2026-11-13"
tags: ["HarmonyOS","沉浸光感","HDS"]
---

# HDS 沉浸光感标题栏自定义区域与显隐

## 自定义区域、组件级安全区与显隐

- `titleBar.content.stackBuilder` 设置标题栏顶部自定义区域；`bottomBuilder` 设置底部自定义区域，`height` 应与真实内容一致（默认 56vp，不支持百分比）。`showType` 可选 `BottomBuilderShowType.DIRECTLY_SHOW` 或 `OVERDRAG_SHOW`，仅在 `HideMode.SCROLL_UP_TO` 下生效。
- `titleBar.enableComponentSafeArea` 从 API 20 起可用，默认 false；为 true 时将标题栏设为组件级安全区。它不是向系统安全区延伸的 `expandSafeArea`，不作为沉浸光感默认开启项。按需启用时，与 `contentStartOffset` 或内部占位只补偿一次，验证内容仍能滚入标题栏下方。
- `dynamicHideTitleBar.hideStatusBar` 仅在 `hideTitleArea: true` 时生效；`hideBottomBuilder` 单独控制底部自定义区域。`HdsNavigationTitleMode.MODAL` 下动态显隐无效，显隐过程中不动态切换配置，不因接入材质而自动隐藏状态栏。

从 `@kit.UIDesignKit` 导入 `BottomBuilderShowType`、`HideMode`。下面的 `headerOverlay`、`filterBar` 复用工程已有 Builder，`filterBarHeight` 与实际高度一致；无对应区域时省略字段，不创建空区域：

```typescript
HdsNavigation() {
  // 保留已绑定 this.scroller 的滚动内容
}
.titleBar({
  content: {
    title: { mainTitle: '列表' },
    stackBuilder: (): void => this.headerOverlay(),
    bottomBuilder: {
      builder: (): void => this.filterBar(),
      height: this.filterBarHeight,
      showType: BottomBuilderShowType.DIRECTLY_SHOW
    }
  }
})
.dynamicHideTitleBar({
  hideTitleArea: true,
  hideBottomBuilder: true,
  hideStatusBar: false,
  mode: HideMode.SCROLL_UP_TO
})
.bindToScrollable([this.scroller])
```

仅在工程确需组件级安全区时，在 `titleBar` 对象中加入 `enableComponentSafeArea: true`。自定义区域中的按钮按各自入口配置材质，不给整个 Builder 根容器统一铺设材质。以上片段按需合并到工程，保留原有菜单、业务内容、版本保护及安全区扩展规则。

标题栏包含菜单按钮时，菜单对象必须使用 HDS 的明确类型 `HdsNavigationMenuContentOptions`，并传给 `titleBar.content.menu`。不要把它声明成无类型对象、`object` 或动态类型；没有菜单时无需创建空对象。导入和声明示例：

```typescript
import {
  HdsNavigation,
  HdsNavigationMenuContentOptions,
  HdsNavigationTitleMode,
  ScrollEffectType,
  hdsMaterial
} from '@kit.UIDesignKit';

private menus: HdsNavigationMenuContentOptions = {
  value: [
    {
      content: {
        label: '编辑',
        icon: $r('sys.symbol.square_and_pencil')
      }
    },
    {
      content: {
        label: '更多',
        icon: $r('sys.symbol.more')
      }
    }
  ]
};
```

改造真实工程时，继续使用源程序原有菜单项、顺序、图标、文案、点击行为和可访问性信息，只把容器声明对齐到 `HdsNavigationMenuContentOptions`；不要用示例菜单替换业务菜单。

```typescript
HdsNavigation() {
  // 页面内容
}
.titleBar({
  content: {
    title: {
      mainTitle: 'Title'
    },
    menu: this.menus
  },
  style: {
    scrollEffectOpts: {
      enableScrollEffect: true,
      scrollEffectType: ScrollEffectType.IMMERSIVE_GRADIENT_BLUR
    },
    systemMaterialEffect: {
      materialType: hdsMaterial.MaterialType.ADAPTIVE,
      materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
    }
  }
})
.dynamicHideTitleBar({
  hideTitleArea: true,
  hideStatusBar: true,
  mode: HideMode.SCROLL_UP_TO
})
.bindToScrollable([this.scroller])
```

`IMMERSIVE_GRADIENT_BLUR` 从透明渐变到模糊，范围更大；`GRADIENT_BLUR` 从半透明渐变到模糊，表现更克制。根据页面背景和滚动内容选择，不要把滚动模糊当作材质本身。

未开启窗口沉浸式时，标题栏沉浸光感需要布局延伸到状态栏下方，`dynamicHideTitleBar` 隐藏状态栏时同样依赖该延伸。先按[沉浸光感悬浮 Tab 布局与避让](../shared/floating-tab-layout-and-clearance.md#窗口沉浸状态与栏间距)核对目标窗口，再沿 HdsNavigation/HdsNavDestination → 页面根容器 → 真实滚动容器逐组件配置 `.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])`，仅给滚动容器设置不足以完成整条链的扩展。同一组件同时处于悬浮 Tab 的底部扩展链时，一次调用 `.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM, SafeAreaEdge.TOP])`，不拆成两次调用。已开启窗口沉浸式的窗口复用现有方案，不因本次接入重复添加安全区扩展。

自定义标题按[沉浸光感标题栏内容避让与自定义标题](../shared/shared-title-clearance.md#标题栏内容避让与自定义标题)明确占用高度，检查首项遮挡；需要避让时优先在真实滚动容器上设置 `contentStartOffset`，也允许随内容滚动的内部顶部占位，两者不重复补偿。不得用滚动容器自身或外层顶部 padding 缩短、下移滚动视口，保持内容能滚入标题栏下方。**标题栏中的按钮默认接入沉浸光感**：系统返回键和菜单使用 HDS 对应标题栏入口；自定义 Builder 须进入内部，逐个为受支持的实际按钮配置相应材质，不能用整个 Builder 根容器的材质代替按钮接入。
