# ArkUI 沉浸光感资产

| 文件 | 用途 | 使用边界 |
|---|---|---|
| [ImmersiveMaterialGuard.ets](../../assets/ImmersiveMaterialGuard.ets) | `sdkApiVersion >= 26` 版本门禁、设备能力判断、通用场景材质工厂 | 不用于 Toggle Switch、Slider 等内部预设视觉参数的组件 |
| [ArkuiMaterialFallbackEntry.ets](../../assets/ArkuiMaterialFallbackEntry.ets) | API 26 以下整树保留、API 26 不支持设备普通样式回退、`Material.empty` 明确关闭 | 示例目标位于 Navigation 标题栏；普通容器必须先核对 `effectScopes`，替换时保留真实源组件树、状态和事件 |
| [ArkuiNavigationTabsEntry.ets](../../assets/ArkuiNavigationTabsEntry.ets) | 原生 Navigation 标题栏和原生悬浮 Tabs 的最小骨架 | TabBar 在完整悬浮条件生效后使用系统默认 `THIN`，不强制显式材质；不适用于 HDS；源分支形态不得被示例固定值覆盖；可滚动页逐页补足尾部避让 |

资料来自官方 `uiMaterial` API、[开启沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-enable)、[组件适配沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)、Navigation 示例20和 Tabs 示例24。仓库测试只验证资产结构与关键约束，不宣称新资产等同于目标工程编译；复制后必须执行目标工程真实构建。

新增 ArkUI 资产时只在本索引登记，并在文件头记录来源、API 门槛、能力判断、普通样式回退和验证状态。不要把官网整页示例复制为资产；只保留会改变实现决策、可在目标工程复用并能经过构建验证的最小骨架。不要把 HDS 导航组件或 API 23～25 方案写入本路线。
