# 代码开发验证报告契约

固定文件名为 `development-verification-report.json` 和 `development-verification-report.md`。只有用户指定输出目录时才落盘；构建日志、设备日志和截图索引放在同目录的 `evidence/`。

JSON 根字段为：`verificationVersion`、`mode`、`input`、`capabilityPackage`、`projectBaseline`、`changes`、`compatibility`、`checks`、`evidence`、`pendingVerifications`、`verdict`。

`input` 只描述能力名、工程绝对路径、开发目标和可选 module/文件/product/build mode/device，不得包含文档、URL、审查报告或验证清单输入。

`capabilityPackage` 记录能力 ID、版本、锁摘要、场景 ID、必需层、事实引用和冲突事实引用。`changes` 对每个触及文件记录状态、before/after SHA-256 和 unified diff；失败也不得删除这些信息。

六个检查层固定为 `static`、`sdk`、`build`、`install`、`runtime`、`visual`，状态固定为 `passed`、`failed`、`blocked`、`not_run`、`inconclusive`。通过的必需层必须有关联证据；视觉通过必须关联截图、录屏或用户明确观察。

总结果：

- `passed`：场景所有必需层均通过。
- `passed_with_spec_conflict`：所有必需层通过，但实际只匹配冲突规范中的一个预期。
- `build_passed_runtime_pending`：静态、SDK、构建通过，必需运行或视觉层尚未执行；无设备属于此类。
- `inconclusive`：运行已执行，但证据不能区分预期，或必需层结果不充分。
- `failed`：已执行的必需层失败，或不匹配任何冲突预期。
- `blocked`：SDK、工程、授权或场景前提使核心验证无法开始。
