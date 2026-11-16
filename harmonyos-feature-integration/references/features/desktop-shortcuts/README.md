# 桌面快捷方式（Desktop Shortcuts）

状态：`ready`。稳定 ID：`desktop-shortcuts`；机器规则见 [profile.json](profile.json)。快捷方式通过桌面入口拉起 UIAbility，再由应用现有导航进入业务目标。

## 路线与接入前澄清

两条路线可组合：`static-shortcut` 通过配置文件预置入口，用户长按应用图标查看或拖动加桌；`dynamic-shortcut` 通过应用内校验、用户点击与系统确认请求加桌。动态路线内部包含预置资源、自定义资源两种重载，不拆成额外路线；使用预置资源需复用静态配置，但不强制选中静态路线。

先从需求与工程确定目标 UIAbility、业务功能或内容、名称图标、入口位置、路线及是否需要管理能力；仅补问缺失的业务决定。多路线可用时按公共规则展示选项并由用户决定。用户只说“桌面快捷方式”时不能自行决定新增哪些入口。可选管理能力只在明确需要时实施，不默认创建管理页面。

普通键盘快捷键、系统桌面快捷键、应用安装图标、Form Kit 卡片和通用 App Linking 请求不自动命中。不要用卡片 API 或系统应用专用 launcherBundleManager 接口实现三方应用加桌。

## 按任务加载

按[任务读取表](../../shared/document-loading.md#任务读取表)确定阶段。所有任务先读 [profile.json](profile.json)与[兼容性](compatibility.md)；只查询接口时不进入工程实施。

设计/实施先读[公共实现](implementation.md)、[资产说明](assets-catalog.md)、[回退](fallback.md)和[公共验收](performance-validation.md)。验证读取回退与公共验收，诊断读取[排障](troubleshooting.md)；只诊断请求不修改工程。

下表是条件必读索引：设计读候选场景的约束与资产说明；实施只读已确认场景的具体资产；验证只读实际启用场景的验收。公共要求与场景要求合并，同文件只读一次，不因读取可选场景而增加功能。

| 场景与加载条件 | 方案与实现 | 代码或配置资产 | 验收入口 |
|---|---|---|---|
| 静态快捷方式 `static-shortcut`；候选或已选静态入口时 | [静态配置与跳转](routes/static-shortcut.md) | [静态路线配置片段](routes/static-shortcut.md)、[资产说明](assets-catalog.md) | [静态入口与业务到达验收](performance-validation.md) |
| 动态快捷方式 `dynamic-shortcut`；候选或已选应用内加桌时 | [动态开发步骤](routes/dynamic-shortcut.md) | [动态路线调用片段](routes/dynamic-shortcut.md)；预置资源另读[静态配置](routes/static-shortcut.md) | [校验、用户确认与结果验收](performance-validation.md) |
| 查询、显隐、删除或设备支持查询；明确需要管理能力时 | [管理能力](management.md) | [管理调用片段](management.md) | [所选管理能力验收](performance-validation.md) |
| 图标资源；准备预置或自定义图标时 | [图标资源规范](assets-catalog.md#图标资源规范) | 工程实际媒体资源或沙箱文件 | [图标与解析验收](performance-validation.md) |

兼容性扫描/修复读取[扫描与回退方案](compatibility-audit.md)，再加载涉及的路线和可选管理能力。

## 来源与版本

核对日期：2026-11-04。主要依据用户提供的官网快照及 DesktopShortcut 示例，采用快照优先、冲突或变更再核验。能力包自包含，运行 Skill 不依赖仓库外部的原始 docs 目录。

- [创建静态快捷方式](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/typical-scenario-configuration)、[最佳实践](https://developer.huawei.com/consumer/cn/doc/doccenter-feature-dev/bpta-desktop-shortcuts)、[配置标签](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/module-configuration-file)、[官方示例](https://gitcode.com/harmonyos_samples/DesktopShortcut)。
- [应用内添加](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/appgallery-productview-addshortcut)、[productViewManager API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/store-productviewmanager)。
- [shortcutManager API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-shortcutmanager)、[查询已加桌](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/appgallery-productview-getshortcut)、[删除](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/appgallery-productview-removeshortcut)、[图标规范](https://developer.huawei.com/consumer/cn/doc/doccenter-ux-design/shortcat-0000002550987962)。
