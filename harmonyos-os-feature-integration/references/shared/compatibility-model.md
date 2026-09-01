# 兼容性模型

兼容性判断同时考虑本机 SDK 根清单 API、工程 compile/compatible/target API、应用模型、module 类型、组件体系、设备能力和运行时开关。

- `supported`：所选路线全部必要条件有工程证据。
- `conditional`：基础路线可用，但目标用法仍有明确条件。
- `upgrade_available`：工程 API 低于所有路线门槛，但可通过升级接入满足；不是终止结论。
- `unsupported`：所有路线均被已知工程事实排除，且升级无法补救（如 FA 模型）。
- `insufficient_context`：关键字段、本机 SDK 或根清单无法发现，不能可靠选路。

## 本机 SDK 前置门禁

- 先从显式 `--sdk`、工程 `local.properties` 的 `sdk.dir`/`hwsdk.dir` 或受支持环境变量定位 SDK；自动发现失败时要求提供路径，不扫描整块磁盘猜测安装位置。
- 只读取 SDK 根目录 `sdk-pkg.json` 取得本机 SDK API 与版本，不扫描 SDK 子包、声明文件或具体接口符号。
- 路线只有在本机 SDK API 和有效 compile API 均达到能力包 `routes[].minApi` 时才可进入候选集；工程未显式声明 `compileSdkVersion` 时，有效 compile API 来自已验证的活动 SDK，并标记为 `local-sdk-default`。仅有 `targetSdkVersion` 或 `compatibleSdkVersion` 不能证明本机可编译。
- `routes[].minApi` 表示“该特性路线的能力门槛”，不表示承载组件或所属组件家族的最早版本。能力包可用 `componentFamilyMinApi` 和 `componentBaselines` 记录组件事实，但这些字段不得降低特性路线门槛。例如 HDS 导航组件可早于沉浸光感材质存在。
- 具体接口是否存在不在路线阶段判断，由实施后的源码静态验证和真实工程构建确认。

## 升级接入（对所有特性通用）

任何已注册特性都支持“升级接入”：当工程或已验证的本机 SDK 低于路线所需 API 时，先安装或切换到达到路线 API 门槛的 SDK，再升级 `targetSdkVersion` 与 `compileSdkVersion` 至路线门槛来获得接口，`compatibleSdkVersion` 保持不变以继续兼容旧版本设备。

- 路线可用性按 `max(compatibleSdkVersion, targetSdkVersion)` 与各路线门槛（profile `routes[].minApi`）判定；
- `targetSdkVersion` 已达门槛而 `compatibleSdkVersion` 未达时，路线可用，但低版本设备必须使用能力包指定且在低版本可调用的 API 做运行时保护，并保留接入前的组件树、响应式布局和交互；仅增加材质的组件还应保留普通背景、边框等视觉样式；
- 升级 `targetSdkVersion` 可能伴随系统行为差异，方案中应说明回归验证范围；
- 存在升级选项或多条可用路线时，必须把可选接入方式、建议路线和理由列给用户，由用户决定路线；仅一条路线且无需升级时，说明建议路线和理由后继续。

## 所有特性的回退基线

所有能力包都必须声明 `fallbackPolicy.baseline: pre-integration-source-state`。旧系统、设备不支持、用户未授权、外部条件不满足或特性关闭时，回退分支继续使用接入前已有组件树或业务路径，保留适用的布局、状态、数据、控制器、事件、生命周期、异常行为和普通视觉样式。回退不是重新设计、简化或重写一套低版本代码；只允许不启用新特性。

例如源程序按断点、横竖屏或窗口模式切换底部/侧边导航时，低版本分支继续使用原有条件和属性组合；非 UI 特性也同样保留原数据流、授权拒绝、离线、异常和服务不可用路径。不要将“接口调用不报错”等同于“效果支持”。
