# 握持手感知

SDK/compile API 20+，运行时 API 20+ 与 Motion SysCap 都满足后，调用 `motion.on('holdingHandChanged', callback)`；在所属 HAP 声明 DETECT_GESTURE。权限与目标发行版要求见 [兼容性](../../compatibility.md)。

`HoldingHandStatus`：NOT_HELD=0、LEFT_HAND_HELD=1、RIGHT_HAND_HELD=2、BOTH_HANDS_HELD=3、UNKNOWN_STATUS=16。此枚举的未知值不是操作手的 0。只将 LEFT_HAND_HELD/RIGHT_HAND_HELD 映射为左右位移，其他值不强制换边；关闭和失败则回到源基线。

使用稳定 callback，在订阅成功后通过 `motion.off('holdingHandChanged', callback)` 清理。首次订阅可返回当前握持状态，不编造 getRecentHoldingHandStatus。按 [共同规则](../../implementation.md) 控制可见期、重复订阅、迟到回调、交互期间暂缓位移与错误处理。

侧边 FAB 可采用左右条件分支和 TransitionEffect.move(START/END)；适配时保留业务状态，屏外绕行、垂直高度不变、左右间距一致。初始位置沿用用户原始布局，不为此增加新闻页、弹窗或附加操作按钮。

设备需支持对应硬件、亮屏解锁且正常握持，SysCap 通过仍可能返回 801；系统开关及壳厚等条件见兼容性。读 [资产](assets.md) 和 [验证](validation.md)。
