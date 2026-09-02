# 沉浸光感接入实现路由

本文件只负责实现资料分流。先完成[兼容性与选型](compatibility.md)，再按 `profile.json` 的 `selectedRoutes` 加载对应路线；不要因为工程达到 API 26 就停止加载仍被真实代码使用的 HDS 路线。

| 路线 | 必读实现 | 适用范围 |
|---|---|---|
| `hds` | [HDS 接入实现](routes/hds/implementation.md) | API 23+ 的 HDS 导航、标题栏、悬浮 `HdsTabs`、MiniBar |
| `arkui` | [ArkUI 接入入口](routes/arkui/implementation.md) | API 26+ 的原生 Navigation/Tabs、普通组件、菜单、弹窗和应用级材质；再按目标加载分类资料 |
| `hds + arkui` | 同时读取上述两个文件 | HDS 处理 HDS 组件，ArkUI 处理原生 ArkUI 组件；共享资料只读取一次 |

所有路线都必须读取[共享回退策略](shared/fallback.md)。验证和资产也按同一路线从[验证路由](performance-validation.md)与[资产路由](assets-catalog.md)加载。

路线资料是可组合的，不是互斥选项。组合实施时分别应用各自的版本门禁、导入、能力判断和静态检查，不把两代接口封装成一个动态类型接口。
