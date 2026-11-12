---
title: "独立闪控窗接入与生命周期"
summary: "说明独立闪控窗的 API 26 接入条件、ACL 与用户授权、页面注册、创建与监听、页面加载、窗口启动及停止清理。"
createdAt: "2026-11-10"
updatedAt: "2026-11-10"
tags: ["HarmonyOS", "闪控窗", "floatView", "API 26", "生命周期"]
---

# 独立闪控窗接入与生命周期

通过 `@kit.ArkUI` 的 `floatView` 在系统闪控窗中展示应用页面。接入前确认展示内容、宿主页面、模板、用户开启入口和结束展示的时机。以下步骤适用于独立闪控窗。需要在窗与球之间由系统切换时，参照[闪控窗／球绑定与解绑](binding.md)。

## 1. 核对能力与权限

- 编译 SDK 与运行系统须达到 API 26，使用 Stage 模型与实际宿主的 `UIAbilityContext`。先检查运行 API 和 `SystemCapability.Window.SessionManager`，再调用 `floatView.isFloatViewEnabled()`。设备、窗口模式和模拟器支持按目标环境核验。
- 窗须在应用前台启动。同一应用只启动一个独立闪控窗，已有闪控球或画中画时先等待其实际停止。
- 实际宿主 HAP 须申请并获得 `ohos.permission.FLOAT_VIEW` 的 ACL，核对实际签名 profile，并按用户操作取得 `user_grant` 授权。 [华为受限权限说明](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/restricted-permissions#ohospermissionfloat_view)

在宿主 `module.json5` 中合并声明，保留已有权限。`reason` 和 `abilities` 使用工程中的实际资源和 Ability 名称。

```json5
"requestPermissions": [
  {
    "name": "ohos.permission.FLOAT_VIEW",
    "reason": "$string:float_view_reason",
    "usedScene": {
      "abilities": ["EntryAbility"],
      "when": "inuse"
    }
  }
]
```

确认前置条件后，在用户开启入口检查授权。需要授权时调用以下代码。授权拒绝或请求失败时保留原业务。开启入口同时执行收藏或订阅时，分别处理业务操作结果和闪控窗开启结果。

```typescript
import { abilityAccessCtrl, common, Permissions } from '@kit.AbilityKit';

async function requestFloatViewAuthorization(context: common.UIAbilityContext): Promise<boolean> {
  const permissions: Permissions[] = ['ohos.permission.FLOAT_VIEW'];
  const manager: abilityAccessCtrl.AtManager = abilityAccessCtrl.createAtManager();
  const result = await manager.requestPermissionsFromUser(context, permissions);
  const grants = result?.authResults ?? [];
  return grants.length > 0 && grants.every((grant) => grant === 0);
}
```

申请的是用户授权，不能代替 FLOAT_VIEW 的 ACL 申请、宿主权限声明及签名 profile 配置。

## 2. 准备宿主页面和尺寸

在实际宿主的 pages profile 的 `src` 数组中注册 `pages/FloatViewPage` 等实际路径。业务内容可以是普通 `@Component`，由宿主 `@Entry` 页面承载。业务组件在 HAR 内时，宿主页面从该模块导入组件，系统加载的仍是宿主注册的页面路径。

```arkts
@Entry
@Component
struct FloatViewPage {
  build() {
    Column() {
      Text('业务内容')
    }
    .width('100%')
    .height('100%')
  }
}
```

模板选择 `ROUNDED_RECTANGLE` 或 `HORIZONTAL_BAR`。用 `floatView.getFloatViewLimits(templateType)` 获取 `minSize`、`maxSize` 和 `ratioLimits`，选取符合限制且宽高大于 0 的尺寸。窗口 API 使用 px。业务设计使用 vp 时，通过实际 `UIContext.vp2px()` 换算后再校验尺寸。页面的交互控件需避开系统返回的 `avoidArea`，模板和布局的完整处理见[闪控窗模板切换与页面避让](float-view-template-and-avoidance.md)。

## 3. 创建、监听、加载并启动

下面是接入现有开启入口的主流程示例。将字段和方法放在实际业务所有者中，控制器的持有期覆盖跨应用展示。调用前核对 ACL、前台状态和窗球或画中画冲突，并通过已有开启状态防止授权或创建返回前重复进入。

```typescript
import { floatView, window } from '@kit.ArkUI';
import { BusinessError, deviceInfo } from '@kit.BasicServicesKit';

private viewController: floatView.FloatViewController | undefined = undefined;

private async createWindow(): Promise<void> {
  try {
    if (this.viewController || !deviceInfo.apiAvailable('26.0.0') ||
      !canIUse('SystemCapability.Window.SessionManager') || !floatView.isFloatViewEnabled()) {
      return;
    }
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    if (!(await requestFloatViewAuthorization(context))) {
      return;
    }

    const config: floatView.FloatViewConfiguration = {
      context: context,
      templateType: floatView.FloatViewTemplateType.ROUNDED_RECTANGLE
    };
    const controller = await floatView.create(config);
    this.viewController = controller;
    const onStateChange = (info: floatView.FloatViewStateChangeInfo): void => {
      console.info(`Float view state: ${info.state}`);
      if (info.state === floatView.FloatViewState.STOPPED && this.viewController === controller) {
        this.viewController = undefined;
        controller.offStateChange(onStateChange);
        // 清理本次实例关联的业务资源。
      }
    };
    controller.onStateChange(onStateChange);

    const limits = floatView.getFloatViewLimits(config.templateType);
    const size: window.Size = { width: limits.maxSize.width, height: limits.maxSize.height };
    await controller.setUIContext('pages/FloatViewPage');
    await controller.setWindowSize(size);
    await controller.start();
  } catch (err) {
    const error = err as BusinessError;
    console.error(`Open float view failed: ${error.code}, ${error.message}`);
  }
}
```

- `requestFloatViewAuthorization` 使用第 1 步的授权函数。创建配置的 `isConfirmOnClose` 默认 `false`，可按业务需要开启关闭确认。
- `pages/FloatViewPage` 替换为宿主实际注册的路径。示例使用模板的最大尺寸，业务选值时按第 2 步同时核对宽高与比例。需要共享状态时，用 `setUIContext(page, storage)` 传入 `LocalStorage`。跨包页面将加载语句替换成 `setUIContextByName(routeName, storage)`，随后照常设置尺寸并启动。
- 需要感知尺寸约束和实际矩形时，分别注册 `onLimitsChange` 和 `onRectChange`。保存实际注册的回调，由同一个监听所有者负责退订。
- 在授权、创建、加载和设置尺寸等异步步骤返回后，复核本次请求、窗口所有者和前台状态。启动前取消或准备失败且放弃实例时，主动清理已注册的监听和引用。启动请求已发出但失败时，保留实例及监听，按实际状态决定是否重试或停止。

收到 `STARTED` 才确认已显示。`HIDDEN` 和 `IN_SIDEBAR` 期间保留实例，`ERROR` 按异常处理。

## 4. 停止并清理

在串行的结束入口使用同一控制器发出停止请求。

```typescript
const controller = this.viewController;
if (controller !== undefined) {
  await controller.stop().catch((error: BusinessError) => {
    console.error(`Stop float view failed: ${error.code}, ${error.message}`);
  });
}
```

开启尚在进行时，先取消该请求。若启动请求已经发出，等待请求结束后再按实际状态处理停止。收到当前实例的 `STOPPED` 后，退订本次注册的回调并清空引用。若同时注册了尺寸限制和矩形监听，用原回调调用 `offLimitsChange` 和 `offRectChange`。同步清理业务订阅、定时器和页面资源。通过 `getWindowProperties().windowId` 取得的窗口 ID，在停止或异常时失效。

主动停止、标题栏或侧栏关闭、拖至垃圾桶、系统替换和关联主窗口销毁均可能触发停止。请求完成后仍以 `STOPPED` 确认终态。请求失败时保留控制器和监听供诊断或重试。应用退到后台或主页面暂时隐藏时，按业务展示周期保留窗口。 [闪控窗 API 参考](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-floatview)

## 验证要点

- 实测前台授权、页面加载、`STARTED`、内容更新、关闭及再次开启。覆盖拒绝授权、无效页面、后台启动、重复点击和已有球或画中画的冲突场景。
- 确认失败重试复用有效实例，用户关闭及系统停止均能回收监听和资源。缺少签名、设备或相应窗口模式时，保留待验收状态。
