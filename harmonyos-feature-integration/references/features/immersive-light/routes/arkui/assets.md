# ArkUI 沉浸光感资产

| 文件 | 用途 | 使用边界 |
|---|---|---|
| [ImmersiveMaterialGuard.ets](../../assets/ImmersiveMaterialGuard.ets) | `sdkApiVersion >= 26` 版本门禁、设备能力判断、通用场景材质工厂 | 不用于 Toggle Switch、Slider 等内部预设视觉参数的组件 |

原生标题栏、悬浮 Tabs 的配置组合与栏宽规则见[导航类组件](components/navigation.md)；版本保护的粒度与最小示例见[共享回退策略](../../shared/fallback.md)。接入时在原工程组件中应用相应配置，并保留既有状态与交互。

仓库测试只验证资产结构与关键约束，不宣称新资产等同于目标工程编译；复制后必须执行目标工程真实构建。

新增 ArkUI 资产时只在本索引登记，并在文件头记录 API 门槛、能力判断、普通样式回退和验证状态。只保留会改变实现决策、可在目标工程复用并能经过构建验证的最小骨架。不要把 HDS 导航组件或 API 23～25 方案写入本路线。
