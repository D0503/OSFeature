# 接入流程

1. 读取 profile 与兼容性，验证本机 SDK，扫描 entry、实际页面表和 Router/Navigation 调用链，记录原页面栈、状态、横竖屏、断点与窗口行为。
2. 列出 Router/Navigation 可选路线和建议；混用时先定位目标生效范围。用户确认路线与任何升级后再修改工程。未要求迁移时不能重写现有路由。
3. 根据需求确定导航/购物模式、设备和窗口范围，以及主页、关联页、全屏页和过渡页。API 23 基础配置不写入 API 26 字段；采用购物模式必须先满足 API 26。
4. 读取 [Router 实施](routes/router/implementation.md) 或 [Navigation 实施](routes/navigation/implementation.md)，从 [资产](assets-catalog.md) 取所需最小配置，与已有 easyGo 合并，保留不相关设备配置。
5. 按 [配置规则](configuration.md) 校验引用、页面名称、字段版本和冲突。现有布局确实使用整窗宽导致越界时才处理页面宽度或虚拟容器，不能顺手改造全部页面。
6. 执行静态校验及通用构建/运行闭环，按 [验证清单](performance-validation.md) 检查真实页面。使用 [回退基线](fallback.md) 对照未启用状态。

查询 `getUIContext().isEasySplit()` 只用于 API 24+ 的运行态判断，不是启动开关；API 23 不需要为了查询而整体抬高基础接入门槛。需要查询时在已有低版本保护路径内调用，不能以强转类型绕过版本限制。

页面尺寸监听或方向请求必须使用现有生命周期管理，退出时解除监听、恢复此前窗口策略。不得因分栏触发重新初始化业务状态或清空路由栈。
