# HDS 沉浸光感迁移参考

接入时先核对 SDK、版本策略、现有导航结构和大屏产品要求，再按[接入实现](implementation.md)的短示例提取最小改动。

## 核心配置

- 主导航容器使用 `HdsTabs`，控制器相应使用 `HdsTabsController`。
- 悬浮导航固定在底部：`barPosition: BarPosition.End`，所有断点统一为底部 `HdsTabs`。
- 禁止手势左右滑动换页：`.scrollable(false)`。
- 内容延伸到页签下方：`.barOverlap(true)`。该属性决定栏与 `TabContent` 是否重叠，是悬浮层次的核心布局条件。
- 使用 `.barFloatingStyle(...)`，其中包含 `systemMaterialEffect: ADAPTIVE + ADAPTIVE` 和 `adaptToHandedness: true`。

按[共享栏宽与断点规则](../../shared/validation.md#悬浮-tab-栏宽与断点)执行：沉浸光感分支在所有断点和横竖屏统一为底部横向 Tab，移除侧栏切换条件及外层 `barWidth`。仅低版本兼容分支保留源程序响应式布局；设备不支持或材质关闭不恢复侧栏。

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
- `TabContent.expandSafeArea(...BOTTOM)` 按窗口状态判断。未开启窗口沉浸式时，按[共享规则](../../shared/validation.md#窗口沉浸状态与栏间距)覆盖所有一级页、真实滚动容器及全部父组件；透明背景按实际需求处理。
- 不要仅因设置 `adaptToHandedness` 就自动添加 `DETECT_GESTURE`；只有工程直接调用手势感知能力且接口要求时才声明权限。

## 组合能力

- `HdsTabs + miniBar` 可根据导航指示区高度计算底部间距，并按窗口宽度选择 MiniBar 的初始形态。
- `HdsNavDestination + HdsTabs` 可联合接入，使用 `HdsTabsController.applyHideAnimation/applyShowAnimation` 做滚动显隐，并允许切换 HDS 材质等级。
- MiniBar 核心接口从 API 23 起可用，`barLayoutMode` 从 API 24 起可用。可执行约束与最小示例见[接入实现](implementation.md#可选-minibar)；含 API 26 接口的组合不能直接用于 API 23～25 工程。

## 复用流程

1. 先用本机 SDK 根清单和工程 compile/compatible/target API 确定 HDS 路线是否可用。
2. 扫描主 Tabs 页面、每个 Tab 页的滚动容器与最后一个可操作项、控制器调用点、自定义 TabBar、断点侧栏逻辑、`HdsTabs` 父级/祖先 bottom padding、底部安全区和自研悬浮组件；如果 `compatibleSdkVersion < 23`，同时保存接入前普通 `Tabs` 的断点、横竖屏、窗口模式和全部条件属性组合。自研导航与 HdsTabs 功能重叠时，只在增强分支移除重复组件及同步逻辑，保留业务事件和内容裁剪。
3. 接入分支在所有断点和窗口尺寸统一为底部横向悬浮 Tab，使用 `vertical(false)` 与 `BarPosition.End`；侧栏布局仅保留在低版本兼容分支。
4. 以 `HdsTabs + BarPosition.End + scrollable(false) + barOverlap(true) + barFloatingStyle` 为悬浮底部方案核心，再按目标布局选择栏高、底部外边距、遮罩和动画。先追踪外层 bottom padding 的用途和分支：普通 Tab 的导航条避让仅保留在普通分支，悬浮分支由栏底部间距负责；其他布局用途按实际作用处理，不仅凭祖先存在 padding 就清零 `barBottomMargin`。
5. 保留 `onChange`、外部 `changeIndex`、双击、隐藏、刷新等业务行为；`HdsTabsController extends TabsController`，但替换后仍要扫描所有控制器类型和调用点。低版本普通 `Tabs` 分支必须保留源程序原有体验，包括不同断点和横竖屏下的底部/侧边形态，不能照抄 HDS 分支的统一底部配置。
6. 处理内容被悬浮栏遮挡、全屏视频深浅色、横竖屏、分屏/自由窗口和底部手势区；安全区写法按实际布局选择。每个可滚动 Tab 页在最后一个内容项之后保留足够的滚动尾部空间，使末项能够完整滚到悬浮栏上方；该空间只用于 HDS 悬浮分支，不得无条件改变低版本源程序的滚动范围。
7. 接入真实调用链并执行静态验证和 Hvigor 构建；文档示例不构成目标工程编译证据。

栏宽、底部间距、握姿偏移、深浅色和大屏位置必须按目标设备验证；不能以静态配置代替真机视觉验收。
