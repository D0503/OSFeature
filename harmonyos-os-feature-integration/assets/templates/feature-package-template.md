# [特性名称]能力包模板

创建 `references/features/<id>/`。单路线能力可以保持扁平结构；存在两条以上可组合路线时使用：

```text
references/features/<id>/
├─ README.md
├─ profile.json
├─ compatibility.md
├─ implementation.md
├─ performance-validation.md
├─ assets-catalog.md
├─ shared/
│  ├─ fallback.md
│  └─ validation.md
└─ routes/<route-id>/
   ├─ implementation.md
   ├─ component-profile.json      # 可选：组件很多且存在专属行为时
   ├─ components/                 # 可选：按目标渐进加载
   ├─ validation.md
   └─ assets.md
```

至少包含：

- `profile.json`：版本、模型、module、特性路线 `minApi`、必要时独立的 `minTargetApi`、通用 `fallbackPolicy`、约束、文档和证据策略；`fallbackPolicy.baseline` 固定为 `pre-integration-source-state`，并列出适用条件和需要保留的源程序维度；当承载组件早于特性能力出现时，另用 `componentFamilyMinApi`/`componentBaselines` 记录组件基线，不得降低特性门槛；
- `README.md`：能力边界、任务路由和执行流程；
- `compatibility.md`：兼容性、前置条件和不支持场景；
- `implementation.md`：实现路由；单路线时也可直接承载实现；
- `performance-validation.md`：验证路由或单路线验证；
- 可组合路线的 `routes[].documents`：分别指向该路线实现、验证和资产索引；共享回退与验证只维护一份。
- 路线包含大量专属组件行为时，可增加组件矩阵，至少记录组件 ID、应用级默认行为、组件级入口和限制；分类资料必须从路线 implementation 入口按目标可发现。

完成工程与 SDK 夹具、结构校验、工具测试和行为评测后，才以 `ready` 状态加入注册表。
