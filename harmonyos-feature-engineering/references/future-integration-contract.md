# 已废止：审查报告直连代码接入契约

本契约已被能力包架构取代，仅保留为迁移记录。`code-development-validation` 已开放，但运行时不得消费审查报告、开发验证清单、原始 Markdown 或 URL。

当前有效接口为：

- 文档审查与验证规划继续使用各自的报告和清单，它们不直接驱动代码修改。
- 代码开发验证只消费 `references/capabilities/registry.json` 中状态为 `ready` 且锁校验通过的能力包。
- 能力包制作或升级阶段可以使用文档审查产物；发布后由 `capability-lock.json` 固定资料快照列表、文档哈希、审查版本、能力包文件哈希与包摘要。
- SDK、构建、模拟器和真机是验证依据，不得反向修改能力包中的官网规范事实。

有效契约见 [能力包契约](capabilities/package-contract.md) 和 [代码开发验证报告契约](development/report-contract.md)。
