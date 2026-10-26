# 闪控球开发步骤（API 20 起）

通过 `@kit.ArkUI` 的 `floatingBall` 创建系统闪控球，在用户切换应用时持续展示已确认的业务信息。本路线用于独立闪控球；用户明确需要窗球切换时另读[绑定流程](binding.md)，不能把独立球的启动、点击恢复逻辑直接套入绑定场景。

## 开发准备

先确定球展示的业务内容、使用模板、数据更新来源、点击后恢复的 Ability／页面，以及何时结束展示。复用工程已有入口、状态和导航；缺少影响实现的选择时补问，已明确的选择不重复确认。四种模板是可选项，不要求同时接入四套演示按钮。

**实施前（首次修改工程前）提醒开发者：`ohos.permission.USE_FLOAT_BALL` 是必须申请的受限 ACL 权限。** 在 HarmonyOS 开发者中心平台[申请 ACL 权限](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)，核对实际签名 profile 包含该权限；它不是 `user_grant` 运行时弹框权限。窗球两项权限均属于受限 ACL 权限；若同时接入闪控窗，还必须申请 `ohos.permission.FLOAT_VIEW` 并取得用户授权。完整前提见[兼容性与权限](../compatibility.md)。

在实际宿主 HAP 的 `module.json5` 中合并以下声明，保留原有权限：

```json5
"requestPermissions": [
  { "name": "ohos.permission.USE_FLOAT_BALL" }
]
```

按[权限申请条件](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/restricted-permissions#ohospermissionuse_float_ball)核对业务准入。应用内需有默认关闭、由用户主动开启的闪控球开关，已有等价入口时复用；展示内容与应用实际功能匹配，不用于营销、广告或引导付费。权限声明不代表 ACL 已获准。

基础接口需要 API20 编译 SDK 和运行系统，Stage 模型及有效 `UIAbilityContext`。Phone、Tablet 的系统模式限制，以及 PC/2in1 从 API26／HarmonyOS 7.0.0 起的支持条件，按[兼容性](../compatibility.md)核对。模拟器需 DevEco Studio 6.0.1 Release 及以上并核实目标系统支持。版本升级遵循[通用兼容性规则](../../../shared/compatibility-model.md#升级接入对所有特性通用)，按实际使用的接口判断版本要求。

## 1. 导入控制器资产

将 [FloatingBallController.ets](../assets/FloatingBallController.ets) 复制到工程控制器目录。类通过静态字段持有球控制器与状态，业务调用静态方法，无需另外保存或传入控制器。

```typescript
import { floatingBall } from '@kit.ArkUI';
import { common, Want } from '@kit.AbilityKit';
import { FloatingBallController } from '../controllers/FloatingBallController';
```

复用工程已有状态防止重复创建；控制器的持有者需覆盖跨应用展示期，不在页面暂时隐藏或应用退后台时自动停止。

## 2. 按内容选择模板并构造参数

| 模板 | 支持内容 | 必填项 | 启动后更新 |
|---|---|---|---|
| `STATIC` | 图标、标题 | template、title、icon | 不支持 |
| `NORMAL` | 标题、内容 | template、title | 支持，template 不可变 |
| `EMPHATIC` | 图标、标题、内容 | template、title；icon 可选 | 支持，template 不可变 |
| `SIMPLE` | 标题，可双行展示 | template、title | 支持，template 不可变 |

下面是 NORMAL 参数构造片段，`title`、`content` 来自已确认的业务状态；其他模板按表裁剪字段：

```typescript
const startParams: floatingBall.FloatingBallParams = {
  template: floatingBall.FloatingBallTemplate.NORMAL,
  title: title,
  content: content
};
```

`startParams` 和 `updateParams` 均为 `floatingBall.FloatingBallParams`，由调用方构造并原样传入；工具不拆分、补默认值或验证参数。启动和更新前由业务按以下约束检查：

- `title` 必填、非空，title 与 content 各不超过 64 UTF-8 字节。不能用 JavaScript `length` 代替字节数；多语言和 emoji 需要按编码后的字节数检查。
- icon 为 `image.PixelMap`，使用 `getPixelBytesNumber()` 确认像素总字节数不超过 192KB，建议宽高 128×128px；PNG 文件大小不能代替解码后的像素字节数。STATIC 图标失败时不继续启动。
- 从资源解码图标后缓存复用，解码完成后释放自有 ImageSource；PixelMap 在相关调用完成且业务不再使用时释放，避免更新中提前释放或每次更新重复解码。
- `backgroundColor` 使用不带透明度的十六进制颜色，如 `#008EF5`；不传时跟随系统深浅色默认背景。API26 的文字颜色另见第 7 步。
- 球使用系统模板，标题和内容不支持自定义字号。无需为球新增 `loadContent` 页面或 pages profile 注册。

## 3. 创建控制器、监听并启动

调用前完成权限、前台及能力检查。创建时传入完整 FloatingBallConfiguration，startParams 使用第 2 步构造的 FloatingBallParams。context 是实际 UIAbilityContext，want 是实际目标 Want。

```typescript
if (FloatingBallController.canUseFloatingBall() &&
    !FloatingBallController.floatingBallController) {
  await FloatingBallController.createFloatingBall(
    { context: context },
    undefined,
    undefined,
    want
  );
  await FloatingBallController.startFloatingBall(startParams);
}
```

将片段放入工程现有异步错误处理及防重复操作入口中，串行执行创建、启动和停止；create 返回后再次检查业务有效性和前台条件。创建方法在已有控制器时拒绝重复创建，但调用方仍需防止创建完成前的并发请求。

`createFloatingBall(config, onClick?, onStateChange?, want?)` 创建控制器并注册 click 和 stateChange，两个业务回调均可省略。启动不重复注册监听，启动和更新参数原样传入平台，不添加默认字段。

点击时仅在传入 want 的情况下发出 restoreMainWindow 请求，然后执行可选点击回调，不等待恢复完成；点击回调不是恢复成功通知，不需要重复恢复。恢复失败记录日志，目标页面由原有 onCreate／onNewWant 导航处理。业务回调自行处理异常。

## 4. 更新闪控球

```typescript
const updateParams: floatingBall.FloatingBallParams = {
  template: floatingBall.FloatingBallTemplate.NORMAL,
  title: title,
  content: content
};
await FloatingBallController.updateFloatingBall(updateParams);
```

仅在 STARTED 后更新，STATIC 不提供更新入口，template 必须与启动时相同。内容轮换也复用同一球控制器，通过不同的 title/content 更新，不重复创建或启动。数据更新事件刷新当前条目，轮换任务才推进到下一条；用稳定业务 ID 跟踪当前条目，删除后选择仍存在的下一条或首条，空列表停止轮换。每次从最新数据生成参数，高频事件合并，等本次更新完成后再提交下一次。停止或替换实例时清理定时器与业务订阅，旧请求结果不能更新新实例。详细见[内容更新与替换](binding.md#4-系统切换与业务更新)；独立球同样适用这些更新规则，无需为此接入绑定。updateParams 同样直接接收 floatingBall.FloatingBallParams；工具不添加默认标题、内容或背景色。按第 2 步检查参数边界，业务层合并高频更新。

## 5. 加载图标

图标解码作为独立资源片段放入工程已有工具目录，返回的 PixelMap 由业务缓存并在不再使用时释放：

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

const icon = await loadFloatingBallIcon(context, 'business-icon.png');
```

路径替换为实际 rawfile，读取或解码失败交给调用方处理。按第 2 步检查解码后的像素大小，再将 icon 放入 FloatingBallParams；重复使用时读取缓存。

## 6. 停止与状态处理

```typescript
await FloatingBallController.stopFloatingBall();
```

创建、启动、更新和停止均返回 Promise<void>，使用 then/catch 记录 hilog 日志，失败记录后继续抛给调用方，调用方使用 await/catch 处理；请求完成不代表生命周期结束，启动、停止分别以 STARTED／STOPPED 通知为准。未创建控制器时操作方法返回拒绝的 Promise，由调用方处理错误。停止失败保留控制器及监听供诊断或重试，不误报已关闭。

监听注册失败会尝试退订并抛出异常；启动失败保留控制器，可按实际状态重试 startFloatingBall，不重复 create。放弃尚未启动的实例时需退订并清空类引用，不能假定一定收到 STOPPED。

`canUseFloatingBall()` 仅返回能力检测结果（异常返回 false），不验证 ACL、应用前台或业务有效性，创建和启动不会自动调用它。

资产独占管理监听，业务通过可选回调接入；无参数 off 会取消对应事件的全部监听。用户删除、系统挤占和主窗口销毁同样通过 STOPPED 清理。真正结束业务时停止球，相关操作结束且图像不再使用后再释放图像。

### 绑定场景

按[绑定路线](binding.md)使用独立的 FloatViewBallController 组合资产，负责两端准备、绑定、单端启动、停止与释放，按需显式解绑。不要先执行独立球的创建启动片段；组合层不传球点击回调或 Want，系统负责窗球切换。

## 7. 按需接入高版本能力

| 可选能力 | 门槛与接入要点 |
|---|---|
| 应用内可见性 `setFloatingBallVisibilityInApp` | API24；false 表示应用前台时隐藏、后台时可见，不等于停止。默认及 true 在多任务界面之外可见；多任务界面球不可见。PC/2in1 仍需满足 API26 设备门槛。 |
| 销毁原因 `onDestroy`／`offDestroy` | API26；保存同一回调并配对退订。可记录主动停止、垃圾桶删除、长按删除、主窗口销毁或 SQUEEZE 挤占等原因；与 STOPPED 共用幂等清理，不能重复释放。 |
| `titleColor`／`contentColor` | API26；配置任一文字颜色必须同时配置 backgroundColor，验证文字与背景对比度。 |
| `textUpdateAnimationType` | API26；仅在业务需要时启用，默认无文本更新动画。 |

所选接口必须同时满足编译 SDK 与运行版本。旧 SDK 的源码不能仅包一层运行判断后仍引用不存在的类型、枚举或属性；只接入 API20 基础球时不携带这些增强字段和销毁回调。

## 异常与注意事项

每个操作记录阶段、实例和 `BusinessError.code/message`，按具体接口的错误码定位；不支持、未授权或功能关闭时沿用[回退策略](../fallback.md)。

| 现象／错误码 | 检查重点 |
|---|---|
| 201 | 宿主 USE_FLOAT_BALL 声明、ACL 批准及实际签名 profile |
| 801 | 系统版本、设备和 Tablet 模式；不以枚举的设备标签推断接口可用 |
| 1300019 | 空标题、UTF-8 字节超限、图标像素大小、颜色格式及增强参数条件 |
| 1300021／1300022 | 同应用多球或重复操作，检查创建和启动是否串行 |
| 1300024／1300025 | 控制器或球状态不支持当前操作，检查停止后仍更新等时序 |
| 1300026 | 恢复主窗口的包名、目标 Want、用户点击条件和额外权限 |
| 1300027／1300028 | 更新时修改了 template，或试图更新 STATIC |
| 1300034（API26+） | 与已有闪控窗冲突，核对是否采用正确绑定／停止流程 |

球在前台启动后可跨应用展示，不因此自动添加定位权限或后台定位任务。

## 验证与结束提醒

按[性能与验证](../performance-validation.md)记录静态、构建和实际运行证据：

- 前台创建与 STARTED、业务内容更新、点击恢复正确页面、主动停止与再次开启；连续点击和启动失败不能留下重复监听或假成功状态。
- STATIC 无更新入口；其他模板不能运行中换模板。验证空标题、中文／emoji 字节边界、图标超限、深浅色和长文本实际显示。
- 长按单个／全部删除、拖至垃圾桶、被其他应用球挤占、主窗口销毁后资源收敛；停止期间到达的更新不再执行。
- ACL 不可用、设备不支持、后台启动和低版本增强分支保留原业务；API24 应用内隐藏与停止分开验证，API26 销毁通知不重复清理。
- 拖拽吸边、位置记忆、旋转、多任务及键盘场景按系统实际行为验证；横屏不会自动避让输入法，不宣称系统在所有方向均能避让。绑定仅按需追加[绑定验收](binding.md)。

静态检查通过不等于设备功能通过；未具备签名、设备或系统条件的项目保留待验收状态。

**实施结束后的最终交付说明必须再次提醒：USE_FLOAT_BALL 是必须申请的受限 ACL 权限，并提供[开发者中心 ACL 申请链接](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)。** 同时接入闪控窗时再次说明 FLOAT_VIEW 的受限 ACL 与用户授权要求；实施前已提醒不能省略结束提醒。

接口约束以对应 API 和目标 SDK 为准。
