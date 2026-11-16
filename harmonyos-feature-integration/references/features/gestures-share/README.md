# 隔空传送（Gestures Share）

状态：`ready`。稳定 ID：`gestures-share`；机器门禁见 [profile.json](profile.json)。Share Kit 通过“一抓一放”跨端传送当前页面的文件或链接；App Linking 链接可在接收端直达同一业务内容。

## 接入范围与澄清

唯一技术路线 `gestures-share`，API20 起。文件与链接是数据场景，可以在不同页面同时使用，不是两套互斥 API 路线。先定位用户指定页面、分享内容（文件/链接）、接收结果（收文件/打开内容）和已有分享入口。仅补问无法从需求与工程确认的业务项。需求包含链接直达时，配置应用的真实 HTTPS 域名关联，核对接收端参数解析与业务路由；缺失时完成可核实部分，记录外部阻断，不填示例域名冒充可用结果。

普通手势识别、拖拽、隔空截屏、碰一碰、系统分享面板和单独的 App Linking 不自动命中本能力。系统提供手势识别，不自行申请相机权限或实现手部识别。**隔空传送仅支持普通 Stage 应用，不支持元服务。** 目标工程为元服务时明确告知不支持并停止隔空接入。

## 按任务加载

按[任务读取表](../../shared/document-loading.md#任务读取表)确定阶段。所有任务先读 [profile.json](profile.json)与[兼容性](compatibility.md)；只查询接口时不进入工程实施。

设计/实施先读[公共实现](implementation.md)、[接入片段](implementation.md)、[回退](fallback.md)和[公共验收](performance-validation.md)。验证读取回退与公共验收，诊断读取[排障](troubleshooting.md)；只诊断请求不修改工程。

下表是条件必读索引：设计读候选场景的约束与资产说明；实施只读已确认场景的具体资产；验证只读实际启用场景的验收。公共要求与场景要求合并，同文件只读一次，不因读取可选场景而增加功能。

| 场景与加载条件 | 方案与实现 | 代码或配置资产 | 验收入口 |
|---|---|---|---|
| 当前页面传文件；分享内容已确定为文件时 | [监听、数据与生命周期](implementation.md) | [实现文件中的接入片段](implementation.md) | [抓取、接收与后台清理](performance-validation.md) |
| 当前页面传链接；分享内容已确定为链接时 | [链接数据与生命周期](implementation.md) | [实现文件中的接入片段](implementation.md) | [双端内容一致性](performance-validation.md) |
| 链接直达应用内容；明确要求 App Linking 时 | [域名关联与参数接收](app-linking.md) | [链接接入片段](app-linking.md) | [冷暖启动及双端验证](performance-validation.md)、[开发者配置指导](app-linking.md#接入完成后向开发者展示) |

隔空传送接入完成后，必须在交付回复中展示[手机设置和真机操作步骤](compatibility.md#系统设置和信任)，包含华为分享、隔空传送开关的设置路径、双端信任与“一抓一放”验证，文件传送和链接分享均须提醒。选择链接直达时，再按[开发者配置指导](app-linking.md#接入完成后向开发者展示)展示应用接收端的配置步骤、官网链接及“App Linking 只能使用手动签名，不能使用自动签名”的提醒；仅给本地文档链接不满足交付要求。未选择链接直达时保持可选，不要求完成无关平台配置。

## 来源与版本

隔空传送资料核对日期：2026-10-31；可选链接配置按2026-11-02官方正文补充。采用“快照优先，发生变更或冲突再核实”策略，双端运行效果须按验证方案实测。

- 官方[场景指南](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/gestures-share-scenes)、[API](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/share-harmony-share)、[设备开关](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/gestures-share-open)、[信任关系](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/gestures-share-trust)。相关规则见兼容性、实现与验证资料。
- 可选链接配置依据[应用链接指南](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/app-linking-startupapp)，正文核对日期为2026-11-02。元服务链接资料保留在该页末尾，作为独立场景的补充知识，按需读取。
- [SharedData API](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/share-system-share)、[App Linking](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/app-linking-startupapp)。
- 监听注册、数据构造与生命周期处理见[实现](implementation.md)。
