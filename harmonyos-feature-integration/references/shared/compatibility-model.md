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
- 路线只有在本机 SDK API 和有效 compile API 均达到能力包 `routes[].minApi` 时才可进入候选集；target API 按统一接入策略至少达到 requiredApi 与 minTargetApi 的最大值（未声明 minTargetApi 时使用 requiredApi）。工程未显式声明 `compileSdkVersion` 时，有效 compile API 来自已验证的活动 SDK，并标记为 `local-sdk-default`；不要为升级接入新增该配置。已有显式配置时仍按实际值校验，低于门槛时调整既有配置。仅有 `targetSdkVersion` 或 `compatibleSdkVersion` 不能证明本机可编译。
- `routes[].minApi` 表示“该特性路线的能力门槛”，不表示承载组件或所属组件家族的最早版本。能力包可用 `componentFamilyMinApi` 和 `componentBaselines` 记录组件事实，但这些字段不得降低特性路线门槛。例如 HDS 导航组件可早于沉浸光感材质存在。
- 具体接口是否存在不在路线阶段判断，由实施后的源码静态验证和真实工程构建确认。

## 升级接入（对所有特性通用）

任何已注册特性都支持“升级接入”。按 Skill 统一升级约定，已有及计划新增字段/API 共同确定 requiredApi；SDK／有效 compile 至少达到 requiredApi，target 至少达到 requiredApi 与已声明 minTargetApi 的最大值。已有更高版本不降低，compatible 保持原值，升级须用户确认。此为接入策略，不等同于接口另有官方 target 硬门槛。

requiredApi 为所选路线 minApi 与实际使用接口版本的最大值。源码扫描只反映已实现内容；方案阶段必须把计划新增接口及字段手动纳入计算，不能仅凭扫描结果判断无需升级。SDK、有效 compile 或 target 任一不足均提供升级选项；target 未知时先补齐证据。无需新增 compileSdkVersion 配置，已有显式配置不足时调整既有值。脚本的 upgradeCompileApi / requiredCompileApi 表示有效编译门槛，不要求写入 compileSdkVersion。

门禁结果中的 API 数值（包括 `upgradeTargetApi`）仅表示版本等级，不能据此推导工程配置的字段类型或版本写法。升级 `targetSdkVersion` 前，必须查阅目标 SDK 及配套构建工具对应版本的配置 schema、官方模板或官方配置文档，确认允许的类型、格式及版本映射后再写入。SDK 清单中的 API 等级或包版本本身不足以证明它就是该字段的合法值；不得自行拼接版本号或照搬其他 SDK 版本的格式。

格式示例：API 23 的 `"6.1.0(23)"` 与 API 26 的 `"26.0.0"` 体现了不同版本的写法差异，实际配置以目标版本规范为准，不能由示例外推其他版本。无法核实合法写法时，明确缺失的依据，不猜测写入。最低兼容版本未调整时保留其原值和格式，无需新增 `compileSdkVersion`。写入后重新执行检查和构建，确认配置被实际工具接受；脚本能解析出 API 等级不等于构建配置合法。

- 本机 SDK/compile 门槛按 `routes[].minApi` 判定；运行设备范围由 compatible/target 上下文决定，但 `routes[].minTargetApi` 是独立硬门槛，不能被较高的 compatible API 或应用级条件替代；
- `targetSdkVersion` 已达门槛而 `compatibleSdkVersion` 未达时，路线可用，但低版本设备必须使用能力包指定且在低版本可调用的 API 做运行时保护，并保留接入前的组件树、响应式布局和交互；仅增加材质的组件还应保留普通背景、边框等视觉样式；
- 升级 `targetSdkVersion` 可能伴随系统行为差异，方案中应说明回归验证范围；
- 存在升级选项或多条可用路线时，必须把可选接入方式、建议路线和理由列给用户，由用户决定路线；仅一条路线且无需升级时，说明建议路线和理由后继续。

## 所有特性的回退基线

回退粒度遵循能力包的专项规则：沉浸光感悬浮 Tab 仅在运行 API 低于路线门槛时保留原组件树及其设备适配；达到门槛时不按设备类型或断点分流，材质不可用或关闭仅在升级接入分支内回退材质。以下通用基线不得扩大该专项回退范围。

所有能力包都必须声明 `fallbackPolicy.baseline: pre-integration-source-state`。旧系统、设备不支持、用户未授权、外部条件不满足或特性关闭时，回退分支继续使用接入前已有组件树或业务路径，保留适用的布局、状态、数据、控制器、事件、生命周期、异常行为和普通视觉样式。回退不是重新设计、简化或重写一套低版本代码；只允许不启用新特性。

例如源程序按断点、横竖屏或窗口模式切换底部/侧边导航时，低版本分支继续使用原有条件和属性组合；非 UI 特性也同样保留原数据流、授权拒绝、离线、异常和服务不可用路径。不要将“接口调用不报错”等同于“效果支持”。
