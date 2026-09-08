# 工程验证规则（自登记）

本文件登记 Skill 自建的验证方法论规则。这些规则不是华为官网陈述的规范事实，使用时受以下硬性约束：

- 只允许在 `document-review` 模式中使用。
- 不得写入 `references/capabilities/` 能力包，不得作为 `code-development-validation` 的门禁、静态规则或判据；能力包内只有官网资料能形成事实依据。
- 规则只决定"如何验证、如何记录"，不决定"验证什么"；与官网事实冲突或官网未裁决时，以官网事实为准，并把差异记录为待验证或规范—实现偏差。

## EVR-1 版本兼容示例的四元核对

审查版本兼容示例时，必须分别核对 `compatibleSdkVersion`、`targetSdkVersion`、实际编译 SDK 与设备 `deviceInfo.sdkApiVersion` 的职责和大小关系；四者不互相替代，也不得用其中一个值推断另一个。

## EVR-2 参数内三元的保护范围

运行时三元表达式放在新 API 的参数内（如 `.systemMaterial(sdkApiVersion >= 26 ? material : undefined)`）只能保护参数求值，不能自动证明新 API 调用本身已被低版本分支避开。

- `document-review`：检查版本保护的控制流边界时，分别记录编译期符号可用性与低版本运行期调用风险；不得仅凭该写法判定示例兼容或错误。

## EVR-3 静态命中的证据强度

仅在文件中搜索到 `sdkApiVersion >= 26` 等版本判断文本不足以证明调用路径安全；审查时必须核对低版本控制流与运行证据。
