---
title: "沉浸光感悬浮 Tab 布局与避让"
summary: "说明原生 ArkUI Tabs 和 HDS HdsTabs 共用的窗口沉浸状态判断、栏间距、安全区扩展、外层 padding 与滚动尾部补偿。"
createdAt: "2026-11-12"
updatedAt: "2026-11-12"
tags: ["HarmonyOS","沉浸光感","ArkUI","HDS","Tabs","HdsTabs","barBottomMargin","安全区","滚动尾部避让"]
---

# 沉浸光感悬浮 Tab 布局与避让

适用于原生 ArkUI `Tabs` 和 HDS `HdsTabs` 的底部悬浮布局。栏位置由窗口状态、系统安全区和栏间距共同决定。列表尾部补偿取决于当前页面的实际遮挡和滚动容器。

## 窗口沉浸状态与栏间距

Tab 页面需要同时延伸顶部和底部系统安全区时，可评估 HDS 底部 Tab。已有工程反馈显示，原生 ArkUI Tabs 在 `barBottomMargin: 0` 与 `.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM, SafeAreaEdge.TOP])` 组合下，仍在底部系统导航区之上额外抬高 28vp。继续使用原生 ArkUI Tabs 时，以目标设备上的实际栏位置为准。

组件默认值不同：HDS 的 `barBottomMargin` 默认为 0，ArkUI Tabs 默认为 28vp。接到悬浮 Tab 开发需求后，先追踪目标窗口的 `setWindowLayoutFullScreen` 调用及其封装、初始化顺序、条件和后续关闭操作，再按下表实施。不限定窗口变量必须叫 `windowClass`。

| 已确认的目标窗口状态 | 接入方式 | `barBottomMargin` |
|---|---|---|
| 已开启窗口沉浸式 | 复用现有窗口沉浸方案 | 显式设置 28vp |
| 未开启窗口沉浸式 | 每个 Tab 一级页均扩展底部系统安全区，不能只处理首页或当前选中页 | 显式设置 0vp |
| 调用链或生效状态不明确 | 先核对初始化、参数与实际窗口状态 | 不凭扫描结果选择分支 |

未开启窗口沉浸式时不为悬浮 Tab 或标题栏沉浸光感自动开启全局窗口沉浸式，改用安全区扩展让布局延伸到对应系统区下方。仅接入悬浮 Tab 时使用 `.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])`。接入标题栏沉浸光感时使用 `.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])`。同一组件同时承担两种场景时一次调用 `.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM, SafeAreaEdge.TOP])`，不拆成两次调用，避免第二次覆盖第一次的边配置。合并时保留组件已有且仍有效的安全区类型和方向。已开启窗口沉浸式的窗口复用现有沉浸方案，不因本次接入重复添加安全区扩展。

两条扩展链都逐组件配置，仅给末端容器设置属性不足以完成整条链的扩展。底部扩展逐个检查所有一级 Tab 页，沿主页面容器 → `Tabs` 或 `HdsTabs` → `TabContent` → 自定义页面根容器 → 真实滚动容器追踪，为滚动容器及其所有父组件配置扩展属性。顶部扩展逐个检查所有接入标题栏沉浸光感的页面，沿主页面容器 → `Navigation`、`NavDestination`、`HdsNavigation` 或 `HdsNavDestination` → 页面根容器 → 真实滚动容器追踪，同样为滚动容器及其所有父组件配置扩展属性。例如 MainEntry 中的父容器、Tabs 和 TabContent，以及 HomePage 的根 Stack 和 Scroll 构成同一条布局链。标题栏沉浸光感与悬浮 Tab 共存于同一条链时，链上共用组件按合并写法一次传入两边，仅处于单侧链上的组件只配置对应方向。

标题栏接入还需检查滚动容器内部的首项及背景绘制节点，不能只检查到 Scroll/List。例如 `Scroll → scrollContent() → Stack → Image(banner)`，若首屏背景图片需铺到状态栏下方而尚未覆盖，应继续逐组件核对内部布局链，并为需要延伸的节点配置 TOP 扩展。同一节点确有底部延伸需求时再合并 BOTTOM。首项并非一律扩展，文本、按钮等可操作内容仍需保留顶部避让，验证首屏及滚动时背景连续、内容可见且可操作。

未开启窗口沉浸式时，须按全部 Tab 页清单逐页配置并切换验证，包括非默认页和懒加载页。**必须从真实滚动容器逐个向上追踪到页面宿主，为该扩展链上的每一个父布局组件配置对应方向的 `expandSafeArea`，不能跳过任何中间层级。**遇到自定义组件或 Builder，必须进入内部检查实际布局节点。仅配置 Scroll/List、页面根容器或公共 `Tabs` 或 `HdsTabs` 均不算完成。无滚动容器的页面也需逐父组件覆盖内容布局链。需要顶部延伸的页面同时按上述规则处理 TOP。不能以首页效果正常代替其他 Tab 页的配置与验证。

`Tabs`、`HdsTabs` 及链上的 `TabContent` 本身也必须按需配置 `.expandSafeArea([SafeAreaType.SYSTEM], [...])`，不能只配置其父容器或内部页面。仅需底部延伸时传入 `[SafeAreaEdge.BOTTOM]`，仅需顶部时传入 `[SafeAreaEdge.TOP]`，同时需要两侧时一次传入 `[SafeAreaEdge.BOTTOM, SafeAreaEdge.TOP]`。配置仍限定在实际需要扩展的布局分支。

## 普通与悬浮 Tab 的外层避让

HDS 与 ArkUI 接入前须追踪原有 bottom padding 的用途和所属分支。普通 Tab 为避让导航条设置的外层 `windowBottomPadding` 仅保留在普通分支。悬浮分支由栏底部间距负责避让，页面内容和滚动视口继续延伸到栏下方。共用父容器时，将该 padding 按工程实际悬浮布局条件分支设置。示例写法为 `bottom: this.useFloatingTab ? 0 : this.vm.windowModel.windowBottomPadding`。`useFloatingTab` 取实际布局条件，不使用材质开关。

同时存在悬浮 Tab 和 bottom padding 只构成静态核对线索，不能证明二者存在祖先关系或在同一分支生效。显式与默认栏间距都要检查，无法确定时继续核对实际布局。不得机械清零 `barBottomMargin`，也不得删除其他布局用途的 padding 或列表内部的尾部补偿。验收时切换普通/悬浮分支及窗口模式，确认普通导航条避让正常，悬浮栏下方没有共用 padding 造成的固定空白。

## 悬浮 Tab 的滚动尾部避让

修改前必须逐页确认并记录宿主到真实滚动容器的组件路径、当前窗口模式下的 `scrollable` 与嵌套滚动职责、已有 `contentEndOffset`/内容 padding/占位及其用途、最终由哪一个滚动容器承担本次补偿。未查清子组件实现时不得直接在宿主页追加占位。同一遮挡补偿只在实际负责该段滚动内容的容器中计算一次。

禁止在使用 `layoutWeight` 或填满剩余高度的 List/Tabs 外部、作为其兄弟节点追加固定高度 Blank 来避让悬浮栏。这会挤占列表视口，让悬浮栏下方变成固定空白。外层即使名为 Scroll，若其 `scrollable` 为 None、实际由内部 List 滚动，也不能在该外层内容末尾追加 Blank 代替内部列表补偿。内层已设置补偿时，不能再次在外层叠加。窗口模式改变滚动职责时分别判断，不能无条件同时补偿内外两层。

优先更新真实滚动容器已有的尾部配置，保留原间距语义。只有确认 Scroll 实际承担该内容滚动、尾部空间随同一内容滚动且不会缩小子列表视口时，才允许使用其内容末尾的 padding 或占位。

`Tabs` 或 `HdsTabs` 的悬浮栏只要通过 `barOverlap(true)` 覆盖内容，就逐个检查每个 Tab 页中的 `List`、`Scroll`、`WaterFlow`、可滚动 `Grid` 和自定义滚动容器。最后一个可操作项及其点击、拖拽或手势热区必须能够完整滚动到悬浮栏上方。

- 先沿页面、TabContent 和自定义子组件追踪真实滚动容器，检查 `scrollable`、嵌套滚动及窗口模式。外层 `Scroll` 为 `ScrollDirection.None`、内部列表负责滚动时，补偿应落在内部列表。窗口模式改变滚动职责时重新核对，不能仅凭存在 `Scroll` 就在外层加 padding。
- 保持页面内容和滚动视口延伸到悬浮 Tab 下方。不得通过页面根容器、列表外层容器的 bottom padding 缩短内容区来避让，否则悬浮栏下方会露出固定预留空白，失去正常页面背景。
- 在最后一个真实滚动项之后增加尾部空间，默认遮挡补偿为 `barHeight + barBottomMargin`，使用最终实际配置的栏间距。未设置时按组件默认值核对，`Tabs` 为 28vp，`HdsTabs` 为 0，再结合必要的操作间隔。外层已经承担的系统安全区不要重复加入。
- `List` 可使用 `contentEndOffset` 或尾部占位项。只有外层 `Scroll` 确实负责该内容滚动时，才在其内容 `Column` 末尾增加 `Blank` 或等价空间。
- 已有 `contentEndOffset` 或内容间距时，保留原间距语义并计算新增遮挡补偿，避免直接覆盖或重复叠加。宿主根据当前页面实际存在的悬浮栏遮挡确定补偿，再传给真实滚动组件。独立页面或无悬浮栏的复用场景保持原间距。
- 尾部空间只负责滚动内容防遮挡，不替代决定悬浮栏位置的外层 padding、系统安全区或栏外边距。同一段安全区高度不得重复计算。
- 仅在实际渲染为悬浮重叠布局的分支启用补偿。普通非悬浮布局沿用接入前的滚动范围和 padding。材质不可用或关闭后，如果悬浮栏仍通过 `barOverlap(true)` 覆盖内容，继续保留尾部避让。
- `WaterFlow`、可滚动 `Grid` 和自定义滚动容器按各自布局方式增加末尾占位或内容 padding。
- 悬浮栏动态显隐时，按最大可见遮挡保留稳定空间，或使尾部空间与栏高同步。验证动画中没有跳动和不可点击区。
- 无滚动内容的 Tab 页不增加空白。所有 Tab 页逐页验证，不能只检查默认页。

## 布局验收标准

- 每个一级 Tab 及其内部可切换列表的内容均能经过悬浮栏下方。滚到末尾时，最后一项及其完整点击、拖拽或手势热区能滚到悬浮栏上方。
- 尾部空间随真实滚动内容进入视口。各窗口模式下，同一遮挡只在负责滚动的容器内补偿一次，页面底部没有固定空白。
- 标题栏材质覆盖状态栏区域，首屏和滚动中的内容可见且可操作。标题栏与悬浮 Tab 共用的节点按需同时扩展 TOP 和 BOTTOM。普通标题栏和独立页面沿用原有避让。
- 非默认页与懒加载页、普通与悬浮分支、低版本原布局、材质关闭及不同断点和窗口模式下，栏位置、栏宽与内容避让均符合各自布局规则。
