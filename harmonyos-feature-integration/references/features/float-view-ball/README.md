# 闪控窗／球

通过 ArkUI 的 floatView / floatingBall 接入独立闪控窗、独立闪控球或绑定切换。机器契约见 [profile.json](profile.json)。普通全局悬浮窗、悬浮按钮、画中画不是本能力，不能按外观相似自动迁移。

实施前与交付时按[权限与提醒要求](compatibility.md#权限声明acl-与用户授权)向开发者说明本次路线的权限条件和申请入口。

## 按任务加载

按[任务读取表](../../shared/document-loading.md#任务读取表)确定阶段。所有任务先读 [profile.json](profile.json)与[兼容性](compatibility.md)；只查询接口时不进入工程实施。

设计/实施先读[公共实现](implementation.md)、[资产说明](assets-catalog.md)、[回退](fallback.md)和[公共验收](performance-validation.md)。验证读取回退与公共验收，诊断读取[排障](troubleshooting.md)；只诊断请求不修改工程。

下表是条件必读索引：设计读候选场景的约束与资产说明；实施只读已确认场景的具体资产；验证只读实际启用场景的验收。公共要求与场景要求合并，同文件只读一次，不因读取可选场景而增加功能。

| 场景与加载条件 | 方案与实现 | 代码或配置资产 | 验收入口 |
|---|---|---|---|
| 独立窗 `float-view`；候选或已选窗路线时 | [窗路线](routes/float-view.md) | [资产说明](assets-catalog.md)、[FloatViewController.ets](assets/FloatViewController.ets) | [窗状态、更新与关闭](performance-validation.md) |
| 独立球 `floating-ball`；候选或已选球路线时 | [球路线](routes/floating-ball.md) | [资产说明](assets-catalog.md)、[FloatingBallController.ets](assets/FloatingBallController.ets) | [球交互与清理](performance-validation.md) |
| 绑定切换 `binding`；明确需要窗球切换时 | [绑定流程](routes/binding.md)；绑定只选 binding，内部复用两端能力；两个独立实现同时出现不等于绑定 | [组合资产说明](assets-catalog.md)、[FloatViewBallController.ets](assets/FloatViewBallController.ets)、[窗控制器](assets/FloatViewController.ets)、[球控制器](assets/FloatingBallController.ets) | [绑定与双端终态验收](performance-validation.md) |
| 闪控窗防窥；用户明确要求联动时 | [防窥联动](anti-peep-integration.md)、独立[防窥能力入口](../dlp-anti-peep/README.md) | 按两包已选能力读取资产，不扩展为球窗口保护 | [窗球验收](performance-validation.md)及[防窥窗口验收](../dlp-anti-peep/performance-validation.md) |

依据 2026-10-20 本地官方资料快照整理：[闪控窗指南](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/float-view-guide)、[窗 API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-floatview)、[球指南](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/floatingball-guide)、[球 API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-floatingball)。版本冲突时核对对应接口与目标 SDK 声明，不按样例工程版本反推 API 起点。

## 已接入工程兼容性扫描

扫描或修复版本守卫与低版本回退时，读取[本特性扫描及回退策略](compatibility-audit.md)和[共享工作流](../../workflows/compatibility-audit.md)。仅检查不改工程；修复后要求高低版本实际运行验证。
