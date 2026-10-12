# 平行视界场景与资料映射

平行视界是独立能力包 `easygo-parallel`，场景前缀为 `EP`。先按提示词的明确目标选择最小场景；不得因为输入资料同时包含多个示例，就把示例中的全部配置和 FAQ 一次性加入 Demo。

| 用户目标 | 场景 | 主要冻结入口 |
|---|---|---|
| 首次接入、选择 Navigation/Router 分栏 | EP-S001 | 开发实践、module.json5、路由指南、设计指南 |
| 主页、关联页、首次左右页组合 | EP-S002 | 开发实践、Navigation/NavDestination |
| 指定页面全屏并在返回时恢复分栏 | EP-S005 | 开发实践、NavDestination |
| 主动请求横屏时全屏或保持分栏 | EP-S006 | 开发实践、Window、NavDestination |
| 虚拟容器、分栏页面尺寸与截断 | EP-S007 | 开发实践、自适应布局、UIObserver、WindowProperties |
| 系统窗口分屏中继续保持平行视界 | EP-S008 | 开发实践、UIContext、Window、startAbility |
| 分栏比例、拖拽、分割线 | EP-S009 | 开发实践、设计指南 |
| isEasySplit 或明确 FAQ 排障 | EP-S010 | 只冻结目标 FAQ 及其直接接口页 |

API 23 基础字段、API 24 运行态查询与 API 26 增强字段使用不同技术路线。版本结论必须从本次冻结正文现提，不能只凭场景名或参考镜像写入代码。提示词同时明确多个效果时分别解析并按 Demo 顺序执行；没有明确要求时，不自动把全屏、横屏、虚拟容器、分屏和比例拖拽组成一份大而全验证。

## Demo 验证边界

- `easy_go.json`、最小路由、稳定测试数据和能够触发目标状态的按钮属于 Demo 实施前提；除非提示词验证的正是这些行为，否则不形成验证点。
- 配置文件不能运行时切换的字段使用 `rebuild_per_variant`：每个变体恢复同一基线、只改目标字段、重新构建、在同一设备窗口形态执行并截图。
- 视觉报告只写实际观察。静态配置命中、构建成功或 `isEasySplit()` 返回值不能单独替代左右页面关系、全屏恢复、布局截断或拖拽效果的真机结论。

## 参考工程边界

分析输入中的示例工程只用于识别可复用的通用结构，不成为生成后 Skill 的外部运行依赖，也不整体复制缓存、签名或 IDE 文件。Demo 按目标最小采用以下结构：

- `module.json5` 的 `easyGo` profile 引用与 `resources/base/profile/easy_go.json`；
- `Index.ets` 中 `Navigation`、`NavPathStack` 与 NavDestination builder；
- 全屏页、横屏页或分屏入口仅在对应场景采用；
- 不复制 `.hvigor`、`build`、`.idea`、签名配置、商品业务素材和无关页面。

输入参考工程声明的构建环境不能为其他 API 路线证明兼容性。每次实施仍须以本次冻结官网正文为准，并在 implementation 记录中把采用的示例关键点关联到真实快照行号。
