# ArkUI 路线验证与排障

先执行[共享验证](../../shared/validation.md)，再覆盖本路线矩阵。

## ArkUI 矩阵

- 本机 SDK、compile API、target API 均达到 26；target 低于 26 时路线不可用而不是仅禁用应用级 metadata；
- `compatibleSdkVersion < 26` 时，`sdkApiVersion >= 26` 整树保护成功与失败两条路径；
- `isImmersiveMaterialSupported()` 返回 true/false；
- 高、中、低算力设备及系统“强、均衡、弱”档位；
- 深色和浅色模式；
- 应用级 `default`、`enable`、`disable`，包括 target 升级但不配置 metadata 的默认行为；
- `DISABLE`、显式材质、`Material.empty`、`undefined` 四类优先关系；
- 原生 Navigation 标题栏与原生 Tabs；Tabs 同时满足 `barOverlap(true)`、`vertical(false)`、`BarPosition.End`；
- AlphabetIndexer、Toast、Popup、Tips、Menu、Dialog/Sheet 的默认状态、Options 类型和背景冲突；
- Button、Select、Toggle、Slider、ChipGroup、SegmentButton 的专属入口和预设视觉限制；
- Select 按钮与菜单两个独立入口；
- `materialColor`、`colorInvert`、`applyShadow`、`interactive` 和 `lightEffect` 的设备降级；
- 不透明背景、背景模糊、边框、阴影和材质的属性覆盖顺序；
- 自绘制组件、材质布局区域与薄材质折射表现。

## 常见问题

| 现象 | 检查 | 处理 |
|---|---|---|
| 材质完全不生效 | API、Stage、module、应用状态、能力判断 | 对齐前置条件并保留普通样式 |
| 原生 Tabs 材质不生效 | `barOverlap`、`vertical`、`barPosition`、`barFloatingStyle.systemMaterial` | 同时满足三个布局条件并移除栏背景冲突 |
| Navigation 标题栏层次不足 | `NavigationTitleOptions.barStyle` | 在符合原设计时使用 `BarStyle.STACK` |
| 材质视觉无变化 | 不透明背景或背景模糊是否盖住背板 | 调整属性顺序或透明度 |
| TextArea 等材质被遮盖 | 内容层背景位于材质背板之上 | 不同时使用冲突背景和材质 |
| 材质区域不符合预期 | 布局区域、圆角和真实可视区域 | 调整 width/height/borderRadius |
| 薄材质边缘出现环境颜色 | `THIN`/`ULTRA_THIN` 折射 | 接受效果、加厚或调整 materialColor |
| 显式关闭后又出现 | 是否传入 `undefined` 且应用为 ENABLE | 使用 `uiMaterial.Material.empty` |
| Slider 传入参数但样式未按参数变化 | Slider 使用内部预设参数 | 只把材质当开启标记并检查 blockType/style 条件 |
| Toggle Checkbox 无效果 | Checkbox 当前未适配 | 保留源样式，不把无效果误判为接口失败 |
| CalendarPicker 弹窗无效果 | 弹出框当前不支持 | 只对组件本体或其他支持的 Picker/Dialog 入口接入 |
| 阴影或边框异常 | `applyShadow` 和属性顺序 | 移除重复效果并明确最终覆盖 |
| 低性能设备没有流光 | 设备算力 | 接受系统降级，关键交互使用其他反馈 |

## ArkUI 验收

- target/compile/本机 SDK 路线门禁均达到 API 26；compatible 低于 26 时使用低版本可用的整树保护；
- 不支持、禁用和旧版本路径保持接入前组件状态与普通样式；
- 应用级配置满足 target API 与 entry module 限制；
- 已按[组件矩阵](component-profile.json)核对默认开启、专属入口、明确关闭和组件限制；
- 原生 Tabs 与 HdsTabs 没有混路由；
- 没有大面积、嵌套、动态背景或无限动画风险；
- 静态检查、真实构建和待真机项分别报告。
