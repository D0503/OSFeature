# 行为评测过程摘要

## Prompt

> 请检查给定 API 26 Stage/entry 工程的沉浸光感接入是否完整，区分组件级与应用级配置，列出静态检查、构建和真机验证边界，不修改工程。

工程：`D:\HW\OSFeatureSkill\harmonyos-os-feature-integration\evals\fixtures\api26-arkui`

## Skill 路由与已读资源

完整读取：

1. `harmonyos-os-feature-integration/SKILL.md`
2. `references/feature-registry.json`
3. `references/features/immersive-light/README.md`
4. `references/workflows/project-discovery.md`
5. `references/workflows/feasibility-check.md`
6. `references/workflows/verification.md`
7. `references/shared/output-contracts.md`
8. `references/features/immersive-light/profile.json`
9. `references/features/immersive-light/compatibility.md`
10. `references/features/immersive-light/implementation.md`
11. `references/features/immersive-light/performance-validation.md`

路由结果：注册表唯一命中 `沉浸光感 / immersive-light`，状态为 `ready`。任务属于工程扫描、兼容性判断与验证，不涉及文件修改。

## 命令与结果

### 工程扫描

命令：

```text
node scripts/inspect-project.mjs --project evals/fixtures/api26-arkui
```

退出码 0。主要结果：

- `model=stage`
- `compatible=26`、`target=26`
- 唯一 module 为 `entry`，应用材质状态为 `enable`
- 发现 `uiMaterial`、`systemMaterial`、API 26 版本保护、设备能力保护、降级背景/边框和 `Material.empty`
- 未发现 HDS、Web 组件；`unknown=[]`
- 共读取 3 个文件

### 兼容性检查

命令：

```text
node scripts/check-compatibility.mjs --project evals/fixtures/api26-arkui --feature immersive-light
```

退出码 0。主要结果：

- `status=supported`
- `recommendedRoute=arkui`
- `availableRoutes=[hds, arkui]`
- 应用级配置 `eligible=true`
- 必须保留 API 26 版本保护、材质能力保护和普通背景/边框降级

### 集成静态验证

命令：

```text
node scripts/verify-integration.mjs --project evals/fixtures/api26-arkui --feature immersive-light --route auto
```

退出码 0。主要结果：

- `route=arkui`、`status=passed`
- `pass=9`、`warn=0`、`fail=0`、`not_applicable=1`
- Stage、路线资格、导入、材质入口、版本保护、能力保护、应用级 metadata、降级样式和明显性能风险检查通过
- Web 同层渲染检查为 `not_applicable`

### 人工核对夹具

使用 `rg --files` 确认夹具仅有 3 个文件，并完整读取：

- `build-profile.json5`
- `entry/src/main/module.json5`
- `entry/src/main/ets/pages/Index.ets`

由此确认夹具是结构扫描用最小工程，不含完整 Hvigor 构建入口与依赖，故没有执行构建。没有连接设备，未进行真机验证。全过程未修改夹具或 Skill。

## 最终响应

最终答复将结论限定为“静态接入通过，构建与真机验收待完成”，分别说明：

- 组件级：显式材质、版本/能力双保护、`Material.empty` 和普通样式降级；
- 应用级：API 26、entry module 与 metadata `enable`；
- 静态验证已完成；
- 构建因夹具不完整未执行；
- 真机视觉、算力档位、系统强度、深浅色和状态矩阵均待验证。
