# 兼容性模型

兼容性判断同时考虑最低 API、目标 API、应用模型、module 类型、组件体系、设备能力和运行时开关。

- `supported`：所选路线全部必要条件有工程证据。
- `conditional`：基础路线可用，但目标用法仍有明确条件。
- `upgrade_available`：工程 API 低于所有路线门槛，但可通过升级接入满足；不是终止结论。
- `unsupported`：所有路线均被已知工程事实排除，且升级无法补救（如 FA 模型）。
- `insufficient_context`：关键字段无法发现，不能可靠选路。

## 升级接入（对所有特性通用）

任何已注册特性都支持“升级接入”：当工程 `compatibleSdkVersion` 低于路线所需 API 时，可升级 `targetSdkVersion` 与 `compileSdkVersion` 至路线门槛来获得接口，`compatibleSdkVersion` 保持不变以继续兼容旧版本设备。

- 路线可用性按 `max(compatibleSdkVersion, targetSdkVersion)` 与各路线门槛（profile `routes[].minApi`）判定；
- `targetSdkVersion` 已达门槛而 `compatibleSdkVersion` 未达时，路线可用，但低版本设备必须做运行时版本保护（如 `deviceInfo.apiAvailable`），并保留普通背景、边框等降级样式；
- 升级 `targetSdkVersion` 可能伴随系统行为差异，方案中应说明回归验证范围；
- 存在升级选项或多条可用路线时，必须把可选接入方式、建议路线和理由列给用户，由用户决定路线；仅一条路线且无需升级时，说明建议路线和理由后继续。

旧系统与不支持设备必须有降级；不要将“接口调用不报错”等同于“效果支持”。
