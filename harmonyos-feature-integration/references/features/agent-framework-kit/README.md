# 智能体框架服务 / Agent Framework Kit

通过 `@kit.AgentFrameworkKit` 的 `FunctionComponent`，让用户从应用内图标或按钮主动拉起指定智能体。唯一工程接入路线为 `function-component`，机器契约见 [profile.json](profile.json)。

本能力只实现 Function 组件。开发 Agent、关联应用、签名及发布真机测试由开发者完成，Skill 提供操作指导。A2A 协议、AgentExtensionAbility、智能体后端及 OpenClaw 接入不属于本能力；即使请求包含 Kit 名称，也不得自动生成这些实现。普通 Agent、Function、聊天页或 AI 按钮不据此匹配。

## 按任务加载

按[任务读取表](../../shared/document-loading.md#任务读取表)确定阶段。所有任务先读 [profile.json](profile.json)与[兼容性](compatibility.md)；只查询接口时不进入工程实施。

设计/实施先读[公共实现](implementation.md)、[资产说明](assets-catalog.md)、[回退](fallback.md)和[公共验收](performance-validation.md)。验证读取回退与公共验收，诊断读取[排障](troubleshooting.md)；只诊断请求不修改工程。

下表是条件必读索引：设计读候选场景的约束与资产说明；实施只读已确认场景的具体资产；验证只读实际启用场景的验收。公共要求与场景要求合并，同文件只读一次，不因读取可选场景而增加功能。

| 场景与加载条件 | 方案与实现 | 代码或配置资产 | 验收入口 |
|---|---|---|---|
| Function 图标或按钮；设计候选、实施选定入口时 | [实施约束](implementation.md) | [资产说明](assets-catalog.md)、[Agent.ets](assets/Agent.ets) | [点击、拉起与关闭验收](performance-validation.md) |
| 缺少 Agent、ID、关联或测试发布；需要说明外部准备时 | [前置操作](prerequisites.md) | 按前置操作指引准备，不写入示例 ID | [平台条件与真机验收](performance-validation.md) |

应用从 API 20 开始；元服务与 `ICON_ABOVE_TITLE` 从 API 21 开始。只支持 Stage、Phone/Tablet 和中国境内（不含港澳台），不支持模拟器。SDK/compile 满足要求不代表 Agent 已可用。

工程接入需定位目标页面、入口位置、真实 agentId、图标或按钮形式、可选 title/queryText，以及已有业务入口的保留方式。能从工程发现的信息先扫描；缺少真实 ID 时可完成方案和与 ID 无关的准备，不把示例 ID 写入成品，也不宣称联调通过。

## 已接入工程兼容性扫描

扫描或修复版本守卫与低版本回退时，读取[本特性扫描及回退策略](compatibility-audit.md)和[共享工作流](../../workflows/compatibility-audit.md)。仅检查不改工程；修复后要求高低版本实际运行验证。
