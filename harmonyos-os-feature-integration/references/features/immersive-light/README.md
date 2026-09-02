# 沉浸光感能力包

状态：`ready`

沉浸光感是由系统材质和空间动效组成的视觉能力，不是窗口沉浸式、状态栏处理或安全区避让。处理请求时先验证本机 SDK，再确认工程 API 范围和组件体系，最后选择 HDS 或 ArkUI 路线；不要把两代接口混写成一套实现。

## 能力范围

本能力包支持：

- 判断 HarmonyOS 工程可使用的沉浸光感路线；
- 为 HDS 标题栏、悬浮导航Tab和底部页签选择 API 23+ **材质能力**接入方案；
- 为原生 ArkUI Navigation/Tabs、普通组件、弹窗、菜单和交互组件选择 API 26+ 接入方案；
- 生成应用级或组件级改造方案，并在用户明确要求时修改工程；
- 提供从原生 `Tabs` 或自研悬浮导航迁移到 `HdsTabs` 的完整代码资产和内置迁移对照结论；
- 提供 ArkUI 路线的能力门禁、场景材质工厂和“条件双写 / 单树后置覆盖”降级写法资产；
- 按通用 `fallbackPolicy` 保留接入前源程序状态，并设计跨版本、设备能力、系统开关、性能约束和测试矩阵；
- 排查材质未生效、组件透明、视觉属性冲突和性能问题。

本能力包不处理窗口沉浸式、系统栏显隐或安全区布局，也不把沉浸光感当成普通背景模糊效果。

## 接入前必须确认

从工程读取或向用户确认以下信息；能够从文件中发现的内容不要重复询问：

1. 实际参与构建的本机 SDK 根目录、`sdk-pkg.json` 和 API 版本；
2. `compileSdkVersion`、`compatibleSdkVersion`、`targetSdkVersion` 或等价 API 版本上下文，以及低于路线门槛时是否接受升级接入；
3. 工程是否使用 Stage 模型，目标 module 是否为 `entry`；
4. 当前使用 ArkUI 原生组件、HDS 组件，还是两者混合；
5. 目标组件是标题栏、底部导航、普通容器、菜单、弹窗还是其他区域；
6. 需要覆盖的设备形态、最低系统版本和性能档位；
7. 用户需要方案、代码修改、验证还是故障排查。

版本或工程上下文不明确时，不直接生成最终代码。先输出缺失信息以及 API 23 路线和 API 26 路线之间会受影响的选择。

## 路线选择

| 工程范围 | 选择 |
|---|---|
| API 18～19 | `HdsNavigation`/`HdsNavDestination` 组件可以存在，但尚无沉浸光感材质接口；按通用升级接入处理至 API 23 |
| API 20～22 | `HdsNavigation`、`HdsNavDestination`、`HdsTabs` 组件可以存在，但尚无沉浸光感材质接口；按通用升级接入处理至 API 23 |
| API 低于 18 | HDS 导航组件与沉浸光感材质均不满足；按通用升级接入处理至路线门槛 |
| API 23～25 | 使用 UI Design Kit / HDS，只覆盖 HDS 标题栏和底部页签等支持组件 |
| API 26+ | HDS 可继续承担 HDS 导航；原生 ArkUI Navigation/Tabs、普通组件、菜单和弹窗使用 ArkUI `uiMaterial`，且 target API 必须达到 26 |
| 同时支持 API 23～26+ | HDS 作为基础路线；API 26 能力使用版本与设备能力判断保护；所有回退路径保留接入前源程序状态 |

HDS 与 ArkUI 是可组合路线，不是互斥选择。工程同时包含 HDS 导航/页签和 ArkUI 普通材质目标时，选路结果使用 `selectedRoutes: ["hds", "arkui"]`，分别加载、实施和验证；`recommendedRoute` 只保留为主要建议与向后兼容字段，不能用来丢弃补充路线。

路线门槛来自 [profile.json](profile.json)：`minApi` 表示本机 SDK/compile 能力门槛，`minTargetApi` 表示路线额外要求的 target 门槛，它们都不是承载组件的起始版本。HDS 组件家族从 API 18 开始出现，其中 `HdsNavigation`/`HdsNavDestination` 从 API 18 可用，`HdsTabs` 从 API 20 可用；沉浸光感材质相关入口从 API 23 才可用。因此，扫描到旧版 HDS 组件不能据此判定沉浸光感可接入。工程 API 低于门槛时，按通用[兼容性模型](../../shared/compatibility-model.md)的升级接入处理，是否升级、选择哪条路线由用户决定；存在多条可用路线或升级选项时必须询问用户，仅一条路线且无需升级时给出建议路线和理由即可。

完整读取 [兼容性与选型](compatibility.md)，完成版本和能力门禁后再设计实现。

## 按任务加载资料

| 用户任务 | 必读文件 |
|---|---|
| 版本判断、路线选择、前置检查 | [compatibility.md](compatibility.md) |
| 所有实现与回退 | [implementation.md](implementation.md)、[shared/fallback.md](shared/fallback.md) |
| HDS 导航、悬浮 Tab、MiniBar | [routes/hds/implementation.md](routes/hds/implementation.md)、[routes/hds/assets.md](routes/hds/assets.md) |
| ArkUI 开启策略、原生 Navigation/Tabs、普通组件、菜单、弹窗 | [routes/arkui/implementation.md](routes/arkui/implementation.md)，再按目标加载该入口列出的分类资料 |
| 示例资产选择入口 | [assets-catalog.md](assets-catalog.md)，再按 `selectedRoutes` 加载对应路线资产 |
| 性能评审、测试与验收 | [performance-validation.md](performance-validation.md)，再按 `selectedRoutes` 读取对应验证文件 |
| 材质无效、透明、卡顿或样式冲突排查 | [compatibility.md](compatibility.md)、[shared/validation.md](shared/validation.md)及选中路线的验证文件 |

同时完整读取主 Skill 指定的对应通用 workflow。机器选路以 [profile.json](profile.json) 为准，Markdown 用于解释、实施和人工复核；两者冲突时停止并报告能力包校验错误。

## 执行流程

1. 运行 `inspect-project.mjs` 验证本机 SDK 清单并扫描工程，记录 compile/target/compatible API、模型、module、组件体系和目标组件。
2. 运行 `check-compatibility.mjs`，按本机 SDK API、路线 `minApi`/`minTargetApi` 和工程组件信号列出可用路线、`selectedRoutes` 与升级选项；涉及升级或多条路线时由用户确认后再确定 HDS、ArkUI 或组合路线，不满足条件时给出降级结论。
3. 记录目标代码的接入前状态基线，列出将修改的依赖、配置、页面和组件，以及旧版本、不支持、禁用和未授权路径如何保留该基线。
4. 用户只要求设计时交付方案并停止；用户明确要求实现时才修改工程。
5. 实现时复用项目现有架构和类型，不用动态类型或不安全断言掩盖接口差异。
6. 运行 `verify-integration.mjs`，再执行项目可用的静态检查和构建；未进行真机验证时明确标注，不把编译通过等同于效果验证。
7. 按性能与验证文档检查设备档位、深浅色、系统设置、动态内容和负向场景。

## 交付结构

输出至少包含：

1. **环境与选型**：本机 SDK 根清单和 API、工程 API 范围、Stage/entry 条件、HDS/ArkUI 路线及理由。
2. **改动内容**：配置、依赖、文件、组件和关键参数。
3. **兼容与回退**：接入前源程序状态基线，以及旧版本、不支持设备、用户设置和外部条件不满足时需要保留的代码路径、布局、状态、交互、数据和普通视觉样式。
4. **性能约束**：材质面积、嵌套、动态背景、动画和属性冲突。
5. **验证结果**：已执行检查、构建结果、待真机验证项和已知限制。

## 资料基线

能力包依据工作区《沉浸光感接入与 API 版本限制》整理，组件基线与材质门槛于 2026-09-01 使用官方开发指导和 API 参考复核。本机 SDK 路由阶段只读取根清单 API，不扫描声明或具体接口；接口可编译性由目标工程真实构建确认。涉及项目版本或新版 SDK 时，优先核对同版本官方文档，并把资料差异记录在交付结果中。

主要官方资料：

- [沉浸光感最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-spatiality-immersive)
- [Spatialization 官方示例](https://gitcode.com/HarmonyOS_Samples/Spatialization)
- [ArkUI 沉浸光感指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense)
- [开启沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-enable)
- [组件适配沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)
- [UI Design Kit 沉浸光感指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ui-design-hds-component-material)
- [HdsNavigation API](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/api/ui-design-hdsnavigation)
- [HdsTabs API](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/api/ui-design-hdstabs)
- [hdsMaterial API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsmaterial)
- [uiMaterial API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial)
- [systemMaterial 通用属性](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)
