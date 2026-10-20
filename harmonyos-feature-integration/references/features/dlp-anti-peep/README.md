# 防窥保护 / DlpAntiPeep

通过 Device Security Kit 感知屏幕窥视状态，独立保护应用窗口，或按需与闪控窗联动。普通防截屏、密码遮罩和自定义隐私按钮不自动命中。契约见 [profile.json](profile.json)。

- 门禁、权限和设备：[兼容性](compatibility.md)。
- 实施：[实施入口](implementation.md)，按任务读取 [状态感知](routes/status-observation.md)、[系统蒙层](routes/system-mask.md)。
- 代码：[资产](assets-catalog.md)；异常：[回退](fallback.md)；问题：[排障](troubleshooting.md)。
- 验收：[性能与验证](performance-validation.md)。
- 目标包含闪控窗时才加载 [联动](float-view-integration.md) 和 [窗球能力](../float-view-ball/README.md)。

来源：2026-10-20 本地 [开发指南](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/devicesecurity-dlpantipeep) 与 [全链路示例](https://developer.huawei.com/consumer/cn/doc/doccenter-advanced-features/bpta-always-on-market-watch)，接口逐项版本于2026-10-20核对 [官方API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/devicesecurity-dlpantipeep-api)。核心保护不依赖示例业务或本机文档路径。
