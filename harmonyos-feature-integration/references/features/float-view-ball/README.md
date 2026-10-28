# 闪控窗／球

通过 ArkUI 的 floatView / floatingBall 接入独立闪控窗、独立闪控球或绑定切换。机器契约见 [profile.json](profile.json)。普通全局悬浮窗、悬浮按钮、画中画不是本能力，不能按外观相似自动迁移。

实施前与交付时按[权限与提醒要求](compatibility.md#权限声明acl-与用户授权)向开发者说明本次路线的权限条件和申请入口。

## 按任务加载

- SDK、权限、设备与版本：[兼容性](compatibility.md)。
- 实施：[实施入口](implementation.md)，再按 selectedRoutes 读取 [闪控窗](routes/float-view.md) 、[闪控球](routes/floating-ball.md) 或 [绑定](routes/binding.md)。
- 路线 ID：`float-view` 为独立窗，`floating-ball` 为独立球，`binding` 为[窗球绑定](routes/binding.md)。绑定只选 binding，内部复用两端能力；两个独立实现同时出现不等于绑定。
- 代码：[资产](assets-catalog.md)；失败和旧版本：[回退](fallback.md)。
- 验收：[性能与验证](performance-validation.md)；诊断：[排障](troubleshooting.md)。
- 用户明确要求闪控窗防窥时，读取[防窥联动](anti-peep-integration.md)，按其中要求加载独立的[防窥能力](../dlp-anti-peep/README.md)。

依据 2026-10-20 本地官方资料快照整理：[闪控窗指南](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/float-view-guide)、[窗 API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-floatview)、[球指南](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/floatingball-guide)、[球 API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-floatingball)。版本冲突时核对对应接口与目标 SDK 声明，不按样例工程版本反推 API 起点。
