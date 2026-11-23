# 兼容性与前置条件

| 项目 | 条件 |
|---|---|
| SDK 与有效 compile | `textSearchImage` 的各方法与 `ImageObject` 自 HarmonyOS 7 / `26.0.0`（API 26）起可用。用活动 SDK 根的 `sdk-pkg.json` 核对路线门槛。在已接入工程扫描时核对实际 SDK 声明。 |
| target 与 compatible | 按 [Skill 兼容性模型](../../shared/compatibility-model.md)处理 SDK、有效 compile 与 target，target 至少 API 26 是统一接入策略。经确认升级时保留既有 compatible 与更高版本配置。 |
| 工程 | API 要求 Stage。本能力包覆盖由 `entry`／`feature` HAP 承载的普通应用，元服务支持待确认。 |
| 运行环境 | 在中国大陆的 API 26.0.0+ Phone、Tablet 或 PC/2in1 真机验收。Core Vision Kit 暂不支持模拟器。运行时先检查 `deviceInfo.apiAvailable('26.0.0')`，再检查 `canIUse('SystemCapability.AI.Vision.VisionBase')`，最后确认实际服务初始化成功。 |
| 权限与签名 | API 参考未声明专用权限、账号或开通步骤。沿用已有图源授权与真机调试签名。选图时只处理用户授权的图片，按需复制到应用沙箱，关闭打开的文件描述符。 |

## 来源与版本

资料快照日期为 2026-11-23，接口起始版本与签名已对照 HarmonyOS SDK 26.0.0.105 声明。官方来源包括[API 参考](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/core-vision-text-search-image-api)、[开发指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/core-vision-text-search-image)、[Core Vision Kit 约束](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/core-vision-introduction)及[错误码](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/errorcode-core-vision)。
