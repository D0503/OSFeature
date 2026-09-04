# 沉浸光感能力包

这是 `code-development-validation` 的沉浸光感能力包，支持两条彼此独立的 Stage 模型路线：

- `arkui-api26`：ArkUI `uiMaterial.ImmersiveMaterial`、组件 `systemMaterial` 和应用级 metadata。
- `hds-api23`：HDS 6.1.0(23) 的 `@kit.UIDesignKit`、`TitleBarStyleOptions.systemMaterialEffect` 与 `HdsTabsFloatingStyle.systemMaterialEffect`。

HDS 规范来源固定为华为开发者官网：[沉浸光感指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ui-design-hds-component-material)、[hdsMaterial API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsmaterial)、[HdsNavigation API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsnavigation) 和 [HdsTabs API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdstabs)。对应正文哈希、抓取时间和更新时间记录在 `capability-lock.json`；运行时使用锁定事实，不重新抓取或接受第三方页面覆盖。

执行时依次读取 `profile.json`、`facts.json`、`scenarios.json`、[实施规则](implementation.md) 与 [验证规则](validation.md)。先由自然语言目标解析唯一场景和路线；只有两者唯一时才能修改工程。不得把 ArkUI 的 `uiMaterial`、应用级开关或 `systemMaterial` 规则套用到 HDS，也不得把 HDS 的 `hdsMaterial`、`systemMaterialEffect` 或 6.1.0(23) 门槛套用到 ArkUI。能力包的 `ready` 表示可以执行，不代表视觉行为已经在当前设备确认。

应用级 `disable` 在规范中有两条冲突陈述。实施时保留两种运行预期，通过同一探针观察；不得在修改代码前选定其中一条，也不得用 SDK 类型声明冒充运行裁决。

资产是最小参考片段。按目标工程已有命名、状态和组件树做局部合并，不复制整个页面，不覆盖无关代码。
