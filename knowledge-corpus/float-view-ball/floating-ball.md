---
title: "独立闪控球开发步骤（API 20 起）"
summary: "说明使用 HarmonyOS floatingBall 系统 API 接入独立闪控球的权限与能力条件、模板和参数、启动与更新、点击恢复、停止清理，以及 API 24 和 API 26 的可选能力。"
createdAt: "2026-11-10"
updatedAt: "2026-11-10"
tags: ["HarmonyOS", "闪控球", "floatingBall", "API 20", "ArkUI"]
---

# 独立闪控球开发步骤（API 20 起）

通过 `@kit.ArkUI` 的 `floatingBall` 展示应用业务信息。球在应用前台启动后可跨应用显示。接入前确定展示内容、数据来源、点击后的目标页面和结束展示的时机。需要在窗和球之间由系统切换时，使用窗球绑定流程。

## 1. 核对权限、运行环境和用户入口

- 基础能力要求编译 SDK 和运行系统均达到 API 20，使用 Stage 模型及实际宿主的 `UIAbilityContext`。先检查运行 API 和 `SystemCapability.Window.SessionManager`，再调用 `floatingBall.isFloatingBallEnabled()`。创建和启动前还须核对权限及应用前台状态。
- 实际宿主 HAP 需要申请并获得 `ohos.permission.USE_FLOAT_BALL` 的 ACL，在 `module.json5` 的 `requestPermissions` 中加入 `{ "name": "ohos.permission.USE_FLOAT_BALL" }`，并核对实际签名 profile。授权方式为 `system_grant`。 [华为受限权限说明](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/restricted-permissions#ohospermissionuse_float_ball)
- 应用内提供默认关闭、由用户主动开启的闪控球开关。展示与应用功能相关的内容，避免用于营销、广告或引导付费。HarmonyOS 7.0.0 之前支持 Phone 和非电脑模式的 Tablet，7.0.0 起支持 Phone、Tablet、PC／2in1。模拟器使用 DevEco Studio 6.0.1 Release 及以上，并确认目标系统和权限。

## 2. 选择模板、准备图标与启动参数

| 模板 | 可展示内容 | 必填字段 | 启动后更新 |
| --- | --- | --- | --- |
| `STATIC` | 图标、标题 | `template`、`title`、`icon` | 不支持 |
| `NORMAL` | 标题、内容 | `template`、`title` | 支持，模板保持不变 |
| `EMPHATIC` | 图标、标题、内容 | `template`、`title`，`icon` 可选 | 支持，模板保持不变 |
| `SIMPLE` | 标题，可双行展示 | `template`、`title` | 支持，模板保持不变 |

- `title` 必须非空，`title` 和 `content` 各不超过 64 UTF-8 字节。中文和 emoji 按编码后的字节数检查。
- `icon` 使用 `image.PixelMap`。用 `getPixelBytesNumber()` 检查解码后的像素总字节数，限 192 KB，建议宽高为 128 × 128 px。`STATIC` 的必需图标读取或解码失败时停止本次启动。
- `backgroundColor` 使用符合 API 要求的不透明十六进制颜色，例如 `#008EF5`。省略时跟随系统深浅色。闪控球的布局和字号由系统模板决定，宿主无需为球注册页面。

### 从应用资源加载图标

以下片段从宿主的 `rawfile` 读取图像并解码为 `PixelMap`。`path` 使用应用内的实际资源路径，读取或解码失败由调用方处理。

```typescript
import { common } from '@kit.AbilityKit';
import { image } from '@kit.ImageKit';

async function loadFloatingBallIcon(context: common.UIAbilityContext,
  path: string): Promise<image.PixelMap> {
  const buffer = context.resourceManager.getRawFileContentSync(path);
  const source = image.createImageSource(buffer.buffer as ArrayBuffer);
  try {
    return source.createPixelMapSync();
  } finally {
    await source.release();
  }
}
```

调用 `loadFloatingBallIcon(context, 'business-icon.png')` 后，先检查返回图像的像素总字节数，再作为 `FloatingBallParams.icon` 使用。重复展示时可缓存同一个 `PixelMap`，等相关调用完成且业务不再使用时释放。

### 构造启动参数

下面以 `NORMAL` 模板为例，`title` 和 `content` 来自当前业务数据。选择 `STATIC` 时，在创建控制器前将已解码且通过大小检查的 `icon` 放入参数。

```typescript
import { floatingBall } from '@kit.ArkUI';

const startParams: floatingBall.FloatingBallParams = {
  template: floatingBall.FloatingBallTemplate.NORMAL,
  title: title,
  content: content
};
```

## 3. 创建控制器并注册监听

在用户开启入口串行执行创建、监听和启动，防止创建返回前重复点击。`context` 使用实际宿主的 `UIAbilityContext`。由业务持有创建所得的 `ballController`，持有周期应覆盖跨应用展示期。保存注册的回调引用供退订。

```typescript
const ballController = await floatingBall.create({ context: context });
// 由业务侧持有此实例，并检查本次请求是否仍有效。
ballController.on('stateChange', onStateChange);
```

### 按需注册点击恢复

如需点击恢复，在启动前为同一控制器注册 `on('click', onClick)`，并在用户点击回调内调用 `ballController.restoreMainWindow(want)`。`want` 使用本应用的实际包名和目标 Ability，宿主通过原有 `onCreate`／`onNewWant` 处理页面导航。以恢复接口的结果判断是否成功。 [闪控球 API 参考](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-floatingball)

监听注册失败时，清理本次已经注册的回调。可选的 API 26 销毁监听也在此阶段按需注册。

## 4. 启动并等待 STARTED

监听注册完成后，核对本次开启请求仍然有效且应用仍在前台，再用第 2 步的参数启动。

```typescript
await ballController.startFloatingBall(startParams);
```

收到 `floatingBall.FloatingBallState.STARTED` 后，业务才将球标记为已启动。若启动失败，按当前实例状态决定是否重试，复用当前控制器和监听。已确认从未启动且决定放弃的实例可能收不到 `STOPPED`，应清理本次注册的监听和引用。

## 5. 更新内容

球处于 `STARTED` 时，用最新业务数据构造新的 `FloatingBallParams`，沿用启动时的模板及参数边界。`STATIC` 不支持更新。确需更换模板时，先停止原实例并完成清理，再使用目标模板启动。

以下接续前文 `NORMAL` 示例，`updatedTitle` 和 `updatedContent` 取自当前业务数据。

```typescript
const updateParams: floatingBall.FloatingBallParams = {
  template: startParams.template,
  title: updatedTitle,
  content: updatedContent
};
await ballController.updateFloatingBall(updateParams);
```

业务轮换多条信息时，用稳定的业务 ID 跟踪当前条目。数据事件刷新当前条目，轮换任务负责选择下一条。当前条目被删除时，选择仍存在的下一条或首条。列表为空时停止轮换。合并高频更新，并等待当前更新请求完成后再提交下一次。停止或替换实例时，清理轮换任务和业务订阅，避免旧请求结果更新新实例。

## 6. 停止并在 STOPPED 后清理

业务结束时调用 `ballController.stopFloatingBall()`。收到 `floatingBall.FloatingBallState.STOPPED` 后，配对退订已注册的 `stateChange` 和 `click` 回调，再清理控制器引用、轮换任务、数据订阅和已不再使用的图像。用户删除、系统挤占和关联主窗口销毁等结束场景也走同一清理流程。主页面暂时隐藏或应用退到后台时，仍可继续跨应用展示。

停止请求返回与 `STOPPED` 是两个信号。停止失败时保留控制器及监听供诊断或重试。准备或监听注册中途失败时，清理本次已注册的监听。各异常分支记录失败阶段及 `BusinessError.code`、`BusinessError.message`。

## 可选能力

| 能力 | 最低 API | 使用条件 |
| --- | --- | --- |
| `setFloatingBallVisibilityInApp` | 24 | 球启动后按需设置。默认和传 `true` 时，除多任务界面外可见。传 `false` 时，应用前台隐藏，后台可见。隐藏与停止分别处理。PC／2in1 仍需满足 API 26 的设备门槛。 |
| `onDestroy`／`offDestroy` | 26 | 注册监听时按需加入，用于记录主动停止、用户删除、主窗口销毁或系统挤占等原因。用同一回调配对退订，与 `STOPPED` 共用清理逻辑。 |
| `titleColor`／`contentColor` | 26 | 构造参数时按需设置。设置任一文字颜色时须同时设置 `backgroundColor`，并验证文字和背景的对比度。 |
| `textUpdateAnimationType` | 26 | 构造参数时按需设置，控制文本更新动画，默认无动画。 |

可选能力同时受编译 SDK 和实际运行版本约束。只接入 API 20 基础能力时，源码使用基础接口和参数。
