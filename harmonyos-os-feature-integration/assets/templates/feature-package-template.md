# [特性名称]能力包模板

创建 `references/features/<id>/`，至少包含：

- `profile.json`：版本、模型、module、特性路线 `minApi`、约束、文档和证据策略；当承载组件早于特性能力出现时，另用 `componentFamilyMinApi`/`componentBaselines` 记录组件基线，不得降低特性门槛；
- `README.md`：能力边界、任务路由和执行流程；
- `compatibility.md`：兼容性、前置条件和不支持场景；
- `implementation.md`：方案与工程实现规则；
- `performance-validation.md`：降级、性能、测试和排障。

完成工程与 SDK 夹具、结构校验、工具测试和行为评测后，才以 `ready` 状态加入注册表。
