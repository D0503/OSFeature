# ArkUI 路线验证与排障

先执行[共享验证](../../shared/validation.md)，再覆盖本路线矩阵。

## ArkUI 矩阵

- 本机 SDK、compile API、target API 均达到 26；target 低于 26 时路线不可用而不是仅禁用应用级 metadata；
- `compatibleSdkVersion < 26` 时，验证 `sdkApiVersion >= 26` 的支持与低版本路径；仅材质变化时检查调用和配置保护，组件、布局或导航结构变化时检查组件树分支；
- `isImmersiveMaterialSupported()` 返回 true/false；
- 冷启动时追踪能力查询及其封装方法的调用链：模块加载、静态/成员字段初始化及启动加载页中均不调用；以工程启动完成且加载页退出的信号触发查询，不以固定延时判断就绪。查询前保留原样式和“未查询”状态，就绪后结果能更新目标组件；静态扫描发现接口名称不能证明调用时机正确，需结合启动流程与运行日志核对；
- 高、中、低算力设备及系统“强、均衡、弱”档位；
- 深色和浅色模式；
- 应用级 `default`、`enable`、`disable`，包括 target 升级但不配置 metadata 的默认行为；
- `DISABLE`、显式材质、`Material.empty`、`undefined` 四类优先关系；
- 原生 Navigation 标题栏与原生 Tabs；Tabs 同时满足 `barFloatingStyle`、`barOverlap(true)`、`vertical(false)`、`BarPosition.End` 后应呈现系统默认 `THIN`，不强制显式材质；接入分支默认显式 `maskColor: Color.Transparent`，保留非透明遮罩的分支须有设计依据并验证滚动内容可视性；逐页验证所有可滚动 Tab 的末项和操作热区能滚到悬浮栏上方；
- AlphabetIndexer、Toast、Popup、Tips、Menu、Dialog/Sheet、SelectionMenu 和文本选择菜单的 `DEFAULT`/`ENABLE` 默认状态、Options 类型和背景冲突；
- Button、Select、Toggle、Slider、Chip、ChipGroup/ChipGroupV2、SegmentButton/SegmentButtonV2 的专属入口、默认状态、生效域和预设视觉限制；
- CalendarPickerDialog、DatePickerDialog、TextPickerDialog、TimePickerDialog 按 CustomDialog 验证；CalendarPicker 自带弹出框仍不支持；
- MultiCapsuleSegmentButtonV2 不支持沉浸光感，保留原样式；
- Select 按钮与菜单两个独立入口；
- `materialColor`、`colorInvert`、`applyShadow`、`interactive` 和 `lightEffect` 的设备降级；
- Navigation 标题栏、底部悬浮 TabBar、全页面组件三类生效域；无法从文本确定祖先关系时保留人工核对项；
- 不透明背景、背景模糊、边框、阴影和材质的属性覆盖顺序；
- 自绘制组件、材质布局区域与薄材质折射表现。

## 常见问题

| 现象 | 检查 | 处理 |
|---|---|---|
| 材质完全不生效 | API、Stage、module、应用状态、能力判断 | 对齐前置条件并保留普通样式 |
| 原生 Tabs 材质不生效 | 应用状态、`barFloatingStyle`、`barOverlap`、`vertical`、`barPosition` | 满足完整悬浮条件后使用系统默认 `THIN`，不强制显式设置 `FloatingTabBarStyle.systemMaterial`；`DISABLE` 下不生效 |
| 悬浮栏周围内容被染色或压暗 | `barFloatingStyle.maskColor`、`maskHeight` | 接入分支默认显式 `maskColor: Color.Transparent`；设计明确需要渐变遮罩时才配置非透明值，并逐页验证滚动内容可视性 |
| 接口存在但材质不生效 | 组件是否位于官方支持的生效域，运行日志是否出现 `Material inactive: out of scope...` | 将目标放到合法的标题栏、底部悬浮 TabBar 或全页面组件入口；静态层级不明确时人工核对 |
| 原生 Tabs 最后一个列表项被遮挡 | 是否逐页检查真实滚动容器，尾部空间是否位于最后一个滚动项之后 | 使用 `contentEndOffset`、末尾 `Blank`、内容 bottom padding 或等价实现；按实际遮挡高度计算且不重复加入安全区 |
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
| 低算力材质样式与参数不同 | `style`、`materialColor`、`colorInvert`、`lightEffect` | 低算力不区分 `style`，`materialColor` 作为背景色；反色与流光按设备能力降级 |

## ArkUI 验收

- ArkUI Tabs 默认栏底部间距为 28vp；实际接入已开启窗口沉浸式时显式 28vp，未开启时显式 0vp，并逐个确认一级页、滚动容器及全部父组件的底部扩展。核对调用链与实际生效，验证顶部避让、底部内容延伸和普通/悬浮分支切换；

- 接入分支删除外层 `.barWidth(...)`，由 `barFloatingStyle.barWidth` 的配置或默认行为生效；所有断点、横竖屏和窗口尺寸保持底部横向 Tab，不误缩窄 TabContent。仅低版本保留原有响应式布局；材质关闭或设备不支持不恢复侧边 Tab；
- 接入分支默认显式设置 `maskColor: Color.Transparent`；保留非透明遮罩的分支有设计依据并逐页验证滚动内容可视性，低版本兼容分支保留接入前遮罩与背景行为；
- 接入分支删除原有 `.animation(...)` 页签切换动效配置；低版本兼容分支保留原动画，材质关闭或设备不支持的回退不恢复切换动画；
- target/compile/本机 SDK 路线门禁均达到 API 26；compatible 低于 26 时按改动范围保护调用或组件树，确保新增 API 不在低版本求值；compatible 达到 26 时无需 API 26 版本分支；
- 不支持、禁用和旧版本路径保持接入前组件状态与普通样式；
- 应用级配置满足 target API 与 entry module 限制；
- 已按[组件矩阵](component-profile.json)核对 `DEFAULT`/`ENABLE` 默认开启、专属入口、明确关闭、生效域和组件限制；
- 原生悬浮 Tabs 的每个可滚动页面都能让最后一个可操作项完整滚到悬浮栏上方，非悬浮源路径的滚动范围保持不变；
- 原生 Tabs 与 HdsTabs 没有混路由；
- 没有大面积、嵌套、动态背景或无限动画风险；
- 静态检查、真实构建和待真机项分别报告。
