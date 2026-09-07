# 实施规则

1. 先执行工程扫描并记录 SDK、Stage 模型、module 类型、compile/target/compatible API、目标组件和 git 状态。
2. 按所选路线执行版本门禁：ArkUI 要求 compile/target API 26；HDS 当前包要求 compile/target/compatible API 23。低于门槛时停止修改并输出升级要求。只有用户明确授权后才修改版本配置。
3. 对拟修改文件记录绝对路径、before SHA-256 和相关组件/状态/事件/普通样式基线。已有未提交修改不表示禁止编辑，但必须局部补丁、不得覆盖，并在报告中披露。
4. 目标工程仅保留用户要求的最终状态。default/enable/disable、配置矩阵、冲突裁决和低版本对照使用系统临时目录中的最小工程或副本。
5. 使用场景中的资产和步骤做最小改动；先复用目标工程现有 import、状态和 Options 类型。不得把一种弹窗 Options 强转给另一种 API。
6. 设备不支持或版本不满足时保留接入前的组件树、布局、断点、方向/窗口逻辑、状态、控制器、事件、错误处理和普通视觉样式。
7. 修改后重新计算 after SHA-256，并保存精确 unified diff。失败时保留修改，不自动回滚。
8. SDK/target 升级、模拟器创建或下载、应用卸载和自动回滚都需要用户另行授权；不得默认执行。

## HDS 路线

- 只使用官网指南直接声明的两个入口：`HdsNavigation` 的 `titleBar.style.systemMaterialEffect` 和 `HdsTabs` 的 `barFloatingStyle.systemMaterialEffect`。
- 默认同时显式设置 `materialType: hdsMaterial.MaterialType.ADAPTIVE` 与 `materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE`。`materialType` 默认值是 `NONE`，不得因只设置等级而宣称材质已开启。
- 自定义等级前调用 `hdsMaterial.getSystemMaterialTypes()`。支持 `IMMERSIVE` 时选 `EXQUISITE` 或 `GENTLE`，不支持时使用 `SMOOTH`；查询异常回到自适应配置并记录证据。
- Phone、Tablet 可按场景运行；PC/2in1 必须先查询材质能力；HdsTabs 在 TV 上无效果，不得把 TV 结果判为视觉通过。
- 官网完整示例不是可直接复制资产。接入时补齐实际工程 import、资源、菜单、滚动器和控制器，仅合并目标字段。

低版本回退只依据官网兼容性事实（IL-F021、IL-F022）：compatible API 低于 26 时用版本条件保留原普通样式分支，低版本路径不引用 API 26 能力；设备不支持时保留接入前的背景、布局、状态、事件与恢复路径。官网未陈述的写法形态不在能力包内定性，只能记录为观察项；此类自登记工程规则仅由 document-review 与 development-validation-planning 使用。

构建使用 `devecocli build`。只对有明确编译错误位置且与本次修改相关的问题做定向修复，最多两轮；第三次仍失败时停止。
