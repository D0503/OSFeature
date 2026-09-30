# 平行视界

平行视界是应用尚未适配原生分栏时，通过配置在宽屏窗口并排显示两个页面的系统兼容方案。它不等于 Navigation 原生双栏、应用多窗口或通用自适应布局。已有原生分栏的目标先核对适用性，不叠加两套分栏。

## 按需加载

| 任务 | 读取资料 |
|---|---|
| 任意平行视界请求 | [profile.json](profile.json)、[兼容性](compatibility.md) |
| 设计或实施 | [实施入口](implementation.md)、[配置确认](configuration-confirmation.md)、[配置规则](configuration.md)，再读取选中路线 |
| 取用配置 | [资产目录](assets-catalog.md) |
| 验证和性能检查 | [验证](performance-validation.md)、[回退](fallback.md) |
| 排障 | [故障排查](troubleshooting.md) |

`router` 与 `navigation` 是互斥技术路线；导航模式和购物模式是路线内部的交互方式。识别工程后列出路线、建议及依据；多条路线可选或需要升级时由用户确认，不能把路由框架迁移当作默认配套改动。`selectedRoutes` 只包含一项。

**用户仅说“接入平行视界”等模糊需求时，必须先扫描工程、列出适用配置项及真实页面候选，主动询问用户如何配置，再根据回答实施。必须明确询问 fullScreenPages 还需要哪些全屏页，以及购物模式的 transPages 配置哪些过渡页；不能只展示建议值后直接写入，不能把“接入”视为用户接受全部默认配置。** 已按启动流程规则确定自动全屏的页面列为已确定项，其余未明确选择等待用户决定，具体执行 [配置确认](configuration-confirmation.md)。

新接入默认 enableReducedContainerSize=true，API 26 同时默认 drawableRectHook=true；低版本优先提出升级选项，用户选择保持版本时省略后者。已有明确选择和显式 false 不静默覆盖。

**启动流程全屏规则：接入时必须主动扫描开屏广告页、启动页和隐私协议页；核实为独立路由页面后，必须自动加入 `fullScreenPages`，无需逐页询问是否全屏。不得仅列为待选建议或因用户未单独点名而漏配。非路由内容、明确例外及配置冲突按 [配置确认](configuration-confirmation.md) 处理。**

## 前置与交付

需要 Stage 工程、可验证的本机 SDK、entry 模块和真实页面标识。API 23 支持开发者配置，API 24 才能调用 `UIContext.isEasySplit()`，API 26 才能使用增强配置。系统开关和窗口条件仍需设备验证。资料没有声明额外账号、服务开通或权限申请，不添加无依据权限；安装沿用工程现有签名要求，元服务及资料未列设备支持标记待确认。

按通用工作流扫描、选路、实施及验证；报告记录 Router/Navigation、导航/购物模式、目标页面、实际分栏行为、回退和未验证项。完成静态检查或构建不能宣称真机效果已通过。
