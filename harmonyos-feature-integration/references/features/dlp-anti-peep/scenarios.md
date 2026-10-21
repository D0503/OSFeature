# 防窥保护场景选择

按用户指定的业务对象选择状态感知及可选系统蒙层，不自动新增页面、业务或关联能力。

| 目标 | 路线与版本 | 接入范围 |
|---|---|---|
| 查询或监听窥视状态 | status-observation，API20 | 查询应用开关、初始状态、前台通知及订阅清理 |
| 金融敏感信息隐藏 | status-observation，API20 | HIDE 时隐藏已确认的余额、收益或持仓字段，PASS 时恢复原值；替代内容沿用原业务策略 |
| 短视频与个性化内容保护 | status-observation，API20 | 仅按已确认策略暂停展示、暂停播放或隐藏关注列表；恢复时保留原播放与用户操作状态，不无条件自动播放 |
| 即时通讯内容保护 | status-observation，API20 | 仅隐藏已确认的联系人、消息预览或聊天内容，或替换为不敏感内容；不修改消息数据或发送逻辑 |
| 系统蒙层覆盖指定窗口 | system-mask，API21，通常组合 status-observation | 使用实际窗口 ID，按本次可见生命周期去重；不自行新增自定义全屏遮罩 |
| 应用内引导开启防窥 | status-observation + 可选 API23 设置接口 | 用户触发现有入口，处理设置结果并重查开关；低版本提供系统设置指引 |
| 持续风险时再次提示 | status-observation + 可选 API23 提示接口 | 明确要求时调用系统风险提示；不扩展为业务 Push 或自建实况窗 |
| 用户明确放通 | status-observation，API20 | 已订阅后按明确操作放通，说明持续到锁屏或应用退出；结束监听使用 off |

版本与授权见[兼容性](compatibility.md)，状态感知与内容保护按[开发步骤](implementation.md)接入，系统蒙层按其中第 6 步选配；设置及提示读取[专门说明](settings-and-information.md)。

状态未知、查询失败或订阅失败不等于 PASS；保持接入前既有保护行为，不以异常作为展示敏感内容的依据。

依据：[防窥保护最佳实践](https://developer.huawei.com/consumer/cn/doc/doccenter-advanced-features/bpta-antipeep-protection)、[API 参考](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/devicesecurity-dlpantipeep-api)。
