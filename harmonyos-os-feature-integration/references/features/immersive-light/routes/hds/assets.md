# HDS 沉浸光感迁移证据

本文件记录三组已核验迁移对照和官方 Spatialization 示例中的工程模式。接入时先核对 SDK、版本策略、现有导航结构和大屏产品要求，再按[接入实现](implementation.md)的短示例提取最小改动。

三组原始工程只用于本能力包形成阶段的差异分析，不随 Skill 分发，也不是运行、路由或校验依赖。原始对照工程被移除不会影响能力包；后续判断以本文件记录的迁移快照、接入实现和官方资料为准。

## 三组迁移对照快照

下表保留形成能力包时已经完成核验的差异摘要，用于说明结论如何得出。原始工程不随 Skill 分发；这些摘要只覆盖与悬浮 Tab 直接相关的差异，不把同版本中的其他业务改动归因于沉浸光感。

| 迁移对照 | 版本变化 | 接入前 | 接入后 |
|---|---|---|---|
| ComprehensiveMall 1.0.7 → 1.0.8 | compatible 20→23，target 22→24 | 原生 `Tabs`；平板使用左侧纵向栏、96vp 栏宽、分割线和 100vp 页签项 | 所有断点改为底部 `HdsTabs`；56vp 栏高；不再显式设置栏宽；启用重叠、悬浮材质和握姿适配；未设置固定底部外边距 |
| ComprehensiveNews 1.0.5 → 1.0.6 | compatible 20→23，target 23→24 | LG/XL 使用纵向侧栏；动态栏宽、栏高、分割线和背景；自定义页签支持滑出隐藏 | 删除大断点纵向策略，所有断点使用底部 `HdsTabs`；保留自定义页签及 `translateY` 动画；栏高在显示时 56vp、隐藏时 0；设置 28vp 底部外边距和透明渐变遮罩 |
| Recipes 1.0.7 → 1.0.8 | compatible 19→23，target 22→24 | 原生 `Tabs` 隐藏系统栏，另用 `floating_navbar` HAR 叠放悬浮导航；横屏改左侧栏 | 删除自研 HAR 与双层同步逻辑，所有断点改为底部 `HdsTabs`；56vp 栏高和 28vp 底部外边距；保留 `changeIndex`、页面切换事件及内容裁剪 |

## 证据分级

### 三组对照均出现的迁移模式（3/3）

- 主导航容器改为 `HdsTabs`，控制器相应改为 `HdsTabsController`。
- 悬浮导航固定在底部：`barPosition: BarPosition.End`。原先按平板、横屏或 LG/XL 切换到侧边栏的逻辑均被移除。
- 禁止手势左右滑动换页：`.scrollable(false)`。
- 内容延伸到页签下方：`.barOverlap(true)`。该属性决定栏与 `TabContent` 是否重叠，是悬浮层次的核心布局条件。
- 使用 `.barFloatingStyle(...)`，其中包含 `systemMaterialEffect: ADAPTIVE + ADAPTIVE` 和 `adaptToHandedness: true`。

当前接入按[共享栏宽与断点规则](../../shared/validation.md#悬浮-tab-栏宽与断点)执行：沉浸光感分支在所有断点和横竖屏统一为底部横向 Tab，移除侧栏切换条件及外层 `barWidth`。仅低版本兼容分支保留源程序响应式布局；设备不支持或材质关闭不恢复侧栏。

### 尺寸与间距经验

| 项目 | 证据 | 建议 |
|---|---|---|
| 栏高 | Mall、Recipes 固定 56vp；News 显示时 56vp、隐藏时 0 | 56vp 可作为显示态基线；存在滚动隐藏时保留 `56/0` 动态状态，不把 56 写死到所有场景 |
| 栏宽 | 三组接入后都删除了原生 `Tabs.barWidth(...)` | 接入分支删除外层 `.barWidth(...)`，由 `barFloatingStyle.barWidth` 的配置或默认行为自动生效，不额外添加固定宽度 |
| 底部外边距 | News、Recipes 为 28vp；Mall 未设置；Spatialization 根据导航指示区高度动态计算 | HDS 默认 0；当前接入按窗口沉浸状态显式设置：已开启为 28vp，未开启为 0vp 并补齐一级页底部安全区扩展 |
| 页签项 | Mall、Recipes 使用 24vp Symbol、`Caption_M` 和 4vp padding；News 保留原 Image 自定义页签 | 新页面可采用系统 Symbol 模式；已有手势、双击或业务状态的自定义 TabBar 应优先保留行为，只调整不再适用的侧栏尺寸 |
| 宿主高度 | Mall 明确填满，News 由外层 Column 填满，Recipes 由导航内容布局承担 | 保证 HdsTabs 获得完整可用区域即可，不强制使用同一种 `.height('100%')` 写法 |

### 非统一项

- `.animationDuration(0)` 只出现在 Mall 和 News；Recipes 未设置。它用于关闭内容切换动画，应按原工程交互决定，不属于悬浮材质必需属性。
- `gradientMask: { maskColor: Color.Transparent }` 只出现在 News，用于其深色视频和自定义页签视觉，不应默认复制。
- `TabContent.expandSafeArea(...BOTTOM)` 出现在 Mall 和 Recipes，News 未使用；这些快照不替代当前接入的窗口状态判断。未开启窗口沉浸式时，按[共享规则](../../shared/validation.md#窗口沉浸状态与栏间距)覆盖所有一级页、真实滚动容器及全部父组件；透明背景按实际需求处理。
- Mall 保留了自行监听握姿的业务代码和权限；News、Recipes 仅设置 `adaptToHandedness`，没有因此新增手势权限。不要仅因设置该属性就自动添加 `DETECT_GESTURE`；只有工程直接调用手势感知能力且官方契约要求时才声明权限。

## 官方 Spatialization 示例补充

[Spatialization 官方示例](https://gitcode.com/HarmonyOS_Samples/Spatialization)提供了迁移快照之外的完整组合，可用于理解能力边界：

- `AdaptiveTabView`：`HdsTabs + miniBar`，底部间距根据导航指示区高度动态计算；宽度小于 600vp 时 MiniBar 的初始形态与大屏不同。
- `ImmersiveLightView`：`HdsNavDestination + HdsTabs` 联合接入，使用 `HdsTabsController.applyHideAnimation/applyShowAnimation` 做滚动显隐，并允许切换 HDS 材质等级。
- 示例声明的 `DETECT_GESTURE` 用于其手势演示场景，不证明基础材质或普通 `adaptToHandedness` 必然需要该权限。

Spatialization 要求 API 26，因此它适合补充 MiniBar、动态隐藏、ArkUI 材质与组合页面模式；不能作为 API 23～25 工程直接可编译的证据。

MiniBar 的版本边界以同版本 HdsTabs API 为准，不从 Spatialization 样例的 API 26 门槛反推：核心 MiniBar 接口从 API 23 起可用，`barLayoutMode` 从 API 24 起可用。可执行约束与最小示例见[接入实现](implementation.md#可选-minibar)。

## 复用流程

1. 先用本机 SDK 根清单和工程 compile/compatible/target API 确定 HDS 路线是否可用。
2. 扫描主 Tabs 页面、每个 Tab 页的滚动容器与最后一个可操作项、控制器调用点、自定义 TabBar、断点侧栏逻辑、`HdsTabs` 父级/祖先 bottom padding、底部安全区和自研悬浮组件；如果 `compatibleSdkVersion < 23`，同时保存接入前普通 `Tabs` 的断点、横竖屏、窗口模式和全部条件属性组合。
3. 接入分支在所有断点和窗口尺寸统一为底部横向悬浮 Tab，使用 `vertical(false)` 与 `BarPosition.End`；侧栏布局仅保留在低版本兼容分支。
4. 以 `HdsTabs + BarPosition.End + scrollable(false) + barOverlap(true) + barFloatingStyle` 为悬浮底部方案核心，再按证据选择栏高、底部外边距、遮罩和动画。先追踪外层 bottom padding 的用途和分支：普通 Tab 的导航条避让仅保留在普通分支，悬浮分支由栏底部间距负责；其他布局用途按实际作用处理，不仅凭祖先存在 padding 就清零 `barBottomMargin`。
5. 保留 `onChange`、外部 `changeIndex`、双击、隐藏、刷新等业务行为；`HdsTabsController extends TabsController`，但替换后仍要扫描所有控制器类型和调用点。低版本普通 `Tabs` 分支必须保留源程序原有体验，包括不同断点和横竖屏下的底部/侧边形态，不能照抄 HDS 分支的统一底部配置。
6. 处理内容被悬浮栏遮挡、全屏视频深浅色、横竖屏、分屏/自由窗口和底部手势区；安全区写法按实际布局选择。每个可滚动 Tab 页在最后一个内容项之后保留足够的滚动尾部空间，使末项能够完整滚到悬浮栏上方；该空间只用于 HDS 悬浮分支，不得无条件改变低版本源程序的滚动范围。
7. 接入真实调用链并执行静态验证和 Hvigor 构建；文档示例不构成目标工程编译证据。

## 验证状态

| 检查 | 结果 |
|---|---|
| 三组迁移对照快照 | 形成能力包时已逐文件核对主 Tabs 页面、相关 ViewModel、版本配置和被删除的自研导航依赖；原始工程不是 Skill 分发依赖 |
| Spatialization 模式 | 已核对 README、HDS Tab、材质工具、MiniBar 和动态隐藏代码 |
| 真机视觉表现 | 尚未统一验证；栏宽、底部间距、握姿偏移、深浅色和大屏位置必须按目标设备复验；ArkUI 材质的深浅色、算力分档和 `materialColor` 表现同样待真机确认 |
