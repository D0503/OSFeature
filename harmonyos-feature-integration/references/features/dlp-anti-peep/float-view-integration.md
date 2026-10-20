# 闪控窗防窥联动

同时加载本能力与 [窗球能力](../float-view-ball/README.md)，各自保留版本、权限和设备门禁。交集要求实际支持防窥的 Phone 真机、API26、FLOAT_VIEW 授权与 DLP_GET_HIDE_STATUS ACL；绑定球时另需 USE_FLOAT_BALL。

由覆盖闪控窗业务生命周期的所有者持有 AntiPeepSession。启动窗且收到 STARTED 后，取得 view.getWindowProperties().windowId，调用 session.setTargetWindow(id)，并在可用条件下 start。HIDDEN、IN_SIDEBAR、IN_FLOATING_BALL 时 setTargetWindow(undefined)，重新 STARTED 时重新获取 ID，不用缓存旧窗口 ID。STOPPED/ERROR 使目标失效；业务终止时 stop 退订。主窗口需要保护时使用独立目标会话或已有窗口管理器，避免把 lastWindow 误当作闪控窗。

当窗从球切回时，重查应用开关和当前状态。主应用后台而闪控窗可见的通知/蒙层行为必须实测，不因主窗口订阅成功推断跨窗口成功。失败保留原业务且记录未完成保护。

不对球窗口自动添加遮罩、修改球文本或停止球；如用户要求保护球中敏感数据，先确认具体策略与官方支持。验收分别记录主窗（若接入）、闪控窗显示、窗→球、球→窗、窗关闭后无迟到蒙层，各窗口结果单独判定。
