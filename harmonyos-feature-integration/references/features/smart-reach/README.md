# 智感握姿

把高频且单手难触达的操作放到易操作区。智感握姿包括握持手识别与操作手（交互手）识别；两者不是同一个信号，不能互相冒充。只按用户指定的组件和范围接入；普通自适应布局、一般手势识别、窗口沉浸式和沉浸光感均不是本能力。

只有高频且单手难触达的操作组件才建议接入。低频、非操作类组件，以及广告或诱导类按钮（包括其“前往”“确认”“关闭”按钮）不建议接入，避免界面不稳定和用户困惑。

## 接入路线

各路线的版本门槛见下表，机器契约见 [profile.json](profile.json)。

| 路线 | 适用目标 | 最低 SDK/compile API |
|---|---|---|
| `native-component` 系统组件原生适配（如 HDS） | 提供原生跟手属性的组件；当前支持实例为 HdsTabs | 当前实例 23 |
| `operating-hand` 操作手感知 | 自定义组件需要随触控操作手变化 | 15 |
| `holding-hand` 握持手感知 | 自定义悬浮按钮等需要随握持手变化 | 20 |

三条路线可组合，例如导航栏由原生组件跟随操作手，侧边按钮由握持手事件驱动。一个组件只能有一个位置决策者，不自动订阅两种事件竞争位置。存在多条可用路线或升级选项时遵循主 Skill 的用户路线决策；不能按 API 大小替用户选择信号语义。

交互方式支持原组件位移，以及保留原组件并新增同步跟手组件；后者仅在用户明确选用时接入，两组共享业务状态与操作。选型与同步规则见 [跟手模式](implementation.md#跟手模式)。

## 按任务加载

按[任务读取表](../../shared/document-loading.md#任务读取表)确定阶段。所有任务先读 [profile.json](profile.json)与[兼容性](compatibility.md)；只查询接口时不进入工程实施。

设计/实施先读[公共实现](implementation.md)、[资产说明](assets-catalog.md)、[回退](fallback.md)和[公共验收](performance-validation.md)。验证读取回退与公共验收，诊断读取[排障](troubleshooting.md)；只诊断请求不修改工程。

下表是条件必读索引：设计读候选场景的约束与资产说明；实施只读已确认场景的具体资产；验证只读实际启用场景的验收。公共要求与场景要求合并，同文件只读一次，不因读取可选场景而增加功能。

| 场景与加载条件 | 方案与实现 | 代码或配置资产 | 验收入口 |
|---|---|---|---|
| 系统组件原生跟手 `native-component`；原生属性符合目标时 | [原生路线](routes/native-component/implementation.md) | [原生属性资产](routes/native-component/assets.md) | [原生验收](routes/native-component/validation.md) |
| 操作手感知 `operating-hand`；目标依据触控操作手移动时 | [操作手路线](routes/operating-hand/implementation.md) | [操作手资产与接入](routes/operating-hand/implementation.md#资产与接入) | [操作手验收](routes/operating-hand/validation.md) |
| 握持手感知 `holding-hand`；目标依据握持手移动时 | [握持手路线](routes/holding-hand/implementation.md) | [握持手资产与接入](routes/holding-hand/implementation.md#资产与接入) | [握持手验收](routes/holding-hand/validation.md) |
| 新增同步跟手组件；用户明确选择保留原入口并新增时 | [跟手模式与共同约束](implementation.md#跟手模式) | 所选感知路线资产，复用同一业务状态 | [同步、重复操作与真机验证](performance-validation.md) |

本包面向 Stage 应用的 entry/feature HAP。库内实现须追踪实际承载 HAP；权限不能在无关模块中补齐。无需因示例而增加账号、网络服务或第三方依赖；正常构建安装仍使用用户工程自身的 SDK、签名和设备。

## 已接入工程兼容性扫描

扫描或修复版本守卫与低版本回退时，读取[本特性扫描及回退策略](compatibility-audit.md)和[共享工作流](../../workflows/compatibility-audit.md)。仅检查不改工程；修复后要求高低版本实际运行验证。
