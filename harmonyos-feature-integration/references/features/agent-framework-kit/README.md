# 智能体框架服务 / Agent Framework Kit

通过 `@kit.AgentFrameworkKit` 的 `FunctionComponent`，让用户从应用内图标或按钮主动拉起指定智能体。唯一工程接入路线为 `function-component`，机器契约见 [profile.json](profile.json)。

本能力只实现 Function 组件。开发 Agent、关联应用、签名及发布真机测试由开发者完成，Skill 提供操作指导。A2A 协议、AgentExtensionAbility、智能体后端及 OpenClaw 接入不属于本能力；即使请求包含 Kit 名称，也不得自动生成这些实现。普通 Agent、Function、聊天页或 AI 按钮不据此匹配。

## 按任务加载

- SDK、应用类型与设备门禁：[兼容性](compatibility.md)。
- 尚未创建 Agent、缺少 ID 或未关联应用：[前置操作指引](prerequisites.md)。不要求开发者把平台凭据或签名私钥交给 Skill。
- 工程实施：[实施](implementation.md)、[回退](fallback.md)和[代码资产](assets-catalog.md)。
- 静态检查、构建和真机验收：[性能与验证](performance-validation.md)。
- 无入口、无法拉起或授权错误：[排障](troubleshooting.md)。只诊断请求不修改工程。

应用从 API 20 开始；元服务与 `ICON_ABOVE_TITLE` 从 API 21 开始。只支持 Stage、Phone/Tablet 和中国境内（不含港澳台），不支持模拟器。SDK/compile 满足要求不代表 Agent 已可用。

工程接入需定位目标页面、入口位置、真实 agentId、图标或按钮形式、可选 title/queryText，以及已有业务入口的保留方式。能从工程发现的信息先扫描；缺少真实 ID 时可完成方案和与 ID 无关的准备，不把示例 ID 写入成品，也不宣称联调通过。
