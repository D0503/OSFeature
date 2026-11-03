# 兼容性与前置条件

## 版本门禁

| 接口/条件 | 来源结论 |
|---|---|
| `harmonyShare.on/off('gesturesShare', callback)` | HarmonyOS 6.0.0 / API20，Stage |
| `on/off('gesturesShare', SendCapabilityRegistry, callback)` | API20，按目标窗口注册 |
| `SharableTarget.share(SharedData)` | API12 起，不可用此较早版本降低隔空传送路线门槛 |
| `SharableTarget.reject(SharableErrorCode)` | API15 起，路线内仍整体要求 API20 |
| SysCap | `SystemCapability.Collaboration.HarmonyShare` |
| App Linking 应用链接 | API12 起；与隔空事件的 API20 门槛分别判断 |
| 元服务链接（接收目标） | API12 起支持 Phone/Tablet；不代表元服务可订阅隔空事件 |

API 文档标注 Phone、Tablet、PC/2in1，不能据此认定所有型号具备隔空手势硬件。TV 上 App Linking 可用不代表隔空传送可用。设备型号、系统实际能力和双端传送需真机验证；模拟器仅用于能独立完成的链接解析/布局检查，不能验收“一抓一放”。

本机 SDK 根清单与有效 compile 至少 API20；通用接入策略还要求 target 至少20，不代表官方额外 target 硬门槛。不足时提供升级选项并保留 compatible 原值。SDK26.0.0+ 编译时优先使用 `deviceInfo.apiAvailable('6.0.0')` 检查隔空传送的发行版门槛；旧编译 SDK 尚无该接口时沿用已有版本判断。低版本运行时先检查版本，再检查 SysCap，保护注册、退订与所有增强调用；编译门禁不能替代运行保护。

承载为普通 Stage 应用的 entry/feature HAP；HAR/HSP 中的工具沿依赖追到宿主。元服务作为发送端的隔空监听支持待补充官方依据。接收目标为元服务时使用[元服务链接配置](app-linking.md#元服务配置)，不把接收端链接支持当作发送端监听支持。

## 系统设置和信任

隔空传送接入完成后，交付回复必须主动向开发者展示以下手机设置和操作步骤，文件传送与链接分享均适用；不能只在能力包内记录前置条件或仅给本地文档链接：

1. 准备支持隔空传送的双端真机，保持亮屏、解锁，并确认双端已开启华为分享。
2. 在参与调试的手机上进入 **设置 → 系统 → 快捷启动和手势 → 隔空传送**，开启隔空传送开关；双端均为手机时分别确认。其他接收设备按其实际设置入口确认支持并启用对应能力。官网：[打开设备侧隔空传送开关](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/gestures-share-open)。
3. 同一华为账号设备默认可信；不同账号按系统提示在双端确认信任，确认后1小时内再次传输无需确认。账号相同不是强制前提，拒绝或取消时尊重用户选择。官网：[可信任设备间传输](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/gestures-share-trust)。
4. 发送端进入本次已接入的可分享页面，由开发者本人完成抓取、在接收端释放的“一抓一放”操作，并核对接收的文件或链接内容。

手机设置由开发者手动操作，应用不伪造开关查询或切换 API，不自动确认信任；未开启、未确认或未完成动作时如实记录待操作或待验证，不能宣称传送已通过。

隔空截屏与隔空传送使用相同手势。系统是否生成/保存截屏取决于两个开关及当前场景；截图保存提示不是应用分享数据接收成功证据。已注册页面可同时出现截屏提示，验收必须区分传送的业务链接/原文件与截屏。

## 权限、签名和服务

隔空传送本身沿用工程原有签名方式，手动签名限制仅在接入 App Linking 链接直达时提示。

给定 `gesturesShare on/off` 与基础 `share` API 未列出额外 ACL 或相机运行时权限，不照搬防窥权限。文件读取、下载或媒体访问只按实际数据来源申请已有业务所需权限；不为传送增加无关权限。

应用链接直达要求开通服务、域名关联发布、HTTPS 落地内容和手动签名，应用 App Linking 服务地区为中国境内（不含港澳台）。元服务链接要求企业开发者账号、已创建目标元服务、平台链接已发布且在有效期内；不套用应用自有域名关联流程。按接收目标读取[可选链接配置](app-linking.md)，相应条件不强加给文件传送和普通链接分享。`appLaunchTrustInfo` 是企业受限能力，需要独立 ACL，本包不使用，也不将其与双端设备信任混为一谈。

事实来源：入口列出的 harmonyShare API、开关/信任指南；App Linking 官方简介和开通服务快照。出现 SDK 声明与快照冲突时按实际目标 SDK 复核具体重载，并记录差异。
