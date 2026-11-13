---
title: "ArkUI 沉浸光感标题栏滚动联动正例"
summary: "保留搜索框随滚动收缩及分类栏滚入标题栏两种场景的代码，说明内容起始偏移、位置测量、状态共享和临界回切。"
createdAt: "2026-11-11"
updatedAt: "2026-11-11"
tags: ["HarmonyOS","沉浸光感","ArkUI","Navigation","NavDestination","标题栏","滚动联动","分类栏","Search"]
---

# ArkUI 沉浸光感标题栏滚动联动正例

适用于 Stage 模型的原生 ArkUI。编译 SDK、target 和启用材质的运行系统须达到 API 26。兼容更低版本时先保护新增接口调用。应用启动完成并退出加载页后，在版本保护内查询 `uiMaterial.isImmersiveMaterialSupported()`。应用级 `DISABLE` 会关闭材质，材质不可用时沿用普通视觉样式。

按目标交互选用下列片段。自定义标题在 `.title({ builder, height }, options)` 声明高度，Builder 根容器使用同一高度。首项需要避让时，在真实滚动容器设置 `contentStartOffset`，或在其滚动内容内加入顶部占位。补偿量只计算一次。复用原页面的事件、布局和路由。

窗口未开启沉浸式且标题需要延伸到状态栏下方时，沿宿主 → Navigation 或 NavDestination → 页面根容器 → 真实滚动容器逐层扩展 TOP。与底部悬浮 Tabs 共用的节点在一次调用中合并 TOP 和 BOTTOM。已开启窗口沉浸式时复用现有窗口布局。

## 正例一：搜索框标题栏随滚动收缩

官方场景把 Search 放在自定义标题 Builder 内，通过滚动偏移联动标题高度、位置和搜索区域透明度；材质配置在 Search 上，标题栏使用 `GRADUAL_BLUR`。内容初始避让固定采用展开高度，不随标题收缩反复改变滚动范围。

下面片段放在现有 `@ComponentV2` 页面组件内，导入 `import { uiMaterial } from '@kit.ArkUI'`。`classifyContent()`、`pageContent()` 分别复用工程分类区域与滚动内容；110vp、50vp 仅为示例尺寸，实际值需匹配标题布局。

```typescript
private scroller: Scroller = new Scroller()
private totalTitleHeight: number = 110
private collapseRange: number = 50
@Local titleHeight: number = 110
@Local titleOffset: number = 0
@Local searchOpacity: number = 1

@Builder
exploreTitleBar() {
  Column() {
    Row() {
      Text('探索')
      Blank()
      Search({ placeholder: '搜索' })
        .height(40)
        .systemMaterial(new uiMaterial.ImmersiveMaterial({}))
    }
    .height(this.collapseRange)
    .opacity(this.searchOpacity)
    this.classifyContent()
  }
  .width('100%')
  .height(this.titleHeight)
  .position({ x: 0, y: -this.titleOffset })
}

build() {
  NavDestination() {
    Scroll(this.scroller) {
      this.pageContent()
    }
    .height('100%')
    .width('100%')
    .contentStartOffset(this.totalTitleHeight)
    .onDidScroll(() => {
      const offset = this.scroller.currentOffset().yOffset
      const collapsed = Math.min(this.collapseRange, Math.max(0, offset))
      this.titleOffset = collapsed
      this.titleHeight = this.totalTitleHeight - collapsed
      this.searchOpacity = 1 - collapsed / this.collapseRange
    })
  }
  .title({ builder: this.exploreTitleBar, height: this.titleHeight }, {
    barStyle: BarStyle.STACK,
    scrollEffectOptions: {
      scrollEffectType: ScrollEffectType.GRADUAL_BLUR
    }
  })
}
```

本节将滚动量限制在 `[0, collapseRange]`，并读取实际 Scroller 偏移，处理快速越过阈值和负向回弹；要求 `0 < collapseRange < totalTitleHeight`。初始标题高度与展开高度保持一致。隐藏后的搜索区域不能继续拦截操作或形成无障碍焦点，按工程焦点策略处理。验证初始首项可见、上滑后内容能滚入标题栏下方、回顶后标题完整恢复。

## 正例二：内容分类栏滚入标题栏后接替显示

官方场景通过 `showTitle` 在标题 Builder 内切换原标题与分类组件，内容区的分类组件使用 `Visibility.Hidden` 保留占位；搜索按钮始终留在标题栏，单独配置沉浸光感。切换依赖两个固定承接位置，状态由页面统一持有。

下面为同一文件中的受控分类组件和页面组件。页面由工程已有 Navigation/路由承载，`onSearch` 接入已有搜索行为；示例文本内容用于形成滚动范围，改造时替换为原业务内容。代码用于已满足 ArkUI 路线门槛的分支。

```typescript
import { ChipGroup, ChipGroupItemOptions, uiMaterial } from '@kit.ArkUI'

let nextTitleScrollPageId: number = 0

@ComponentV2
struct ControlledClassifyBar {
  @Param selectedIndexes: number[] = [0]
  @Param inTitleBar: boolean = false
  @Event onSelectionChange: (indexes: number[]) => void = () => {}
  private items: ChipGroupItemOptions[] = [
    { label: { text: '策略' } },
    { label: { text: '动作' } },
    { label: { text: '竞技' } }
  ]

  build() {
    ChipGroup({
      items: this.items,
      selectedIndexes: this.selectedIndexes,
      backgroundSystemMaterial: this.inTitleBar
        ? new uiMaterial.ImmersiveMaterial({ interactive: true })
        : undefined,
      onChange: (indexes: number[]) => this.onSelectionChange(indexes)
    })
  }
}

@ComponentV2
export struct GameTitleScrollPage {
  @Event onSearch: () => void = () => {}
  @Local showTitle: boolean = false
  @Local selectedIndexes: number[] = [0]
  private scroller: Scroller = new Scroller()
  private titleHeight: number = 72
  private classifyHeight: number = 48
  private switchTolerance: number = 2
  private pageId: string = `title-scroll-${++nextTitleScrollPageId}`
  private titleAnchorId: string = `${this.pageId}-title`
  private contentAnchorId: string = `${this.pageId}-content`
  private pageVisible: boolean = false
  private rows: number[] = Array.from({ length: 30 }, (_, index: number) => index)

  private updateTitlePlacement(): void {
    if (!this.pageVisible) {
      return
    }
    try {
      const context = this.getUIContext()
      const components = context.getComponentUtils()
      const content = components.getRectangleById(this.contentAnchorId)
      const title = components.getRectangleById(this.titleAnchorId)
      if (content.size.height <= 0 || title.size.height <= 0 ||
        content.size.width <= 0 || title.size.width <= 0) {
        return
      }
      const contentTop = context.px2vp(content.windowOffset.y)
      const titleTop = context.px2vp(title.windowOffset.y)
      if (!Number.isFinite(contentTop) || !Number.isFinite(titleTop)) {
        return
      }
      if (!this.showTitle && contentTop <= titleTop) {
        this.showTitle = true
      } else if (this.showTitle && contentTop > titleTop + this.switchTolerance) {
        this.showTitle = false
      }
    } catch {
      // 节点尚未完成布局时保留状态，由后续布局或滚动回调重测。
      return
    }
  }

  @Builder
  sharedClassifyContent(inTitleBar: boolean) {
    ControlledClassifyBar({
      selectedIndexes: this.selectedIndexes,
      inTitleBar: inTitleBar,
      onSelectionChange: (indexes: number[]) => {
        this.selectedIndexes = [...indexes]
      }
    })
  }

  @Builder
  gameTitleBar() {
    Row() {
      Stack({ alignContent: Alignment.Start }) {
        if (this.showTitle) {
          this.sharedClassifyContent(true)
        } else {
          Text('游戏').fontSize(24)
        }
      }
      .id(this.titleAnchorId)
      .layoutWeight(1)
      .height(this.classifyHeight)
      .onAreaChange(() => this.updateTitlePlacement())

      Button('搜索')
        .height(40)
        .backgroundColor(Color.Transparent)
        .systemMaterial(new uiMaterial.ImmersiveMaterial({
          interactive: true,
          lightEffect: { color: Color.White }
        }))
        .onClick(() => this.onSearch())
    }
    .width('100%')
    .height(this.titleHeight)
    .padding({ left: 16, right: 16 })
  }

  build() {
    NavDestination() {
      Scroll(this.scroller) {
        Column() {
          Text('内容区背景').height(180).width('100%')
          // 占位节点始终存在，只隐藏其内容。
          Column() {
            Column() {
              this.sharedClassifyContent(false)
            }
            .visibility(this.showTitle ? Visibility.Hidden : Visibility.Visible)
          }
          .id(this.contentAnchorId)
          .height(this.classifyHeight)
          .width('100%')
          .onAreaChange(() => this.updateTitlePlacement())

          ForEach(this.rows, (index: number) => {
            Text(`内容 ${index + 1}`).height(64).width('100%')
          }, (index: number) => index.toString())
        }
        .width('100%')
        .onAreaChange(() => this.updateTitlePlacement())
      }
      .height('100%')
      .width('100%')
      .contentStartOffset(this.titleHeight)
      .onDidScroll(() => this.updateTitlePlacement())
      .onAreaChange(() => this.updateTitlePlacement())
    }
    .title({ builder: this.gameTitleBar, height: this.titleHeight }, {
      barStyle: BarStyle.STACK,
      scrollEffectOptions: {
        scrollEffectType: ScrollEffectType.GRADUAL_BLUR
      }
    })
    .onShown(() => {
      this.pageVisible = true
      this.updateTitlePlacement()
    })
    .onHidden(() => {
      this.pageVisible = false
    })
  }
}
```

**工程化处理**：两个锚点始终存在且 ID 在页面实例内唯一。读取同一布局帧和同一窗口坐标系的顶部位置，统一转换为 vp 后直接比较。切换采用 2vp 回切容差，仅改变 `showTitle`，不修改标题高度。分类状态由页面统一持有，用户操作回调写入共享状态；业务筛选也接在该回调中，避免两份组件分别触发重复请求。

`onShown` 处理返回页面，`onAreaChange` 处理布局及尺寸变化，`onDidScroll` 处理内容位移；读取无效时等待后续有效布局，不把失败当作到达阈值。工程如有不触发布局回调的窗口或字体更新，应在其已有更新流程完成布局后调用同一测量方法。嵌套滚动场景需连接实际影响锚点位置的所有滚动源，并核对目标 SDK 回调时序。

72vp、48vp 仅为示例尺寸，需按工程字体和实际分类栏高度调整，两处分类栏保持相同占位高度。安全区扩展沿实际布局链按需补齐，不能把示例无条件套到普通页面或低版本分支。原有组件高度、事件、控制器和搜索行为优先复用。

验证上滑接替、下滑恢复、临界往返、快速滚动与回弹、返回页面、旋转和字体放大；确认隐藏副本不重复点击或进入无障碍焦点，选择状态不丢失，内容仍可滚入标题栏下方。内容区的材质配置按该组件自身规则处理，不因复用组件就认定内容区具有标题栏生效域。本示例尚需在目标工程编译及设备运行验证。
