# 沉浸光感代码资产与迁移证据

`assets/` 保存从三组已核验迁移对照、官方 Spatialization 示例和官方 uiMaterial API 示例中蒸馏的可复用 ArkTS 模式。资产用于补足“只有接口说明、缺少工程落地代码”的问题，不是可整文件覆盖业务页面的模板；接入时先核对 SDK、版本策略、现有导航结构和大屏产品要求，再提取最小改动。

三组原始工程只用于本能力包形成阶段的差异分析，不随 Skill 分发，也不是运行、路由或校验依赖。原始对照工程被移除不会影响能力包；后续判断以本文件记录的迁移快照、`assets/` 代码和官方资料为准。

## 代码资产

| 文件 | 用途 | 使用边界 |
|---|---|---|
| [HdsMaterialGuard.ets](assets/HdsMaterialGuard.ets) | HDS 路线运行时版本门禁与 `ADAPTIVE` 材质参数工厂 | 仅在 `compatibleSdkVersion < 23` 且工程确需继续运行于旧设备时使用；接入后必须真实构建并验证最低版本设备 |
| [FloatingTabsMainEntry.ets](assets/FloatingTabsMainEntry.ets) | 原生 `Tabs` / 自研悬浮导航迁移到 HDS 底部悬浮胶囊的完整页面模式 | 默认演示所有断点保持底部悬浮；若产品要求大屏侧边导航，应在方案阶段保留分支，而不是机械套用 |
| [ImmersiveMaterialGuard.ets](assets/ImmersiveMaterialGuard.ets) | ArkUI 路线（API 26）运行时能力门禁（版本 + 设备双重判断）与官方场景推荐的材质参数工厂，含 `materialColor` 统一颜色封装 | 仅 API 26 路线使用；`MaterialState.DISABLE` 或设备不支持时显式材质不生效，调用方必须保留普通样式 |
| [ArkuiMaterialFallbackEntry.ets](assets/ArkuiMaterialFallbackEntry.ets) | ArkUI 材质“条件双写”与“单树后置覆盖”两种官方降级适配模式的页面级实现 | 属性级降级，不承担 API 26 以下整树版本降级（那是 HDS 资产职责）；模式2 依赖官方“后设置生效（除阴影）”覆盖规则，颜色统一由 `materialColor` 承载 |

ArkUI 材质资产来源：官方《@ohos.arkui.uiMaterial》API 参考“示例5（查询材质等级与是否支持沉浸式材质）”及其两种适配方式、《沉浸光感》开发指导的 `ImmersiveStyle` 场景推荐表；与 HDS 资产分别服务两条路线，不要在 API 23～25 工程引用。

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

这些是三组迁移对照的共同实现，不自动等同于所有应用的强制规范。尤其是“大断点也保持底部悬浮”属于已核验工程采用的迁移策略；HarmonyOS 大屏设计仍可能要求侧边导航。扫描到旧工程的 `vertical`、动态 `barPosition`、`barWidth`、`divider` 或横屏侧栏时，方案必须明确列出“统一改底部”与“保留大屏侧栏分支”的取舍，由产品目标决定。

### 尺寸与间距经验

| 项目 | 证据 | 建议 |
|---|---|---|
| 栏高 | Mall、Recipes 固定 56vp；News 显示时 56vp、隐藏时 0 | 56vp 可作为显示态基线；存在滚动隐藏时保留 `56/0` 动态状态，不把 56 写死到所有场景 |
| 栏宽 | 三组接入后都删除了原生 `Tabs.barWidth(...)` | 优先让 HDS 使用系统宽度；确需定制时使用 `barFloatingStyle.barWidth` 的 small/medium/large 范围，而不是沿用旧侧栏的 96vp 或 `'100%'` |
| 底部外边距 | News、Recipes 为 28vp；Mall 未设置；Spatialization 根据导航指示区高度动态计算 | 28vp 是常见对照值，不是固定规范；优先结合底部避让区、窗口模式和视觉留白计算 |
| 页签项 | Mall、Recipes 使用 24vp Symbol、`Caption_M` 和 4vp padding；News 保留原 Image 自定义页签 | 新页面可采用系统 Symbol 模式；已有手势、双击或业务状态的自定义 TabBar 应优先保留行为，只调整不再适用的侧栏尺寸 |
| 宿主高度 | Mall 明确填满，News 由外层 Column 填满，Recipes 由导航内容布局承担 | 保证 HdsTabs 获得完整可用区域即可，不强制使用同一种 `.height('100%')` 写法 |

### 非统一项

- `.animationDuration(0)` 只出现在 Mall 和 News；Recipes 未设置。它用于关闭内容切换动画，应按原工程交互决定，不属于悬浮材质必需属性。
- `gradientMask: { maskColor: Color.Transparent }` 只出现在 News，用于其深色视频和自定义页签视觉，不应默认复制。
- `TabContent.expandSafeArea(...BOTTOM)` 出现在 Mall 和 Recipes，News 未使用；透明 `TabContent` 背景只有 Mall 明确设置。二者是内容透出和遮挡处理手段，不是材质生效的统一前提。
- Mall 保留了自行监听握姿的业务代码和权限；News、Recipes 仅设置 `adaptToHandedness`，没有因此新增手势权限。不要仅因设置该属性就自动添加 `DETECT_GESTURE`；只有工程直接调用手势感知能力且官方契约要求时才声明权限。

## 官方 Spatialization 示例补充

[Spatialization 官方示例](https://gitcode.com/HarmonyOS_Samples/Spatialization)提供了迁移快照之外的完整组合，可用于理解能力边界：

- `AdaptiveTabView`：`HdsTabs + miniBar`，底部间距根据导航指示区高度动态计算；宽度小于 600vp 时 MiniBar 的初始形态与大屏不同。
- `ImmersiveLightView`：`HdsNavDestination + HdsTabs` 联合接入，使用 `HdsTabsController.applyHideAnimation/applyShowAnimation` 做滚动显隐，并允许切换 HDS 材质等级。
- `MaterialUtil`：展示“组件 Modifier”和“Menu Options”两类材质适配器以及普通背景/模糊降级。能力包实现时仍应使用明确类型，并按本能力包的 API 26 版本与 `isImmersiveMaterialSupported()` 规则核验，不照搬样例中的泛型断言。
- 示例声明的 `DETECT_GESTURE` 用于其手势演示场景，不证明基础材质或普通 `adaptToHandedness` 必然需要该权限。

Spatialization 要求 API 26，因此它适合补充 MiniBar、动态隐藏、ArkUI 材质与组合页面模式；不能作为 API 23～25 工程直接可编译的证据。

## 复用流程

1. 先用本机 SDK 根清单和工程 compile/compatible/target API 确定 HDS 路线是否可用。
2. 扫描主 Tabs 页面、控制器调用点、自定义 TabBar、断点侧栏逻辑、底部安全区和自研悬浮组件；如果 `compatibleSdkVersion < 23`，同时保存接入前普通 `Tabs` 的断点、横竖屏、窗口模式和全部条件属性组合。
3. 明确大屏策略：参考迁移快照统一为底部悬浮，或保留侧边导航分支；不要静默删除大屏交互。
4. 以 `HdsTabs + BarPosition.End + scrollable(false) + barOverlap(true) + barFloatingStyle` 为悬浮底部方案核心，再按证据选择栏高、底部外边距、遮罩和动画。
5. 保留 `onChange`、外部 `changeIndex`、双击、隐藏、刷新等业务行为；`HdsTabsController extends TabsController`，但替换后仍要扫描所有控制器类型和调用点。低版本普通 `Tabs` 分支必须保留源程序原有体验，包括不同断点和横竖屏下的底部/侧边形态，不能照抄 HDS 分支的统一底部配置。
6. 处理内容被悬浮栏遮挡、全屏视频深浅色、横竖屏、分屏/自由窗口和底部手势区；安全区写法按实际布局选择。
7. 接入真实调用链并执行静态验证和 Hvigor 构建；未被 import 的资产文件不构成编译证据。

## 验证状态

| 检查 | 结果 |
|---|---|
| 三组迁移对照快照 | 形成能力包时已逐文件核对主 Tabs 页面、相关 ViewModel、版本配置和被删除的自研导航依赖；原始工程不是 Skill 分发依赖 |
| Spatialization 模式 | 已核对 README、HDS Tab、材质工具、MiniBar 和动态隐藏代码 |
| ArkUI 资产单独编译 | ImmersiveMaterialGuard 与 ArkuiMaterialFallbackEntry 已于 2026-09-01 在 API 26 最小工程通过 `assembleHap` 完整构建（本机 SDK HarmonyOS 26.0.0.105），并经 LSP 静态检查无诊断 |
| HDS 资产单独编译 | 尚未在独立最小工程复验；复制到目标工程后必须构建 |
| 真机视觉表现 | 尚未统一验证；栏宽、底部间距、握姿偏移、深浅色和大屏位置必须按目标设备复验；ArkUI 材质的深浅色、算力分档和 `materialColor` 表现同样待真机确认 |

## 新增资产门槛

新增 `.ets` 资产前确认它解决的是重复出现的问题，而不是单工程特例。资产必须：

- 有可追溯来源，并在文件头声明来源、共性与例外；
- 接入最小工程并通过构建，或如实标注“未单独编译复验”；
- 不与 [implementation.md](implementation.md) 的短代码片段重复；
- 明确版本、权限、布局和大屏策略边界；
- 至少留下静态、构建或真机行为证据之一，其他层级显式标为待验证。
