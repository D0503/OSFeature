# 故障排查

| 现象 | 检查证据与处理 |
|---|---|
| 无抓取回调 | 确认双端型号支持、API20、SysCap、亮屏解锁、华为分享与隔空开关；检查当前可见页面注册日志与真实 windowId，不能只查导入 |
| 只有截屏 | 检查隔空传送与隔空截屏开关组合及目标页订阅；截屏或保存提示不等于业务传送 |
| 卡片后超时 | 测量回调至 share 耗时，是否在回调下载/转码；提前准备并建议3秒内调用，核对 Promise 拒绝与网络 |
| 文件为空/无法接收 | 检查 UTD、当前选择、文件/封面 URI、沙箱可读性与清理时机、SharedData 条数及200KB元数据上限 |
| 抓取提示无内容/被拒分享 | 分享文件由 `$r` 资源在页面侧准备时，资源若定义在 HSP 模块（如 Mock 数据源模块），宿主 `resourceManager.getMediaContent(resource.id)` 查不到该 id（HSP 资源表与宿主隔离），准备失败后回调按 NO_CONTENT_ERROR 拒绝；查应用日志区分准备失败与空选择；Image 正常显示该资源不能证明资源管理器可按 id 读取；改用 `application.createModuleContext(context, moduleName)`（@since 12）取得模块级 resourceManager 读取，失败仍按无内容回退 |
| 错误内容/重复分享 | 检查当前 VM 数据、切页状态、重复 start；匿名包装回调与传给 off 的外层 callback 身份不同会退订失败 |
| 后台仍有监听/回来失效 | 查页面 hide、NavDestination/Tab 可见、Ability 后台事件和恢复；aboutToDisappear 不足以覆盖后台；若工程异步获取窗口，检查返回时页面是否仍可分享 |
| 应用链接在浏览器打开 | 检查已安装、HTTPS host/path、独立 browsable/viewData skill、domainVerify、exported、AGC关联发布和手动签名身份 |
| 打开首页/旧详情 | 检查 onCreate 与 onNewWant 均解析 Want.uri，等导航栈就绪、校验业务ID并去重；不可只处理冷启动 |
| 不同账号被确认弹窗拦住 | 双端按系统信任流程确认或取消；1小时信任窗口不等于永久授权，不在应用内绕过 |

排障只检查与报告，除非用户要求修复。复测覆盖原故障、页面退出/恢复与原业务回退；仅截图/日志的成功文案不能替代接收端真实内容证据。
