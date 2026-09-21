# 兼容性与门禁

| 能力 | 最低 API | 判定 |
|---|---|---|
| entry 的 easyGo 开发者配置，Router 或 Navigation 分栏 | 23 | SDK 根清单与有效 compile 均达到 23 |
| UIContext.isEasySplit() | 24 | 仅在调用该接口时要求 SDK/compile 24；运行 API 低于 24 时不得调用 |
| mode、pagePairs、transPages、wideSplit/squareSplit、splitDividerColor、drawableRectHook、enableInSplitScreen | 26 | 使用任意字段即要求 SDK/compile 26，不把购物示例当作 API 23 模板 |

基础路线 `minApi: 23`；已配置增强字段或状态查询时，扫描输出的 `requiredApi` 上调到 24/26。计划新增但尚未写入的字段也必须按此表先判门槛。`targetSdkPolicy: preserve-unless-declared` 表示本资料未声明额外 target 要求：保留已有 target，不把 SDK/compile 门槛冒充 target 门槛。compatible 保留原值；低版本实际行为需回归，尤其旧系统如何处理高版本 JSON 字段不能仅凭编译通过推断。

## 新接入版本建议

为默认开启 enableReducedContainerSize 和 drawableRectHook，API 23～25 工程优先建议升级本机 SDK 与 compile 到 26，升级需用户选择；选择保持旧版本时仅开启前者，省略后者。compatible 保持原值，target 无独立要求时保持。工具计算的 requiredApi 描述已有配置/调用，计划新增字段由 AI 按 [配置确认](configuration-confirmation.md) 提前纳入方案。显式 false 不是非法值；API 26 字段即便填 false 也不能写入低版本配置。

## 设备与窗口

- `common` 是默认设备配置；`phone`、`tablet` 一旦存在，分别完全替代 common，不做字段继承。
- 宽屏窗口宽度至少 600vp，且宽/高 > 1.2；方形窗口宽度至少 600vp，且高/宽 ≤ 1.2、宽/高 ≤ 1.2。两者分别配置，不能用“设备是折叠屏”替代窗口判断。
- 自由多窗暂不支持。窗口分屏默认不进入平行视界；API 26 的 `enableInSplitScreen: true` 允许满足尺寸条件时进入，不代表支持自由多窗。
- 折叠手机、平板按实际 device type、系统版本、形态、窗口和用户开关验证。其他设备及元服务在现有资料中未获得支持结论，标记 unknown。
- `original` 关闭对应窗口显示模式的兼容行为；系统开关关闭或条件不满足时保留原应用路径。

## 路由与应用条件

仅 entry 模块可配置，应用级生效；不得写在 ability、feature 或共享模块中。同一显示配置不能同时包含 routerSplitOptions 与 navigationSplitOptions；工程混用两套路由可能异常，应先确认目标和实际调用链，不自动重构路由框架。

工程版本不足给出升级选项和回归范围；FA 模型、没有 entry 的工程不直接实施。文档未说明的权限、授权和外部条件不能猜测补齐。安装验证仍依赖可用构建、签名与目标设备。
