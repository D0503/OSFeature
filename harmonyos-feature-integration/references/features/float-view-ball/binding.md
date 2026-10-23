# 窗球绑定切换（API 26）

前提：两端可用、Phone/Tablet 实际支持、FLOAT_VIEW 与 USE_FLOAT_BALL 均已完成权限声明，且 FLOAT_VIEW 已获用户授权。创建两个尚未启动的控制器，给窗加载页面，注册各自状态回调，然后 await floatView.bind(view, ball, params)。绑定参数覆盖球控制器此前保存的启动参数。

使用 [FloatingBallController](assets-catalog.md#闪控球) 时，调用 `createFloatingBall(config, undefined, onStateChange)` 创建球端并注册监听，不传 want。取类中已创建的控制器，之后 bind 并启动一端。准备失败由组合所有者清理本次监听与引用。

绑定成功后只调用一端启动：view.start() 或 ball.startFloatingBall(params)，由业务决定初始展示形态。系统同时创建两端窗口，但只展示一端；用户通过系统操作切换。不要在球 click 回调中再启动窗或同时恢复主窗口。

进入 IN_FLOATING_BALL 时窗控制器仍存活，不能按 STOPPED 清理。任一端 stop 会同时销毁两端并触发通知；所有者等待终态并幂等清理两个控制器的监听和自有资源，不能先丢弃引用。unbind(view, ball) 必须在两端均停止后调用，只负责解除关系，不等同于停止或销毁；需要解绑时在完成解绑前保留两个引用。

绑定失败时不启动任一端，清理本次监听并保持原业务；不自动选择独立模式。重复点击用同一串行任务隔离，异步完成后核对当前所有者。

验收需记录 view→ball、ball→view、关闭任一端后双端销毁、再次创建，以及绑定失败、缺少任一权限和启动后再绑定的负向场景。与[防窥](anti-peep-integration.md)联动时，窗进入球或侧栏后使蒙层目标不可见，不能把球视作已遮罩。
