# 输出契约

## 方案设计

使用 `assets/templates/integration-plan.md`，包含环境、可行性、`availableRoutes`、`recommendedRoute`、`selectedRoutes`、各路线改动点、接入前源程序状态基线、回退条件与保留维度、性能风险和验证计划。组合路线分别列出实现与验证，不把主要建议当成互斥选择。

## 工程实施

使用 `assets/templates/integration-report.md` 的四部分结构：特性改造汇总、类别或路线与模式、视觉验证结果、升级与兼容。标题根据注册特性命名；沉浸光感区分 HDS / ArkUI 和实际类别，平行视界区分 Router / Navigation 与导航/购物模式，并记录目标跳转和实际分栏行为。按实际页面和组件说明改动与文件；视觉部分附目标页截图（以固定宽度 270px 的 HTML img 标签嵌入）、设备系统信息和各阶段结果，升级兼容部分按整个工程记录一份：版本前后对照一份，回退表按低版本、设备不支持、特性关闭合并所有改造项的保留行为与验证结果。存在低版本兼容分支时，回退表“低版本”行的结论必须来自回退环境实测（阶段表“兼容方案回退”行呈现环境与证据），未实测时如实标注未验证并写明阻断原因，不以静态复核或构建通过替代。应用状态、生效域和参数风险按本次涉及内容写入对应目标结论。

按[验证闭环](../workflows/verification.md)由 `verify-development.mjs` 生成 `<工程>/os-feature-integration/integration-report.md`，`--output` 可覆盖目录。最终只交付一份 Markdown 与其引用的截图，不生成 JSON 汇总报告；过程日志与判定数据留在临时目录。未执行、未到达目标页或未判图均不得写成通过。

涉及受限权限的能力，最终交付说明执行对应能力包的提醒要求：[窗球权限](../features/float-view-ball/compatibility.md#权限声明acl-与用户授权)、[防窥权限](../features/dlp-anti-peep/compatibility.md#权限声明与-acl)。

报告更新及最终总结的一致性要求见[验证闭环：结果与存储](../workflows/verification.md#结果与存储)。
验证结论与运行观察明细须经结构化补录生成；不直接编辑报告正文补结论。同一改造项重试只展示当前结果，回退实测截图按用途导入，保留原设备的功能与视觉结论。

## 故障排查

输出环境、现象、证据、根因、修复、回归与限制。不得把 `warn` 写成已确认错误，也不得把未运行的测试写成通过。
