---
title: "HDS 沉浸光感底部悬浮 Tab 迁移"
summary: "底部悬浮 Tab 迁移、布局分支、核心配置、尺寸与间距及组合能力"
createdAt: "2026-11-13"
updatedAt: "2026-11-13"
tags: ["HarmonyOS","沉浸光感","HDS"]
---

# HDS 沉浸光感底部悬浮 Tab 迁移

## HDS 底部悬浮 Tab 迁移

组件树只按运行 API 分支：API 23 及以上进入 HdsTabs 升级接入分支，低于 23 保留原 Tabs 及其原有设备适配；不以手机、平板、断点或材质能力作为升级分支的附加条件。材质不可用或关闭在 HdsTabs 分支内处理，不切回原 Tabs。最低兼容版本已达到 23 时无需新增低版本分支。

`HdsTabs` 及链上的 `TabContent` 本身也要按[沉浸光感悬浮 Tab 布局与避让](../shared/floating-tab-layout-and-clearance.md#窗口沉浸状态与栏间距)配置 `.expandSafeArea([SafeAreaType.SYSTEM], [...])`，按需选择 BOTTOM、TOP 或一次合并两者，不能只扩展外围容器和内部页面。

逐页扩展链与自定义组件内部节点按[沉浸光感悬浮 Tab 布局与避让](../shared/floating-tab-layout-and-clearance.md#窗口沉浸状态与栏间距)检查。**必须沿扩展链逐个父布局组件配置 `expandSafeArea`，从真实滚动容器一直覆盖到页面宿主，不能跳过中间层级。**

先按[沉浸光感悬浮 Tab 布局与避让](../shared/floating-tab-layout-and-clearance.md#窗口沉浸状态与栏间距)核对目标窗口、路线默认值及安全区扩展链。以下 `this.floatingBarBottomMargin` 使用按该规则确认的工程配置值。

接入分支把手机、平板大断点和横屏主导航统一成底部悬浮 `HdsTabs`。核心配置如下，具体参数见[核心配置](#核心配置)及[尺寸与间距](#尺寸与间距)。

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

## 悬浮 Tab 迁移规则

迁移时按下面的规则处理：

- `BarPosition.End`、`scrollable(false)`、`barOverlap(true)`、`barFloatingStyle` 和 `ADAPTIVE + ADAPTIVE` 是悬浮底部导航的核心配置。
- 56vp 是显示态栏高基线；需要随滚动隐藏时可在 56 和 0 之间切换。
- HDS 的 `barHeight` 不支持 `'auto'`。原工程若设置 `.barHeight('auto')`，在 HDS 分支移除整项配置，不将其替换为另一个固定高度；通过变量、条件或封装传入时也要追踪实际值，确保 HDS 分支不会得到 `'auto'`。已有合法数值和动态显隐高度保留，低版本普通 `Tabs` 分支保持原配置。
- 接入分支的栏宽与布局按[沉浸光感悬浮 Tab 栏宽与断点](../shared/floating-tab-width.md#悬浮-tab-栏宽与断点)处理；内容容器宽度独立保留。
- HDS 的 `barBottomMargin` 默认值为 0；接入时按窗口沉浸状态显式选择 28vp 或 0vp，并检查祖先 padding 的用途与分支，避免重复避让。
- `animationDuration(0)`、透明 `gradientMask` 和透明背景按工程实际交互选择；`expandSafeArea` 按窗口沉浸状态规则处理，未开启窗口沉浸式时底部扩展覆盖所有一级页及完整父组件链，标题栏沉浸光感页面同样覆盖 TOP 扩展链，两场景共用组件一次传入 `[SafeAreaEdge.BOTTOM, SafeAreaEdge.TOP]`。
- `HdsTabsController` 继承 `TabsController`，既有 `changeIndex` 通常可继续使用；仍需扫描所有类型声明、控制器注入、双击、隐藏和刷新回调。
- API 23/24 模板将 `HdsTabs` 从 `@hms.hds.hdsBaseComponent` 导入，当前 SDK 也可见 `@kit.UIDesignKit` 聚合入口。生成代码时沿用目标 SDK 与工程已验证的导入方式，最终以真实构建为准。

## 核心配置

- 主导航容器使用 `HdsTabs`，控制器相应使用 `HdsTabsController`。
- 悬浮导航固定在底部：`barPosition: BarPosition.End`，所有断点统一为底部 `HdsTabs`。
- 禁止手势左右滑动换页：`.scrollable(false)`。
- 内容延伸到页签下方：`.barOverlap(true)`。该属性决定栏与 `TabContent` 是否重叠，是悬浮层次的核心布局条件。
- 使用 `.barFloatingStyle(...)`，其中包含 `systemMaterialEffect: ADAPTIVE + ADAPTIVE` 和 `adaptToHandedness: true`。

按[沉浸光感悬浮 Tab 栏宽与断点](../shared/floating-tab-width.md#悬浮-tab-栏宽与断点)执行：沉浸光感分支在所有断点和横竖屏统一为底部横向 Tab，移除侧栏切换条件及外层 `barWidth`。仅低版本兼容分支保留源程序响应式布局；设备不支持或材质关闭不恢复侧栏。

## 尺寸与间距

| 项目 | 接入规则 |
|---|---|
| 栏高 | 56vp 可作为显示态基线；存在滚动隐藏时保留 `56/0` 动态状态，不把 56 写死到所有场景 |
| 栏宽 | 接入分支删除外层 `.barWidth(...)`，由 `barFloatingStyle.barWidth` 的配置或默认行为自动生效，不额外添加固定宽度 |
| 底部外边距 | HDS 默认 0；按窗口沉浸状态显式设置：已开启为 28vp，未开启为 0vp 并补齐一级页底部安全区扩展 |
| 页签项 | 新页面可采用 24vp Symbol、`Caption_M` 和 4vp padding；已有手势、双击或业务状态的自定义 TabBar 应优先保留行为，只调整不再适用的侧栏尺寸 |
| 宿主高度 | 保证 HdsTabs 获得完整可用区域，不强制使用同一种 `.height('100%')` 写法 |

- `.animationDuration(0)` 用于关闭内容切换动画，应按原工程交互决定，不属于悬浮材质必需属性。
- `gradientMask: { maskColor: Color.Transparent }` 按深色视频和自定义页签视觉需要选择，不默认配置。
- `TabContent.expandSafeArea(...)` 按窗口状态判断。未开启窗口沉浸式时，按[沉浸光感悬浮 Tab 布局与避让](../shared/floating-tab-layout-and-clearance.md#窗口沉浸状态与栏间距)覆盖所有一级页、真实滚动容器及全部父组件：仅悬浮 Tab 配置 `BOTTOM`，页面同时接入标题栏沉浸光感时为链上共用组件一次传入 `[SafeAreaEdge.BOTTOM, SafeAreaEdge.TOP]`；透明背景按实际需求处理。
- 不要仅因设置 `adaptToHandedness` 就自动添加 `DETECT_GESTURE`；只有工程直接调用手势感知能力且接口要求时才声明权限。

## 组合能力

- `HdsTabs + miniBar` 可根据导航指示区高度计算底部间距，并按窗口宽度选择 MiniBar 的初始形态。
- `HdsNavDestination + HdsTabs` 可联合接入，使用 `HdsTabsController.applyHideAnimation/applyShowAnimation` 做滚动显隐，并允许切换 HDS 材质等级。
- MiniBar 核心接口从 API 23 起可用，`barLayoutMode` 从 API 24 起可用。可执行约束与最小示例见[HDS 沉浸光感 MiniBar](hds-minibar.md#可选-minibar)；含 API 26 接口的组合不能直接用于 API 23～25 工程。
