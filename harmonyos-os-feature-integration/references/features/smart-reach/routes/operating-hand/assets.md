# 操作手接入资料

按 [操作手实施](implementation.md) 在实际页面组织 `operatingHandChanged` 监听或 `getRecentOperatingHandStatus()` 查询；权限声明见 [兼容性](../../compatibility.md)。

单次查询无需订阅事件。事件监听使用同一回调订阅和退订；状态与业务交互由目标组件管理。验证见 [操作手验证](validation.md)。
