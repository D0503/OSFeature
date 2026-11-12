---
title: "闪控窗／球绑定与解绑"
summary: "说明 API 26 窗球绑定的权限、页面与参数准备、两端监听、首次展示、双端停止、按需解绑及整组替换。"
createdAt: "2026-11-11"
updatedAt: "2026-11-11"
tags: ["HarmonyOS", "闪控窗", "闪控球", "窗球绑定", "解绑", "生命周期"]
---

# 闪控窗／球绑定与解绑

窗球绑定用于由系统在闪控窗和闪控球之间切换的场景。业务所有者持有同一组系统控制器，覆盖准备、启动、跨应用展示和停止的整个周期。两端各自独立展示时，分别参照[独立闪控窗接入与生命周期](float-view.md)和[独立闪控球开发步骤（API 20 起）](floating-ball.md)。

## 1. 核对运行环境、权限和开启条件

- 编译 SDK 和运行系统须支持 API 26，使用 Stage 模型与实际宿主的 `UIAbilityContext`。先检查运行版本和 `SystemCapability.Window.SessionManager`，再分别调用 `floatView.isFloatViewEnabled()` 和 `floatingBall.isFloatingBallEnabled()`。结合目标设备与窗口模式核对绑定支持。
- 实际宿主 HAP 须声明并获准 `ohos.permission.FLOAT_VIEW` 和 `ohos.permission.USE_FLOAT_BALL` 的 ACL，核对实际签名 profile。`FLOAT_VIEW` 还须配置 `reason` 和 `usedScene`，并在用户开启入口取得运行时授权。`USE_FLOAT_BALL` 的授权类型为 `system_grant`。 [申请 ACL 权限](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)
- 在应用前台的用户开启入口串行执行准备、绑定、启动和停止，拦住重复点击。已有独立窗、球或其他冲突窗口时，先结束原流程并确认停止。异步步骤返回后复核当前请求、业务所有者和前台状态。

## 2. 创建两端、注册监听并准备页面

下例使用圆角矩形窗和 `NORMAL` 球。窗配置指定模板和宿主上下文，球配置使用同一宿主上下文。`page` 使用实际宿主的 pages profile 中已注册的路径。需要共享页面级状态时向 `setUIContext(page, storage)` 传入 `LocalStorage`。跨包页面改用 `setUIContextByName(routeName, storage)`，加载成功后再设置尺寸。

将以下片段放入同一个业务所有者的异步开启流程。取得每个控制器后立即保存到该所有者，便于后续更新、停止，以及准备中途失败时清理已创建的部分。两个状态回调用于分别记录两端状态，尺寸限制和矩形监听按业务需要注册。保存注册时的回调供退订。

```typescript
import { floatView, floatingBall, window } from '@kit.ArkUI';

const viewConfig: floatView.FloatViewConfiguration = {
  context: context,
  templateType: floatView.FloatViewTemplateType.ROUNDED_RECTANGLE
};
const ballConfig: floatingBall.FloatingBallConfiguration = { context: context };
let viewState: floatView.FloatViewState | undefined;
let ballState: floatingBall.FloatingBallState | undefined;

const onViewStateChange = (info: floatView.FloatViewStateChangeInfo): void => {
  viewState = info.state;
};
const onBallStateChange = (state: floatingBall.FloatingBallState): void => {
  ballState = state;
};

const viewController = await floatView.create(viewConfig);
viewController.onStateChange(onViewStateChange);
const ballController = await floatingBall.create(ballConfig);
ballController.on('stateChange', onBallStateChange);

const limits = floatView.getFloatViewLimits(viewConfig.templateType);
const size: window.Size = { width: limits.maxSize.width, height: limits.maxSize.height };
await viewController.setUIContext('pages/FloatViewPage');
await viewController.setWindowSize(size);
```

示例用目标模板的最大尺寸演示。实际尺寸使用 px，宽高须大于 0，并核对 `minSize`、`maxSize` 和 `ratioLimits`。需要感知约束和实际矩形变化时，分别调用窗控制器的 `onLimitsChange`、`onRectChange`，并由注册方配对退订。

## 3. 两端未启动时绑定，随后只启动一端

窗页面和尺寸准备成功后，用同一组控制器执行绑定。示例的 `title`、`content` 取自实际业务数据。标题非空，标题和内容各不超过 64 UTF-8 字节。使用其他模板时按其参数要求准备，例如 `STATIC` 还须提供合规的 `PixelMap` 图标。

```typescript
const ballParams: floatingBall.FloatingBallParams = {
  template: floatingBall.FloatingBallTemplate.NORMAL,
  title: title,
  content: content
};
await floatView.bind(viewController, ballController, ballParams);
```

绑定时的参数覆盖球控制器此前保存的启动参数。保存本次绑定参数供球先启动使用，后续内容变化时另建参数对象。绑定失败时退出本次启动流程，按失败阶段决定重试或清理。

绑定成功后，再次确认本次请求仍有效且应用在前台。`initialDisplay` 由业务明确选择，类型为 `'view' | 'ball'`。开启请求返回前保持当前组的防重状态。

```typescript
if (initialDisplay === 'view') {
  await viewController.start();
} else {
  await ballController.startFloatingBall(ballParams);
}
```

任一端发起启动后，系统管理两个窗口的创建和展示，同一时刻展示一端。已经加载的窗页面继续复用。Promise 返回表示请求已完成，实际显示以状态回调为准。用户点击触发系统切换，球端的点击回调无需再发起启动或恢复主窗口。窗进入 `IN_FLOATING_BALL`、`HIDDEN` 或 `IN_SIDEBAR` 时保留这组控制器。 [华为闪控窗 API 参考](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-floatview)

## 4. 停止、清理和按需解绑

绑定后调用任一端的停止接口，由系统结束两端。以下示例在业务结束入口按当前状态向一端发送停止请求。

```typescript
if (viewState !== floatView.FloatViewState.STOPPED) {
  await viewController.stop();
} else if (ballState !== floatingBall.FloatingBallState.STOPPED) {
  await ballController.stopFloatingBall();
}
```

在两个状态回调中分别记录 `STOPPED`，确认双端终态后再清理。业务发出停止请求时，还要等该请求完成。先到的单端通知和停止 Promise 分别只说明一部分结果。系统或用户已关闭窗口时，由双端状态通知触发同一收尾流程。

普通关闭流程可在双端停止后配对退订本次监听，并清空业务持有的控制器、状态和参数引用。对上例使用 `viewController.offStateChange(onViewStateChange)` 和 `ballController.off('stateChange', onBallStateChange)`。若注册了窗的尺寸限制或矩形回调，也用原回调配对退订。随后清理业务订阅、轮换定时器和页面资源。

需要显式解除绑定时，使用绑定时的原控制器调用以下接口。两端均尚未发起启动时可直接解绑。已发起启动时，确认双端 `STOPPED` 后再调用。解绑成功后完成本次业务清理，失败时保留控制器引用供诊断或重试。

```typescript
await floatView.unbind(viewController, ballController);
```

## 5. 失败恢复与整组替换

| 失败阶段 | 后续处理 |
| --- | --- |
| 创建、监听注册、页面加载或设尺寸 | 暂停绑定。放弃时配对退订本次已成功注册的监听，清理已创建的部分实例。 |
| 绑定 | 保持两端未启动。修正状态或参数后再重试绑定，或清理本次准备。独立展示由明确的业务请求触发。 |
| 启动 | 保留引用与监听。按实际状态处理停止，确认双端 `STOPPED` 后清理或按需解绑。系统终态无法确认时，记录失败阶段和平台错误。 |
| 停止或解绑 | 保留引用与状态，核对当前两端状态后决定是否重试。 |
| 清理 | 记录尚未成功清理的回调或资源，恢复时处理本次实例。 |

仅在业务明确需要重建，或需要更换无法在线更新的球模板时替换整组。普通内容更新、列表增删、窗模板切换和恢复主窗口继续使用当前组。点击恢复带参数时，业务导航仍由宿主的 `onNewWant` 处理。

1. 串行记录本次替换请求和新配置，停止旧组的轮换及数据订阅，并发出停止请求。
2. 等待停止请求完成和双端 `STOPPED`，配对退订并清理旧组引用。显式解绑按需执行。
3. 复核替换请求仍有效、业务所有者仍存活且应用仍在前台，再以最新数据重新准备、绑定并选择首次展示的一端。收到状态通知后恢复业务更新。

用户主动关闭、列表已空或替换请求已取消时，结束本次替换。任一步失败时保留错误和当前状态，暂停后续创建和启动。旧组迟到的回调及数据结果仅归属于旧实例。

## 验证要点

- 分别验证先展示窗和先展示球，以及窗转球、球转窗。确认切换由系统完成且复用同一组实例。
- 验证关闭任一端、系统关闭、双端停止通知的不同先后顺序、可选解绑和清理后重新创建。
- 覆盖缺少权限、用户拒绝、设备不支持、后台启动、已有独立实例、重复点击及各异步步骤失败。确认失败时保留可恢复的状态，并按实际设备结果验收。
