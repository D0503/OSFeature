# 兼容性与权限

| 能力 | SDK/compile 与运行 API | 其他条件 |
|---|---|---|
| 闪控球基础 | 20 | Stage；USE_FLOAT_BALL 受限权限 |
| setFloatingBallVisibilityInApp | 24 | 仅在该分支使用 |
| onDestroy/offDestroy、titleColor/contentColor/textUpdateAnimationType | 26 | 文字颜色配置须有 backgroundColor |
| 闪控窗路线 float-view | 26 | Stage；需要 FLOAT_VIEW |
| 绑定路线 binding（bind/unbind） | 26 | Stage；同时检查窗、球权限与两端接口版本 |

版本升级遵循[通用兼容性规则](../../shared/compatibility-model.md#升级接入对所有特性通用)。

先判断运行 API，再判断 SystemCapability.Window.SessionManager，再调用 isFloatViewEnabled/isFloatingBallEnabled；SDK、SysCap 和布尔可用性均不能代替权限、前台和窗口模式检查。控制器只能使用有效 UIAbilityContext，HAR 代码须追踪实际宿主 HAP。元服务及未获证据的设备/分发形态先核对支持情况，不从 Stage 推断可用。

闪控球在 HarmonyOS 7.0.0 之前支持 Phone、非电脑模式 Tablet；7.0.0 起支持 Phone、Tablet、PC/2in1。DevEco Studio 6.0.1 Release 及以上模拟器支持球功能，仍须确认目标系统和权限。窗相关可执行接口支持 Phone/Tablet/2in1，bind/unbind 资料标注 Phone/Tablet；不能把类型定义顶部的设备标签当作全部操作的可用性证据。闪控窗与绑定不推定模拟器可用，实际支持须核验。

## 权限声明、ACL 与用户授权

**`ohos.permission.FLOAT_VIEW` 和 `ohos.permission.USE_FLOAT_BALL` 都是受限 ACL 权限。** 按实际接入路线在 HarmonyOS 开发者中心平台[申请 ACL 权限](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)，在实际宿主 `module.json5` 的 `requestPermissions` 中声明对应权限，并核对实际签名 profile 包含已获准的权限；绑定场景须同时具备两项权限。

闪控窗必须申请并获得 [`ohos.permission.FLOAT_VIEW`](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/restricted-permissions#ohospermissionfloat_view) 权限。除 ACL 申请及声明外，还须提供 reason 对应的资源和使用场景，通过 abilityAccessCtrl 检查并按用户操作请求 user_grant 用户授权；ACL 获准不能代替用户授权。拒绝后保留原业务，不循环弹窗。

闪控球必须申请 [`ohos.permission.USE_FLOAT_BALL`](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/restricted-permissions#ohospermissionuse_float_ball) 受限 ACL 权限，完成声明和签名身份核对；其授权方式为 system_grant，不是运行时用户弹框权限。资料开放场景为跨应用题目搜索、账单记录、商品比价、抢单、翻译及金融实时盯盘，实际准入以平台核验为准。Skill 提供操作指引，不代替平台审批，不索取签名私钥。

**首次修改工程前和实施结束后的最终交付说明中，都必须向开发者提醒上述两项受限 ACL 权限，并按本次路线说明球必须申请权限、窗必须申请权限且取得用户授权，提供 ACL 申请链接。** 实施前已提醒不能省略实施后的提醒；声明或静态检查通过不能证明 ACL 已获准或用户已授权。

窗和球仅允许应用前台启动。同应用仅一个窗、一个球；独立窗不能在球或画中画已启动时启动，先完成停止。绑定使用专门生命周期而非并行启动。设备最多两个球，新球可能替换最早启动的球，必须处理系统停止回调。
