# 闪控窗／球绑定（binding）

本路线用于用户明确需要窗球切换的场景。内部复用窗、球能力。使用 [FloatViewBallController.ets](../assets/FloatViewBallController.ets)，同时复制同目录的两个基础控制器。仅在用户明确需要窗球切换时加载本流程，不因同时选择两条独立路线自动绑定。
先确定业务页面、窗模板与尺寸、球模板参数和首次展示形态。参数及页面准备分别参考[窗路线](float-view.md)和[球路线](floating-ball.md)。业务回调可选，状态由两个基础资产维护。

## 开发准备

首次修改前按[权限与提醒要求](../compatibility.md#权限声明acl-与用户授权)向开发者说明本次路线的权限条件和申请入口。工程侧负责前台检查、入口防重和业务所有者有效性检查，控制器的持有者需覆盖跨应用展示期。

## 读取知识库正文

按[知识库查询流程](../../../workflows/knowledge-query.md)读取下表中当前任务所需标题的正文。

| 查询标题 | 加载条件 |
| --- | --- |
| 闪控窗／球绑定与解绑 | 绑定接入、停止与清理、显式解绑、失败恢复或整组替换时读取。 |
| 闪控窗／球绑定后的内容更新 | 共享业务数据、窗模板或尺寸调整、页面避让、球内容更新或轮换时读取。 |

按场景补充查询以下正文。

- 展开／收起组件与页面避让，通过[窗知识查询](float-view.md#读取知识库正文)读取「闪控窗模板切换与页面避让」。
- 复用原工程断点或屏幕尺寸机制，通过[窗知识查询](float-view.md#读取知识库正文)读取「闪控窗屏幕尺寸与断点响应」。
- 核对两端参数与更新约束，按需通过[窗知识查询](float-view.md#读取知识库正文)和[球知识查询](floating-ball.md#读取知识库正文)读取对应正文。

需要恢复主窗口或导航时，通过[闪控窗知识查询](float-view.md#读取知识库正文)读取「闪控窗恢复主窗口与导航」。用户明确要求防窥时读取[防窥联动](../anti-peep-integration.md)。

## 读取本地资产并接入

按[绑定资产索引](../assets-catalog.md#绑定)读取 [FloatViewBallController.ets](../assets/FloatViewBallController.ets)，同时读取并复制同目录的 [FloatViewController.ets](../assets/FloatViewController.ets) 和 [FloatingBallController.ets](../assets/FloatingBallController.ets)。以实际源码核对参数、回调和清理行为。

采用资产时，保留知识库示例中的页面、参数和状态判断，将控制器操作映射到资产方法。每个控制器只由资产创建一次，资产统一持有控制器并管理内部监听，业务通过资产回调接入。知识库示例中的 `viewController`、`ballController` 对应两个基础资产持有的系统控制器，由 `prepare()` 统一创建并注册内部监听。

| 知识库步骤 | 本地资产接入 |
| --- | --- |
| 创建两端、注册监听、加载窗页面和设置初始尺寸 | `FloatViewBallController.prepare(viewConfig, ballConfig, page, size, storage?, callbacks?)` 一次完成。第 5 个参数为可选 `LocalStorage`，第 6 个为可选 `FloatViewBallCallbacks`，包含两端状态、窗尺寸限制和实际矩形回调。跨包页面按[分步调用说明](../assets-catalog.md#分步调用与补充监听)调整页面加载。 |
| 绑定两端 | `FloatViewBallController.bind(ballParams)`。资产保存同一参数对象供球先启动使用，绑定后另建更新参数对象。 |
| 选择首次展示的一端 | `FloatViewBallController.start(initialDisplay)`，显式传入 `'view'` 或 `'ball'`。 |
| 窗模板、尺寸与属性 | 使用 `FloatViewController.switchTemplate(property)`、`setWindowSize(size)`、`getFloatViewProperties()` 或 `getWindowProperties()`。 |
| 球内容更新 | 使用 `FloatingBallController.updateFloatingBall(updateParams)`。 |
| 停止及清理 | `await FloatViewBallController.stop()` 请求完成并确认双端 `STOPPED` 后，调用 `release()`。显式解绑按[绑定资产说明](../assets-catalog.md#绑定)调用 `unbind()`。 |

以下片段展示如何结合知识库参数调用本地资产。合入工程已有的串行开启入口与异步错误处理，按正文准备 `viewConfig`、`ballConfig`、`page`、`size` 和 `ballParams`。从窗资产导入独立函数 `requestFloatViewPermission`。

```typescript
if (!FloatViewController.canUseFloatView() ||
    !FloatingBallController.canUseFloatingBall()) {
  return;
}
if (FloatViewController.floatViewController ||
    FloatingBallController.floatingBallController) {
  return;
}
if (!(await requestFloatViewPermission(context))) { return; }

// page 为实际注册的窗页面路径，size 为符合当前模板限制的 px 尺寸。
// storage、callbacks 分别用于共享页面状态和接收业务通知，按需传入。
await FloatViewBallController.prepare(viewConfig, ballConfig, page, size, storage, callbacks);
await FloatViewBallController.bind(ballParams);
// initialDisplay 显式选择 'view' 或 'ball'。发起启动前复核前台和请求有效性。
await FloatViewBallController.start(initialDisplay);
```

组合资产在两端进入 `STOPPED` 后保留控制器引用。业务通过 `callbacks` 和基础资产的 `state` 跟踪状态，在双端停止且停止请求完成后进入收尾。准备或绑定失败、启动失败、可选解绑和整组替换按知识库中的对应阶段处理，并结合资产的 `release()`、`unbind()` 实际行为清理。

## 按状态验收

按[性能与验证](../performance-validation.md)和已加载的知识库正文验证首次展示、系统切换、双端停止、失败恢复及本次涉及的更新行为。业务收尾时清理自己的订阅、定时器和页面资源。出现错误时读取[排障查询](../troubleshooting.md)，条件不满足时按[回退策略](../fallback.md)处理。

交付时按[权限与提醒要求](../compatibility.md#权限声明acl-与用户授权)说明本次路线的权限条件和申请入口。
