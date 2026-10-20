# 系统蒙层（API21）

通常与状态感知组合；若工程已有可信状态来源则复用该订阅。收到 HIDE 后，对实际存活且可见的受保护窗口调用 setAntiPeepMaskLayer(windowId)。windowId 必须是大于0的整数；普通窗口用 getWindowProperties().id，闪控窗用其控制器 getWindowProperties().windowId，不混用对象字段。

每个目标窗口按 HIDE 周期合并触发，Promise 成功后才记为成功；失败保留错误与未保护状态，避免无限自动重试。窗口销毁/隐藏时将目标失效，异步返回不得污染下一代窗口；若调用已发出无法撤销，不在 Promise 完成后把旧结果写入新窗口。

## 资产

[AntiPeepSession.ets](../assets/AntiPeepSession.ets) 的 systemMask=true 模式要求 API21。目标切换时用 setTargetWindow(id)；隐藏/销毁时用 setTargetWindow(undefined)。业务结束调用 stop。与闪控窗联动见 [联动](../float-view-integration.md)。

## 验证

验证正确窗口覆盖、无效/销毁窗口、重复HIDE、蒙层失败、窗口切换和退出后迟到的异步结果；截图只能证明所展示窗口，不能推断其他窗口或闪控球已保护。
