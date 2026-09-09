# 沉浸光感场景与资料映射

以用户目标匹配，不要求用户知道组件名称、API 或官网章节名。所有正文入口登记在 `scenarios.json`；开发只从本次冻结正文提取判据。

| 用户目标或官网用语 | 场景 | 首读入口与章节 |
|---|---|---|
| 应用级开启、关闭、default/enable/disable | IL-S001 | enable、overview：应用开关与优先级 |
| 组件级开启、关闭、恢复默认 | IL-S002 | enable、ui-material-api：Material.empty 与 undefined |
| 普通标题栏、底部页签、索引条 | IL-S003 | component：Navigation、Tabs、AlphabetIndexer |
| 弹出框、气泡、AlertDialog、CustomDialog、ActionSheet、PickerDialog、文本菜单 | IL-S004 | component、enable、faq：具体入口与不支持情况 |
| 按钮、滑动条、子页签、操作块、分段按钮 | IL-S005 | component：Button/Select/Toggle/Slider/ChipGroup/SegmentButton |
| 交互形变、点光源、赋色、反色、自定义阴影 | IL-S006 | common、ui-material-api、faq：各参数及生效条件 |
| 不生效、背景遮挡、边框折射、渲染区域、层级、功耗、参数稳定 | IL-S008 | faq 对应问题、constraints 八项优化 |
| 明确 HDS 标题栏或 HdsNavigation | IL-S009 | hds-component-material-guide、hds-navigation-api |
| 明确 HDS 底部页签或 HdsTabs | IL-S010 | hds-component-material-guide、hds-tabs-api |
| HdsNavigation 和 HdsTabs 一起接入 | IL-S011 | HDS 指南：系统自适应示例 |
| HDS 自定义等级、getSystemMaterialTypes | IL-S012 | HDS 指南：自定义效果；hds-material-api |
| 沉浸光感典型场景：搜索框标题栏具有沉浸光感效果；搜索框随上滑隐藏 | IL-S013 | typical-scenes：搜索框标题栏效果 |
| 内容区标题栏开启沉浸光感；分类栏吸顶；内容标题进入顶部标题栏 | IL-S014 | typical-scenes：内容区标题栏开启沉浸光感 |
| getMaterialInfo、材质配置状态、设备是否支持、设备等级查询 | IL-S015 | ui-material-api：MaterialInfo 及三个查询接口 |
| 材质厚度、五种样式、系统强弱和深浅色自适应 | IL-S016 | overview、design-guidance、ui-material-api |
| 菜单非线性形变、边缘流光、滑动条粒子动画 | IL-S017 | overview：沉浸式空间动效；constraints：弹窗尺寸 |
| ArkUI/HDS 差异、uiMaterial 等级能否设置 | IL-S018 | faq：两套材质等级与样式差异；两套材质 API |
| 普通 Search/TextArea/TextInput、布局容器、滚动容器的背板材质 | IL-S019 | component：其余组件；enable、constraints、faq |

搜索框与标题栏组合需求优先定位 IL-S013，不能因句中同时出现 Navigation、Tabs、按钮而退回通用组件场景。单独的搜索框不意味着需要新增标题栏；普通标题栏按钮不意味着 HDS。只说“典型场景”时列出 IL-S013 和 IL-S014，不替用户选一种。故障描述应优先进入排障，不能仅凭组件名重新执行接入。

IL-S018 用于解释与核验路线差异。涉及工程实施时，按用户指定和已有组件确定路线，再执行对应组件场景；不能把该场景默认的 ArkUI route 用于构建 HDS 工程。纯知识查询只读资料并回答。

## 资料边界

本索引依据用户提供的官网资料快照（抓取日期 2026-09-08）。15 个入口覆盖如下：

| 资料文件名 | 入口 | 覆盖方式 |
|---|---|---|
| arkts-immersive-light-sense.md | catalog | 子页发现，不生成独立开发判据 |
| arkts-immersive-light-sense-development.md | development | 开发指导目录 |
| arkts-immersive-light-sense-overview.md | overview | 应用状态、样式、空间动效、路线范围 |
| arkts-immersive-light-sense-enable.md | enable | 开关、优先级、查询、组件生效范围 |
| arkts-immersive-light-sense-component-adaptation.md | component | 导航、弹窗、控件、通用组件 |
| arkts-immersive-light-sense-common-capability.md | common | 反色、赋色、交互、阴影 |
| arkts-immersive-light-sense-constraints.md | constraints | 面积、嵌套、模糊、弹窗尺寸、动态背景、反色范围、稳定性、阴影 |
| arkts-immersive-light-sense-faq.md | faq | 路线差异、生效范围、背景覆盖、折射、算力、反色、阴影、顺序、默认行为、区域、层级 |
| arkts-immersive-light-sample.md | typical-scenes | 搜索框标题栏、内容区标题栏两个典型场景 |
| arkts-apis-uimaterial.md | ui-material-api | 材质类型、状态、信息、查询、等级、样式与参数 |
| ui-design-hds-component-material.md | hds-component-material-guide | 系统自适应及自定义 HDS 材质 |
| ui-design-hdsnavigation.md | hds-navigation-api | TitleBarStyleOptions.systemMaterialEffect 及其上下文 |
| ui-design-hdstabs.md | hds-tabs-api | HdsTabsFloatingStyle.systemMaterialEffect 及其上下文 |
| ui-design-hdsmaterial.md | hds-material-api | HDS 类型、等级及设备查询 |
| immersivelight-0000002612101053.md | design-guidance | 厚度选择、系统强弱、顶部/底部/浮层/弹窗设计建议 |

HDS 参考页的非材质功能不逐一扩展为沉浸光感场景；只有目标依赖时才读取对应布局或交互上下文。目录页用于发现页面，设计建议不能变成强制规则。图片无法读取时不能臆测其中的参数和效果。

若自然语言未命中，先检查该表、已登记入口和官网目录链接；未命中关键词不代表官网没有该能力。确实无法唯一识别时才列候选。运行不依赖工作区 `docs`，本地资料不替代开发时的官网冻结，也不手工改写 `sessions/latest`。
