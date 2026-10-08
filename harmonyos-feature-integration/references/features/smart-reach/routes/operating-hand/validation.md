# 操作手验证

- API 14 走源路径，15–19 核对 ACTIVITY_MOTION 声明、reason/usedScene 与运行时授权；20+ 验证实际所选权限，选择 ACTIVITY_MOTION 时同样先授权，选择 DETECT_GESTURE 时只声明；仅 DETECT_GESTURE 时低于 20 禁止增强。
- ACTIVITY_MOTION 未授权前不订阅或查询；获准后仍复核页面可见、功能启用、API 与 SysCap。拒绝、请求异常及授权期间页面离开时保留原布局与原功能，不重复弹框；授权成功后只启动一份感知。
- 连续有效触控验证 UNKNOWN/LEFT/RIGHT；初始无结果和重复值不引发跳边。测试不能只机械点击屏幕左/右坐标。
- 订阅路线核对同一回调 on/off、重复进入、隐藏与迟到回调；复核退订成功标志、所选权限路径的 API 门槛与 SysCap 守卫。单次 getRecent 查询无需配对订阅，但必须验证异常与未知结果。
- 201、801、401、服务异常各自保留基线；与握持手同时使用时核对目标归属。
- 执行 [共同矩阵](../../performance-validation.md)，记录实际事件、日志与目标页面截图。
