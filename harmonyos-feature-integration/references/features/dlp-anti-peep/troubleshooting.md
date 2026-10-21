# 排障

| 现象 | 检查 |
|---|---|
| 201 | 宿主 DLP_GET_HIDE_STATUS 声明、ACL批准及实际签名身份 |
| 801 | Phone真机、运行API、SystemCapability.Security.DlpAntiPeep与设备设置是否存在该能力 |
| 1020600001 | 内部错误；保留实际错误与 unknown/未保护，检查服务和调用前提，不自动放通 |
| 1020600002 | 系统及当前应用防窥开关、人脸识别；返回应用后重新查询 |
| 1020600003 | 目标应用是否显示、窗口是否存活可见、ID来源与当前生命周期 |
| 1020600004 | requestAntiPeepOptions 调用时未设置人脸识别，引导用户到设备设置完成后再主动重试 |
| 1020600005 | publishAntiPeepInformation 提示已发布，检查重复触发，不循环重发 |
| 1020600006 | publishAntiPeepInformation 未检测到窥视风险，不把错误当作 getDlpAntiPeepInfo 返回的 PASS |
| 无HIDE通知 | 订阅成功、前台可见、光线/距离/人脸遮挡与机主识别；不要以接口无异常判定通过 |
| 蒙层重复/覆盖错窗 | `isSystemLayerTriggered` 是否正确记录调用结果、`onPageHide` 中是否复位、目标窗口是否显示、窗口 ID 是否来自当前存活且归属明确的目标窗口 |
| 一直PASS | 排查是否误调用 passDlpAntiPeepInfo，锁屏或应用退出前放通仍可能有效 |

仅诊断请求不修改工程。异常保留unknown/未保护，不伪造PASS；按对应路线复验。
