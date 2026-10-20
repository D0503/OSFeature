# 窗球代码资产

以下为合入现有所有者的方法片段，非完整业务工程。所有调用入口需完成[权限与设备门禁](compatibility.md)，并串行执行，复用真实 UIAbilityContext、页面、Want 与业务内容。运行版本/SysCap 检查在调用前执行；编译 SDK 也必须能解析导入符号。

## 闪控窗

```typescript
import { floatView } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
import { deviceInfo } from '@kit.BasicServicesKit';

async function prepareFloatView(context: common.UIAbilityContext, page: string,
  onState: (info: floatView.FloatViewStateChangeInfo) => void): Promise<floatView.FloatViewController | undefined> {
  if (deviceInfo.sdkApiVersion < 26 || !canIUse('SystemCapability.Window.SessionManager')) return undefined;
  if (!floatView.isFloatViewEnabled()) return undefined;
  const view = await floatView.create({ context, templateType: floatView.FloatViewTemplateType.ROUNDED_RECTANGLE });
  await view.setUIContext(page);
  view.onStateChange(onState);
  return view;
}
```

`page` 必须已写入宿主 pages profile。准备方法不启动；所有者持有返回值，完成授权与前台检查后 `await view.start()`。异常交给所有者记录并清理。注册的 `onState` 应在 STOPPED 使 ID 失效、调用 `view.offStateChange(onState)` 并释放本实例；`ERROR` 不当成功。await 返回时所有者已退出则退订，不再启动。

显示内容用原工程页面；独立小页可使用以下骨架，把 `content` 接到现有状态，不固化示例业务：

```typescript
@Entry
@Component
struct FloatContent {
  @State content: string = '';
  build() {
    Column() { Text(this.content) }
    .width('100%')
    .height('100%')
  }
}
```

尺寸按 `getFloatViewLimits(templateType)`、`onLimitsChange`、`onRectChange` 的实际 px 与比例限制处理；不在通用资产中固定尺寸。跨包页面按 `setUIContextByName` 对接原工程命名路由。

## 闪控球

```typescript
import { floatingBall } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
import { deviceInfo } from '@kit.BasicServicesKit';

async function prepareFloatingBall(context: common.UIAbilityContext,
  onClick: () => void,
  onState: (state: floatingBall.FloatingBallState) => void): Promise<floatingBall.FloatingBallController | undefined> {
  if (deviceInfo.sdkApiVersion < 20 || !canIUse('SystemCapability.Window.SessionManager')) return undefined;
  if (!floatingBall.isFloatingBallEnabled()) return undefined;
  const ball = await floatingBall.create({ context });
  ball.on('click', onClick);
  try {
    ball.on('stateChange', onState);
  } catch (error) {
    ball.off('click', onClick);
    throw error;
  }
  return ball;
}
```

所有者保存 `ball` 与同一回调。准备后按业务参数 `await ball.startFloatingBall(params)`；失败时退订并保留原业务。独立球 click 中可用真实 Want 恢复主窗，绑定球只让系统切换。STOPPED 后 `off('click', onClick)`、`off('stateChange', onState)`，再清空引用与自有图像。需要更新时先验证非 STATIC，标题及内容各≤64 UTF-8字节、图标像素≤192KB。

## 绑定

复用上述两端准备逻辑；均未启动时调用 `await floatView.bind(view, ball, params)`，然后只 `await view.start()` 或只 `await ball.startFloatingBall(params)`。任何准备/绑定失败不继续启动，清理已经注册的回调。停止只选一端发请求、由两端终态统一收敛。完整时序和验收见[绑定流程](binding.md)。

## 可选高版本接口

`setFloatingBallVisibilityInApp` 需API24守卫；`onDestroy/offDestroy`、颜色和动画需API26守卫。低版本编译样例不引用这些符号。`restoreMainWindow` 只从符合系统限制的用户点击触发，不自动后台拉起。
