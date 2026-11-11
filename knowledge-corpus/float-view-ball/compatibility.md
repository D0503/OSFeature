---
title: "闪控球／窗兼容性与权限"
summary: "汇总独立闪控球、独立闪控窗及窗球绑定的编译与运行 API 门槛、设备和模拟器支持条件、ACL 权限与授权方式，以及运行时检查和启动限制。"
createdAt: "2026-11-10"
updatedAt: "2026-11-10"
tags: ["HarmonyOS", "闪控球", "闪控窗", "窗球绑定", "兼容性", "设备支持", "ACL 权限"]
---

# 闪控球／窗兼容性与权限

## API 门槛

| 路线或能力 | 最低编译 API | 最低运行 API | 附加条件 |
| --- | --- | --- | --- |
| 独立闪控球基础能力（`floatingBall`） | 20 | 20 | Stage 模型，需 `ohos.permission.USE_FLOAT_BALL` |
| 闪控球应用内可见性（`setFloatingBallVisibilityInApp`） | 24 | 24 | 仅在支持该接口的分支调用 |
| 闪控球销毁监听（`onDestroy`／`offDestroy`） | 26 | 26 | 仅在支持该接口的分支调用 |
| 闪控球文字颜色（`titleColor`／`contentColor`） | 26 | 26 | 配置任一文字颜色时须同时配置 `backgroundColor` |
| 闪控球文字更新动画（`textUpdateAnimationType`） | 26 | 26 | 仅在支持该参数的分支使用 |
| 独立闪控窗（`floatView`） | 26 | 26 | Stage 模型，需 `ohos.permission.FLOAT_VIEW` |
| 窗球绑定（`floatView.bind`／`floatView.unbind`） | 26 | 26 | Stage 模型，需同时满足两端的版本、设备及权限条件 |

## 设备与模拟器支持

| 能力 | 环境 | 支持条件 |
| --- | --- | --- |
| 闪控球 | HarmonyOS 7.0.0 之前 | Phone、非电脑模式下的 Tablet |
| 闪控球 | HarmonyOS 7.0.0 起 | Phone、Tablet、PC／2in1 |
| 闪控球 | DevEco Studio 模拟器 | DevEco Studio 6.0.1 Release 及以上，仍须确认模拟器目标系统和权限 |
| 闪控窗 | 目标设备 | 相关可执行接口的资料标注为 Phone、Tablet、2in1，以实际使用的接口为准 |
| 窗球绑定 | 目标设备 | `bind`／`unbind` 的资料标注为 Phone、Tablet，逐项核对两端接口 |
| 闪控窗、窗球绑定 | DevEco Studio 模拟器 | 待核验，以实际目标环境的验证结果为准 |

设备支持以具体操作的说明及能力检测结果为依据。元服务或资料未覆盖的设备和分发形态须单独核对。类型定义标注的设备范围不足以确定各个操作是否可用。

## 权限、授权与签名

| 权限 | 适用路线 | ACL | 授权类型 | 应用侧要求 |
| --- | --- | --- | --- | --- |
| `ohos.permission.USE_FLOAT_BALL` | 独立闪控球、窗球绑定 | 需申请并获准 | `system_grant` | 在实际宿主 `module.json5` 的 `requestPermissions` 中声明，核对实际签名 profile |
| `ohos.permission.FLOAT_VIEW` | 独立闪控窗、窗球绑定 | 需申请并获准 | `user_grant` | 在实际宿主声明权限、配置 `reason` 字符串资源和 `usedScene`，核对实际签名 profile，再通过 `abilityAccessCtrl` 检查并按用户操作请求授权 |

窗球绑定需要两项权限。窗的 ACL 获准后仍须取得用户授权。用户拒绝时保留原业务，避免重复弹出授权请求。接入权限后需要重新签名，使用自动签名调试时，确认更新后的签名 profile 包含所需权限。 [申请 ACL 权限](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)

闪控球资料列出的开放场景包括跨应用题目搜索、账单记录、商品比价、抢单、翻译和金融实时盯盘，实际准入以平台核验为准。

## 运行时检查与启动限制

1. 先检查实际运行 API，再检查 `SystemCapability.Window.SessionManager`，随后调用所选路线对应的 `floatView.isFloatViewEnabled()` 或 `floatingBall.isFloatingBallEnabled()`。绑定时分别检查两端。
2. 单独核对权限、应用前后台和窗口模式。控制器使用有效的 `UIAbilityContext`。功能封装在 HAR 中时，权限和签名配置以实际宿主 HAP 为准。
3. 闪控球和闪控窗均须在应用前台启动。同一应用各只能启动一个窗和一个球。启动独立闪控窗前，须等已有闪控球或画中画停止。绑定场景先绑定两端，再启动首次展示的一端。
4. 设备最多同时展示两个闪控球。新球可能替换最早启动的球，业务应处理系统停止回调。

版本依据来自 2026-10-20 的官方资料快照。结论有冲突时，核对实际使用的接口与目标 SDK 声明。
