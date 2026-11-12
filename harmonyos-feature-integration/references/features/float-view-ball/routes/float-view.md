# 独立闪控窗（float-view）

本路线用于独立闪控窗。先明确展示内容、宿主页面、模板、开启入口及结束展示的时机。窗球切换按[绑定路线](binding.md)接入。

## 开发准备

先确定展示内容、页面路径、模板、用户开启入口和结束展示的时机。复用原工程业务状态与导航，控制器的持有者需覆盖跨应用展示期。

首次修改前按[权限与提醒要求](../compatibility.md#权限声明acl-与用户授权)向开发者说明本次路线的权限条件和申请入口。

需要 API26 编译 SDK 和运行系统、Stage 模型及有效 `UIAbilityContext`。按兼容性文档核对设备与窗口模式，不推定模拟器可用。版本升级遵循[通用兼容性规则](../../../shared/compatibility-model.md#升级接入对所有特性通用)，低版本或不支持时沿用原业务。仅允许应用在前台启动；同应用只启动一个闪控窗，已有闪控球或画中画时需先完成停止。

## 读取知识库正文

按[知识库查询流程](../../../workflows/knowledge-query.md)读取下表中当前任务所需标题的正文。

| 查询标题 | 加载条件 |
| --- | --- |
| 独立闪控窗接入与生命周期 | 独立闪控窗接入必读。窗球绑定按需取窗端权限、页面和初始尺寸。防窥联动按需核对窗口状态与 ID。 |
| 闪控窗模板切换与页面避让 | 处理页面避让、展开／收起、模板或尺寸调整、控件遮挡时读取。 |
| 闪控窗屏幕尺寸与断点响应 | 窗需随折叠、旋转、分屏或已有断点状态更新时读取。 |
| 闪控窗恢复主窗口与导航 | 需要从窗内点击恢复应用或导航到指定页面时读取。 |

## 读取本地资产并接入

按[闪控窗资产索引](../assets-catalog.md#闪控窗)读取 [FloatViewController.ets](../assets/FloatViewController.ets)，以实际源码核对参数、回调和清理行为。

采用资产时，保留知识库示例中的页面、参数和状态判断，将控制器操作映射到资产方法。每个控制器只由资产创建一次，资产统一持有控制器并管理内部监听，业务通过资产回调接入。知识库中的 `floatView.create()` 和内部监听注册由 `FloatViewController.createFloatView(...)` 承接。

以下示例展示如何按知识库步骤调用本地资产。将片段合入用户开启闪控窗的处理方法，复用工程已有的防重复操作和异步错误处理。从资产导入 `FloatViewController` 和独立函数 `requestFloatViewPermission`，按知识库正文准备参数。

```
private async createWindow(): Promise<void> {
  try {
    if (!FloatViewController.canUseFloatView()) { return; }
    if (FloatViewController.floatViewController) { return; }
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    if (!(await requestFloatViewPermission(context))) { return; }
    const config: floatView.FloatViewConfiguration = {
      context: context,
      templateType: floatView.FloatViewTemplateType.ROUNDED_RECTANGLE
    };
    await FloatViewController.createFloatView(config,
      (info: floatView.FloatViewStateChangeInfo) => {
        // 在此同步业务状态，STOPPED 时释放业务自己的订阅和资源。
        console.info(`Float view state: ${info.state}`);
      });
    const limits = floatView.getFloatViewLimits(config.templateType);
    const size: window.Size = {
      width: limits.maxSize.width,
      height: limits.maxSize.height
    };
    await FloatViewController.startFloatView('pages/FloatViewPage', size);
  } catch (err) {
    console.error(`Create float view failed: ${(err as BusinessError).code}, ${(err as BusinessError).message}`);
  }
}
```

需要加载跨包页面、分步启动或补充业务监听时，读取资产索引中的[分步调用与补充监听](../assets-catalog.md#分步调用与补充监听)。

工程侧负责[兼容性与权限核对](../compatibility.md)、前台检查、入口防重和业务参数准备。首次修改前和交付时按[权限提醒要求](../compatibility.md#权限声明acl-与用户授权)说明本次路线的权限条件和申请入口。

## 按状态验收

业务结束时使用资产的 `stopFloatView()`。收到 `STARTED` 后确认启动，收到 `STOPPED` 后确认停止。资产清理内部监听与控制器引用，业务清理自己的订阅、定时器和页面资源。按[性能与验证](../performance-validation.md)及已加载的知识条目核对实际接入结果。失败时按[排障](../README.md#排障)查阅窗端知识，条件不满足时按[回退策略](../fallback.md)保留原业务。

静态检查通过不等于设备功能通过，缺少签名或适配设备时保留待验收状态。

交付时按[权限与提醒要求](../compatibility.md#权限声明acl-与用户授权)向开发者说明本次路线的权限条件和申请入口。
