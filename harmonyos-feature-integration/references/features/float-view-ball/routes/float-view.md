# 闪控窗路线（API 26）

先读取 [兼容性](../compatibility.md)。满足运行版本、SysCap、isFloatViewEnabled、FLOAT_VIEW 授权和应用前台条件后，调用 floatView.create({ context, templateType, isConfirmOnClose })；模板为 ROUNDED_RECTANGLE 或 HORIZONTAL_BAR。

- 独立页面用 setUIContext('pages/实际页面', storage)，路径与本模块 pages profile 的 src 一致；跨包页面使用 setUIContextByName，按官方命名路由要求注册。页面加载完成后再 start，避免空窗。
- getFloatViewLimits(templateType) 同步返回尺寸/比例限制，单位 px；setWindowSize 接受 window.Size。onLimitsChange 更新约束，onRectChange 接收系统实际尺寸，不硬编码手机尺寸；switchTemplate 接受模板和 size。尊重 getWindowProperties().avoidArea，避免交互控件落在不响应区域。
- 注册 onStateChange，处理 STARTED、HIDDEN、IN_SIDEBAR、IN_FLOATING_BALL、STOPPED、ERROR。进入侧栏或球不是销毁，保留业务状态；STOPPED 后使 windowId 失效并清理对应监听。
- getWindowProperties() 是同步调用，启动后取得 windowId；停止、异常或未启动时不得取属性。
- restoreMainWindow(wantParameters?) 仅在满足用户点击及窗口前台等限制时使用；失败保留窗口业务状态，不改用后台自动拉起。
- 结束业务时 stop，并按系统终态完成资源释放。offStateChange/offRectChange/offLimitsChange 使用原回调。

## 资产

使用 [最小窗页面与控制器片段](../assets-catalog.md#闪控窗)，按原工程状态管理合并，不替换整页。

## 验证

验证页面加载、尺寸变化、拖动/侧栏（设备支持时）、模板、恢复主窗口、用户关闭与再次启动。负向覆盖权限拒绝、后台启动、无效页面、球/画中画互斥、系统关闭。绑定另外执行 [绑定验收](../binding.md)。
