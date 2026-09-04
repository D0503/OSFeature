# 验证规则

验证层固定为 `static`、`sdk`、`build`、`install`、`runtime`、`visual`，状态固定为 `passed`、`failed`、`blocked`、`not_run`、`inconclusive`。

- static：运行场景静态规则并人工核对组件树、普通样式、状态与事件基线。低版本场景必须拒绝“只在 `systemMaterial` 参数内做版本三元判断”的伪保护。
- sdk：按路线核对本机声明。ArkUI 核对 API 26 的 `uiMaterial` 与组件属性；HDS 核对 6.1.0(23) 的 `@kit.UIDesignKit`、`hdsMaterial`、`SystemMaterialParams`、HdsNavigation 和 HdsTabs 字段。SDK 只能证明可用性，不能证明视觉行为。
- build：使用 `devecocli build` 真实构建。日志保留命令、退出码、时间与 SHA-256。
- install/runtime：仅当用户请求运行验证且恰好选择一个设备时使用 `devecocli run`；无设备不创建或下载模拟器，不使用 `--uninstall`。
- visual：截图、录屏、可复查日志或用户明确观察才算证据。没有观察证据时只能是 `not_run` 或 `inconclusive`。

HDS 自定义材质验证必须记录 `getSystemMaterialTypes()` 返回值或异常、最终 `MaterialType`/`MaterialLevel`、目标设备类型和视觉观察。PC/2in1 缺少查询证据、TV 上验证 HdsTabs 材质，均不能标记视觉通过。

所有必需层通过才是 `passed`。静态、SDK、构建通过但缺少必需运行/视觉证据时是 `build_passed_runtime_pending`。冲突场景运行成功且只匹配一个规范预期时是 `passed_with_spec_conflict`。观察无法区分多个预期时是 `inconclusive`；已执行的必需层失败为 `failed`；工程、SDK、授权、场景或设备前提使验证不能开始为 `blocked`。
