# ArkUI 沉浸光感资产

| 文件 | 用途 | 使用边界 |
|---|---|---|
| [ImmersiveMaterialGuard.ets](../../assets/ImmersiveMaterialGuard.ets) | API 26 版本与设备能力门禁、场景材质参数工厂和 `materialColor` 封装 | 只用于 ArkUI 路线；调用方继续保留普通样式 |
| [ArkuiMaterialFallbackEntry.ets](../../assets/ArkuiMaterialFallbackEntry.ets) | “条件双写”与“单树后置覆盖”两种页面级降级模式 | 不承担 API 26 以下 HDS/普通组件整树分支 |

资料来自官方 `uiMaterial` API 能力判断示例、沉浸光感开发指导的场景推荐和属性覆盖规则。两个资产已在 API 26 最小工程通过 `assembleHap` 并经 LSP 静态检查无诊断；复制到目标工程后仍须执行该工程真实构建。

新增 ArkUI 资产时只在本索引登记，并在文件头记录来源、API 门槛、能力判断、普通样式回退和验证状态。不要把 HDS 导航组件或 API 23～25 方案写入本路线。
