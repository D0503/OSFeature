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
6. 每个场景必须绑定已注册技术路线；路线分别维护工程门槛、SDK 声明、符号、目标组件和设备限制。当前沉浸光感包注册 `arkui-api26` 与 `hds-api23`，任何未注册路线均应拒绝。
7. 新增路线的规范事实必须保存官网 URL、正文快照哈希和定位；能力包锁文件必须登记相同来源，SDK 与构建结果不能替代官网来源。

## 场景契约

每个场景至少包含稳定 ID、技术路线、意图短语、目标组件、事实引用、实现步骤、静态规则、负向用例、必需检查层和运行判据。事实未显式标注路线时归属 `profile.defaultRoute`；显式路线事实只能被同一路线场景引用。`requiredChecks` 只能使用 `static`、`sdk`、`build`、`install`、`runtime`、`visual`。

低版本回退场景的静态规则必须证明官网兼容性事实要求的版本条件分支与低版本路径不引用新 API 能力。官网未陈述的写法形态判断（如版本三元的位置语义、四元版本核对）属于自登记工程规则，只能登记在 [工程验证规则](../../engineering-verification-rules.md) 并由 document-review 与 development-validation-planning 使用，不得写入能力包或作为代码模式门禁。

## 来源反查与对勘

- `sourceDocuments` 必须为每个快照登记 `officialUrl`（华为开发者官网 HTTPS 页面）；`title`、`retrievedAt`、`updatedAt` 可为 `null`，但不得用本地时间冒充抓取时间。
- 实施前用 `scripts/verify-capability-sources.mjs crosscheck` 把每条事实与其锁定快照原文对勘；快照缺失、哈希不符时停止实施并报告能力包缺陷，不得按未对勘事实开发。
- 链接有效性检测（`links` 模式）属于能力包发布/更新周期的门禁，不混入开发路径；检测结果只报告漂移，不自动改写锁。

包含冲突事实的场景必须提供 `expectationMode=alternatives`，并为冲突组内每条事实提供独立预期。验证成功但只匹配其中一个规范预期时，总结果为 `passed_with_spec_conflict`，不能宣称规范冲突已消失。
