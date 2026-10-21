# 防窥保护开发步骤

## 开发准备

确认[兼容性](compatibility.md)中的设备、API、人脸识别及系统/应用开关条件。按[权限声明与 ACL](compatibility.md#权限声明与-acl)在实际宿主 `module.json5` 中声明 `ohos.permission.DLP_GET_HIDE_STATUS`，配置 `reason`、`usedScene` 及对应字符串资源。

**实施前（首次修改工程前）提醒开发者：`ohos.permission.DLP_GET_HIDE_STATUS` 是受限 ACL 权限。** 仅本地调试防窥保护能力，自动签名时同意权限申请即可；应用上架需使用此能力，须在 HarmonyOS 开发者中心平台[申请 ACL 权限](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)。

先确定需要保护的实际内容和窗口。下面的 `isPrivacyHidden` 表示目标内容的隐藏状态：工程已有对应状态时直接复用，并保留原来的初始显示策略；没有时再按此名称定义。必须将状态接入目标内容的实际渲染逻辑，隐藏时显示已确认的替代内容，恢复时展示原数据，不修改业务数据本身。

## 1. 复用工具文件并准备页面导入

将[AntiPeepUtils.ets](assets/AntiPeepUtils.ets)复制到工程工具目录。所需函数、返回值和限制见[工具资产](assets-catalog.md)，实施不依赖能力包以外的工程文件。

完整文件需要 API23 编译 SDK。API20 状态感知或 API21 系统蒙层工程按需提取对应函数和导入，移除较新方法及类型引用；仅增加运行版本判断不能解决旧编译 SDK 缺少符号的问题。

页面文件顶部导入基础状态感知需要的接口，路径按实际目录调整：

```
import { dlpAntiPeep } from '@kit.DeviceSecurityKit';
import { deviceInfo } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import {
  AntiPeepCallback,
  canUseAntiPeep,
  isAntiPeepOn,
  getAntiPeepInfo,
  listenOnAntiPeepStatus,
  listenOffAntiPeepStatus
} from '../utils/AntiPeepUtils';
```

## 2. 按所选能力定义状态和回调

这些是页面管理显示、订阅和异步调用的字段，不是平台强制的变量名称；工程已有等价状态时直接复用。仅一次读取开关或窥视状态时，不需要声明监听、页面可见性和请求标志，按版本及权限条件直接调用对应查询函数即可。以下步骤用于页面持续监听并保护内容。

| 字段 | 何时需要 | 作用 |
|---|---|---|
| `isPrivacyHidden` | 需要隐藏内容时，优先复用已有状态 | 驱动目标内容隐藏和恢复 |
| `isPageVisible` | 页面接入 | 页面隐藏后停止处理通知及异步查询结果 |
| `isListenOn` | 注册状态监听时 | 避免重复订阅，并在退出时判断是否退订 |
| `antiPeepCB` | 注册状态监听时 | 将通知交给与初始状态相同的处理方法 |
| `isSystemLayerTriggered` | 选择系统蒙层时 | 记录本次页面进入是否已成功触发蒙层 |
| `isMaskRequesting` | 选择系统蒙层时 | 防止并发获取窗口和重复请求蒙层 |
| `isRequestingAntiPeep` | 接入用户主动设置入口时 | 防止重复拉起设置弹框 |

基础接入只定义以下状态和回调。`isPrivacyHidden` 的初始值应与工程接入前的显示策略一致；原来默认隐藏的内容继续保持隐藏。

```
@State private isPrivacyHidden: boolean = false;
private isListenOn: boolean = false;
private isPageVisible: boolean = false;
private antiPeepCB: AntiPeepCallback = {
  onStatusChanged: async (status: dlpAntiPeep.DlpAntiPeepStatus): Promise<void> => {
    await this.handleAntiPeepStatus(status);
  }
};
```

## 3. 统一处理初始状态和通知

初始状态和监听通知都交给此方法。入口先检查页面可见性、运行版本和设备能力；PASS 恢复指定内容；HIDE 先隐藏内容，再按已选接入范围处理系统蒙层。无法确认状态时保留当前显示，不将查询失败当作 PASS。

PASS=0，HIDE=1。机主独自注视时为非窥视，机主与非机主共同注视时为窥视；没有机主使用或机主分享场景返回非窥视，不能仅凭出现其他人就推断 HIDE。

以下处理内容的隐藏和恢复，在 HIDE 分支隐藏内容后预留系统蒙层接入位置。需要覆盖窗口时，按第 6 步补充完整分支及其导入、字段。状态变更必须对应实际目标控件的渲染。

```typescript
private async handleAntiPeepStatus(status: dlpAntiPeep.DlpAntiPeepStatus): Promise<void> {
  if (!this.isPageVisible || deviceInfo.sdkApiVersion < 20 || !canUseAntiPeep()) {
    return;
  }
  switch (status) {
    case dlpAntiPeep.DlpAntiPeepStatus.PASS:
      this.isPrivacyHidden = false;
      break;
    case dlpAntiPeep.DlpAntiPeepStatus.HIDE:
      this.isPrivacyHidden = true;
      // 系统蒙层的可选接入位置，完整分支见第 6 步。
      break;
    default:
      hilog.warn(0x0000, 'AntiPeepUtils', '无法确认窥视状态：%{public}d', status);
      break;
  }
}
```

初始状态和后续通知共用此方法。HIDE 隐藏内容，只有明确的 PASS 才恢复；未选择系统蒙层时，保留上述分支即可。

## 4. 检查设备能力和开关，再读取状态并订阅

设备不支持时提示并返回；应用开关未开启或无法确认时，进入 `if (!opened)` 分支，清理本次订阅，并在该分支预留应用内开启防窥的接入位置。未选择此可选能力时，仅提示用户检查设置并返回。确认开关开启后，读取并处理当前状态，再按订阅标志决定是否注册监听。提示沿用工程已有反馈方式，以下使用系统 Toast。

```typescript
private async initAntiPeepStatus(): Promise<void> {
  try {
    if (!this.isPageVisible) {
      return;
    }
    if (deviceInfo.sdkApiVersion < 20 || !canUseAntiPeep()) {
      this.getUIContext().getPromptAction().showToast({ message: '当前设备不支持防窥保护' });
      return;
    }

    const opened = await isAntiPeepOn();
    if (!opened) {
      if (this.isListenOn) {
        listenOffAntiPeepStatus();
        this.isListenOn = false;
      }
      // 应用内开启防窥的接入位置，具体分支见“可选：用户主动开启防窥”。
      this.getUIContext().getPromptAction().showToast({ message: '应用防窥保护未开启或无法获取开关状态，请通过已有设置入口开启' });
      return;
    }

    const info = getAntiPeepInfo();
    this.handleAntiPeepStatus(info);
    if (!this.isListenOn) {
      this.isListenOn = listenOnAntiPeepStatus(this.antiPeepCB);
    }
  } catch (error) {
    hilog.error(0x0000, 'AntiPeepUtils', '初始化防窥保护失败：%{public}s', String(error));
  }
}
```

`isAntiPeepOn()` 在开关关闭、不支持或查询异常时均返回 `false`，具体原因查看工具日志。页面隐藏后不继续处理已返回的开关查询结果。需要应用内设置时，在上述 `if (!opened)` 分支的标注位置接入后面的可选代码；已开启分支和后续状态读取、订阅逻辑保持不变。

确认开关开启后，`getAntiPeepInfo()` 获取初始状态并交给第 3 步，随后在尚未订阅时注册监听。状态查询失败返回的 `-1` 不作为 PASS，仍可订阅后续通知。`isListenOn` 直接保存订阅函数的返回值，失败原因由工具日志记录。

## 5. 页面展示时启动初始化

将防窥初始化合入实际页面展示生命周期，保留工程已有初始化行为。

```typescript
onPageShow(): void {
  this.isPageVisible = true;
  this.initAntiPeepStatus();
}
```

## 6. 按需增加系统蒙层

只有目标明确要求覆盖窗口时，才接入本步骤。在第 3 步 HIDE 分支隐藏内容后，由状态通知触发蒙层处理；不需要每次再让用户点击。已有用户可控保护策略时，复用该策略作为请求条件，不新增设置控件。

页面顶部补充导入：

```typescript
import { window } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
import { showSystemMaskLayer } from '../utils/AntiPeepUtils';
```

页面组件补充以下两个标志，仅在选择系统蒙层时定义：

```typescript
private isSystemLayerTriggered: boolean = false;
private isMaskRequesting: boolean = false;
```

**用下面的完整分支替换第 3 步的 HIDE 分支。** 替换范围从 `case dlpAntiPeep.DlpAntiPeepStatus.HIDE:` 开始，到该分支最后的 `break;` 为止；PASS 和 default 分支保持不变。代码必须位于 `handleAntiPeepStatus` 的 switch 内，不能放在处理函数之外或追加到已有 `break;` 之后。

```typescript
case dlpAntiPeep.DlpAntiPeepStatus.HIDE:
  this.isPrivacyHidden = true;

  if (deviceInfo.sdkApiVersion < 21) {
    break;
  }
  if (this.isSystemLayerTriggered || this.isMaskRequesting) {
    hilog.info(0x0000, 'AntiPeepUtils', '本次页面已触发蒙层或请求正在处理中');
    break;
  }

  this.isMaskRequesting = true;
  try {
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    const windowClass = await window.getLastWindow(context);
    if (!this.isPageVisible || !this.isPrivacyHidden) {
      break;
    }
    const windowId = windowClass.getWindowProperties().id;
    if (!Number.isInteger(windowId) || windowId <= 0) {
      hilog.warn(0x0000, 'AntiPeepUtils', '受保护窗口 ID 无效');
      break;
    }

    const applied = await showSystemMaskLayer(windowId);
    if (this.isPageVisible) {
      this.isSystemLayerTriggered = applied;
    }
    if (!applied) {
      hilog.warn(0x0000, 'AntiPeepUtils', '系统防窥蒙层未成功触发');
    }
  } catch (error) {
    hilog.error(0x0000, 'AntiPeepUtils', '获取窗口或触发蒙层失败：%{public}s', String(error));
  } finally {
    this.isMaskRequesting = false;
  }
  break;
```

如需检查已有的用户保护策略，在 `this.isPrivacyHidden = true;` 之后、API21 检查之前增加策略判断；未启用蒙层时直接结束分支，敏感内容继续保持隐藏。

系统蒙层通常与状态感知组合。工程已有可信的窥视状态订阅时，直接在该回调中接入蒙层处理，避免重复注册。

该取值方式用于已确认由页面保护的普通应用窗口，其 ID 来自 `getWindowProperties().id`。工程已有窗口管理器时，直接使用其中当前存活、可见且归属明确的目标窗口正整数 ID。

蒙层结果以工具返回值为准。失败或窗口无效时保持内容隐藏，只有明确的 PASS 才恢复内容。窗口获取完成后复用 `isPrivacyHidden` 检查当前是否仍需保护；`isSystemLayerTriggered` 防止成功后重复触发，`isMaskRequesting` 防止请求期间并发调用。系统蒙层交互由系统管理，未提供取消蒙层接口。负向场景和窗口证据要求见[性能与验证](performance-validation.md)。

## 可选：用户主动开启防窥

此部分是第 4 步 `if (!opened)` 分支的可选实现。只有选择应用内引导开启防窥时，才添加以下导入和请求标志；已有 `common` 导入时合并使用。

```typescript
import { common } from '@kit.AbilityKit';
import { requestAntiPeepOptions } from '../utils/AntiPeepUtils';
```

```typescript
private isRequestingAntiPeep: boolean = false;
```

**将下面的完整分支替换到第 4 步的 `if (!opened)` 位置。** 它位于开关查询之后、正常的初始状态读取和订阅代码之前。替换后该分支自行处理提示和返回，不再保留原分支中的默认 Toast；不要将这段代码追加到已开启分支或单独放在初始化函数之外。

```typescript
if (!opened) {
  if (this.isListenOn) {
    listenOffAntiPeepStatus();
    this.isListenOn = false;
  }
  if (deviceInfo.sdkApiVersion >= 23) {
    if (this.isRequestingAntiPeep) {
      return;
    }
    this.isRequestingAntiPeep = true;
    try {
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
      const result = await requestAntiPeepOptions(context);
      if (!this.isPageVisible) {
        return;
      }
      if (result === dlpAntiPeep.AntiPeepOptionsResult.SUCCESS ||
        result === dlpAntiPeep.AntiPeepOptionsResult.ALREADY_ON) {
        const info = getAntiPeepInfo();
        this.handleAntiPeepStatus(info);
        if (!this.isListenOn) {
          this.isListenOn = listenOnAntiPeepStatus(this.antiPeepCB);
        }
      } else {
        this.getUIContext().getPromptAction().showToast({ message: '防窥保护未开启，请检查人脸识别与系统设置' });
      }
    } catch (error) {
      this.getUIContext().getPromptAction().showToast({ message: '防窥保护未开启，请检查人脸识别与系统设置' });
    } finally {
      this.isRequestingAntiPeep = false;
    }
  } else {
    this.getUIContext().getPromptAction().showToast({ message: '请进入“设置 > 隐私和安全 > 防窥保护”开启当前应用开关' });
  }
  return;
}
```

设备能力和页面可见性已由第 4 步检查，分支内再次按 API23 区分设置弹框与系统设置指引。弹框由系统请求用户确认开启开关。SUCCESS、ALREADY_ON 后重查开关、读取初始状态并按需订阅；处理完成后直接返回，不递归调用初始化方法。FAIL 保留失败反馈，不在失败分支循环重弹。

请求标志由 `finally` 复位。工具已捕获的底层异常会记录日志并转换为 FAIL，未被封装捕获的异常由第 4 步外层 catch 处理；具体底层错误码从 `AntiPeepUtils` 日志定位，`1020600004` 表示未设置人脸识别。

## 7. 页面隐藏时停止处理，销毁时取消监听

```typescript
onPageHide(): void {
  this.isPageVisible = false;
}

aboutToDisappear(): void {
  this.isPageVisible = false;
  if (this.isListenOn) {
    listenOffAntiPeepStatus();
    this.isListenOn = false;
  }
}
```

选择系统蒙层时，在 `onPageHide()` 和 `aboutToDisappear()` 中各追加 `this.isSystemLayerTriggered = false;`，供重新进入页面时触发。`isMaskRequesting` 由请求自身的 `finally` 复位，不在请求未结束时提前清空。仅接入状态感知时不添加蒙层字段及其复位代码。

工具中的 `listenOffAntiPeepStatus()` 取消该事件的所有回调；存在其他订阅者时，使用 API 可选 callback 参数保存并取消当前订阅，避免影响其他页面。重新展示时由第 5 步启动第 4 步，重查最新状态。其他业务目标及可选风险提示见[场景选择](scenarios.md)和[设置与提示](settings-and-information.md)。

## 可选：明确放通

仅在满足权限、版本、设备和开关条件且已注册监听后，由用户明确操作调用 `dlpAntiPeep.passDlpAntiPeepInfo()`。调用后查询和通知持续返回非窥视，直到应用退出或设备锁屏，不代表实际窥视风险已经消失。仅需结束通知时使用 `off`，不自动增加放通入口，也不以放通作为初始化、异常恢复或关闭蒙层的手段。

## 结束提醒

实施结束后的最终交付说明必须再次提醒开发者：`ohos.permission.DLP_GET_HIDE_STATUS` 是受限 ACL 权限；仅本地调试时，自动签名同意权限申请即可；应用上架需使用此能力时，须在 HarmonyOS 开发者中心平台[申请 ACL 权限](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-apply-acl-0000002394212138)。实施前已提醒也不能省略。
