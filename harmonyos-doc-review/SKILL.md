---
name: harmonyos-doc-review
description: 审查 HarmonyOS / 鸿蒙官方开发文档的技术正确性、版本兼容性、完整性、一致性、示例可执行性、可复现性和安全合规性，并输出带原文定位、官方证据、严重度、置信度与修改建议的质量报告。只要用户要求检查、评审、验收、质疑或分析 developer.huawei.com 文档，判断鸿蒙官网文档是否合理、是否过时、是否缺步骤、是否与 SDK/API 参考冲突，或提供鸿蒙官方文档 URL/正文并询问问题，都应使用本 Skill。不要用于单纯按文档实现功能、普通内容摘要、第三方文章审稿或应用上架审核。
compatibility: Windows、macOS、Linux；Node.js 18+ 用于官网文档抓取和本地文档解析；联网核验需要可访问 developer.huawei.com；可选使用本机 HarmonyOS SDK 声明或 devecocli 本地文档交叉验证，未安装 devecocli 不阻断审查且不得自动安装。
---

# HarmonyOS 官方文档质量审查

把“这篇官网文档是否合理”转化为可复查的证据审查。结论必须能回溯到目标文档位置、同版本官方资料、本机 SDK 声明或实际验证结果；证据不足时保留为待确认项，不靠记忆补足事实。

## 输入与交付

接受以下任一种输入：

- `https://developer.huawei.com/...` 官方文档 URL；
- 已保存的 HTML、Markdown 或 TXT 文档；
- 用户粘贴的正文、代码片段或两份待比较的官方材料；
- 可选的目标 API Level、SDK 路径、工程配置或构建错误。

默认在对话中交付 Markdown 报告。用户需要落盘或自动处理时，再额外生成符合 [报告模板与 JSON 契约](references/report-template.md) 的 `.md` 和 `.json`；生成 JSON 后运行 `scripts/validate-report.mjs` 校验。

## 八步审查流程

### 1. 确定审查边界

记录目标文档、文档类型、语言、页面更新时间、用户关心的问题、目标 API Level/SDK 版本以及应用、元服务、卡片或设备形态。版本未知时继续审查，但把版本相关结论列为限制，不擅自选择最新版本代替用户环境。

### 2. 获取并结构化正文

URL 或本地文件输入时完整读取 [文档获取与解析](references/extraction.md)，使用随附脚本保留标题层级、代码块、链接和文档元数据。正文过短、疑似 JS 空壳、未发布或抓取失败时先回退获取；仍拿不到可复查正文，就停止事实性判错并报告限制。

### 3. 识别文档类型与承诺

完整读取 [文档类型检查表](references/document-types.md)，判断它是开发指南、API 参考、配置/权限说明、代码示例、FAQ/故障排查还是版本说明。提取文档明确承诺的适用版本、前置条件、操作步骤、输入输出、错误码和验证结果；不要拿教程的详尽程度要求 API 索引页。

### 4. 建立同版本核验基线

完整读取 [证据与核验规则](references/evidence-rules.md)。优先核对同一 API Level 的 API 参考、本机 SDK `.d.ts`/`.d.ets`、目标文档关联页、官方版本说明和官方示例。若本机存在 `devecocli`，再完整读取 [DevEco CLI 文档核验基线](references/deveco-cli-baseline.md)，用精确 API、权限、配置键或错误码搜索本地官方文档并读取命中文档；它是补充核验通道，不是唯一事实源。在线“最新文档”与本地文档或旧 SDK 不一致时，先判断是否为版本差异，而不是直接判定文档错误。

### 5. 多维检测候选问题

完整读取 [质量模型](references/quality-model.md)，逐维检查：技术正确性、版本兼容性、完整性、内外一致性、示例可执行性、步骤可复现性、表达结构、链接资源及安全合规。先形成候选问题；文风偏好与技术缺陷分开记录。

### 6. 为候选问题建立证据链

每个问题至少记录：目标文档章节或短摘录、问题分析、支持或反驳该判断的证据、适用版本、影响、严重度和置信度。将问题标为 `confirmed`、`likely`、`ambiguous`、`version_caveat`、`editorial` 或 `pending`。没有独立证据的外部事实不能标为 `confirmed`。

### 7. 给出分级、评分与结论

按质量模型计算各维度评分和综合分，但以证据和严重问题门槛约束最终结论。只允许输出：`合理`、`基本合理但需小修`、`需要修订`、`不合理/高风险`、`证据不足无法判断`。不要用一个总分掩盖 Blocker/High 问题。

### 8. 生成报告并反向复核

按 [报告模板与 JSON 契约](references/report-template.md) 输出。交付前逐项反问：是否把版本差异误判为错误；引用是否真的支持结论；是否混淆官方明示、SDK 事实和分析推断；修订建议是否引入新 API 或新前提；是否把未验证内容写成已验证。

## 硬规则

1. **先取证，后判错。** 仅凭模型记忆或第三方文章不得断言官网文档错误。
2. **版本必须对齐。** API 签名、权限、系统能力和行为只在明确的 API Level、SDK 或页面版本下比较。
3. **引用保持短而可定位。** 优先给章节、表格行、API 名和短摘录，不大段复制官网正文或示例代码。
4. **不静默修正文档。** 报告必须区分“原文”“证据”“推断”“建议改写”。
5. **抓取失败不是质量问题。** 网络失败、鉴权限制或 JS 空壳只能记为审查限制。
6. **不修改用户工程。** 本 Skill 默认是只读审查；只有用户另行要求修文档或代码时才写入对应文件。
7. **编译通过不等于文档合理。** 编译只能证明某个样例在某个环境成立，不能自动证明内容完整、兼容或表述准确。

## 渐进加载

| 当前任务 | 必读文件 |
|---|---|
| URL/HTML/Markdown/TXT 获取与结构化 | [references/extraction.md](references/extraction.md) |
| 判断该类文档应检查什么 | [references/document-types.md](references/document-types.md) |
| 查官方对照资料、SDK 声明、版本证据 | [references/evidence-rules.md](references/evidence-rules.md) |
| 使用 DevEco CLI 搜索/读取本地官方文档 | [references/deveco-cli-baseline.md](references/deveco-cli-baseline.md) |
| 问题分级、置信度、评分和最终结论 | [references/quality-model.md](references/quality-model.md) |
| 输出 Markdown/JSON 报告 | [references/report-template.md](references/report-template.md) |

## 完成标准

- 已明确文档类型、审查范围、版本上下文和无法核验的限制；
- 每个事实性问题都有原文定位和至少一条可检查的证据，或明确标为待确认；
- 已覆盖与文档类型相关的质量维度，而非只检查错别字或代码；
- 结论、分数、严重度和证据相互一致；
- 修改建议具体到应补充、删除、改写或核对的内容，并且没有伪造 API；
- 若生成 JSON，`validate-report.mjs` 返回 `valid`。
