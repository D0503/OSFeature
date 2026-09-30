# 沉浸光感工程参考与资产路由

工程参考与资产按路线索引，避免接入一条路线时加载另一条路线的代码模式：

| 路线 | 接入参考 |
|---|---|
| `hds` | [HDS 迁移参考](routes/hds/assets.md)，代码短示例见[接入实现](routes/hds/implementation.md) |
| `arkui` | [ArkUI 资产](routes/arkui/assets.md) |
| `hds + arkui` | 同时读取两条路线的参考，只提取各自目标组件需要的最小改动 |

ArkUI 的 `.ets` 资产存放在 `assets/`，使用边界见 ArkUI 路线索引。

所有资产都不是可整文件覆盖业务页面的模板。复制或改写前必须核对本机 SDK、工程版本、现有组件树和[共享回退策略](shared/fallback.md)，接入后执行真实工程构建。
