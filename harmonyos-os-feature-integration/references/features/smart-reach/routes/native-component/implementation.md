# 系统组件原生适配（如 HDS）

当前支持的实例为 HdsTabs API 23+，不能将路线名称当作全部系统组件均支持的承诺。其他组件先确认对应版本的接口支持再接入，不类推普通 ArkUI Tabs 的同名属性。

已有 HdsTabs 悬浮栏时，合并 `barFloatingStyle` 中的 `adaptToHandedness: true`，保留其原有字段；配置 `barOverlap(true)`、`vertical(false)`、`barPosition(BarPosition.End)`。不是 `.adaptToHandedness(true)` 独立链式方法。底部间距、安全区和滚动尾部避让复用工程现有方案，不重复增加 padding。

原生组件路线无需声明感知权限。内部跟随的是操作手，无需应用手动订阅 `operatingHandChanged` 或 `holdingHandChanged`。本路线不要求新增沉浸光感材质、MiniBar 或业务页。

需要替换普通 Tabs 时先确认目标改动范围，保留原控制器语义、选中项、事件、状态和旧版本分支。API 23 门槛保护整个新增调用链。默认跟手值为 false；恢复原值时还要对照原布局，见 [回退](../../fallback.md)。不支持硬件可能只停止跟手而保留悬浮外观，这种差异必须实测，不虚构原生硬件能力查询。

按 [资产](assets.md) 合并最小片段，并执行 [验证](validation.md)。
