# 行为评测转录摘要

## Prompt

> 底部普通 Tabs 要改成悬浮导航Tab。请判断它属于哪个特性，给出适用路线、关键配置、降级和验收要点；同时明确它与窗口沉浸式的边界。

## Skill 与资源读取

按当前 Skill 的注册表路由和“方案设计 + 验收”任务读取了以下完整文件：

- `harmonyos-os-feature-integration/SKILL.md`
- `harmonyos-os-feature-integration/references/feature-registry.json`
- `harmonyos-os-feature-integration/references/features/immersive-light/README.md`
- `harmonyos-os-feature-integration/references/features/immersive-light/profile.json`
- `harmonyos-os-feature-integration/references/features/immersive-light/compatibility.md`
- `harmonyos-os-feature-integration/references/features/immersive-light/implementation.md`
- `harmonyos-os-feature-integration/references/features/immersive-light/performance-validation.md`
- `harmonyos-os-feature-integration/references/workflows/project-discovery.md`
- `harmonyos-os-feature-integration/references/workflows/feasibility-check.md`
- `harmonyos-os-feature-integration/references/workflows/integration-design.md`
- `harmonyos-os-feature-integration/references/shared/compatibility-model.md`
- `harmonyos-os-feature-integration/references/shared/permission-and-capability.md`
- `harmonyos-os-feature-integration/references/shared/privacy-and-security.md`
- `harmonyos-os-feature-integration/references/shared/evidence-rules.md`
- `harmonyos-os-feature-integration/references/shared/device-matrix.md`
- `harmonyos-os-feature-integration/references/shared/output-contracts.md`
- `harmonyos-os-feature-integration/assets/templates/integration-plan.md`

## 命令与结果

1. `Get-Content -Raw harmonyos-os-feature-integration\\SKILL.md`
   - 结果：确认注册表优先路由、固定数据流、窗口沉浸式排除项和设计任务工作流。
2. `Get-Content -Raw harmonyos-os-feature-integration\\references\\feature-registry.json`
   - 结果：`悬浮导航Tab` 与 `悬浮导航 Tab` 均是唯一 `ready` 能力 `immersive-light` 的注册别名。
3. `Get-Content -Raw ...\\immersive-light\\README.md`
   - 结果：入口将路线选择指向兼容性资料，将方案与配置指向实现资料，将验收指向性能验证资料。
4. 并行读取 `profile.json`、`compatibility.md`、`implementation.md`。
   - 结果：确认 HDS 路线最低 API 23、Stage 模型、`HdsTabs`；API 26 ArkUI 路线面向普通组件与弹出类；确认 `barFloatingStyle`、自适应材质、设备查询和降级规则。
5. 并行读取性能验证、方案模板、输出契约和设备矩阵。
   - 结果：获得低算力降级、性能红线、API/设备/主题/系统设置测试矩阵和编译不等于真机效果的验收约束。
6. 并行读取工程发现、可行性、兼容性、权限、隐私和证据规则。
   - 结果：无工程输入时不得猜测 API 或模型，应输出 `insufficient_context`；能力包未声明额外权限不能扩大解释为全局合规结论。
7. `Get-ChildItem -Force ...\\eval-3-floating-tab\\current`
   - 结果：目标评测目录存在，尚无 `outputs` 子目录。
8. `New-Item -ItemType Directory -Force ...\\current\\outputs`
   - 结果：创建评测输出目录；未修改 Skill 或 fixture。

未运行工程扫描、兼容性 CLI、静态验证或 Hvigor 构建，因为 prompt 没有提供工程路径。本次只做能力路由与方案回答。

## Final response

最终回答保存于 `outputs/response.md`，包含：

- 将悬浮导航 Tab 识别为沉浸光感能力；
- 在缺少工程证据时标记项目结论为 `insufficient_context`；
- API 23～25 选择 HDS、API 26+ 仍以 HDS 承担导航；
- `HdsTabs`、`barFloatingStyle`、`systemMaterialEffect`、自适应材质和能力查询等关键点；
- 旧 API、设备不支持、低算力与 Web 同层场景的降级；
- 静态、构建、真机、功能与性能验收；
- 沉浸光感与窗口全屏、系统栏和安全区适配的明确边界。
