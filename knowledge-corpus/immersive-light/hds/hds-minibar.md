---
title: "HDS 沉浸光感 MiniBar"
summary: "MiniBar 接口、示例与 API 24 布局模式"
createdAt: "2026-11-13"
updatedAt: "2026-11-13"
tags: ["HarmonyOS","沉浸光感","HDS"]
---

# HDS 沉浸光感 MiniBar

## 可选 MiniBar

MiniBar 是悬浮 `HdsTabs` 的可选折叠形态，不是沉浸光感的默认必选项。只在产品确有“折叠后继续显示摘要或快捷操作”的需求时启用；`miniBarBuilder` 必填，并应复用源程序的真实状态、控制器和操作，不要用演示文案替换业务内容。

MiniBar 核心接口从 API 23 起可用，包括 `barFloatingStyle.miniBar`、`miniBarBuilder`、`miniBarWidth`、`miniBarStyle`、`enableMiniBarBackground`、`enableMiniBarClip` 以及 `HdsTabsController.applyMiniBarStyle()`。基础组合示例：

```typescript
import {
  HdsBarStyle,
  HdsTabs,
  HdsTabsController,
  hdsMaterial
} from '@kit.UIDesignKit';

private controller: HdsTabsController = new HdsTabsController();

@Builder
private buildMiniBar() {
  Row({ space: 8 }) {
    Text(this.currentTitle)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
    Blank()
    Button('暂停')
      .onClick(() => this.onSourceMiniBarAction())
  }
  .width('100%')
  .padding({ left: 12, right: 12 })
}

HdsTabs({
  barPosition: BarPosition.End,
  index: this.currentIndex,
  controller: this.controller
}) {
  // 复用源程序的 TabContent 与 tabBar builder
}
.scrollable(false)
.vertical(false)
.barHeight(56)
.barOverlap(true)
.barFloatingStyle({
  barBottomMargin: this.floatingBarBottomMargin,
  adaptToHandedness: true,
  systemMaterialEffect: {
    materialType: hdsMaterial.MaterialType.ADAPTIVE,
    materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
  },
  miniBar: {
    miniBarBuilder: () => this.buildMiniBar(),
    miniBarStyle: HdsBarStyle.EXPAND,
    enableMiniBarBackground: true,
    enableMiniBarClip: true
  }
})
```

默认不设置 `miniBarWidth`，让 HDS 先按窗口自适应；确需约束时再用 `smallWidth`、`mediumWidth`、`largeWidth` 分段配置，并结合真实文案、字体放大、多语言、窗口尺寸和快捷操作数量校准。若需要由应用主动折叠或展开，可调用 `controller.applyMiniBarStyle(HdsBarStyle.COLLAPSE | HdsBarStyle.EXPAND)`，并确保切换不改变当前页签、播放/编辑状态或既有事件语义。

`barLayoutMode` 需要单独处理：它和 `HdsBarLayoutMode.HORIZONTAL` / `VERTICAL` 从 API 24 起才可用，不属于 API 23 MiniBar 基线。当 `compatibleSdkVersion < 24` 时，只能在 `deviceInfo.apiAvailable(24)` 的运行时分支中引用并配置 `barLayoutMode`；API 23 分支应省略该属性，继续使用 MiniBar 的默认排列。使用 `apiAvailable(24)` 需要 SDK 26.0.0+ 编译；不要把 API 24 属性放进两个分支共用、会被提前求值的配置对象。

MiniBar 与 TabBar 的 `HORIZONTAL` / `VERTICAL` 是产品布局选择，不等于设备横竖屏；切换排列时仍要保留源程序已有的断点、方向、窗口模式、控制器、状态和操作。电视设备上 MiniBar 不生效，应按能力包的通用回退策略保留接入前组件树与交互。
