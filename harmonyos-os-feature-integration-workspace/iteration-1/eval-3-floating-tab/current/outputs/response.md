# 判断结论

“悬浮导航Tab”是已注册特性“沉浸光感 / `immersive-light`”的别名，目标应路由到 HDS 的 `HdsTabs` 悬浮底部页签能力。它不属于窗口沉浸式。

当前没有提供工程路径、API、应用模型和 module 信息，因此项目级可行性应标记为 `insufficient_context`，不能直接断言已支持。落地前至少确认 `compatibleSdkVersion`、`targetSdkVersion`、Stage 模型、目标 module 类型及现有 Tabs 组件体系。

## 适用路线

- API 低于 23：当前能力包无可用路线，保留普通 Tabs。
- API 23～25：使用 HDS 路线，将普通 Tabs 调整为 `HdsTabs` 悬浮底栏。
- API 26+：导航仍优先由 HDS 承担；ArkUI `uiMaterial` 仅用于普通组件、菜单或弹窗等扩展，不应为了悬浮导航 Tab 强行改走 ArkUI 组件级路线。
- 必须是 Stage 模型。若实际工程不满足，应停止改造并保留原样式。

## 关键配置与实现点

1. 使用 `HdsTabs`，通过 `barFloatingStyle` 配置悬浮形态；需要折叠式 MiniBar 时使用其 `miniBar` 配置。
2. 在 `HdsTabsFloatingStyle.systemMaterialEffect` 中设置沉浸材质，普通场景优先采用 `hdsMaterial.MaterialType.ADAPTIVE` 与 `hdsMaterial.MaterialLevel.ADAPTIVE`。
3. 若业务必须自定义材质档位，先用 `hdsMaterial.getSystemMaterialTypes()` 查询设备能力；支持 `IMMERSIVE` 时才选对应强度，否则降为 `SMOOTH` 或普通视觉样式。
4. `systemMaterialEffect` 负责材质，悬浮结构由 `barFloatingStyle` 负责，两者职责不要混淆。
5. API 26 的应用级 `ohos.arkui.UIMaterial.state` 不是 HDS 悬浮 Tabs 的必选配置；只有同时扩展 ArkUI 材质、且 `targetAPIVersion >= 26.0.0`、配置位于 `entry` module 时才评估它。
6. 当前能力包未声明额外权限；这只表示本特性资料未提出新增权限，不代表整个应用已完成权限或合规审查。

## 降级策略

- API 低于 23：继续显示原有普通 Tabs。
- 设备不支持目标 HDS 材质：使用 `SMOOTH`，仍不合适时回退到普通背景色、边框和必要阴影。
- 低算力设备或系统效果受限：允许流光、模糊等视觉效果降级，但导航、选中态和点击行为必须完整可用。
- 避免把材质叠加在大面积动态背景、视频、无限动画或重复模糊上；若涉及 Web 同层渲染并出现透明，应关闭该控件光感或关闭同层渲染。

## 验收要点

- 静态检查：API、Stage 模型、HDS 依赖与导入、`HdsTabs`、`barFloatingStyle`、`systemMaterialEffect` 和普通样式回退均有文件证据。
- 构建检查：运行工程现有 Hvigor 构建；构建通过不能替代真机视觉验收。
- 真机矩阵：至少覆盖 API 23、API 26，高/中/低算力，深/浅色，以及系统沉浸光感“强、均衡、弱”。
- 功能验收：Tab 切换、选中态、MiniBar 折叠与恢复、触控区域和可读性在材质启用与降级状态下都正常。
- 性能验收：无大面积材质、父子嵌套材质、重复模糊、动态背景覆盖或持续参数动画；未覆盖的设备和视觉结果标记为待验证。

## 与窗口沉浸式的边界

沉浸光感解决的是系统材质、模糊、高光与空间动效；窗口沉浸式解决的是全屏布局、状态栏/导航条显隐、安全区和内容避让。即使悬浮 Tab 视觉上靠近窗口边缘，也不能据此修改系统栏或安全区配置。若需求还包含“内容延伸到状态栏下方”或“底部安全区避让”，应作为独立的窗口沉浸式任务处理。
