# 闪控窗防窥联动

用户明确要求闪控窗防窥时，加载本能力与独立的[防窥能力](../dlp-anti-peep/README.md)，各自保留版本、权限、应用形态和设备门禁。交集要求实际支持防窥的 Phone 真机、API26、FLOAT_VIEW 的 ACL 与用户授权、DLP_GET_HIDE_STATUS 的 ACL；不支持元服务，绑定球时另需 USE_FLOAT_BALL。

闪控窗联动属于组合接入，只有用户明确要求时，才在防窥状态回调中结合[闪控窗路线](routes/float-view.md)的窗口状态和 ID 获取方式实施。普通主窗口的接入结果不能作为闪控窗已受保护的证据。

按[防窥开发步骤](../dlp-anti-peep/implementation.md)检查能力与开关、读取初始状态并注册监听。闪控窗收到 STARTED 后，使用其控制器 `getWindowProperties().windowId` 作为 `showSystemMaskLayer` 的目标；HIDDEN、IN_SIDEBAR、IN_FLOATING_BALL、STOPPED、ERROR 状态下不再对该不可见或已失效窗口发起蒙层调用。重新显示时重新获取 ID，业务退出时取消本次订阅。普通主窗的 `getWindowProperties().id` 不等于闪控窗 ID。

当窗从球切回时，重查应用开关和当前状态。主应用后台而闪控窗可见的通知/蒙层行为必须实测，不因主窗口订阅成功推断跨窗口成功。失败保留原业务且记录未完成保护。

不对球窗口自动添加遮罩、修改球文本或停止球；如用户要求保护球中敏感数据，先确认具体策略与官方支持。验收分别记录主窗（若接入）、闪控窗显示、窗→球、球→窗、窗关闭后无迟到蒙层，各窗口结果单独判定。

按[防窥验证要求](../dlp-anti-peep/performance-validation.md)完成所选防窥路线的验收，在防窥 `system-mask` 路线的运行观察中另采集 `float-view-protected`、`target-window-invalidated`；绑定切换仍按[窗球验证要求](performance-validation.md)独立验收。截图和运行结论仅证明实际采集的目标窗口，不能推断其他窗口或闪控球已受保护。
