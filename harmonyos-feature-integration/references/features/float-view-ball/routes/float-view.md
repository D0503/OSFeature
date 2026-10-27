# 闪控窗开发步骤（API 26 起）

通过 `@kit.ArkUI` 的 `floatView` 创建系统闪控窗，加载业务页面并管理窗口尺寸、状态和关闭流程。本路线用于独立闪控窗；窗球切换按需读取[绑定路线](binding.md)，使用独立组合资产。

## 开发准备

先确定展示内容、页面路径、模板、用户开启入口和结束展示的时机。复用原工程业务状态与导航，控制器的持有者需覆盖跨应用展示期。

**实施前（首次修改工程前）提醒开发者：`ohos.permission.FLOAT_VIEW` 是受限 ACL 权限，必须申请并取得用户授权。** 在 HarmonyOS 开发者中心平台[申请 ACL 权限](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)，核对实际签名 profile 包含该权限；ACL 获准不能代替用户授权。完整前提见[兼容性与权限](../compatibility.md)。

在实际宿主 HAP 的 `module.json5` 中合并权限声明，reason 资源和 abilities 替换为工程实际值：

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

需要 API26 编译 SDK 和运行系统、Stage 模型及有效 `UIAbilityContext`。按兼容性文档核对设备与窗口模式，不推定模拟器可用。版本升级遵循[通用兼容性规则](../../../shared/compatibility-model.md#升级接入对所有特性通用)，低版本或不支持时沿用原业务。仅允许应用在前台启动；同应用只启动一个闪控窗，已有闪控球或画中画时需先完成停止。

## 1. 导入控制器资产

将 [FloatViewController.ets](../assets/FloatViewController.ets) 复制到工程控制器目录。类通过静态字段持有独立闪控窗实例与状态，页面和窗口内容共享同一控制器。

```
import { floatView, window } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { FloatViewController, requestFloatViewPermission } from '../controllers/FloatViewController';
```

`FloatViewController.canUseFloatView()` 分步检查 API26、SysCap 和设备能力，异常返回 false。调用方在创建前执行；能力检测不代表已获授权或应用处于前台。旧编译 SDK 无法解析的符号不能仅靠运行判断解决。

## 2. 按用户操作申请授权

使用资产导出的独立函数 `requestFloatViewPermission(context)`，传入实际 UIAbilityContext；它不是 FloatViewController 的静态方法。

```
const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
const granted = await requestFloatViewPermission(context);
if (!granted) {
  return;
}
```

函数返回 Promise<boolean>：授权结果非空且全部通过时返回 true；拒绝、空结果或申请异常时返回 false，异常通过 hilog 记录。用户主动开启闪控窗时，在能力检查通过后调用一次，只有返回 true 才继续创建；拒绝或失败时保留原业务并使用已有提示方式，不循环请求。

若入口同时包含收藏、订阅等业务操作，应分别记录业务结果与闪控窗开启结果。已完成的业务操作不因授权被拒绝而撤销；通过原有提示说明闪控窗未开启。授权成功也不代表窗口已经显示，实际展示仍以 STARTED 为准。

此函数申请的是用户授权，不能代替 FLOAT_VIEW 的 ACL 申请、宿主权限声明及签名 profile 配置。第 3 步已包含此调用，将两步合入同一入口，避免重复申请。

## 3. 创建控制器、监听并启动

创建配置直接传入 `floatView.FloatViewConfiguration`。模板可选 `ROUNDED_RECTANGLE` 或 `HORIZONTAL_BAR`；`isConfirmOnClose` 按业务需要配置，默认 false。权限申请仍使用第 2 步的方法。

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

`createFloatView(config, onStateChange?, onLimitsChange?, onRectChange?)` 创建控制器并注册监听，三个业务回调均可选。状态和尺寸限制监听始终注册，矩形监听仅在传入回调时注册；不要对同一控制器重复注册。业务回调自行处理其异常。

- `pages/FloatViewPage` 替换为实际页面，在宿主 pages profile 的 `src` 中注册同一路径。窗口内容使用[页面骨架](../assets-catalog.md#闪控窗)或现有业务页面。
- `prepareFloatView(page, size, storage?)` 仅加载页面和设置尺寸；`startFloatView(page, size, storage?)` 复用准备方法后发出启动请求；页面状态可通过可选 LocalStorage 传递。跨包页面需按命名路由改用平台 `setUIContextByName`，不要再调用会按路径加载页面的 startFloatView。
- 创建与启动等方法使用 async/await，返回 Promise<void>；通过 hilog.debug/error 记录结果，try/catch 捕获失败后继续抛给调用方。`startFloatView` 完成不代表启动流程结束，以 STARTED 通知为准。HIDDEN、IN_SIDEBAR 保留控制器与业务状态；ERROR 不当作启动成功。
- 复用工程入口的防重复操作状态，串行调用创建、启动和停止，避免 create 返回前再次创建。每次 await 后复核所有者与前台条件。创建和启动方法不会自动申请权限或检查前台，授权函数需由调用方显式调用。
- 注册监听失败会尝试退订并抛出错误。页面加载或启动失败时保留控制器，不重复 create；根据实际状态重试启动，或停止并清理本次监听。启动前准备失败不能假定一定会收到 STOPPED，需在放弃该实例时退订并清空引用。
- 资产独占管理该控制器的监听，无参数 off 会取消对应事件的全部监听；业务使用可选回调，不另建独立监听所有者。

### 宿主页面与功能组件

功能模块可以只导出普通 `@Component`，由宿主 HAP 的 `@Entry` 页面承载。将下文的 `FloatViewContent` 放在功能模块或宿主组件目录，宿主页面导入后使用：

```typescript
// 宿主 pages/FloatViewPage.ets，按组件实际位置调整导入。
import { FloatViewContent } from '../components/FloatViewContent';

@Entry
@Component
struct FloatViewPage {
  build() {
    FloatViewContent()
  }
}
```

在宿主 pages profile 的 `src` 数组中合并 `"pages/FloatViewPage"`，保留其他页面。`setUIContent` / `startFloatView` 传入这个宿主页面路径，不能把普通组件所在文件路径当作页面路径；组件位于 HAR 时由宿主从该模块导入即可。

## 4. 更新内容、尺寸与模板

内容更新使用已加载页面的正常状态管理。主页面和窗页面共享同一份业务数据，使用宿主已有 AppStorage／LocalStorage 等方案驱动刷新；不因字段变化或条目增删重新 setUIContent、create 或 start。列表使用稳定业务 ID 作为条目标识。尺寸单位为 px，宽高必须大于 0；通过 `getFloatViewLimits(templateType)` 读取 minSize、maxSize 和 ratioLimits，再调用 `await FloatViewController.setWindowSize(size)`。第 3 步采用返回的最大尺寸，业务可在尺寸和比例约束内选择合适大小。

`onLimitsChange` 返回约束变化，不是实际窗口尺寸；需要动态布局时在回调中更新业务保存的约束。系统可能调整请求尺寸，实际位置和尺寸通过 createFloatView 的可选 onRectChange 回调获取，资产在 STOPPED 时退订。

切换模板时传入完整 `TemplateProperty`，先读取目标模板限制并选择尺寸：

```
const templateType = floatView.FloatViewTemplateType.HORIZONTAL_BAR;
const limits = floatView.getFloatViewLimits(templateType);
const property: floatView.TemplateProperty = {
  templateType: templateType,
  size: { width: limits.maxSize.width, height: limits.maxSize.height }
};
await FloatViewController.switchTemplate(property);
```

switchTemplate 只改变系统模板和窗口尺寸，页面还需同步改变自己的展开／紧凑布局状态；等待接口成功后再提交页面状态，失败保留原布局。切回原模板时重新读取目标模板的限制。条目数量、显示区域和 onLimitsChange 变化时，按当前模板重算尺寸；设计尺寸从 vp 转成 px 后再校验宽高和比例限制，实际布局参考 onRectChange 与 avoidArea。详细流程见[绑定场景的更新与替换](binding.md#4-系统切换与业务更新)，这些窗更新步骤也可独立使用。

片段放入现有异步错误处理入口，按实际状态控制操作；控制器不存在时方法抛出异常。根据 `FloatViewController.getWindowProperties().avoidArea` 布局，避免交互控件落入不响应区域，不固定为某款手机的尺寸。

### 展开／收起页面片段

上箭头将闪控窗切为紧凑横条，下箭头切回展开矩形；这是窗模板切换，两个形态都不是闪控球。以下组件复用已创建的控制器，初始布局对应创建时的 ROUNDED_RECTANGLE；若初始模板为 HORIZONTAL_BAR，将 compact 初值设为 true。

```typescript
import { floatView } from '@kit.ArkUI';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { FloatViewController } from '../controllers/FloatViewController';

@Component
export struct FloatViewContent {
  @State compact: boolean = false;
  @State switching: boolean = false;

  private async changeLayout(compact: boolean): Promise<void> {
    this.switching = true;
    try {
      const templateType = compact
        ? floatView.FloatViewTemplateType.HORIZONTAL_BAR
        : floatView.FloatViewTemplateType.ROUNDED_RECTANGLE;
      const limits = FloatViewController.getFloatViewLimits(templateType);
      if (limits === null) { return; }
      const property: floatView.TemplateProperty = {
        templateType: templateType,
        size: { width: limits.maxSize.width, height: limits.maxSize.height }
      };
      await FloatViewController.switchTemplate(property);
      this.compact = compact;
    } catch (error) {
      const err = error as BusinessError;
      hilog.error(0xF811, 'FloatViewContent',
        'Switch layout failed: %{public}s, %{public}s', String(err.code), err.message);
    } finally {
      this.switching = false;
    }
  }

  build() {
    Column() {
      if (this.compact) {
        Row() {
          Text('业务摘要').layoutWeight(1)
          SymbolGlyph($r('sys.symbol.chevron_down'))
            .accessibilityText('展开')
            .enabled(!this.switching)
            .onClick(() => { this.changeLayout(false); })
        }
        .width('100%')
      } else {
        Column() {
          Text('业务详细内容')
          // 在这里接入现有业务组件及共享数据。
        }
        .layoutWeight(1)
        Row() {
          SymbolGlyph($r('sys.symbol.chevron_up'))
            .accessibilityText('收起')
            .enabled(!this.switching)
            .onClick(() => { this.changeLayout(true); })
        }
        .width('100%')
        .justifyContent(FlexAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
  }
}
```

片段以目标模板的最大尺寸演示调用，实际替换为业务所需且满足模板约束的尺寸。文字替换为真实内容并沿用工程国际化；布局按 avoidArea 留出交互避让空间。若展开、紧凑内容拆成子组件，可由父组件 `@Provide` 保存布局状态、子组件 `@Consume` 共享；仍在 switchTemplate 成功后修改状态，不另建控制器或重载页面。

**内容驱动尺寸**：展开布局按头部、内容条目和操作区计算高度，紧凑布局按摘要和操作区计算宽度；通过实际 UIContext 将 vp 换为 px，再按目标模板的宽高及比例约束选取尺寸。内容超过窗口上限时使用内部滚动或截断，不复制固定的单行高度、断点或窗口大小。

**可选过渡效果**：需要淡入淡出时，可在页面 Stack 顶层放置覆盖层，通过 opacity 与 animation 控制，并设置 `hitTestBehavior(HitTestMode.None)`。覆盖层只用于视觉过渡，不承担防窥保护。切换完成或失败后均收起覆盖层；动画时长不作为系统接口完成依据，页面退出时清理自己创建的定时任务。

## 5. 恢复主窗口与读取窗口属性

仅从闪控窗中的用户点击触发恢复，且窗口需处于 STARTED 状态。传入的是 `Record<string, Object>` 类型的 wantParameters，用于主窗口 `onNewWant` 处理业务路由，不是闪控球接口的 Want：

```
// 在闪控窗页面的用户点击回调中调用。
FloatViewController.restoreMainWindow().catch((err: BusinessError) => {
  console.error(`Restore main window failed: ${err.code}, ${err.message}`);
});
```

需要路由参数时调用 `FloatViewController.restoreMainWindow(wantParameters)`。主窗口处于 PAUSED 生命周期或多任务状态时可能失败；保留窗口业务状态，不改为后台自动拉起。

### 在 onNewWant 中接收参数并处理导航

恢复主窗口只负责将主窗口带到前台，业务页面跳转需在原有 `EntryAbility.onNewWant` 和页面导航逻辑中处理。闪控窗点击时传入业务标识，主窗口从 `want.parameters` 读取同名字段：

```
// 在闪控窗的用户点击回调中，itemId 为当前业务数据的标识。
const wantParameters: Record<string, Object> = { itemId: itemId };
FloatViewController.restoreMainWindow(wantParameters).catch((err: BusinessError) => {
  console.error(`Restore main window failed: ${err.code}, ${err.message}`);
});
```

在 EntryAbility 中导入 `Want`，将以下处理合入已有 onNewWant，不覆盖其他启动来源的处理：

```
import { Want } from '@kit.AbilityKit';

onNewWant(want: Want): void {
  const itemId = want.parameters?.itemId;
  if (typeof itemId === 'string' && itemId.length > 0) {
    // 通过事件监听或应用全局UI状态存储AppStorageV2等其他方式方式进行具体页面跳转
    this.context.eventHub.emit('openBusinessDetail', itemId);
  }
}
```

例如，主页面使用同一 UIAbilityContext 的 eventHub 监听该事件，校验标识对应的数据存在且可访问后，通过工程现有 Router 或 Navigation 打开详情。`itemId` 和事件名替换为实际业务约定。监听需在发送事件前就绪，页面销毁时用原回调退订；尚未就绪时由已有状态管理暂存导航请求，待页面就绪后消费。参数缺失或无效时沿用原有入口逻辑，不跳转到无效页面。

如果业务要求进入详情时结束闪控窗，可在确认有效参数后调用 `FloatViewController.stopFloatView()` 并处理失败；STOPPED 负责监听和控制器清理。停止窗口是业务选择，不作为恢复主窗口的默认动作，也不因收到 onNewWant 自动重新创建窗口。

`FloatViewController.getWindowProperties()` 同步返回属性，启动后才读取 `windowId`，未启动、STOPPED 或 ERROR 时不得调用。需要保存 ID 的业务应在停止或异常时使其失效，不能跨实例复用。

## 6. 停止与资源释放

```
FloatViewController.stopFloatView().catch((err: BusinessError) => {
  console.error(`Stop float view failed: ${err.code}, ${err.message}`);
});
```

实际结束以 STOPPED 通知为准，状态回调负责退订和清空引用。停止失败时保留引用用于诊断或重试，不宣称窗口已关闭。停止和恢复方法返回 Promise<void>，可使用 await/catch 处理请求结果；停止请求完成仍不能代替 STOPPED 通知。

主动停止、标题栏关闭、侧栏关闭、拖至垃圾桶、系统替换和关联主窗口销毁都可能结束窗口。业务在终态同步释放自有订阅、定时器及页面资源；不在主页面暂时隐藏或应用退后台时自动停止跨应用展示。

## 异常与注意事项

| 现象 | 检查重点 |
|---|---|
| 权限失败 | 宿主 FLOAT_VIEW 声明、reason 资源、ACL、实际签名 profile 和用户授权 |
| 不支持或能力检测失败 | API26、SysCap、设备与窗口模式、isFloatViewEnabled；失败保留原业务 |
| 空窗或页面加载失败 | pages profile 路径、页面资源、加载完成后才 start |
| 尺寸不符 | px 单位、当前模板尺寸与比例约束、onRectChange 实际结果 |
| 重复窗口或启动冲突 | 创建入口并发、应用前台、已有窗／球／画中画是否已结束 |
| 恢复失败 | 用户点击来源、STARTED 状态、主窗口生命周期及参数类型 |
| 停止后仍有回调 | 配对退订状态、限制及自行添加的矩形监听，清理业务订阅 |

错误记录具体操作及 `BusinessError.code/message`，其他问题见[排障](../troubleshooting.md)；不支持、未授权及功能关闭沿用[回退策略](../fallback.md)。

## 验证与结束提醒

按[性能与验证](../performance-validation.md)记录证据：

- 授权通过后前台创建、页面加载、STARTED、内容更新、关闭及再次开启。
- 权限拒绝、查询失败、后台启动、无效页面、重复点击与已有球／画中画冲突，不误报启动成功。
- 两类模板、尺寸与比例限制变化、实际矩形、交互避让区域、点击恢复正确业务页面。
- 拖动、最小化进入侧栏、恢复、用户关闭、系统替换和主窗口销毁后监听与资源收敛；侧栏及垃圾桶操作按设备和模式支持条件验收。
- 加载、启动及停止失败后保留可诊断状态，重试不产生重复监听。

静态检查通过不等于设备功能通过，缺少签名或适配设备时保留待验收状态。

**实施结束后的最终交付说明必须再次提醒：FLOAT_VIEW 是受限 ACL 权限，必须完成[ACL 申请](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)并取得用户授权。** 接入后需要重新签名；本地调试使用自动签名时，同意本次权限申请，并核对更新后的签名 profile 包含所需权限。声明权限或编译通过不能证明权限已生效。

### 分步调用与补充监听

需要单独加载页面、设置尺寸再启动时，使用同一个控制器：

```typescript
await FloatViewController.setUIContent('pages/FloatViewPage', storage);
await FloatViewController.setWindowSize(size);
await FloatViewController.startFloatView();
```

`startFloatView(page, size, storage?)` 仍支持一次完成准备与启动。`getFloatViewLimits(template)` 查询失败返回 null；`getFloatViewProperties()` 在窗口不可用或查询失败时返回 undefined，调用方先判断再使用。

`registerStateChangeCallback(state, callback)` 为指定状态设置业务回调，同状态再次注册会覆盖；`unRegisterStateChangeCallback()` 清除这些业务回调，保留内部状态更新和 STOPPED 清理。创建时传入的 onStateChange 不受该方法影响。

尺寸限制使用 `registerLimitsChangeCallback(callback)` / `UnRegisterLimitsChangeCallback(callback?)`；矩形变化使用 `onRectChangeCallback(callback)` / `offRectChangeCallback(callback?)`。传原回调只退订该回调，不传则退订该类全部监听，包括创建时注册的监听。STOPPED 统一清理，后续创建时重新注册。
