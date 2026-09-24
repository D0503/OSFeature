# 操作手感知

SDK/compile API 15+，导入 `motion`，在调用前检查运行 API 与 `SystemCapability.MultimodalAwareness.Motion`，按 [兼容性](../../compatibility.md) 完成权限声明。API 15–19 使用 ACTIVITY_MOTION；API 20+ 可用两种权限之一。不能因为 compatible 低于 20 就只声明 DETECT_GESTURE 并继续在 15–19 调用。

- `motion.on('operatingHandChanged', callback)`：订阅操作手变化。
- `motion.off('operatingHandChanged', callback)`：用同一回调退订。
- `motion.getRecentOperatingHandStatus()`：同步读取最近状态，不需要先订阅；需要相同权限、版本与错误处理。单次查询路线无需为了满足检查而添加 on/off。

`OperatingHandStatus`：UNKNOWN_STATUS=0、LEFT_HAND_OPERATED=1、RIGHT_HAND_OPERATED=2。只有后两者驱动左右位置，不把未知值当右手。需要首次状态时可在启用后使用最近状态，但它不是握持手状态，也不能保证是本次最新动作。

按 [共同生命周期规则](../../implementation.md) 连接页面实际可见期，在所属 HAP 声明对应权限，并处理调用异常。

初次或换手后的多次触控才可能上报；排除边缘 8mm、窗口旋转、多指、指关节。不可把这一路线作为握持手 API 20 的自动低版本替代。读 [资产](assets.md) 和 [验证](validation.md)。
