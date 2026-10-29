# 闪控窗／球绑定开发步骤（API 26 起）

`binding` 是窗球绑定的独立 CLI 路线，内部复用窗、球能力。使用 [FloatViewBallController.ets](../assets/FloatViewBallController.ets)，同时复制同目录的两个基础控制器。仅在用户明确需要窗球切换时加载本流程，不因同时选择两条独立路线自动绑定。

## 开发准备

首次修改前按[权限与提醒要求](../compatibility.md#权限声明acl-与用户授权)向开发者说明本次路线的权限条件和申请入口。

先确定业务页面、窗模板与尺寸、球模板参数、首次展示窗还是球。参数及页面准备分别参考[窗路线](float-view.md)和[球路线](floating-ball.md)。所有方法使用 async/await、hilog 和 Promise<void>；失败记录后向调用方抛出。业务回调可选，状态由两个基础资产维护。

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

### 区分内容更新、模板切换与实例替换

| 变化 | 处理方式 |
|---|---|
| 同一业务条目的内容变化、条目增删 | 更新共享业务数据，窗通过页面状态刷新；球更新当前展示条目的参数 |
| 窗的展开／紧凑布局变化 | 同一控制器调用 switchTemplate，同时更新窗页面的布局状态 |
| 条目数量、显示区域或系统尺寸限制变化 | 重新计算当前模板下的尺寸，调用 setWindowSize |
| 球轮换展示不同条目 | 同一球模板下调用 updateFloatingBall，不重建控制器 |
| 业务明确要求替换整组窗球，或更换不能在线更新的球模板 | 停止旧组、确认双端终态、释放后重新准备和绑定 |

窗和球从同一份业务数据取值，但更新通道不同。窗可通过宿主已有 AppStorage／LocalStorage 等状态管理刷新，球需显式调用更新接口。数据变化只替换当前内容，不重复加载窗页面、绑定或启动控制器。业务列表用稳定 ID 标识条目，避免用实时变化的显示值作标识。

### 窗模板、页面布局与尺寸同步

需要上／下箭头控制展开、收起时，复用[展开／收起页面片段](float-view.md#展开收起页面片段)。该交互只改变闪控窗模板与页面布局，绑定关系和闪控球控制器保持不变。

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
// 成功后再把窗页面的响应式布局状态切换为紧凑布局。
```

`switchTemplate` 只切换系统模板和窗口尺寸，不会替换页面内的组件。窗页面需维护自己的展开／紧凑布局状态，并用条件渲染切换内容；顶部预留随状态同步：常规态（ROUNDED_RECTANGLE）top padding 32vp，mini 态（HORIZONTAL_BAR）top padding 4vp。可使用 @Provide/@Consume 或宿主已有的状态方案共享。只有接口成功后才提交布局状态，失败保留原布局。切回展开布局时查询 ROUNDED_RECTANGLE 的限制，不能沿用横条模板的限制。过渡动画按产品需要实现，固定延时不能用来判定接口成功。

**仅调整窗尺寸**：模板不变时调用 `await FloatViewController.setWindowSize(size)`。size 使用 `window.Size`，单位为 px，需满足当前模板的尺寸及比例限制。实际窗口尺寸通过准备阶段的 `onRectChange` 回调或 `FloatViewController.getFloatViewProperties()` 读取；属性返回 undefined 时不继续使用。

条目数量变化、显示区域变化、onLimitsChange 以及原工程既有断点或屏幕尺寸机制的更新都可能触发尺寸重算；窗是否借用原工程机制响应屏幕变化，按[窗路线的屏幕尺寸与断点响应](float-view.md#屏幕尺寸与断点响应借用原工程既有机制)执行，不为窗单独新增监听。按内容所需宽高和当前可用空间计算；设计尺寸若使用 vp，先用实际 UIContext 的 vp2px 转成 px，再检查当前模板的 minSize、maxSize 和 ratioLimits。重算结果只是请求值，系统可能按模板约束调整最终尺寸；页面内容行不写固定高度贴顶，垂直位置交给根容器居中（见[窗路线的请求尺寸说明](float-view.md#展开收起页面片段)）。超出允许大小时在页面内部滚动或截断，不能只扩大窗口。onLimitsChange 表示约束变化，onRectChange 才表示实际矩形变化；mini 态内容容器的左右 padding 分别取 avoidArea.leftRect.width、avoidArea.rightRect.width，经实际 UIContext.px2vp 转换后各加 6vp 内容留白，摘要和展开按钮都需避让；模板切换或矩形变化后重新读取，系统避让宽度动态读取，额外留白保持每侧 6vp；顶部固定预留（常规态 32vp、mini 态 4vp）不因 avoidArea 为空而省略。组件退出时退订它自己的显示与窗口回调。

### 球内容更新与条目轮换

**更新球内容**：使用与绑定时相同的球模板，传入新的业务内容。

```typescript
const updateParams: floatingBall.FloatingBallParams = {
  template: ballParams.template,
  title: title,
  content: content
};
await FloatingBallController.updateFloatingBall(updateParams);
```

上述球片段适用于前文的 NORMAL 模板，仅在球处于 STARTED 后调用；STATIC 不支持更新，也不能通过更新参数更换球模板。窗、球更新均按各自状态及参数约束执行，失败交由业务入口处理，详见[窗更新](float-view.md)和[球更新](floating-ball.md)。

业务有多条内容需要轮换时，在业务模型中保存当前展示条目的稳定 ID 和下一条 ID，不把轮换逻辑放入通用控制器：

- 数据事件到达时，按当前 ID 找到最新条目，只刷新它的内容，避免每次数据更新都跳到下一条。
- 轮换时机到达时，从最新列表选择下一条，再生成 FloatingBallParams。当前条目被删除时，优先选择仍存在的下一条，否则回到首条；列表为空时停止轮换，不读取首条或对长度取模。
- 未到 STARTED 或正在停止时只保留最新业务数据，等球可以更新后再提交。更新 Promise 完成前不并发提交下一次更新，高频事件合并为最新值；失败不重建控制器，也不把显示记录为更新成功。
- 轮换是可选业务行为，只启动一个轮换任务。停止窗球或替换整组实例时清理定时器、数据事件订阅；旧请求晚到的结果不能继续更新新实例。

列表清空后的关闭策略由业务决定；若该窗球仅服务于列表内容，可停止整组并按第 5 节释放。窗组件切换布局时清理自己的动画和显示监听，整组业务订阅由组合流程的所有者清理，避免切换布局后重复订阅。

球不是窗页面，也不推定它受到同一防窥蒙层保护；需要防窥时另读[防窥联动](../anti-peep-integration.md)。

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

只有需要主动解除绑定关系时调用 unbind，一般业务关闭流程不需要此步骤。两端尚未启动的绑定可以直接解除；**已请求启动时，必须确认双端 STOPPED：**

```typescript
await FloatViewBallController.unbind();
```

unbind 成功后会自动调用 release 清理引用。失败时保留引用供重试。

release 仅清理监听和本地引用，不停止窗口，也不调用系统解绑接口。未绑定的准备流程被放弃时也可调用；尚未停止的绑定不能直接 release。完成释放后可重新 prepare。停止失败保留引用和监听，不能直接释放或宣称已关闭。

### 按需替换整组窗球

只在业务明确要求重建时执行。普通内容更新、列表增删、窗模板切换不走此流程。`restoreMainWindow(wantParameters)` 后的 onNewWant 可根据业务参数处理导航；恢复主窗口本身不要求销毁或重建窗球。若业务确实需要替换，则在业务所有者中记录一次替换请求和新配置：

1. 停止旧组的轮换任务及数据更新订阅，调用 `await FloatViewBallController.stop()`。
2. 由两个状态回调确认双端 STOPPED，并等待停止请求完成；不能收到单端 STOPPED 就重新创建，也不能用固定延时替代状态确认。
3. 调用 `await FloatViewBallController.release()` 清理旧引用。unbind 仍是可选操作。
4. 使用最新业务数据依次 `await prepare(...)`、`await bind(newBallParams)`、`await start('view' 或 'ball')`，明确新组首次展示形态；启动状态确认后恢复业务更新。

替换请求由业务入口串行处理，完成后清除；用户主动关闭、列表为空或替换已取消时不自动再开。任一步失败停止后续创建／启动，保留错误与当前状态，不重复重建。再次启动仍须符合权限、设备和前台条件。

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

运行[验证流程](../performance-validation.md)，静态与 Node 模拟测试不能替代 HarmonyOS 编译和真机系统切换验收。缺少签名、设备或系统条件时保留待验收状态。

交付时按[权限与提醒要求](../compatibility.md#权限声明acl-与用户授权)向开发者说明本次路线的权限条件和申请入口。
