# 验证规则

验证层固定为 `static`、`sdk`、`build`、`install`、`runtime`、`visual`，状态固定为 `passed`、`failed`、`blocked`、`not_run`、`inconclusive`。

- static：运行场景静态规则并人工核对组件树、普通样式、状态与事件基线。
- sdk：核对本机 API 26 声明中的类型、成员和组件属性；只能证明可用性，不能证明视觉行为。
- build：使用 `devecocli build` 真实构建。日志保留命令、退出码、时间与 SHA-256。
- install/runtime：仅当用户请求运行验证且恰好选择一个设备时使用 `devecocli run`；无设备不创建或下载模拟器，不使用 `--uninstall`。
- visual：截图、录屏、可复查日志或用户明确观察才算证据。没有观察证据时只能是 `not_run` 或 `inconclusive`。

所有必需层通过才是 `passed`。静态、SDK、构建通过但缺少必需运行/视觉证据时是 `build_passed_runtime_pending`。冲突场景运行成功且只匹配一个规范预期时是 `passed_with_spec_conflict`。观察无法区分多个预期时是 `inconclusive`；已执行的必需层失败为 `failed`；工程、SDK、授权、场景或设备前提使验证不能开始为 `blocked`。
