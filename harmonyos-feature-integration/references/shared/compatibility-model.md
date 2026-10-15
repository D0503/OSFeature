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
- 路线只有在本机 SDK API 和有效 compile API 均达到能力包 `routes[].minApi` 时才可进入候选集；路线声明 `minTargetApi` 时，target API 也必须单独达到该值。工程未显式声明 `compileSdkVersion` 时，有效 compile API 来自已验证的活动 SDK，并标记为 `local-sdk-default`；不要为升级接入新增该配置。已有显式配置时仍按实际值校验，低于门槛时调整既有配置。仅有 `targetSdkVersion` 或 `compatibleSdkVersion` 不能证明本机可编译。
- `routes[].minApi` 表示“该特性路线的能力门槛”，不表示承载组件或所属组件家族的最早版本。能力包可用 `componentFamilyMinApi` 和 `componentBaselines` 记录组件事实，但这些字段不得降低特性路线门槛。例如 HDS 导航组件可早于沉浸光感材质存在。
- 具体接口是否存在不在路线阶段判断，由实施后的源码静态验证和真实工程构建确认。

## 升级接入（对所有特性通用）

任何已注册特性都支持“升级接入”：当工程或已验证的本机 SDK 低于路线所需 API 时，先安装或切换到达到路线 `minApi` 的 SDK，无需显式配置 `compileSdkVersion`，按路线要求将 `targetSdkVersion` 升至 `minTargetApi`（未声明时使用 `minApi`），`compatibleSdkVersion` 保持不变以继续兼容旧版本设备。能力包声明 `targetSdkPolicy: preserve-unless-declared` 时，未声明 minTargetApi 就保持原 target，不推断额外门槛。可选字段/API 的 requiredApi 高于路线 minApi 时，以 requiredApi 作为 SDK/有效 compile API 要求。脚本的 `upgradeCompileApi` / `requiredCompileApi` 表示有效编译版本门槛，不表示必须写入 `compileSdkVersion`。

门禁结果中的 API 数值（包括 `upgradeTargetApi`）仅表示版本等级，不能据此推导工程配置的字段类型或版本写法。升级 `targetSdkVersion` 前，必须查阅目标 SDK 及配套构建工具对应版本的配置 schema、官方模板或官方配置文档，确认允许的类型、格式及版本映射后再写入。SDK 清单中的 API 等级或包版本本身不足以证明它就是该字段的合法值；不得自行拼接版本号或照搬其他 SDK 版本的格式。

格式示例：API 23 的 `"6.1.0(23)"` 与 API 26 的 `"26.0.0"` 体现了不同版本的写法差异，实际配置以目标版本规范为准，不能由示例外推其他版本。无法核实合法写法时，明确缺失的依据，不猜测写入。最低兼容版本未调整时保留其原值和格式，无需新增 `compileSdkVersion`。写入后重新执行检查和构建，确认配置被实际工具接受；脚本能解析出 API 等级不等于构建配置合法。

- 本机 SDK/compile 门槛按 `routes[].minApi` 判定；运行设备范围由 compatible/target 上下文决定，但 `routes[].minTargetApi` 是独立硬门槛，不能被较高的 compatible API 或应用级条件替代；
- `targetSdkVersion` 已达门槛而 `compatibleSdkVersion` 未达时，路线可用，但低版本设备必须使用能力包指定且在低版本可调用的 API 做运行时保护，并保留接入前的组件树、响应式布局和交互；仅增加材质的组件还应保留普通背景、边框等视觉样式；
- 升级 `targetSdkVersion` 可能伴随系统行为差异，方案中应说明回归验证范围；
- 存在升级选项或多条可用路线时，必须把可选接入方式、建议路线和理由列给用户，由用户决定路线；仅一条路线且无需升级时，说明建议路线和理由后继续。

## 所有特性的回退基线

所有能力包都必须声明 `fallbackPolicy.baseline: pre-integration-source-state`。旧系统、设备不支持、用户未授权、外部条件不满足或特性关闭时，回退分支继续使用接入前已有组件树或业务路径，保留适用的布局、状态、数据、控制器、事件、生命周期、异常行为和普通视觉样式。回退不是重新设计、简化或重写一套低版本代码；只允许不启用新特性。

例如源程序按断点、横竖屏或窗口模式切换底部/侧边导航时，低版本分支继续使用原有条件和属性组合；非 UI 特性也同样保留原数据流、授权拒绝、离线、异常和服务不可用路径。不要将“接口调用不报错”等同于“效果支持”。
