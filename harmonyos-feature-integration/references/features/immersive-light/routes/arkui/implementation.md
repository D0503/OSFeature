# ArkUI 沉浸光感接入入口

ArkUI 路线覆盖 API 26+ 的原生 ArkUI `Navigation`、`Tabs`、弹窗和交互组件，不覆盖 `HdsNavigation`、`HdsTabs` 或 MiniBar。工程同时使用 HDS 与 ArkUI 时保留 `selectedRoutes: ["hds", "arkui"]`，分别加载两条路线。

本页的知识条目按[知识库查询流程](../../../../workflows/knowledge-query.md)读取。

## 前置门禁

- 本机 SDK 根清单 API、有效 compile API 和 `targetSdkVersion` 都必须达到 26；
- Stage 模型是必需条件；应用级 metadata 还必须位于 `entry` module；
- `compatibleSdkVersion < 26` 时，使用 `deviceInfo.apiAvailable('26.0.0')` 保护 API 26 调用和配置；仅材质变化时复用原组件，组件、布局或导航结构变化时使用组件树分支；
- 所有不满足条件的路径保留[接入前源程序状态](../../shared/fallback.md)。

读取《ArkUI 沉浸光感开启策略》，核对应用级与组件级配置。调整 `build-profile.json5` 时按[兼容性模型](../../../../shared/compatibility-model.md)核实构建配置。target API 从 26 以下升级到 26 及以上时，按正文的「应用升级检查」核对行为变化。

### 能力查询时机

在 API 26 运行版本保护内，由工程现有的启动完成和业务页面就绪流程在退出启动加载页后触发 `uiMaterial.isImmersiveMaterialSupported()`。模块顶层、静态或成员字段初始化及启动加载页均不得查询能力，包括通过 `ImmersiveMaterialGuard.isMaterialSupported()` 间接查询。

## 按目标加载

| 目标 | 必读资料 |
|---|---|
| `systemMaterial` 参数、颜色、反色、阴影、覆盖关系 | 查询《ArkUI 沉浸光感通用材质》 |
| 原生 Navigation 标题栏、原生悬浮 Tabs、AlphabetIndexer | [导航类组件](components/navigation.md) |
| 搜索框标题栏随滚动收缩 | [自定义标题高度与内容避让](components/navigation.md#自定义标题高度与内容避让)中的对应正例 |
| 内容标题随滚动固定到标题栏、分类栏滚入标题栏、沉浸光感标题栏滚动吸顶 | [滚动内容切换到标题栏](components/navigation.md#可选滚动内容切换到标题栏)；按需实施，不用于普通列表内部吸顶 |
| Toast、Popup、Tips、Menu、Dialog、Sheet | [弹窗类组件](components/overlays.md) |
| Button、Select、Toggle、Slider、ChipGroup、SegmentButton | 查询《ArkUI 沉浸光感按钮、选择控件与通用组件》 |
| 复制门禁、降级或原生导航页签代码 | [ArkUI 资产](assets.md) |
| 静态检查、真机构成和故障排查 | [ArkUI 验证](validation.md) |

指定组件接入时只读取与目标有关的资料。工程整体接入时，按[工程发现](../../../../workflows/project-discovery.md)盘点矩阵全部类别，对有候选的类别加载对应资料并逐实例核对。不要因为发现普通 Button、Tabs 等组件就自动配置材质：是否支持、生效区域、默认开启条件和是否需要显式配置分别判断。

## 实施顺序

1. 读取[组件矩阵](component-profile.json)，识别 `DEFAULT`/`ENABLE` 默认行为、`effectScopes` 生效区域、组件入口、明确关闭方式和限制。
2. 记录目标组件的接入前代码、交互态、响应式布局和普通样式。
3. 选择应用级开启、组件级开启或两者组合；先解决 `DEFAULT`/`ENABLE`/`DISABLE` 行为，再设置具体材质。
4. 对 API 26 以下、不支持设备、系统关闭和业务关闭路径保留接入前状态。
5. 按目标分类实施；组件专属接口优先于把通用 `systemMaterial` 生搬到所有组件。
6. 运行静态验证和真实工程构建，再在目标设备上检查系统材质档位、深浅色和交互反馈。
