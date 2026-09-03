# 能力包契约

代码开发验证模式只通过 `registry.json` 读取状态为 `ready` 的能力包。能力包必须自包含，不得在运行时读取原始 Markdown、URL、审查报告或开发验证清单。

## 固定组成

- `profile.json`：适用技术路线、工程门槛、工具策略和报告策略。
- `facts.json`：官网规范事实及其不可变来源快照标识。冲突事实必须并列保存。
- `scenarios.json`：自然语言路由、最小修改规则、静态规则、验证层和多个允许预期。
- `assets/`：可局部复用的 ArkTS/JSON5 资产，不是整页示例。
- `capability-lock.json`：能力包文件与制作资料的 SHA-256 锁。
- `entry.md`、`implementation.md`、`validation.md`：执行时的渐进说明。

## 信任边界

1. 官网快照形成规范事实。事实的 `normativeStatus` 只能是 `clear`、`conflicting` 或 `ambiguous`。
2. SDK 声明、真实构建、模拟器、真机、日志和截图只形成验证证据，不能回写或删除规范事实。
3. `ready` 只表示包结构完整且可执行。`deviceValidationStatus` 单独表达设备验证程度。
4. 运行时先核验锁文件；任一必需文件缺失或哈希不符时阻塞，不降级到读取原始资料。
5. 路径必须在能力包根目录内；锁文件不得引用 `..` 或绝对路径。
6. 首版只允许 `arkui-api26` 路线。HDS、API 23 和任何未注册路线均应拒绝。

## 场景契约

每个场景至少包含稳定 ID、意图短语、目标组件、事实引用、实现步骤、静态规则、负向用例、必需检查层和运行判据。`requiredChecks` 只能使用 `static`、`sdk`、`build`、`install`、`runtime`、`visual`。

包含冲突事实的场景必须提供 `expectationMode=alternatives`，并为冲突组内每条事实提供独立预期。验证成功但只匹配其中一个规范预期时，总结果为 `passed_with_spec_conflict`，不能宣称规范冲突已消失。
