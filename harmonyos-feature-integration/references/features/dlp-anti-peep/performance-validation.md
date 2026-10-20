# 性能与验证

feature 使用 dlp-anti-peep，verify-development 按 status-observation/system-mask 分别验证。静态 warn 需文件证据复核，不以关键词存在证明控制流保护。平台ACL、系统设置和识别效果必须实测。

仅接受已确认的 Phone 真机效果证据，设备信息需有 Phone 类型与真机连接/标志。运行观察 runtime.observations 包含 switch-checked、hide-observed、pass-observed、fallback-preserved、subscription-cleaned；system-mask 另需 mask-applied、mask-failure-handled、window-invalidated。每项 note 说明实际操作并引用本轮 runtime.evidence 的 id/sha256。visual 至少包含保护前与保护后的两张不同截图；状态感知单独接入时截图对应已确认业务对两种状态的响应，不虚构蒙层。

闪控窗联动另采集 float-view-protected、target-window-invalidated 的观察，绑定切换还按窗球能力独立验收。蒙层失败、权限拒绝和开关关闭必须显示未完成保护；故障注入可验证代码，但不能代替真实传感器检测。

检查重复HIDE不并发拉起蒙层、重复进入不叠加监听、退出后无迟到状态更新、隐藏/销毁窗口不再接收蒙层。性能验证观察回调数量、窗口切换、耗时与资源，不引入高频轮询。
