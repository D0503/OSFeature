# 输出契约

## 方案设计

使用 `assets/templates/integration-plan.md`，包含环境、可行性、路线、改动点、降级、性能风险和验证计划。

## 工程实施

使用 `assets/templates/integration-report.md`，区分实际修改、静态验证、构建、真机验证、未完成条件和证据来源。

## 故障排查

输出环境、现象、证据、根因、修复、回归与限制。不得把 `warn` 写成已确认错误，也不得把未运行的测试写成通过。
