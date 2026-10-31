# 沉浸光感扫描与回退

遵循[扫描工作流](../../workflows/compatibility-audit.md)。以下策略用于已接入工程；先复用已有实现，再按备选修复，不按路线最低 API 替代具体 SDK `@since`。

## Tabs（HDS 和 ArkUI）

- HdsTabs 低版本替换普通 Tabs；原生悬浮 Tabs 回退普通非悬浮 Tabs。内容、索引、控制器、页签顺序、点击/双击/刷新/隐藏事件及业务状态复用，不能创建两套独立状态。
- 工程已有一多适配时，恢复 lg/xl 的侧边 Tab，以及原断点下 vertical、barPosition、barWidth、barHeight、内容布局和方向/窗口条件。找不到原实现时参考工程断点与其他页面，仍无法确定侧边位置和宽度则询问；没有一多依据时沿用当前方向位置，不新建一多方案。
- 普通分支不调用不支持的 barFloatingStyle（包含 margin、maskColor、maskHeight、systemMaterial、adaptToHandedness 等字段/对象/枚举）。barOverlap 恢复原非悬浮值，无原值时使用不重叠布局。各字段版本独立核对。
- 背景、模糊、边框、分隔线和阴影恢复普通配置；有原页签 animation 则恢复，无依据不新增动画。栏宽恢复与内容宽度分别检查。
- 每个 Tab 页面真实滚动容器的尾部占位、contentEndOffset、padding 等，撤销悬浮栏专用补偿；混合用途拆分，保留业务留白。普通分支恢复必要的导航条避让，不将外层 padding 和滚动尾部补偿混淆。
- Tabs、TabContent、页面根节点和祖先的 expandSafeArea 逐条追踪用途；只撤销增强专用的边，保留共用安全区需求。
- 版本满足但材质不支持/关闭时仅退材质，保留底部横向悬浮布局、barOverlap 和尾部避让；不恢复侧边布局，不恢复增强分支移除的切换动画。

- HdsTabs 存在 MiniBar 时，回退普通 Tabs 后不再呈现 MiniBar。每次改造先询问其中业务的承接方式：不提供该快捷区域、复用已有入口，或经确认使用普通组件承接；结合工程说明影响，同次相同场景复用回答，不自行新增替代组件。用户确认前不实施依赖该选择的回退；仅扫描时列为修复待确认项，报告记录最终选择和验证结果。
- MiniBar 的独立配置、外部控制调用（如 applyMiniBarStyle）、相关类型和枚举仍按 SDK `@since` 扫描，沿导入、接收者和配置使用处确认属于 HdsTabs。检查共用对象、初始化和退出清理，确保普通 Tabs 分支不会访问不支持的接口；普通同名业务变量不作为缺陷。
- 检查 MiniBar 在组件外部的专用占位、尺寸及滚动补偿，随普通 Tabs 回退同步清理；混合用途拆分，保留安全区和业务间距。高低版本运行分别验证 MiniBar 操作与所选业务承接方式、残留间距及外部调用。
- 仅材质不可用时保留 MiniBar；更高版本新增属性单独保护。接入沉浸光感不主动新增 MiniBar。

## Navigation / NavDestination

- HDS 组件本身不可用才替换普通 Navigation/NavDestination；组件可用、仅材质不可用则保留组件退普通样式。SDK 声明中的组件版本与材质版本分别核对。
- 保护 systemMaterial、材质对象/枚举、scrollEffectOptions 等新增调用；已有受支持滚动效果保留。
- 为透底新增的 BarStyle.STACK 恢复原值；无原值时普通非叠放布局。同步撤销专用 contentStartOffset、内部顶部占位、位移/透明度/标题高度联动和安全区扩展，避免重复留白或首项遮挡；共用业务逻辑不删除。
- NavigationMode（Auto/Stack/Split）不是 BarStyle。保留原导航模式、路由栈、参数、返回、生命周期和工具栏业务；不强制 Stack。未知布局会改变单双栏交互时询问。
- 自定义标题及菜单内按钮恢复普通样式和操作状态。内容接替标题/分类吸顶等独立交互不随材质回退删除，其中不兼容调用单独处理。

## 材质增强通用策略

适用 Dialog/PickerDialog、Sheet、Popup、Menu、Toast、Tips、Button、Select、Toggle、Slider、Chip/ChipGroup、SegmentButton、通用材质、AlphabetIndexer 提示及文本选择菜单。

- 低版本不执行新增属性调用，不提前求值新增选项、对象和枚举，不能仅把材质值设 undefined 后继续调用高版本属性。
- 恢复已有普通背景、边框、阴影和遮罩；无原配置时使用工程主题或组件默认样式。为材质改变的尺寸、圆角、间距、透明度、裁剪、层级与安全区逐项处理，保留一多规则及业务用途。
- 保留选中值、禁用/加载态、范围/步长、确认/取消、点击/删除、显示/关闭回调。保留 Sheet 档位、拖拽和键盘避让；Popup/Menu/Tips 锚点；Toast 内容时长位置；索引定位和文本复制/粘贴/自定义菜单操作。
- 不隐藏弹层或控件、不取消提示、不替换交互；组件本身也不支持时优先已有实现，否则提出替代方案询问。
- 应用级默认材质且没有新增组件调用时，不重建组件；核对应用配置及低版本实测。材质关闭不自动意味着关闭业务。

高低版本均实际操作目标组件；Tabs 额外验证 lg/xl 侧边栏、缩放、首末项、留白和状态保持。见共享工作流的验证要求。
