# 兼容性与前置条件

## 版本矩阵

| 范围 | 门槛 | 依据与使用规则 |
|---|---|---|
| 静态基础配置 | API9 | Stage 模型基础标签 shortcutId/label/icon/wants；通过 wants.parameters 携带字符串业务参数 |
| 动态预置资源／自定义资源校验与请求 | API14（5.0.2） | 两种 checkPinShortcutPermitted 重载及 requestNewPinShortcut |
| visible 配置字段 | API20 起生效 | 直接配置，低版本自动兼容，无需运行时守卫；不参与路线 requiredApi |
| 配置查询与显示隐藏接口 | API20 | getAllShortcutInfoForSelf、setShortcutVisibleForSelf，按运行版本保护调用 |
| 已加桌查询与删除 | API24（6.1.1） | getPinShortcutInfos、removePinShortcut |
| 设备支持查询 | API26 | isShortcutSupported |

各版本来源从[能力入口](README.md#来源与版本)回溯。`requiredApi` 取所选路线及实际使用运行接口的最高门槛；`visible` 的 `sinceApi` 仅记录字段生效版本。计划新增的可选接口尚未出现在源码时，AI 必须先计算门槛；不能只运行扫描后按基础 API 写入新符号。SDK/compile/target 升级沿用[公共兼容策略](../../shared/compatibility-model.md)，需用户确认，保留已有更高版本与 compatible。编译 SDK 不含符号时不以运行守卫代替编译支持；按版本提取资产，避免低版本文件导入新接口。

## 工程、设备与环境

- Stage 工程，定位真实 entry HAP 的桌面入口 UIAbility；多 HAP 的静态入口配置仍在 entry，目标模块与 Ability 必须来自真实产物。HAR/HSP 不是桌面入口。复用既有构建、签名与部署，不新增平台依赖或权限。
- 静态配置示例声明无相关权限；在目标设备桌面验证入口展示、拖动加桌与点击启动。
- 动态路线要求 Phone、Tablet、PC/2in1 真机及可用 AppGallery 服务；不支持模拟器。概览声称服务在 API22 起支持 TV，但具体校验 API 在 TV 返回错误，请求 API 无响应，因此本包不将 TV 列为动态加桌支持设备。
- 不凭“元服务同为 Stage”推定快捷方式支持；目标工程为 atomicService 或应用类型未知时，先核实真实入口、设备及接口支持，不能借用其他产品能力作为证明。
- 动态加桌具有系统确认流程，拒绝是正常结果；不自动申请 ACL。静默删除仅在用户明确需要时按[管理指引](management.md)申请对应开放能力。
- 名称与图标复用既有业务资源。静态入口最多展示4个，应用内请求加桌单应用最多2个；不能相加为6个的全局配额承诺，也不把可见入口数量等同于当前已加桌数量。
- API26 可选查询返回 false 时保留原业务入口；低版本不调用该接口，也不能把缺少该接口判为设备不支持。
