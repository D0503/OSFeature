# 沉浸光感能力包

这是 `code-development-validation` 的首个已发布能力包，只支持 ArkUI API 26、Stage 模型。HDS API 23 不属于本包，也不得由执行者自行补入。

执行时依次读取 `profile.json`、`facts.json`、`scenarios.json`、[实施规则](implementation.md) 与 [验证规则](validation.md)。先用注册表解析场景；只有唯一场景时才能修改工程。能力包的 `ready` 表示可以执行，不代表视觉行为已经在当前设备确认。

应用级 `disable` 在规范中有两条冲突陈述。实施时保留两种运行预期，通过同一探针观察；不得在修改代码前选定其中一条，也不得用 SDK 类型声明冒充运行裁决。

资产是最小参考片段。按目标工程已有命名、状态和组件树做局部合并，不复制整个页面，不覆盖无关代码。
