# 图像超分兼容与前置条件

| 项 | 本路线要求 |
|---|---|
| SDK／有效 compile | `ImageSRAnalyzer.create/process/destroy` 起始于 HarmonyOS 7 / `26.0.0`（API 26）；定位活动 SDK 根 `sdk-pkg.json`。已有显式 compile 不足时调整既有配置；没有则不新加。 |
| target／compatible | target ≥ 26 是 Skill 接入策略，不是独立的官方 target 硬门槛。升级须确认、更高版本不下调，`compatibleSdkVersion` 保持原值；按[通用兼容性模型](../../shared/compatibility-model.md)核实配置格式。 |
| 工程范围 | Stage 普通应用的 `entry`／`feature` HAP 承载业务入口；服务可复用现有模块。给定 API 资料未明确元服务支持，本能力包不承诺该范围。 |
| 运行环境 | Phone、Tablet、PC/2in1 真机，中国大陆；模拟器不支持。真机类型符合并不证明具体设备可运行，需核实 `26.0.0+`、`SystemCapability.AI.Vision.VisionBase` 和实际处理。 |
| 权限与签名 | API 资料未列出专用权限、账号或服务开通要求；不添加推测性权限。使用现有图源或 `PhotoViewPicker` 的用户选中 URI，不因选择单图申请全图库权限。保存授权按原流程；签名沿用目标工程真机调试配置。 |

先确定 product、承载 HAP、现有图源、回退基线与是否已授权升级。所有高版本调用（包括清理）仅在版本和 SysCap 守卫内可达；使用 `deviceInfo.apiAvailable('26.0.0')` 后再判断 SysCap，不能用共享的 VisionBase SysCap 代替版本检查。

## 来源与核验

版本与限制基于 2026-11-19 的华为开发者联盟资料：[开发指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/core-vision-image-super-resolution)、[图像超分 API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/core-vision-image-super-resolution-api)、[Core Vision Kit 约束](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/core-vision-introduction)、[visionBase](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/core-vision-vision-base-api)、[错误码](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/errorcode-core-vision)。SDK 声明、官方文档或实际设备表现有冲突时分开记录，不将社区 Demo 的成功样本当成支持范围。
