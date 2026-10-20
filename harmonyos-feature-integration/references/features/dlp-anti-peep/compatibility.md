# 兼容性与前提

| 接口 | SDK/compile、运行 API |
|---|---|
| isDlpAntiPeepSwitchOn、on/off('dlpAntiPeep')、getDlpAntiPeepInfo、passDlpAntiPeepInfo | 20 |
| setAntiPeepMaskLayer | 21 |
| requestAntiPeepOptions、AntiPeepOptionsResult、publishAntiPeepInformation | 23 |

来源：[官方API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/devicesecurity-dlpantipeep-api)。Stage、Phone，SystemCapability.Security.DlpAntiPeep；设备设置须存在防窥保护选项。配置人脸识别，开启系统防窥保护并经人脸验证开启当前应用开关。元服务及其他形态不能仅凭 Stage 认定支持，先核对对应 SDK/官方支持证据。

宿主 module.json5 声明 ohos.permission.DLP_GET_HIDE_STATUS，并通过 [受限权限申请](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/declare-permissions-in-acl) 完成 ACL 和签名准备；不是 user_grant 弹框权限。按指南向用户说明数据使用目的、方式和范围。Skill 不代替平台审批。

运行 API 守卫必须早于方法访问和调用，随后检查 SysCap、应用开关。API20/21 无设置弹框接口时，引导用户到“设置 > 隐私与安全 > 防窥保护”操作，不调用 API23。返回应用后重查状态；API23 弹框由用户主动操作触发，不循环弹出。

无额外 target 门槛，保留 target/compatible。状态感知仅 API20；需要系统蒙层时 requiredApi 至少21；使用设置弹框/提示时至少23；闪控窗联动还要求窗能力 API26。单独状态路线可供业务保护逻辑使用，不默认制造自定义蒙层。

注册成功且应用前台可见时才收到通知。人脸、光线、距离、遮挡会影响识别；必须在支持能力的 Phone 真机验证，模拟器和 SDK 编译不能证明保护成功。
