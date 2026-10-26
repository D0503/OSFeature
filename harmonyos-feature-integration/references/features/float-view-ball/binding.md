# 闪控窗／球绑定开发步骤（API 26 起）

绑定是独立窗、球能力之上的组合接入。使用 [FloatViewBallController.ets](assets/FloatViewBallController.ets)，同时复制同目录的两个基础控制器。仅在用户明确需要窗球切换时加载本流程，不因同时选择两条路线自动绑定。

## 开发准备

**实施前提醒：FLOAT_VIEW 与 USE_FLOAT_BALL 均是受限 ACL 权限，需在[开发者中心申请 ACL](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)。** 实际宿主声明两项权限，核对签名 profile；FLOAT_VIEW 还需用户授权，USE_FLOAT_BALL 不通过用户授权弹框申请。按[兼容性](compatibility.md)核对 API26、Stage、SysCap、Phone/Tablet 实际支持情况及前台启动条件。

先确定业务页面、窗模板与尺寸、球模板参数、首次展示窗还是球。参数及页面准备分别参考[窗路线](routes/float-view.md)和[球路线](routes/floating-ball.md)。所有方法使用 async/await、hilog 和 Promise<void>；失败记录后向调用方抛出。业务回调可选，状态由两个基础资产维护。

## 1. 创建两端并准备页面

```typescript
import { floatView, floatingBall, window } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
import { FloatViewBallController, FloatViewBallCallbacks } from '../controllers/FloatViewBallController';
import { FloatViewController, requestFloatViewPermission } from '../controllers/FloatViewController';
import { FloatingBallController } from '../controllers/FloatingBallController';

// 放入现有用户开启入口的 try/catch 中；context 是真实 UIAbilityContext。
if (!FloatViewController.canUseFloatView() || !FloatingBallController.canUseFloatingBall()) {
  return;
}
if (!(await requestFloatViewPermission(context))) { return; }
const viewConfig: floatView.FloatViewConfiguration = {
  context: context,
  templateType: floatView.FloatViewTemplateType.ROUNDED_RECTANGLE
};
const ballConfig: floatingBall.FloatingBallConfiguration = { context: context };
const limits = floatView.getFloatViewLimits(viewConfig.templateType);
const size: window.Size = { width: limits.maxSize.width, height: limits.maxSize.height };
await FloatViewBallController.prepare(viewConfig, ballConfig, 'pages/FloatViewPage', size);
```

页面路径替换为实际宿主 pages profile 中已注册的页面。`prepare` 依次创建窗、球并注册监听，再等待窗页面加载和尺寸设置完成，不启动任何一端。需要共享状态时传入第 5 个参数 LocalStorage。

第 6 个参数为可选 `FloatViewBallCallbacks`，包含 `onViewStateChange`、`onBallStateChange`、`onLimitsChange` 和 `onRectChange`。业务通过它们更新显示状态、记录终态并释放自己的订阅；自行处理回调异常。球端不传点击回调或 Want。

组合资产直接调用两个基础资产，业务入口按 prepare → bind → start 的顺序等待操作完成，并防止重复点击或并发调用。已有独立窗、球实例时先完成原流程的清理；不要混用独立启动与绑定启动流程。

## 2. 两端未启动时绑定

```typescript
const ballParams: floatingBall.FloatingBallParams = {
  template: floatingBall.FloatingBallTemplate.NORMAL,
  title: title,
  content: content
};
await FloatViewBallController.bind(ballParams);
```

`title`、`content` 使用实际业务内容，参数约束沿用球路线。只有 prepare 成功才能 bind；绑定参数覆盖球控制器此前保存的启动参数。资产保存同一参数对象供球先启动使用，绑定后不要原地修改对象。绑定失败不启动、不自动退回独立模式，可重试 bind 或 release 放弃本次准备。

## 3. 显式选择首次展示

准备和绑定完成后，二选一：

```typescript
// 先显示窗。
await FloatViewBallController.start('view');
```

```typescript
// 或先显示球，使用 bind 时提供的球参数。
await FloatViewBallController.start('ball');
```

只调用一端启动接口，系统创建两端窗口但同一时刻仅展示一端。窗页面已准备完成，不再次加载。Promise 完成只表示启动请求完成，实际显示按系统状态回调判断；首次形态必须显式传入，不设隐式默认值。

## 4. 系统切换与业务更新

用户通过系统交互在窗、球之间切换，不在球点击回调里手动启动窗或恢复主窗口。窗进入 IN_FLOATING_BALL、HIDDEN 或 IN_SIDEBAR 时仍存活，不能清空基础资产中的控制器引用。

窗内容使用原页面状态更新。绑定后的模板、尺寸和球内容更新仍调用两个基础资产，无需重新创建、绑定或启动。

**切换窗模板**：先查询目标模板的尺寸限制，再调用 `FloatViewController.switchTemplate(property)`。这里切换的是窗的模板，不是窗球显示形态。

```typescript
// 放入现有异步业务入口的 try/catch 中。
const templateType = floatView.FloatViewTemplateType.HORIZONTAL_BAR;
const limits = FloatViewController.getFloatViewLimits(templateType);
if (limits === null) { return; }
const property: floatView.TemplateProperty = {
  templateType: templateType,
  size: { width: limits.maxSize.width, height: limits.maxSize.height }
};
await FloatViewController.switchTemplate(property);
```

**仅调整窗尺寸**：模板不变时调用 `await FloatViewController.setWindowSize(size)`。size 使用 `window.Size`，单位为 px，需满足当前模板的尺寸及比例限制。实际窗口尺寸通过准备阶段的 `onRectChange` 回调或 `FloatViewController.getFloatViewProperties()` 读取；属性返回 undefined 时不继续使用。

**更新球内容**：使用与绑定时相同的球模板，传入新的业务内容。

```typescript
const updateParams: floatingBall.FloatingBallParams = {
  template: ballParams.template,
  title: title,
  content: content
};
await FloatingBallController.updateFloatingBall(updateParams);
```

上述球片段适用于前文的 NORMAL 模板，仅在球处于 STARTED 后调用；STATIC 不支持更新，也不能通过更新参数更换球模板。窗、球更新均按各自状态及参数约束执行，失败交由业务入口处理，详见[窗更新](routes/float-view.md)和[球更新](routes/floating-ball.md)。

球不是窗页面，也不推定它受到同一防窥蒙层保护；需要防窥时另读[防窥联动](anti-peep-integration.md)。

## 5. 停止与释放（解绑可选）

```typescript
await FloatViewBallController.stop();
// 此处仅表示停止请求完成，不能立即假定两端都已停止。
```

stop 仅向一端发出请求，系统结束两端。业务通过两个状态回调分别记录 STOPPED，不依赖回调先后顺序。通常无需显式解绑；确认双端 STOPPED 且停止请求已完成后，从业务收尾入口清理本地引用：

```typescript
await FloatViewBallController.release();
```

组合资产直接使用两个基础资产中的控制器字段。prepare 创建时传入 retainControllerOnStopped = true，各自 STOPPED 时退订监听，引用保留至 release 或可选的 unbind 成功后清空。独立接入默认仍在 STOPPED 时清空引用。系统关闭时无需再次 stop，确认双端终态后同样可 release。

### 可选：显式解除绑定

只有需要主动解除绑定关系时调用 unbind，一般业务关闭流程不需要此步骤。两端尚未启动的绑定可以直接解除；已请求启动时，必须确认双端 STOPPED：

```typescript
await FloatViewBallController.unbind();
```

unbind 成功后会自动调用 release 清理引用。失败时保留引用供重试。

release 仅清理监听和本地引用，不停止窗口，也不调用系统解绑接口。未绑定的准备流程被放弃时也可调用；尚未停止的绑定不能直接 release。完成释放后可重新 prepare。停止失败保留引用和监听，不能直接释放或宣称已关闭。

## 异常与恢复

| 失败阶段 | 后续处理 |
|---|---|
| 创建或加载页面 | 不进入 bind；调用 release 清理已创建的部分实例后重新 prepare |
| bind | 不启动；重试 bind 或 release，不自动启用独立模式 |
| start | 不推定未启动，不直接 release/unbind；尝试 stop，确认双端 STOPPED 后 release；unbind 按需调用 |
| stop | 保留引用和监听，可重试；没有双端 STOPPED 不宣称已停止 |
| unbind（可选） | 保留原始引用，可重试；成功后完成释放 |
| release 清理 | 保留尚未清理的引用，修复原因后重试，不接管其他实例 |

启动失败后若系统未给出可确认的终态，保留待恢复状态并检查接口错误与设备日志，不伪造 STOPPED，不自动重建。窗、球状态直接读取基础资产的 state；调用方负责保证准备成功后才绑定、绑定成功后才启动，不在运行中重新绑定。业务退出、重复点击和异步返回后仍需检查前台及所有者有效性。

## 验证与结束提醒

- 窗先启动、球先启动，均不重复创建或重复注册监听；窗→球、球→窗由系统切换。
- 关闭任一端、系统关闭、双端 STOPPED 不同顺序，可直接 release 并重新创建；另验证可选 unbind 流程。
- 缺任一权限、用户拒绝、设备不支持、后台启动、已有独立实例及错误调用顺序不误报成功。
- 创建、加载、绑定、启动、停止、解绑失败后不自动启动另一端、不丢失恢复所需引用。
- 业务入口阻止重复点击和并发调用；页面加载和尺寸设置成功后才继续绑定启动。

运行[验证流程](performance-validation.md)，静态与 Node 模拟测试不能替代 HarmonyOS 编译和真机系统切换验收。缺少签名、设备或系统条件时保留待验收状态。

**实施结束再次提醒：两项权限均为受限 ACL，USE_FLOAT_BALL 必须申请，FLOAT_VIEW 必须申请并取得用户授权；提供[ACL 申请入口](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)。**
