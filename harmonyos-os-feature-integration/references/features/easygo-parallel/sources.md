# 来源索引

以下结论来自 2026-09-17 抓取的官方快照。本包是按任务整理的规则与独立最小配置，不依赖抓取目录或示例工程的本机路径。

| 来源 | 本包使用的事实 |
|---|---|
| [平行视界最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-easygo-parallel)（2026-09-14 更新） | API 23 开发者配置、entry 限制、配置结构/默认值/API 26 字段、开发场景和常见问题 |
| [平行视界设计指南](https://developer.huawei.com/consumer/cn/doc/design-guides/parallel_view-0000002588655180) | 兼容分栏的定位、导航/购物模式及原生分栏边界 |
| [module.json5](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/module-configuration-file) | module.easyGo 资源引用 |
| [UIContext](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uicontext-uicontext) | isEasySplit 从 API 24 支持，查询当前是否分栏 |
| [UIObserver](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uicontext-uiobserver) | API 23 页面尺寸信息与页面尺寸变化监听 |
| [Navigation](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navigation)、[NavDestination](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navdestination) | 导航容器、目的页名称和 DIALOG 页面类型 |
| [Window](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-window-window)、[WindowProperties](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-window-i) | 窗口方向设置与 drawableRect |
| [官方购物示例](https://gitcode.com/HarmonyOS_Samples/easygo-parallel-shopping) | Navigation + mode=0、全屏图片页、地址编辑过渡页；包含 API 26 字段，不能整体回填到 API 23 工程 |

最佳实践的 ratio 表格在抓取后被竖线切断；同页 JSON 示例和购物示例都采用 `"1 | 1"`，因此比例配置使用竖线分隔，不能写成 `"1:1"`。文档中的“1:1”是比例描述。

虚拟容器按右侧页面尺寸计算；FAQ 的“一半”对应默认 1:1 场景，API 26 自定义比例/拖拽时不能固定除以二。设备实测、target 的额外硬门槛、资料未列应用类型的支持情况均不从示例反推。
