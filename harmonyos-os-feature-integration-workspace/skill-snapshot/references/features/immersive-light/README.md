# 沉浸光感能力包

状态：`ready`

沉浸光感是由系统材质和空间动效组成的视觉能力，不是窗口沉浸式、状态栏处理或安全区避让。处理请求时先确认 API 范围和组件体系，再选择 HDS 或 ArkUI 路线；不要把两代接口混写成一套实现。

## 能力范围

本能力包支持：

- 判断 HarmonyOS 工程可使用的沉浸光感路线；
- 为 HDS 标题栏、悬浮导航Tab和底部页签选择 API 23+ 接入方案；
- 为普通 ArkUI 组件、弹窗、菜单和自定义布局选择 API 26+ 接入方案；
- 生成应用级或组件级改造方案，并在用户明确要求时修改工程；
- 设计跨版本降级、设备算力适配、性能约束和测试矩阵；
- 排查材质未生效、组件透明、视觉属性冲突和性能问题。

本能力包不处理窗口沉浸式、系统栏显隐或安全区布局，也不把沉浸光感当成普通背景模糊效果。

## 接入前必须确认

从工程读取或向用户确认以下信息；能够从文件中发现的内容不要重复询问：

1. `compatibleSdkVersion`、`targetSdkVersion` 或等价 API 版本上下文；
2. 工程是否使用 Stage 模型，目标 module 是否为 `entry`；
3. 当前使用 ArkUI 原生组件、HDS 组件，还是两者混合；
4. 目标组件是标题栏、底部导航、普通容器、菜单、弹窗还是其他区域；
5. 需要覆盖的设备形态、最低系统版本和性能档位；
6. 用户需要方案、代码修改、验证还是故障排查。

版本或工程上下文不明确时，不直接生成最终代码。先输出缺失信息以及 API 23 路线和 API 26 路线之间会受影响的选择。

## 路线选择

| 工程范围 | 选择 |
|---|---|
| API 低于 23 | 当前能力包没有可用的沉浸光感接入路线，保留普通视觉样式 |
| API 23～25 | 使用 UI Design Kit / HDS，只覆盖 HDS 标题栏和底部页签等支持组件 |
| API 26+ | HDS 可继续承担导航框架；普通组件、菜单和弹窗使用 ArkUI `uiMaterial` |
| 同时支持 API 23～26+ | HDS 作为基础路线；API 26 能力使用版本与设备能力判断保护，并保留普通样式降级 |

完整读取 [兼容性与选型](compatibility.md)，完成版本和能力门禁后再设计实现。

## 按任务加载资料

| 用户任务 | 必读文件 |
|---|---|
| 版本判断、路线选择、前置检查 | [compatibility.md](compatibility.md) |
| 生成方案、代码或修改工程 | [compatibility.md](compatibility.md)、[implementation.md](implementation.md) |
| 性能评审、测试与验收 | [performance-validation.md](performance-validation.md) |
| 材质无效、透明、卡顿或样式冲突排查 | [compatibility.md](compatibility.md)、[performance-validation.md](performance-validation.md) |

## 执行流程

1. 扫描工程并记录 API、模型、module、组件体系和目标组件。
2. 按兼容性表确定 HDS、ArkUI 或组合路线；不满足条件时给出降级结论。
3. 列出将修改的依赖、配置、页面和组件，以及旧版本降级行为。
4. 用户只要求设计时交付方案并停止；用户明确要求实现时才修改工程。
5. 实现时复用项目现有架构和类型，不用动态类型或不安全断言掩盖接口差异。
6. 执行项目可用的静态检查和构建；未进行真机验证时明确标注，不把编译通过等同于效果验证。
7. 按性能与验证文档检查设备档位、深浅色、系统设置、动态内容和负向场景。

## 交付结构

输出至少包含：

1. **环境与选型**：API 范围、Stage/entry 条件、HDS/ArkUI 路线及理由。
2. **改动内容**：配置、依赖、文件、组件和关键参数。
3. **兼容与降级**：旧版本、不支持设备、用户设置和普通视觉备选方案。
4. **性能约束**：材质面积、嵌套、动态背景、动画和属性冲突。
5. **验证结果**：已执行检查、构建结果、待真机验证项和已知限制。

## 资料基线

能力包依据工作区《沉浸光感接入与 API 版本限制》整理，资料日期为 2026-08-31。涉及项目版本或新版 SDK 时，优先核对同版本官方文档，并把资料差异记录在交付结果中。

主要官方资料：

- [沉浸光感最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-spatiality-immersive)
- [ArkUI 沉浸光感指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense)
- [UI Design Kit 沉浸光感指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ui-design-hds-component-material)
- [hdsMaterial API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsmaterial)
- [uiMaterial API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial)
- [systemMaterial 通用属性](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)
