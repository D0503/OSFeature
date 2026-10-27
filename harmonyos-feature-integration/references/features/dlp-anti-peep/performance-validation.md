# 性能与验证

feature 使用 dlp-anti-peep，verify-development 按 status-observation/system-mask 分别验证。静态 warn 需文件证据复核，不以关键词存在证明控制流保护。平台ACL、系统设置和识别效果必须实测。

| 路线 | 必须覆盖的场景 |
|---|---|
| status-observation | 开关关闭或拒绝、查询异常、订阅异常、初始状态、PASS/HIDE、未知状态不作为 PASS、重复进入不叠加监听、页面销毁时退订；存在多个订阅者时检查退订隔离 |
| system-mask | 正确窗口覆盖、无效或已销毁窗口、重复 HIDE 与 PASS→HIDE 不重复触发、重新进入可再次触发、蒙层失败、窗口切换、退出后的迟到结果 |

截图和运行结论仅证明实际采集的目标窗口，不能推断其他窗口已受保护。

仅接受已确认的 Phone 真机效果证据，设备信息需有 Phone 类型与真机连接/标志。运行观察 runtime.observations 包含 switch-checked、hide-observed、pass-observed、fallback-preserved、subscription-cleaned；system-mask 另需 mask-applied、mask-failure-handled、window-invalidated。每项 note 说明实际操作并引用本轮 runtime.evidence 的 id/sha256。visual 至少包含保护前与保护后的两张不同截图；状态感知单独接入时截图对应已确认业务对两种状态的响应，不虚构蒙层。

蒙层失败、权限拒绝和开关关闭必须显示未完成保护；故障注入可验证代码，但不能代替真实传感器检测。compatible 低于路线门槛时，低版本回退表现须实测并以 `fallback` 判定补录（见[回退路径的实测验证](fallback.md#回退路径的实测验证)），不以故障注入或静态复核替代。

状态感知检查 `isListenOn` 配合 `aboutToDisappear` 取消订阅；选择系统蒙层时另检查 `isSystemLayerTriggered` 记录结果、`isMaskRequesting` 防止并发请求、`onPageHide` 复位成功标志后重新进入可再次触发。工程使用等价状态时按实际字段核验。重复进入不叠加监听，页面销毁后不再更新其状态，隐藏/销毁窗口不再发起蒙层请求。性能验证观察回调数量、窗口切换、耗时与资源，不引入高频轮询。

按实际调用追加可选运行观察：requestAntiPeepOptions 需要 options-result-checked（设置结果及状态重查）、options-failure-handled（拒绝或未设置人脸等分支）；publishAntiPeepInformation 需要 information-published、information-failure-handled（重复发布或无风险等分支）；passDlpAntiPeepInfo 需要 explicit-pass-confirmed（明确放通操作与已订阅前提）、pass-duration-checked（锁屏或退出边界）。每项仍须引用本轮日志或组件树证据，错误注入仅证明对应异常分支。业务场景按 [场景选择](scenarios.md) 采集指定内容隐藏与恢复证据，不默认验证未选择的业务。
