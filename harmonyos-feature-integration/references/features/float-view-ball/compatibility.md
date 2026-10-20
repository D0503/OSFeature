# 兼容性与权限

| 能力 | SDK/compile 与运行 API | 其他条件 |
|---|---|---|
| 闪控球基础 | 20 | Stage；USE_FLOAT_BALL 受限权限 |
| setFloatingBallVisibilityInApp | 24 | 仅在该分支使用 |
| onDestroy/offDestroy、titleColor/contentColor/textUpdateAnimationType | 26 | 文字颜色配置须有 backgroundColor |
| 闪控窗与 bind/unbind | 26 | Stage；窗需要 FLOAT_VIEW，绑定同时需要球权限 |

无独立 target 门槛，保留 target 和 compatible；升级本机 SDK/有效 compile 的选择沿用通用门禁。新增接口也参与 requiredApi，不只检查已存在的源码。

先判断运行 API，再判断 SystemCapability.Window.SessionManager，再调用 isFloatViewEnabled/isFloatingBallEnabled；SDK、SysCap 和布尔可用性均不能代替权限、前台和窗口模式检查。控制器只能使用有效 UIAbilityContext，HAR 代码须追踪实际宿主 HAP。元服务及未获证据的设备/分发形态先核对支持情况，不从 Stage 推断可用。

闪控球在 HarmonyOS 7.0.0 之前支持 Phone、非电脑模式 Tablet；7.0.0 起支持 Phone、Tablet、PC/2in1。DevEco Studio 6.0.1 Release 及以上模拟器支持球功能，仍须确认目标系统和权限。窗相关可执行接口支持 Phone/Tablet/2in1，bind/unbind 资料标注 Phone/Tablet；不能把类型定义顶部的设备标签当作全部操作的可用性证据。闪控窗与绑定不推定模拟器可用，实际支持须核验。

在宿主 module.json5 的 requestPermissions 声明 ohos.permission.FLOAT_VIEW，提供 reason 对应的资源和使用场景；通过 abilityAccessCtrl 检查并按用户操作请求 user_grant 授权。拒绝后保留原业务，不循环弹窗。

ohos.permission.USE_FLOAT_BALL 为受限权限，先完成 [ACL 申请](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/declare-permissions-in-acl) 和签名身份核对，再声明权限；不是运行时用户弹框权限。资料开放场景为跨应用题目搜索、账单记录、商品比价、抢单、翻译及金融实时盯盘，实际准入以平台核验为准。Skill 提供操作指引，不代替平台审批，不索取签名私钥。

窗和球仅允许应用前台启动。同应用仅一个窗、一个球；独立窗不能在球或画中画已启动时启动，先完成停止。绑定使用专门生命周期而非并行启动。设备最多两个球，新球可能替换最早启动的球，必须处理系统停止回调。
