# 防窥保护 / DlpAntiPeep

通过 Device Security Kit 感知屏幕窥视状态，按业务需要隐藏敏感内容或通过系统蒙层保护应用窗口。普通防截屏、密码遮罩和自定义隐私按钮不自动命中。契约见 [profile.json](profile.json)。

**防窥保护不支持元服务。** 接入前核对目标应用形态；目标为元服务时，明确告知不支持并停止防窥接入，不能因使用 Stage 模型或满足 API 版本就认定可用。设备和其他前提见[兼容性](compatibility.md)。

## 按任务加载

按[任务读取表](../../shared/document-loading.md#任务读取表)确定阶段。所有任务先读 [profile.json](profile.json)与[兼容性](compatibility.md)；只查询接口时不进入工程实施。

设计/实施先读[公共实现](implementation.md)、[资产说明](assets-catalog.md)、[回退](fallback.md)和[公共验收](performance-validation.md)。验证读取回退与公共验收，诊断读取[排障](troubleshooting.md)；只诊断请求不修改工程。

下表是条件必读索引：设计读候选场景的约束与资产说明；实施只读已确认场景的具体资产；验证只读实际启用场景的验收。公共要求与场景要求合并，同文件只读一次，不因读取可选场景而增加功能。

| 场景与加载条件 | 方案与实现 | 代码或配置资产 | 验收入口 |
|---|---|---|---|
| 状态查询或监听；设计保护内容、实施状态感知时 | [场景选择](scenarios.md)、[开发步骤](implementation.md) | [工具说明](assets-catalog.md)、[AntiPeepUtils.ets](assets/AntiPeepUtils.ets)，只取所需函数 | [状态响应与内容保护](performance-validation.md) |
| 系统防窥蒙层；明确选择该能力时 | [开发步骤中的蒙层分支](implementation.md#6-按需增加系统蒙层) | [工具说明](assets-catalog.md)、[AntiPeepUtils.ets](assets/AntiPeepUtils.ets) | [目标窗口与失败场景](performance-validation.md) |
| 设置弹窗或风险提示；请求或方案涉及对应可选能力时 | [设置与提示](settings-and-information.md) | [主动开启步骤](implementation.md#可选用户主动开启防窥)、[工具说明](assets-catalog.md) | [所选能力的验收](performance-validation.md) |

## 接入前澄清

用户仅提出“接入防窥保护”等模糊需求，或以下任一选择尚不明确时，实施前必须主动询问。沿用用户已经明确的保护范围和能力选择，只补问缺失项；未确认前不修改工程，不默认接入全部可选能力，也不默认只做状态感知。

| 需要确认的内容 | 询问方式与版本说明 |
|---|---|
| 保护目标 | 需要保护哪些页面、窗口或敏感内容？基础状态查询与监听需要 API20；内容隐藏、暂停或恢复沿用已确认的业务策略。 |
| 系统防窥蒙层 | 是否需要在检测到窥视时，对目标窗口拉起系统防窥蒙层？该接口需要 API21；不需要时，仅按已确认策略处理内容。 |
| 引导开启防窥的设置弹窗 | 是否需要用户主动操作应用内入口，拉起系统弹窗引导开启当前应用防窥开关？该接口及结果枚举需要 API23；低版本通过系统设置指引开启。 |

提问时一并说明上述版本条件；设置弹窗指 `requestAntiPeepOptions`，不代表 ACL 权限申请。蒙层与设置弹窗分别确认，可以独立选择，不能因选择其中一项就自动添加另一项。用户只要求状态查询或监听且已明确不需要可选能力时，按该范围接入。

等待澄清期间可只读检查工程与本机 SDK，核对编译版本、兼容版本及用户期望支持的运行版本。所选接口的编译 SDK 和实际调用时的运行 API 均须达到门槛；完整工具文件另需 API23 编译 SDK，低版本按[开发步骤](implementation.md)提取所需函数。版本不足时说明升级或低版本保留行为的选项，由用户确认后实施，不自行提高最低兼容版本。确定范围后，再按[场景选择](scenarios.md)和[兼容性](compatibility.md)落实路线、设备能力及运行版本保护。

实施前与交付时按[权限与提醒要求](compatibility.md#权限声明与-acl)向开发者说明本次路线的权限条件和申请入口。

资料依据为 2026-10-20 的官方文档本地快照及配套示例：

| 来源 | 用途 |
|---|---|
| [开发指南](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/devicesecurity-dlpantipeep) | 系统设置、人脸识别、ACL、接入流程 |
| [API 参考](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/devicesecurity-dlpantipeep-api) | 逐项 API20/21/23 门槛、参数、枚举和错误码 |
| [防窥保护最佳实践](https://developer.huawei.com/consumer/cn/doc/doccenter-advanced-features/bpta-antipeep-protection) | 金融、短视频、即时通讯场景及页面内蒙层去重 |
| [AntiPeep 官方示例](https://gitcode.com/HarmonyOS_Samples/AntiPeep) | 敏感字段状态更新、窗口 ID、生命周期和签名配置参考 |

接口最低版本按 API 参考逐项判断；示例自身的 HarmonyOS/SDK 6.0.2 Release 要求不等于所有接口的起始版本。示例中的财务数据、页面、弹窗和布局不是接入要求。核心保护不依赖示例业务或本机文档路径。

## 已接入工程兼容性扫描

扫描或修复版本守卫与低版本回退时，读取[本特性扫描及回退策略](compatibility-audit.md)和[共享工作流](../../workflows/compatibility-audit.md)。仅检查不改工程；修复后要求高低版本实际运行验证。
