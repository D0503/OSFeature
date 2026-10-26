# 兼容性与前提

| 接口 | SDK/compile、运行 API |
|---|---|
| isDlpAntiPeepSwitchOn、on/off('dlpAntiPeep')、getDlpAntiPeepInfo、passDlpAntiPeepInfo | 20 |
| setAntiPeepMaskLayer | 21 |
| requestAntiPeepOptions、AntiPeepOptionsResult、publishAntiPeepInformation | 23 |

来源：[官方API](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/devicesecurity-dlpantipeep-api)。Stage、Phone，SystemCapability.Security.DlpAntiPeep；设备设置须存在防窥保护选项。配置人脸识别，开启系统防窥保护并经人脸验证开启当前应用开关。折叠屏设备也须按 Phone 类型、SysCap 和设备设置核验，不能据设备外形认定支持。

**应用形态限制：防窥保护不支持元服务。** 接入前必须核对目标应用形态；目标为元服务时，告知不支持并停止防窥接入。使用 Stage 模型、满足 API20/21/23 版本或通过 SysCap 检查，均不能解除这一限制。

## 权限声明与 ACL

接入时必须在实际宿主 HAP 的 `module.json5` 中合并以下权限声明，保留已有权限。`AntipeepAbility` 替换为实际使用防窥能力的 Ability 名称。

```json5
{
  "module": {
    "requestPermissions": [
      {
        "name": "ohos.permission.DLP_GET_HIDE_STATUS",
        "reason": "$string:permission_hide",
        "usedScene": {
          "abilities": ["AntipeepAbility"],
          "when": "always"
        }
      }
    ]
  }
}
```

在宿主模块的 `resources/base/element/string.json` 的 `string` 数组中补充以下资源；已有同名资源时复用，并按工程现有方式提供多语言文案。

```json
{
  "name": "permission_hide",
  "value": "使用系统防窥保护能力以保护应用的隐私"
}
```

**实施前（首次修改工程前）和实施结束后的最终交付说明中，都必须提醒开发者：`ohos.permission.DLP_GET_HIDE_STATUS` 是受限 ACL 权限。** 两次提醒均须包含以下调试与上架要求及 ACL 申请链接：

- **仅本地调试防窥保护能力：** 自动签名时同意权限申请即可。
- **应用上架需使用防窥保护能力：** 需要申请 `ohos.permission.DLP_GET_HIDE_STATUS` 权限，并在 HarmonyOS 开发者中心平台 [申请 ACL 权限](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)。

两种场景均需声明上述权限，并核对实际签名 profile 中包含该权限；声明本身不代表已获准。它不是 `user_grant` 运行时弹框权限，`requestAntiPeepOptions` 仅用于防窥开关设置，不能代替 ACL 申请。向用户说明数据使用目的、方式和范围。声明流程参见 [申请使用受限权限](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/declare-permissions-in-acl)，Skill 不代替平台审批。

## 运行门禁

运行 API 守卫必须早于方法访问和调用，随后检查 SysCap、应用开关。API20/21 无设置弹框接口时，引导用户到“设置 > 隐私与安全 > 防窥保护”操作，不调用 API23。返回应用后重查状态；API23 弹框由用户主动操作触发，不循环弹出。

版本升级遵循[通用兼容性规则](../../shared/compatibility-model.md#升级接入对所有特性通用)。状态感知仅 API20；需要系统蒙层时 requiredApi 至少21；使用设置弹框/提示时至少23。单独状态路线可供业务保护逻辑使用，不默认制造自定义蒙层。

注册成功且应用前台可见时才收到通知。人脸、光线、距离、遮挡会影响识别；必须在支持能力的 Phone 真机验证，模拟器和 SDK 编译不能证明保护成功。
