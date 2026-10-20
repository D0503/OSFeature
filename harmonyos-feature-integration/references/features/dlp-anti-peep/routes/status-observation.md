# 状态感知（API20）

完成 [兼容性](../compatibility.md)。按可见窗口所有者检查 SysCap 与应用开关，保存回调后订阅 on('dlpAntiPeep', callback)，读取 getDlpAntiPeepInfo 获取当前状态。订阅失败、开关查询失败、状态读取失败均保持 unknown，不能转换为 PASS。

PASS=0，HIDE=1。状态变化交给已确认的保护逻辑；如需系统蒙层加载 [系统蒙层](system-mask.md)。使用同一个回调 off('dlpAntiPeep', callback)，只在订阅成功后退订；退订失败保留引用用于重试。不要 off 所有回调影响其他所有者。

## 资产

[AntiPeepSession.ets](../assets/AntiPeepSession.ets) 提供拥有订阅、代次失效和未知状态的会话；单独状态模式不调用 API21 蒙层。开关设置入口使用 [资产说明](../assets-catalog.md) 的 API23 保护片段。

## 验证

验证开关关闭/拒绝、查询异常、订阅异常、初始状态、PASS/HIDE、重复通知、退出时尚未完成的异步查询、重新进入和多所有者退订隔离。实际窥视回调仍需真机验证。
