# 接入流程

1. 读取 profile 与兼容性，验证本机 SDK，扫描 entry、实际页面表和 Router/Navigation 调用链，记录原页面栈、状态、横竖屏、断点与窗口行为。主动追踪启动链路，将已核实为独立路由页面的开屏广告页、启动页、隐私协议页默认纳入 fullScreenPages；弹窗/系统启动图和配置冲突按配置确认规则处理。
2. 列出 Router/Navigation 可选路线和建议；混用时先定位目标生效范围。API 23～25 优先建议升级本机 SDK/compile 至 26，以启用两个接入默认字段；用户选择保持旧版本时仅默认开启 enableReducedContainerSize，不写 drawableRectHook。用户确认路线与任何升级后再修改工程。未要求迁移时不能重写现有路由。
3. 写入前按 [配置确认](configuration-confirmation.md) 展示所选路线的适用配置、版本要求、当前值、建议值与真实页面候选。需求模糊时集中确认模式、设备/窗口、主页/关联页、fullScreenPages，以及购物模式的 transPages；其他配置可整体接受建议。已明确项不重复询问，未回复不等于接受，未决定页面不填为空。确认结果作为实施依据。
4. 读取 [Router 实施](routes/router/implementation.md) 或 [Navigation 实施](routes/navigation/implementation.md)，从 [资产](assets-catalog.md) 取所需最小配置，与已有 easyGo 合并，保留不相关设备配置。
5. 按 [配置规则](configuration.md) 校验引用、页面名称、字段版本和冲突。新接入默认 enableReducedContainerSize=true，API 26 同时默认 drawableRectHook=true；用户明确选择或既有显式 false 按配置确认结果保留。仅在出现实际布局问题时调整相关页面代码，不顺手改造全部页面。
6. 执行静态校验及通用构建/运行闭环，按 [验证清单](performance-validation.md) 检查真实页面。使用 [回退基线](fallback.md) 对照未启用状态。

查询 `getUIContext().isEasySplit()` 只用于 API 24+ 的运行态判断，不是启动开关；API 23 不需要为了查询而整体抬高基础接入门槛。需要查询时在已有低版本保护路径内调用，不能以强转类型绕过版本限制。

页面尺寸监听或方向请求必须使用现有生命周期管理，退出时解除监听、恢复此前窗口策略。不得因分栏触发重新初始化业务状态或清空路由栈。
