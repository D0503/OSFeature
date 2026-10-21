# 防窥设置与风险提示（API23）

两项能力独立可选，复用 status-observation 路线并将 SDK/compile 要求提高到 API23；不要求为此增加系统蒙层。设置入口从[工具资产](assets/AntiPeepUtils.ets)导入 `requestAntiPeepOptions`，结果枚举及风险提示接口使用 `@kit.DeviceSecurityKit` 的 `dlpAntiPeep`。调用前满足[兼容性与权限](compatibility.md)，运行版本与 SysCap 守卫须早于封装调用和 `AntiPeepOptionsResult` 枚举的访问。

## 引导开启防窥

底层 API 支持 UIAbility/UIExtensionAbility 使用对应 Context 拉起设置弹框。工具资产提供 `requestAntiPeepOptions(context: common.UIAbilityContext)`，用于持有 UIAbilityContext 的页面。页面导入该封装，在已检查 API23 和设备能力的分支中调用；使用现有、用户主动点击的设置入口，并防止并发或循环弹框。

| 结果 | 值 | 处理 |
|---|---|---|
| SUCCESS | 0 | 设置成功，重新查询应用开关和当前窥视状态，再建立或恢复本次订阅 |
| FAIL | 1 | 保留原业务和既有保护，不报告已开启或强制重弹 |
| ALREADY_ON | 2 | 已开启，重新查询状态，不重复叠加订阅 |

封装成功时返回底层原结果，捕获接口异常时记录日志并返回 FAIL。页面按结果处理失败，具体错误码查看 `AntiPeepUtils` 日志，不通过页面 catch 判断已被捕获的底层异常。日志中的 `1020600004` 表示未设置人脸识别，引导用户完成设备人脸设置；201、801、1020600001 分别检查权限、设备能力和服务异常。设置结果不是 PASS/HIDE，也不能直接证明窗口已受保护。

API20/21 使用“设置 > 隐私与安全 > 防窥保护”的用户操作指引，返回应用后重新查询。最小 API23 片段见 [代码资产](assets-catalog.md#api23-用户设置入口)。

## 再次发布风险提示

`publishAntiPeepInformation(): Promise<void>` 发布系统防窥保护提示。设备持续处于窥屏风险时，系统主动发送一次时长 5 秒的实况窗提醒；再次提醒可由该接口触发。只有目标明确要求再次提示时才添加调用，不在每次 HIDE 回调中无节制触发。

处理 Promise 拒绝：1020600002 为未开启，1020600003 为应用未显示，1020600005 为提示已发布，1020600006 为未检测到窥视风险。保留这些实际结果，不将“无风险”错误转换为主动查询所得的 PASS，不因失败循环重发。该接口不返回防窥状态，也不提供窗口蒙层。

## 验证

设置入口覆盖 SUCCESS、FAIL、ALREADY_ON、未设置人脸、重复点击和返回页面后的状态重查；提示入口覆盖持续风险、重复发布、无风险、应用不可见和开关关闭。错误注入可验证分支，系统弹框和实际提示仍需支持能力的 Phone 真机证据。

依据：[API 参考](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/devicesecurity-dlpantipeep-api)、[开发指南](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/devicesecurity-dlpantipeep)。
