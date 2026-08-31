# 沉浸光感接入方案（API 23）

结论：`supported`，唯一可用路线是 **HDS**。本次只完成只读检查与方案设计，没有修改工程。

## 环境与证据

- `build-profile.json5`：`compatibleSdkVersion: 23`、`targetSdkVersion: 23`。
- `entry/src/main/module.json5`：Stage 模型、`entry` module，设备范围为 phone、tablet、2in1。
- `Index.ets`：已使用 `HdsNavigation`、`HdsTabs`、`barFloatingStyle` 和 HDS 自适应材质；同时保留了普通背景色。
- 工具判断：`status=supported`、`recommendedRoute=hds`、`availableRoutes=[hds]`。

## 路线与改动范围

- 保持 `HdsNavigation + HdsTabs` 导航结构，在悬浮导航 Tab 的 `barFloatingStyle.systemMaterialEffect` 中使用 `ADAPTIVE + ADAPTIVE`。当前页面已经具备这组基线配置，无需引入 API 26 的 `uiMaterial`。
- `targetSdkVersion` 只有 23，因此不设计 ArkUI 组件级材质或应用级 `MaterialState`；它们在本工程上下文中不适用。
- 当前夹具未显示必须新增的依赖或 module 配置。若后续还要给标题栏增加效果，应在 `HdsNavigation` 的标题栏样式内独立配置材质，不要把滚动渐变模糊误当作材质本身。

## 兼容与降级

- API 低于 23：不启用当前两条沉浸光感路线，保留普通背景、边框和必要阴影。
- API 23～25：只使用 HDS，不引用 API 26 接口。当前 `Text` 的 `#F5F5F5` 背景可作为普通视觉降级基线。
- 当前优先使用系统自适应材质；若以后改成自定义 HDS 档位，应先查询设备支持的材质类型，不支持沉浸类型时降为 `SMOOTH` 或普通样式。
- 若后续页面引入 Web 同层渲染并出现控件透明，应关闭对应控件光感或关闭同层渲染。

## 性能风险

- 材质限制在悬浮 Tab、标题栏等局部区域，避免整页覆盖。
- 避免父子嵌套材质、为大量列表项逐项设置材质，以及叠加背景模糊、背景效果和多重阴影。
- 避免把材质覆盖在视频、动图等持续变化背景上，也不要持续修改材质区域或执行无限动画。

## 验证边界

- 已完成：只读工程扫描和兼容性门禁；确认 HDS 路线可用，未发现 API 26 材质信号。
- 实施后应做：运行静态集成检查，再使用工程自身的 Hvigor 构建；检查悬浮 Tab 的普通背景降级仍可读、可操作。
- 真机矩阵：phone/tablet/2in1，高/中/低算力，深浅色，以及系统沉浸光感“强/均衡/弱”。同时验证材质支持与不支持两种结果。
- 当前目录是结构化合成夹具，不等同于完整可编译 DevEco 工程；本次没有构建、设备运行或真机视觉验证，因此不能宣称最终视觉效果、帧率或各设备档位已通过。

权限与隐私方面，当前能力包未声明额外权限；这不等同于对整个应用作出合规结论。
