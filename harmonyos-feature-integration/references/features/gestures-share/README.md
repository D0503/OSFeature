# 隔空传送（Gestures Share）

状态：`ready`。稳定 ID：`gestures-share`；机器门禁见 [profile.json](profile.json)。Share Kit 通过“一抓一放”跨端传送当前页面的文件或链接；App Linking 链接可在接收端直达同一业务内容。

## 接入范围与澄清

唯一技术路线 `gestures-share`，API20 起。文件与链接是数据场景，可以在不同页面同时使用，不是两套互斥 API 路线。先定位用户指定页面、分享内容（文件/链接）、接收结果（收文件/打开内容）和已有分享入口。仅补问无法从需求与工程确认的业务项。需求包含链接直达时，先确定接收目标：应用配置真实 HTTPS 域名关联；元服务配置平台生成并发布的元服务链接，以及动态或静态参数接收。两者均须核对接收端路由；缺失时完成可核实部分，记录外部阻断，不填示例域名冒充可用结果。

普通手势识别、拖拽、隔空截屏、碰一碰、系统分享面板和单独的 App Linking 不自动命中本能力。系统提供手势识别，不自行申请相机权限或实现手部识别。隔空传送监听当前覆盖普通 Stage 应用。可选链接资料分别说明应用与元服务作为接收目标的配置；元服务作为发送端订阅隔空事件的适用性仍须独立核实。

## 按任务加载

按[任务读取表](../../shared/document-loading.md#任务读取表)合并公共与路线资料，索引须继续读取到相关正文。方案设计先读取 [实现约束](implementation.md)、[回退](fallback.md)和[双端验证](performance-validation.md)；链接直达涉及时另读[App Linking](app-linking.md)；不因设计读取而实施可选功能。

| 任务 | 资料 |
|---|---|
| 版本、设备、开关、权限与账号 | [兼容性与前置条件](compatibility.md) |
| 页面或 VM 内的监听、文件/链接数据与生命周期 | [实现](implementation.md) |
| 可选 App Linking：应用域名关联、元服务平台链接与参数接收 | [链接直达](app-linking.md) |
| 旧版本、能力不足与异常处理、回退实测 | [回退规则](fallback.md) |
| 静态、构建、双端运行及负向验收 | [验证](performance-validation.md) |
| 已接入工程扫描与回退判定 | [扫描与回退](compatibility-audit.md) |
| 故障定位 | [排障](troubleshooting.md) |

隔空传送接入完成后，必须在交付回复中展示[手机设置和真机操作步骤](compatibility.md#系统设置和信任)，包含华为分享、隔空传送开关的设置路径、双端信任与“一抓一放”验证，文件传送和链接分享均须提醒。选择链接直达时，再按[开发者配置指导](app-linking.md#接入完成后向开发者展示)展示对应应用或元服务的配置步骤、官网链接及“App Linking 只能使用手动签名，不能使用自动签名”的提醒；仅给本地文档链接不满足交付要求。未选择链接直达时保持可选，不要求完成无关平台配置。

## 来源与版本

隔空传送资料核对日期：2026-10-31；可选链接配置按2026-11-02官方正文补充。采用“快照优先，发生变更或冲突再核实”策略，双端运行效果须按验证方案实测。

- 官方[场景指南](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/gestures-share-scenes)、[API](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/share-harmony-share)、[设备开关](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/gestures-share-open)、[信任关系](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/gestures-share-trust)。相关规则见兼容性、实现与验证资料。
- 可选链接配置依据[应用链接指南](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/app-linking-startupapp)和[元服务链接指南](https://developer.huawei.com/consumer/cn/doc/doccenter-atomic-service/atomic-applinking)，正文核对日期为2026-11-02。
- [SharedData API](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/share-system-share)、[App Linking](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/app-linking-startupapp)。
- 监听注册、数据构造与生命周期处理见[实现](implementation.md)。
