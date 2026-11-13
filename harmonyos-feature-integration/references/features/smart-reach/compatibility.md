# 兼容性与前置条件

按[知识库查询流程](../../workflows/knowledge-query.md)读取所需正文。

## 版本、模型和权限

先验证本机 sdk-pkg.json，再检查 compile/target/compatible。版本升级遵循[通用兼容性规则](../../shared/compatibility-model.md#升级接入对所有特性通用)。三条路线分别按实际使用要求判定，不统一套用示例的 API 23。compatible 低于所选路线时保护整个新调用路径。

读取《智感握姿版本、模型和权限》全文。按所选路线核对应用模型、运行版本、系统能力和实际承载 HAP 的权限声明，再确认设备支持情况、系统设置和有效验证动作。
