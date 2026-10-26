# 兼容性与门禁

| 条件 | 要求 |
|---|---|
| 应用 FunctionComponent、FunctionController、AgentController | SDK/compile 与运行系统 API 20（HarmonyOS 6.0.0）起 |
| 元服务使用上述接口 | API 21（HarmonyOS 6.0.1）起 |
| ButtonType.ICON_ABOVE_TITLE | API 21 起 |
| 工程模型 | Stage；定位实际承载 UI 的 entry/feature HAP，HAR 内代码须追踪宿主 |
| 系统能力 | SystemCapability.AI.Agent.AgentKit |
| 设备 | Phone、Tablet 真机；模拟器不支持 |
| 地区 | 中国境内，不含香港、澳门及中国台湾 |
| 运行环境 | 设备登录华为账号、联网，Agent 已关联当前应用并可在该账号使用 |

通过工程 AppScope/app.json5 的 `app.bundleType` 识别 app / atomicService；有效 app 对象缺省 bundleType 时按 app 处理。工程级 build-profile.json5 的 product.bundleType 可覆盖该值。缺少 app 配置、解析失败、非法类型或多个 product 混合应用/元服务时记录未知，先核对实际构建产物，不凭 module 名称猜测。当前扫描未选择特定 product，混合类型返回 insufficient_context，需对实际产物配置完成针对性核验。

`requiredApi` 为基础 API 20、元服务 API 21、实际使用 ICON_ABOVE_TITLE API 21 的最大值。静态扫描不能解析 options 封装时必须复核其真实取值；方案新增 API 21 样式时同样按 21 检查本机 SDK、compile 和运行守卫。

版本升级遵循[通用兼容性规则](../../shared/compatibility-model.md#升级接入对所有特性通用)。SDK 根清单未验证时不能判断路线可用。低于所用能力版本时，执行接入前路径，版本守卫必须先于控制器创建、方法调用及组件构建；不能先在未保护的字段初始化器中 new FunctionController 再在 build 中保护组件。

SysCap 只证明系统能力，不证明地区、机型、登录、隐私授权、网络、平台应用关联或 Agent 发布状态。`isAgentSupport` 返回 Promise<boolean>，不是 Agent 信息对象；true 表示 agentId 有效且 Agent 功能支持，false 表示 ID 无效或不支持，异常须分类处理。

平台关系、签名身份和实际服务可用性均需开发者或真机确认。Function 接入资料没有要求额外的业务运行时权限；不因 Kit 名称自动添加 A2A 扩展声明、账号登录 SDK、网络 SDK 或第三方依赖。
