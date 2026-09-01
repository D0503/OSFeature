# HDS 沉浸光感接入实现

先按[兼容性与选型](../../compatibility.md)确定路线，并读取[共享回退策略](../../shared/fallback.md)。示例用于说明接口组合；修改真实工程时应复用项目现有组件、类型、主题资源和状态管理方式。

悬浮导航Tab（底部悬浮胶囊页签）的完整页面模式、运行时门禁工具和"原生 Tabs / 自研悬浮导航栏 → HDS 悬浮页签"的迁移对照，优先复用[HDS 资产目录](assets.md)中已蒸馏的资产，不重复手写。

## HDS 沉浸光感材质路线：API 23+

`HdsNavigation`/`HdsNavDestination` 从 API 18 起可用，`HdsTabs` 从 API 20 起可用；下面使用的 `hdsMaterial`、`systemMaterialEffect` 和悬浮页签 `barFloatingStyle` 则从 API 23 起可用。已有旧版 HDS 组件不等于已经具备沉浸光感能力，不能把组件的 since 版本当作本路线门槛。

标题栏或底部导航优先使用系统自适应材质：

```typescript
systemMaterialEffect: {
  materialType: hdsMaterial.MaterialType.ADAPTIVE,
  materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
}
```

如果业务必须自定义档位，先查询设备支持类型：

```typescript
  // 获取系统支持的材质类型，用于根据设备能力选择合适的材质等级
  let materialTypes: Array<hdsMaterial.MaterialType> = hdsMaterial.getSystemMaterialTypes();
  if (materialTypes.indexOf(hdsMaterial.MaterialType.IMMERSIVE) < 0) {
    // 当前设备不支持IMMERSIVE材质类型，则使用SMOOTH效果以优化性能，降低卡顿和发热风险
    this.customMaterialLevel = hdsMaterial.MaterialLevel.SMOOTH;
  }
```

- 支持 `IMMERSIVE` 时可选择 `EXQUISITE` 或 `GENTLE`；
- 不支持时降级为 `SMOOTH`；
- 普通业务继续优先选择 `ADAPTIVE + ADAPTIVE`。

导航框架中的职责要分开：

- `systemMaterialEffect` 设置材质；
- `scrollEffectOpts` 设置滚动渐变模糊；
- `dynamicHideTitleBar` 控制标题栏和状态栏随滚动显隐；
- `bindToScrollable` 把效果与内容滚动组件关联。

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

## HDS 底部悬浮 Tab 迁移

能力包内置的三组迁移对照快照显示，接入后版本都把手机、平板大断点和横屏主导航统一成底部悬浮 `HdsTabs`。共同核心如下；完整页面、低版本整树降级和自包含差异摘要见[HDS 资产与迁移证据](assets.md)。原始对照工程不随 Skill 分发，也不是执行依赖。

```typescript
HdsTabs({
  barPosition: BarPosition.End,
  index: this.currentIndex,
  controller: this.controller
}) {
  // 复用原 TabContent 与 tabBar builder
}
.scrollable(false)
.vertical(false)
.barHeight(56)
.barOverlap(true)
.barFloatingStyle({
  adaptToHandedness: true,
  systemMaterialEffect: {
    materialType: hdsMaterial.MaterialType.ADAPTIVE,
    materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
  }
})
.onChange((index: number) => {
  this.currentIndex = index;
})
```

### 可选 MiniBar

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

`barLayoutMode` 需要单独处理：它和 `HdsBarLayoutMode.HORIZONTAL` / `VERTICAL` 从 API 24 起才可用，不属于 API 23 MiniBar 基线。当 `compatibleSdkVersion < 24` 时，只能在 `deviceInfo.sdkApiVersion >= 24` 的运行时分支中引用并配置 `barLayoutMode`；API 23 分支应省略该属性，继续使用 MiniBar 的默认排列。不要使用从 API 26 才可用的 `apiAvailable` 保护 API 24 接口，也不要把 API 24 属性放进两个分支共用、会被提前求值的配置对象。

MiniBar 与 TabBar 的 `HORIZONTAL` / `VERTICAL` 是产品布局选择，不等于设备横竖屏；切换排列时仍要保留源程序已有的断点、方向、窗口模式、控制器、状态和操作。电视设备上 MiniBar 不生效，应按能力包的通用回退策略保留接入前组件树与交互。

迁移时按下面的证据层级处理：

- `BarPosition.End`、`scrollable(false)`、`barOverlap(true)`、`barFloatingStyle` 和 `ADAPTIVE + ADAPTIVE` 是三组迁移对照的共同模式。
- 56vp 是显示态栏高基线；需要随滚动隐藏时可在 56 和 0 之间切换。
- 不默认设置栏宽。三组迁移对照都移除了原生 `Tabs.barWidth`；如确需控制悬浮胶囊宽度，使用 `barFloatingStyle.barWidth` 的 small/medium/large 范围并做多窗口验证。
- `barBottomMargin: 28` 是两对工程采用的常见值，不是固定规范。设置前必须扫描 `HdsTabs` 的父级/祖先容器是否已经通过 `.padding({ bottom: ... })`、安全区或导航指示区高度预留了同一段底部空间；底部间距只能由一处承担，不能把父容器 bottom padding 与正数 `barBottomMargin` 无条件叠加。
- `animationDuration(0)`、透明 `gradientMask`、`TabContent.expandSafeArea(BOTTOM)` 和透明背景均不是三组迁移对照的统一必需项，只在对应交互或布局确有需要时保留。
- `HdsTabsController` 继承 `TabsController`，既有 `changeIndex` 通常可继续使用；仍需扫描所有类型声明、控制器注入、双击、隐藏和刷新回调。
- API 23/24 模板将 `HdsTabs` 从 `@hms.hds.hdsBaseComponent` 导入，当前 SDK 也可见 `@kit.UIDesignKit` 聚合入口。生成代码时沿用目标 SDK 与工程已验证的导入方式，最终以真实构建为准。

### 底部间距归一化

按实际布局所有权决定 `barBottomMargin`：

1. 先定位 `HdsTabs` 的直接父级和影响其布局边界的祖先，记录 `padding.bottom`、安全区扩展、导航指示区高度及其他 bottom offset。
2. 如果外层容器已经用动态 bottom padding 把整个 `HdsTabs` 区域上移，例如 `Column.padding({ bottom: windowBottomPadding })`，则 `barBottomMargin` 使用 `0`，避免再次叠加 28vp。用户给出的 `Column { HdsTabs(...) }.padding({ bottom: this.vm.windowModel.windowBottomPadding })` 结构属于这种情况。
3. 如果影响 `HdsTabs` 布局边界的外层没有底部预留，而产品需要悬浮栏与屏幕底部保持间距，才考虑 `barBottomMargin: 28`；28vp 只是已核验迁移快照中的常见起点，必须经目标设备和窗口矩阵确认。
4. 如果 bottom padding 只存在于某个 `TabContent` 的滚动内容内部、用途是避免末项被悬浮栏遮挡，它不一定会移动 `HdsTabs` 自身，不能仅凭关键词就把 `barBottomMargin` 清零；必须确认属性所在的组件层级。
5. 动态安全区变化时选择一个唯一的间距来源：要么由外层 padding 统一承担、`barBottomMargin` 为 0，要么外层不承担并由 `barBottomMargin` 计算，不能两处同时加同一份高度。

外层已经承担底部间距时，HDS 分支应写成：

```typescript
Column() {
  HdsTabs({
    barPosition: BarPosition.End,
    index: this.vm.curIndex,
    controller: this.hdsController
  }) {
    this.tabContents(false)
  }
  .width('100%')
  .height('100%')
  .scrollable(false)
  .barHeight(56)
  .barOverlap(true)
  .barFloatingStyle({
    barBottomMargin: 0,
    adaptToHandedness: true,
    systemMaterialEffect: HdsMaterialGuard.getSystemMaterialParams()
  })
}
.width('100%')
.padding({
  bottom: this.vm.windowModel.windowBottomPadding
})
```

这里的 `0` 不是新的全局默认值，而是因为同一父级 bottom padding 已经拥有底部间距。实施报告要记录最终由哪一层承担间距，并分别在有/无导航指示区、横竖屏、分屏和自由窗口下检查悬浮栏位置与内容末项可点击性。

### 滚动 Tab 页尾部避让

`barOverlap(true)` 会让悬浮栏覆盖在 Tab 内容上方。每个包含 `List`、`Scroll`、`WaterFlow`、可滚动 `Grid` 或自定义滚动容器的 Tab 页都必须单独检查：滚动到末尾时，最后一个可见项、按钮和手势热区应能完整移动到悬浮栏上方，不能停在材质胶囊下面。

滚动页需要在内容末尾提供“悬浮栏遮挡高度”对应的尾部空间：

- 对 `List`，优先使用 `contentEndOffset`，或按工程既有写法追加不可交互的尾部占位项；
- 对 `Scroll + Column` 等容器，在真实内容的最后追加 bottom padding 或尾部 `Blank`；
- 尾部空间以当前布局坐标中的实际遮挡为准，通常至少覆盖可见 `barHeight + barBottomMargin`，再结合必要的操作间隔；外层已经承担的系统安全区不要重复加入；
- 有动态隐藏能力时，可按最大可见悬浮栏高度保留稳定滚动范围，或让尾部空间与栏高同步变化，但必须验证动画过程中没有跳动和不可点击区；
- 无滚动能力的静态 Tab 页不机械增加尾部空白；所有 Tab 页逐页检查，不能只验证默认选中的第一页。

`List` 示例：

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

`Scroll` 示例：

```typescript
Scroll() {
  Column() {
    this.buildSourceContent()

    // 位于最后一个真实滚动项之后，使末项可滚到悬浮栏上方。
    Blank()
      .height(this.floatingTabOcclusionHeight)
  }
}
```

这里的页尾空间与上一节的外层 bottom padding 职责不同：外层 padding / `barBottomMargin` 决定悬浮栏位置，滚动内容尾部空间决定最后一项能否滚出悬浮栏遮挡。二者可能同时存在，但每一段高度只能按其坐标和职责计算一次。

如果 HDS 与低版本普通 `Tabs` 共用 Tab 内容 Builder，不要把 HDS 专用尾部空间无条件施加给低版本分支。通过明确参数或各页面自己的布局状态只在存在悬浮遮挡的分支启用；低版本继续保留源程序原有滚动范围、padding 和末项体验。

大断点处理必须作为显式设计决策：如果目标是迁移快照所示的统一悬浮导航，可删除旧的 `vertical`、动态 `barPosition`、侧栏 `barWidth` 和 `divider`，在大断点继续显示底部悬浮 Tab；如果产品仍要求平板/PC 侧边导航，则保留断点分支，只在小中断点使用底部 HDS 悬浮栏。不要仅因对照快照采用底部方案就静默破坏既有大屏信息架构。

### 低版本分支必须保留源程序体验

当 `compatibleSdkVersion < 23` 时，HDS 与普通 `Tabs` 是两棵运行时条件组件树。HDS 分支可以按产品确认后的新方案统一为底部悬浮，但普通 `Tabs` 分支不是简化示例或全新降级设计，必须保留接入前源程序的行为：

- 继续使用原有断点、横竖屏和窗口模式条件，保持对应的底部横向栏或侧边纵向栏；
- 原样迁移这些条件控制的 `vertical`、`barPosition`、`barMode`、`barWidth`、`barHeight`、`divider` 和背景属性；
- 保留原控制器、当前索引、页签顺序、自定义 TabBar、双击、隐藏、刷新和页面切换回调；
- 只把公共 `TabContent` 抽成 Builder 复用，不要为了减少重复而丢失两个分支不同的导航外观和交互；
- 在 API 23 以下设备分别覆盖原工程支持的手机、平板/大窗口、横屏、分屏与自由窗口矩阵。

因此不能把能力包示例中的某个固定栏宽、栏高或 `BarPosition.End` 直接复制到所有普通 `Tabs` 降级分支。实施前先保存接入前 Tabs 属性与行为清单，实施后逐项对照。

ArkUI 普通组件、菜单、弹窗和应用级材质不在本文件维护；组合路线继续读取[ArkUI 接入实现](../arkui/implementation.md)。
