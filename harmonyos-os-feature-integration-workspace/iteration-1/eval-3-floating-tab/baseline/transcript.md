# 基线评测转录摘要

## 输入

用户要求把底部普通 Tabs 改成悬浮导航Tab，并判断所属特性、适用路线、关键配置、降级与验收要点，同时说明与窗口沉浸式的边界。

## 约束

- 只使用快照目录 `harmonyos-os-feature-integration-workspace/skill-snapshot`。
- 不读取或使用当前 Skill。
- 不修改快照 Skill 或评测夹具。
- 最终回答使用中文并保持精炼。

## 读取的基线资料

1. `skill-snapshot/SKILL.md`：确认注册表驱动的路由规则、方案设计边界、未注册处理方式，以及沉浸光感和窗口沉浸式必须分离。
2. `skill-snapshot/references/feature-registry.json`：通过别名“悬浮导航Tab”唯一命中 `immersive-light`，状态为 `ready`，入口为沉浸光感 README。
3. `skill-snapshot/references/features/immersive-light/README.md`：确认任务属于 HDS 底部页签范围，并按任务路由加载兼容性、实现、性能和验证资料。
4. `compatibility.md`：提取 API 23～25 的 HDS 路线、API 26+ 的组合路线、Stage 前置条件、`HdsTabs` 与 `barFloatingStyle.miniBar`、材质能力查询和窗口沉浸式边界。
5. `implementation.md`：提取 HDS 自适应材质建议、职责拆分和材质类型降级规则。
6. `performance-validation.md`：提取普通样式降级、Web 同层透明问题、性能红线、测试矩阵与验收标准。

## 推理与回答组织

先根据注册表把“悬浮导航Tab”归入“沉浸光感 / immersive-light”，再依据用户未提供工程 API 与模型信息这一事实，使用条件化路线而非直接承诺实现。回答将 API 低于 23、API 23～25 和 API 26+ 分开，指出底部导航优先采用 HDS `HdsTabs`，并列出材质、MiniBar、设备能力和普通视觉降级。最后把验收拆为版本、设备、主题、系统档位、交互、构建和真机视觉检查，并明确窗口沉浸式负责系统栏、安全区和全屏布局，不属于本次材质能力。

## 结果

已生成 `outputs/response.md`。回答未读取真实工程，因此没有声称工程已修改、构建已通过或真机效果已验证；也未将 API 26 ArkUI 材质接口误作悬浮底部导航的唯一实现。
