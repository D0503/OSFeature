# HDS 路线验证与排障

先执行[共享验证](../../shared/validation.md)，再覆盖本路线矩阵。

按[知识库查询流程](../../../../workflows/knowledge-query.md)逐节读取当前任务所需正文。

## 悬浮 Tab 与导航矩阵

- 标题栏单层或嵌套滚动绑定对应真实控制器与父子关系；验证内外容器交接、到顶到底及回弹时的模糊和显隐，不因多容器同时滚动产生异常切换；
- 自定义滚动模糊区间时验证起点、过渡中段、终点和回滚，核对 `originalStyle`、`scrollEffectStyle` 与 `enableScrollEffect` 开关行为，文字和按钮在两端均清晰可见；
- 使用 `stackBuilder`、`bottomBuilder` 时核对位置、实际占用高度及 `showType` 的模式条件；使用 `enableComponentSafeArea` 时确认与内容起始偏移或内部占位不重复避让，首项可见且上滑可进入标题栏下方；
- 动态显隐核对 `hideStatusBar` 对 `hideTitleArea` 的依赖、`hideBottomBuilder` 行为及 MODAL 模式限制，显隐过程中不动态修改配置；
- HDS 默认栏底部间距为 0；实际接入已开启窗口沉浸式时显式 28vp，未开启时显式 0vp 并逐个确认一级 Tab 页、真实滚动容器及所有父组件的底部扩展；窗口封装、条件和后续关闭调用均需核对；
- 验证每个一级页的底部内容延伸和顶部避让；接入标题栏沉浸光感的页面核对 TOP 扩展覆盖完整父组件链、标题栏材质覆盖状态栏区域且内容不被遮挡，与悬浮 Tab 共存的链路使用 `[SafeAreaEdge.BOTTOM, SafeAreaEdge.TOP]` 合并写法。普通/悬浮分支及独立复用页面之间切换时，TOP 与 BOTTOM 扩展均不泄漏到普通布局；

- 手机、平板/折叠展开态和大窗口；竖屏、横屏、分屏与自由窗口；
- 接入分支所有断点均为底部横向 Tab，外层 `.barWidth(...)` 已移除，由 `barFloatingStyle.barWidth` 或默认行为控制栏宽；材质关闭或设备不支持仍保持底部布局；
- 56vp 显示态及存在隐藏能力时的 0vp 状态，检查跳动和残留点击区域；
- HDS 分支不得设置 `barHeight('auto')`；直接配置应移除，变量、条件和封装调用需核对实际值。静态发现 `auto` 时核对组件及版本分支，保留低版本普通 Tabs 原配置；
- 有/无导航指示区时的 `barBottomMargin`、祖先 bottom padding 和安全区；普通 Tab 导航条避让 padding 只在普通分支生效，悬浮分支由栏底部间距负责，显式和默认 margin 均需验证；
- `barOverlap(true)` 下首尾内容、透明背景、内容 padding 和 `expandSafeArea(BOTTOM)`；标题栏沉浸光感页面的 `expandSafeArea(TOP)` 及与 BOTTOM 的组合写法；
- 所有可滚动 Tab 的最后一项与完整点击热区能越过悬浮栏；检查 `contentEndOffset`、尾部占位或等价 padding；
- 默认栏宽及自定义 small/medium/large 宽度下的多语言、字体放大和页签数量；
- `adaptToHandedness` 的左右偏移、回中和不支持设备表现；
- MiniBar 展开/折叠、Builder 状态、快捷操作、裁剪与背景；API 23 分支不得包含 `barLayoutMode`，API 24+ 分别验证两种布局。

当 `compatibleSdkVersion < 23` 时，API 23 以下设备逐项对照接入前源程序：断点、横竖屏、窗口模式、栏宽栏高、分割线、控制器、页签顺序、自定义 TabBar、隐藏、刷新和滚动范围都保持一致。

## 常见问题

按知识库查询流程读取《HDS 沉浸光感常见问题与处理》的「常见问题」。

## HDS 验收

- 材质接口与 HDS 组件基线没有混淆；
- 悬浮栏位置、间距、滚动遮挡、大断点和 MiniBar 已完成目标矩阵验证；
- API 23 以下普通 `Tabs` 与接入前源程序逐项一致；
- 设备能力和自定义材质档位按规则处理；
- 静态检查、真实构建和待真机项分别报告。
