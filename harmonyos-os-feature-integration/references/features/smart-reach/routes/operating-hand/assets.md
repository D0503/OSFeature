# 操作手资产

使用 [OperatingHandSession.ets](../../assets/OperatingHandSession.ets)。构造时传入 `(left: boolean) => void` 和 `(code: number) => void`；左手为 true、右手为 false，未知状态不输出方向。状态去重、交互锁和初始位置由原组件决定。

`start()` 之前完成对应权限授权；可见时启动，不可见/关闭时 `stop()` 并恢复原位置。`stop()` 失败时实例保留订阅标志，后续 start 不会重复 on；再次明确清理成功后才能重新启用。

只需最近状态的目标可以直接调用 getRecentOperatingHandStatus，不必引入 Session；调用必须受 API 15、SysCap、权限与 try/catch 保护，显式比较 LEFT_HAND_OPERATED/RIGHT_HAND_OPERATED，其他值保持原状态。返回值不对应当前握持手。

这不是带 UI 的演示应用，不含授权弹窗资源；复用用户工程现有权限封装。
