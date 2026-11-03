# 按任务读取资料

Markdown 链接和 `profile.documents` 是读取索引，不会自动把正文加载给 Agent。先完整读取命中能力的 README 与 profile，再按本表实际打开所需文件。

## 路径与合并规则

- 注册项 `entry`、`profile` 相对 Skill 根目录；`profile.documents` 和 `routes[].documents` 相对该能力包目录；Markdown 链接相对所在文档。
- 能力包公共资料与候选或选中路线资料合并读取，路线资料不能替代公共前置、回退和验收要求。同一文件读取一次；多个角色指向同一文件合法。
- 角色指向 README 或其他索引时，继续按当前任务和目标读取其指定正文；再次遇到已读索引时不递归重读，仍须完成尚未读取的相关正文。只有索引循环且没有实际内容时报告资料缺口。
- 设计阶段读取实施资料用于制定方案，其中的复制、修改、安装和发布步骤不在设计任务执行；路线确认要求在实施前落实，未决选项可以写入方案。路线尚未决定时，设计读取候选路线的接口约束与资产说明，不复制代码。实施时只使用已确认的 `selectedRoutes`；同一请求已确认的决定直接复用，相关工程事实或范围改变时再核对。
- 可选能力仅在用户请求或已确认范围涉及时加载并实施；入口的适用性判断可以先读。文件缺失、索引无法到达正文或文档与 profile 冲突时报告具体路径，停止依赖该资料的步骤，不凭记忆补齐。

## 任务读取表

表中角色取自当前能力包的 profile；专项资料由 README 按场景补充，不要求每个角色单独建文件。

| 任务 | 能力包必读内容 | 结束位置 |
|---|---|---|
| 工程发现 | entry、profile、compatibility，以及入口指定的扫描和覆盖资料 | 输出现状、候选和未知项，不修改工程 |
| 可行性 | compatibility、前置条件、候选路线 implementation 的适用约束；涉及可选能力时核对其门槛 | 输出可选路线和条件，不修改工程 |
| 方案设计 | 公共 implementation、assets 说明、fallback、validation、sharedValidation，以及候选路线对应资料；场景/覆盖资料按目标读取 | 交付方案；未决路线列为备选，实施前确认 |
| 工程实施 | 公共 implementation、assets、fallback、validation、sharedValidation，加每条选中路线 implementation、assets、validation；打开实际复制或改写的资产源码 | 完成授权范围内实现及验证；缺条件如实记录 |
| 验证已有接入 | 公共 validation、sharedValidation、fallback，加实际启用路线的 validation；需要定位时读取相关 implementation | 交付验证结果，不自动修改源码或升级配置 |
| 兼容性扫描 | compatibility、compatibility-audit，以及涉及调用的实现/资产约束 | 输出逐调用结论，不修复、不部署 |
| 兼容性修复 | 扫描资料，加涉及调用的 implementation、实际资产、fallback、公共与相关路线 validation | 最小修复后复扫与运行验证；不套用新接入的升级、功能增补和选路流程 |
| 故障诊断／修复 | compatibility、troubleshooting，以及现象涉及的 implementation、fallback、validation；索引以内嵌排障章节代替独立文件时继续读取 | 诊断只报告；修复和设备变更须在已授权范围内 |
| 单独查询接口版本 | compatibility、相关接口资料及可用的对应 SDK 声明，遵守证据规则 | 输出版本及依据；不要求无关工程，不推导工程可接入结论 |

## 共享规则

- 判断版本、处理资料冲突或引用结论前，读取[兼容性模型](compatibility-model.md)和[证据规则](evidence-rules.md)。
- 设计和实施涉及权限、签名、账号、设备能力或外部服务时，读取[权限与系统能力](permission-and-capability.md)；处理工程、设备或传输数据前读取[隐私与安全](privacy-and-security.md)。
- 制定测试计划及验证时读取[设备矩阵](device-matrix.md)。目标效果的真机限制与低版本回退实测分别按能力包执行。
- 输出方案或报告前读取[输出契约](output-contracts.md)。共享规则只读取与当前任务有关的内容，不加载其他能力包代替本包资料。
