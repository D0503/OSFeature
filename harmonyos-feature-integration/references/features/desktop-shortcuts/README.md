# 桌面快捷方式（Desktop Shortcuts）

状态：`ready`。稳定 ID：`desktop-shortcuts`；机器规则见 [profile.json](profile.json)。快捷方式通过桌面入口拉起 UIAbility，再由应用现有导航进入业务目标。

## 路线与接入前澄清

两条路线可组合：`static-shortcut` 通过配置文件预置入口，用户长按应用图标查看或拖动加桌；`dynamic-shortcut` 通过应用内校验、用户点击与系统确认请求加桌。动态路线内部包含预置资源、自定义资源两种重载，不拆成额外路线；使用预置资源需复用静态配置，但不强制选中静态路线。

先从需求与工程确定目标 UIAbility、业务功能或内容、名称图标、入口位置、路线及是否需要管理能力；仅补问缺失的业务决定。多路线可用时按公共规则展示选项并由用户决定。用户只说“桌面快捷方式”时不能自行决定新增哪些入口。可选管理能力只在明确需要时实施，不默认创建管理页面。

普通键盘快捷键、系统桌面快捷键、应用安装图标、Form Kit 卡片和通用 App Linking 请求不自动命中。不要用卡片 API 或系统应用专用 launcherBundleManager 接口实现三方应用加桌。

## 按任务加载

合并[公共任务读取表](../../shared/document-loading.md#任务读取表)与下表，索引继续读到正文。选中路线分别加载；共用资料只读一次。

| 任务 | 必读资料 |
|---|---|
| 版本、应用类型、设备、权限、签名与外部条件 | [兼容性](compatibility.md) |
| 设计与实施 | [公共实施](implementation.md)、[资产目录](assets-catalog.md)、[回退](fallback.md)、[验收](performance-validation.md)，以及选中路线正文 |
| 静态路线 | [静态配置与资产](routes/static-shortcut.md) |
| 动态路线 | [动态流程与资产](routes/dynamic-shortcut.md)；预置资源另读静态路线的配置段落 |
| 查询、显示隐藏、删除或设备支持查询 | [管理能力](management.md)，仅按需加载 |
| 桌面图标格式、尺寸、分层资源与解析限制 | [图标资源规范](assets-catalog.md#图标资源规范) |
| 验证 | [验收与证据](performance-validation.md)，以及被验收路线正文 |
| 已接入工程的低版本回退扫描与修复 | [扫描与回退方案](compatibility-audit.md)、对应路线和可选能力资料 |
| 诊断 | [故障排查](troubleshooting.md)、对应兼容性与路线资料 |

## 来源与版本

核对日期：2026-11-04。主要依据用户提供的官网快照及 DesktopShortcut 示例，采用快照优先、冲突或变更再核验。能力包自包含，运行 Skill 不依赖仓库外部的原始 docs 目录。

- [创建静态快捷方式](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/typical-scenario-configuration)、[最佳实践](https://developer.huawei.com/consumer/cn/doc/doccenter-feature-dev/bpta-desktop-shortcuts)、[配置标签](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/module-configuration-file)、[官方示例](https://gitcode.com/harmonyos_samples/DesktopShortcut)。
- [应用内添加](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/appgallery-productview-addshortcut)、[productViewManager API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/store-productviewmanager)。
- [shortcutManager API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-shortcutmanager)、[查询已加桌](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/appgallery-productview-getshortcut)、[删除](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/appgallery-productview-removeshortcut)、[图标规范](https://developer.huawei.com/consumer/cn/doc/doccenter-ux-design/shortcat-0000002550987962)。
