# HDS 沉浸光感接入实现

先按[兼容性与选型](../../compatibility.md)确定路线，并读取[共享回退策略](../../shared/fallback.md)。示例用于说明接口组合；修改真实工程时应复用项目现有组件、类型、主题资源和状态管理方式。

悬浮导航Tab（底部悬浮胶囊页签）的工程迁移参考见[HDS 迁移参考](assets.md)。按本文短示例修改目标工程的实际组件和配置入口，保留既有页面结构与业务行为。

## HDS 沉浸光感材质路线：API 23+

`HdsNavigation`/`HdsNavDestination` 从 API 18 起可用，`HdsTabs` 从 API 20 起可用；下面使用的 `hdsMaterial`、`systemMaterialEffect` 和悬浮页签 `barFloatingStyle` 则从 API 23 起可用。已有旧版 HDS 组件不等于已经具备沉浸光感能力，不能把组件的 since 版本当作本路线门槛。

标题栏或底部导航优先使用系统自适应材质：

```typescript
systemMaterialEffect: {
  materialType: hdsMaterial.MaterialType.ADAPTIVE,
  materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
}
```

`compatibleSdkVersion >= 23` 时无需增加 API 23 版本分支；低于 23 时，用低版本可用的 `deviceInfo.sdkApiVersion` 保护 HDS 材质配置和调用。普通 ArkTS 方法内的最小示例：

```typescript
import { deviceInfo } from '@kit.BasicServicesKit';
import { hdsMaterial, SystemMaterialParams } from '@kit.UIDesignKit';

if (deviceInfo.sdkApiVersion >= 23) {
  const materialParams: SystemMaterialParams = {
    materialType: hdsMaterial.MaterialType.ADAPTIVE,
    materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
  };
  // 在目标组件支持的配置入口使用 materialParams。
}
```

版本判断只说明接口版本可用，不代表设备支持所有材质档位；不能用 API 26 才可用的 `deviceInfo.apiAvailable` 保护低版本。页面从原生组件迁移到 HDS 时，在受影响组件范围保留低版本原组件分支，继续复用原状态、控制器调用和业务内容；HDS 专属枚举、配置和对象构造不得提前在分支外求值。

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

先按[窗口沉浸状态规则](../../shared/validation.md#窗口沉浸状态与栏间距)核对目标窗口。HDS 的 `barBottomMargin` 默认 0；本 Skill 接入时，已开启窗口沉浸式显式设置 28vp，未开启时显式设置 0vp，并为所有一级 Tab 页的真实滚动容器及全部父组件配置底部 `expandSafeArea`。状态不明时先查调用链，不自动开启全局窗口沉浸式。以下 `this.floatingBarBottomMargin` 表示按该规则确认后的工程配置值，不是通过静态扫描猜出的窗口状态。

接入分支把手机、平板大断点和横屏主导航统一成底部悬浮 `HdsTabs`。核心配置如下；迁移规则与适用边界见[HDS 迁移参考](assets.md)。

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
  barBottomMargin: this.floatingBarBottomMargin,
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

`barLayoutMode` 需要单独处理：它和 `HdsBarLayoutMode.HORIZONTAL` / `VERTICAL` 从 API 24 起才可用，不属于 API 23 MiniBar 基线。当 `compatibleSdkVersion < 24` 时，只能在 `deviceInfo.sdkApiVersion >= 24` 的运行时分支中引用并配置 `barLayoutMode`；API 23 分支应省略该属性，继续使用 MiniBar 的默认排列。不要使用从 API 26 才可用的 `apiAvailable` 保护 API 24 接口，也不要把 API 24 属性放进两个分支共用、会被提前求值的配置对象。

MiniBar 与 TabBar 的 `HORIZONTAL` / `VERTICAL` 是产品布局选择，不等于设备横竖屏；切换排列时仍要保留源程序已有的断点、方向、窗口模式、控制器、状态和操作。电视设备上 MiniBar 不生效，应按能力包的通用回退策略保留接入前组件树与交互。

迁移时按下面的规则处理：

- `BarPosition.End`、`scrollable(false)`、`barOverlap(true)`、`barFloatingStyle` 和 `ADAPTIVE + ADAPTIVE` 是悬浮底部导航的核心配置。
- 56vp 是显示态栏高基线；需要随滚动隐藏时可在 56 和 0 之间切换。
- HDS 的 `barHeight` 不支持 `'auto'`。原工程若设置 `.barHeight('auto')`，在 HDS 分支移除整项配置，不将其替换为另一个固定高度；通过变量、条件或封装传入时也要追踪实际值，确保 HDS 分支不会得到 `'auto'`。已有合法数值和动态显隐高度保留，低版本普通 `Tabs` 分支保持原配置。
- 接入分支删除外层 `.barWidth(...)`，由 `barFloatingStyle.barWidth` 的配置或默认行为自动生效，不额外添加固定宽度。
- HDS 的 `barBottomMargin` 默认值为 0；接入时按窗口沉浸状态显式选择 28vp 或 0vp，并检查祖先 padding 的用途与分支，避免重复避让。
- `animationDuration(0)`、透明 `gradientMask` 和透明背景按工程实际交互选择；底部 `expandSafeArea` 按窗口沉浸状态规则处理，未开启窗口沉浸式时覆盖所有一级页及完整父组件链。
- `HdsTabsController` 继承 `TabsController`，既有 `changeIndex` 通常可继续使用；仍需扫描所有类型声明、控制器注入、双击、隐藏和刷新回调。
- API 23/24 模板将 `HdsTabs` 从 `@hms.hds.hdsBaseComponent` 导入，当前 SDK 也可见 `@kit.UIDesignKit` 聚合入口。生成代码时沿用目标 SDK 与工程已验证的导入方式，最终以真实构建为准。

### 底部间距归一化

按原有 padding 的用途和实际分支决定底部避让：

1. 定位 `HdsTabs` 的父级和祖先，追踪 `padding.bottom` 的来源、用途及普通/悬浮分支，区分导航条避让、其他布局间距和滚动内容补偿。
2. 原 padding 若用于普通 Tab 避让导航条，仅保留在普通分支；悬浮分支由栏底部间距承担避让，页面与滚动视口继续延伸到栏下方。不要把普通分支的外层 padding 无条件施加给悬浮分支。
3. `barBottomMargin` 显式配置或使用默认值时，都需要检查祖先 padding；不能只在源码出现正数 margin 时才核对，也不能仅因存在祖先 padding 就将 margin 清零。
4. 如果 bottom padding 只存在于某个 `TabContent` 的滚动内容内部、用途是避免末项被悬浮栏遮挡，保留其独立职责。其他布局用途的外层 padding 按实际作用判断，不机械删除或改写。
5. 断点、窗口模式和分支切换后，核对普通 Tab 的导航条避让仍保持原行为，悬浮 Tab 下方没有因共用 padding 形成固定空白或重复间距。

若两个分支共用的外层容器原本通过 `windowBottomPadding` 为普通 Tab 避让导航条，可将该容器的属性按实际悬浮分支条件设置：

```typescript
.padding({
  bottom: this.useFloatingTab ? 0 : this.vm.windowModel.windowBottomPadding
})
```

`useFloatingTab` 应替换为工程实际决定悬浮布局的条件，不仅是材质开关；这里的 0 只针对普通 Tab 导航条避让用途的外层 padding。实施报告记录用途与分支归属，并在有/无导航指示区、横竖屏、分屏和自由窗口下验证。

### 滚动 Tab 页尾部避让

先按[共享验证规则](../../shared/validation.md#悬浮-tab-的滚动尾部避让)追踪真实滚动容器。保持页面与滚动视口延伸到悬浮栏下方，补偿放在实际列表内容末尾；不得通过页面外层 bottom padding 缩短内容区。列表位于自定义子组件时继续深入该组件，先查清已有补偿和各窗口模式下的滚动职责再修改。

`barOverlap(true)` 会让悬浮栏覆盖在 Tab 内容上方。每个包含 `List`、`Scroll`、`WaterFlow`、可滚动 `Grid` 或自定义滚动容器的 Tab 页都必须单独检查：滚动到末尾时，最后一个可见项、按钮和手势热区应能完整移动到悬浮栏上方，不能停在材质胶囊下面。

滚动页需要在内容末尾提供“悬浮栏遮挡高度”对应的尾部空间：

- 对 `List`，优先使用 `contentEndOffset`，或按工程既有写法追加不可交互的尾部占位项；
- 对确实负责内容滚动的 `Scroll + Column`，确认尾部空间随内容滚动且不挤占子列表视口后，才使用内容末尾 padding 或占位；
- 尾部空间以当前布局坐标中的实际遮挡为准，通常至少覆盖可见 `barHeight + barBottomMargin`，使用最终实际配置的栏间距，HDS 未设置时默认 0，再结合必要的操作间隔；外层已经承担的系统安全区不要重复加入；
- 有动态隐藏能力时，可按最大可见悬浮栏高度保留稳定滚动范围，或让尾部空间与栏高同步变化，但必须验证动画过程中没有跳动和不可点击区；
- 无滚动能力的静态 Tab 页不机械增加尾部空白；所有 Tab 页逐页检查，不能只验证默认选中的第一页。

`List` 示例（无已有尾部间距时）；已有配置则在原处核对和调整，保留基础间距且不重复加入遮挡补偿：

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

优先更新内部列表已有的 `contentEndOffset`，先检查其是否已包含本次遮挡补偿，不能在外层再加一份。外层 Scroll 禁止滚动、内部 Tabs/List 填充剩余高度时，Tabs/List 后方的兄弟 Blank 是固定布局占位，不属于列表尾部补偿。Scroll 内容末尾占位仅在已确认该 Scroll 实际负责滚动且不会挤占内层列表视口时适用，具体前置检查与逐页验收见[共享规则](../../shared/validation.md#悬浮-tab-的滚动尾部避让)。

这里的页尾空间与上一节的外层 bottom padding 职责不同：外层 padding / `barBottomMargin` 决定悬浮栏位置，滚动内容尾部空间决定最后一项能否滚出悬浮栏遮挡。二者可能同时存在，但每一段高度只能按其坐标和职责计算一次。

如果 HDS 与低版本普通 `Tabs` 共用 Tab 内容 Builder，不要把 HDS 专用尾部空间无条件施加给低版本分支。通过明确参数或各页面自己的布局状态只在存在悬浮遮挡的分支启用；低版本继续保留源程序原有滚动范围、padding 和末项体验。

按[共享栏宽与断点规则](../../shared/validation.md#悬浮-tab-栏宽与断点)，接入分支在所有断点、横竖屏和窗口尺寸均使用 `vertical(false)`、`BarPosition.End` 的底部悬浮 Tab。删除外层 `barWidth`、侧栏切换条件和侧栏专属尺寸、分割线配置；保留业务事件与状态。设备不支持或材质关闭时仅回退材质，仍保持底部布局。

### 低版本分支必须保留源程序体验

当 `compatibleSdkVersion < 23` 时，HDS 与普通 `Tabs` 是两棵运行时条件组件树。HDS 分支统一为底部悬浮，低版本普通 `Tabs` 分支必须保留接入前源程序的行为：

- 继续使用原有断点、横竖屏和窗口模式条件，保持对应的底部横向栏或侧边纵向栏；
- 原样迁移这些条件控制的 `vertical`、`barPosition`、`barMode`、`barWidth`、`barHeight`、`divider` 和背景属性；
- 保留原控制器、当前索引、页签顺序、自定义 TabBar、双击、隐藏、刷新和页面切换回调；
- 只把公共 `TabContent` 抽成 Builder 复用，不要为了减少重复而丢失两个分支不同的导航外观和交互；
- 在 API 23 以下设备分别覆盖原工程支持的手机、平板/大窗口、横屏、分屏与自由窗口矩阵。

因此不能把能力包示例中的某个固定栏宽、栏高或 `BarPosition.End` 直接复制到所有普通 `Tabs` 降级分支。实施前先保存接入前 Tabs 属性与行为清单，实施后逐项对照。

ArkUI 普通组件、菜单、弹窗和应用级材质不在本文件维护；组合路线继续读取[ArkUI 接入实现](../arkui/implementation.md)。
