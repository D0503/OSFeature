# 动态快捷方式

基础 API14，仅在支持的 Phone、Tablet、PC/2in1 真机上调试，先读[兼容性](../compatibility.md)。应用内加桌支持静态资源、自定义资源两种方式，均采用：预先校验 → 保存校验结果 → 用户点击 → 系统确认 → 处理加桌结果。

单个应用通过此能力最多添加2个桌面快捷方式，与长按应用图标最多展示4个静态入口的限制分别核对。

## 开发准备

在实际提供加桌入口的页面文件中合并下列导入与成员。示例均为现有页面组件的成员片段，包名、UIAbility、资源及业务标识按真实工程替换；同一入口按已确认需求选择一种资源方式。

```typescript
import { productViewManager } from '@kit.AppGalleryKit';
import { common, Want } from '@kit.AbilityKit';
import { BusinessError, deviceInfo } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
```

在页面组件中保存本次校验的 tid、有效期限与请求状态：

```typescript
@State private tid: string = '';
private expiresAt: number = 0;
@State private requesting: boolean = false;
```

当 compatible 低于14时，在调用校验及请求接口之前检查系统版本；同时核对 `SystemCapability.AppGalleryService.Distribution.Recommendations`。不满足条件时保留原业务入口及既有不可用处理，具体回退见[已接入工程的回退方案](../compatibility-audit.md)。

## 以静态资源方式创建桌面快捷方式

### 1. 准备静态快捷方式配置

先按[静态路线的配置步骤](static-shortcut.md#配置与资产)完成：

- 在 `entry/src/main/resources/base/profile/shortcuts_config.json` 定义 shortcutId、label、icon 和 wants。
- 在 `entry/src/main/module.json5` 的目标 UIAbility `metadata` 中引用该 profile。
- 在当前模块资源目录中准备实际字符串、图标资源，按[图标规范](../assets-catalog.md#图标资源规范)核对格式与尺寸。

若入口模块实际目录不是 entry，按真实模块路径定位。此处复用静态配置，不要求额外选择静态路线进行整套实施。

以下参数与静态路线的配置示例对应：

| 配置内容 | 校验接口参数 |
|---|---|
| `shortcutId: "open_feature"` | `shortcutId = 'open_feature'` |
| `label: "$string:shortcut_label"` | `labelResName = 'shortcut_label'` |
| `icon: "$media:shortcut_icon"` | `iconResName = 'shortcut_icon'` |
| wants 中的目标与 parameters | Want 中的 bundleName、moduleName、abilityName、parameters 保持一致 |

传入资源名称时不带 `$string:`、`$media:` 前缀。shortcutId 不超过63字节，静态名称遵循配置的255字节限制。

### 2. 构造参数并调用静态资源校验重载

接口签名：

```typescript
checkPinShortcutPermitted(context: common.UIAbilityContext, shortcutId: string,
  want: Want, labelResName: string, iconResName: string): Promise<CheckShortcutResult>
```

在页面中增加异步方法，先取得当前页面的 UIAbilityContext，再构造与配置一致的参数并调用接口：

```typescript
async checkStaticShortcut(): Promise<void> {
  if (this.requesting) {
    return;
  }
  this.tid = '';
  this.expiresAt = 0;
  if (deviceInfo.sdkApiVersion < 14 ||
    !canIUse('SystemCapability.AppGalleryService.Distribution.Recommendations')) {
    return;
  }
  try {
    const uiContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
    // 对应shortcuts标签中的配置
    const shortcutId = 'open_feature';
    const labelResName = 'shortcut_label';
    const iconResName = 'shortcut_icon';
    const want: Want = {
      bundleName: 'com.example.application',
      moduleName: 'entry',
      abilityName: 'EntryAbility',
      parameters: {
        shortcutTarget: 'open_feature'
      }
    };
    const result = await productViewManager.checkPinShortcutPermitted(
      uiContext, shortcutId, want, labelResName, iconResName);
    if (result.code !== 0 || !result.tid || !result.expired || result.expired <= 0) {
      hilog.error(0x0000, 'DesktopShortcut', 'Shortcut check failed: %{public}d', result.code);
      return;
    }
    this.tid = result.tid;
    this.expiresAt = Date.now() + result.expired;
  } catch (error) {
    const err = error as BusinessError;
    hilog.error(0x0000, 'DesktopShortcut', 'Shortcut check error: %{public}d', err.code);
  }
}
```

### 3. 保存校验结果并提供加桌入口

`CheckShortcutResult` 的 `code` 为0表示校验成功；`tid` 为后续请求需要的事务ID，`expired` 为有效时间，单位ms；`limit` 表示允许应用添加快捷方式的数量。上例在拿到可用 tid 后保存本地期限，点击时再检查是否过期。

在页面及资源就绪、目标确定后预先调用 `checkStaticShortcut()`，例如合并到现有 `onPageShow()` 或业务初始化完成的位置。检查通过后再启用已确认的加桌入口；不要在点击后连续执行预校验和加桌请求。

### 4. 用户点击后请求加桌

将入口点击绑定到下文的[请求加桌方法](#请求加桌与结果处理)。调用 `requestNewPinShortcut` 时使用当前页面 UIAbilityContext 与本次保存的 tid，由系统展示确认框。用户同意后再处理成功结果；用户取消或拒绝时保留原业务状态。

## 以自定义资源方式创建桌面快捷方式

### 1. 准备名称与沙箱图标

采用[开发准备](#开发准备)中的相同导入与页面成员。自定义资源重载直接传入名称文本和图标文件路径，资源准备要求如下：

- shortcutId 不超过63字节，使用与当前业务目标对应的标识，同一目标重试时保持一致。
- label 为桌面名称文本，不超过255个字符；不是 `$string:` 资源索引。
- foregroundIcon 为应用沙箱内可读的 png/webp 文件路径，图标最大100KB。示例使用 `uiContext.filesDir + '/shortcut.png'`，调用前必须实际准备好该文件；不将资源索引或网络地址直接作为文件路径传入。
- backgroundIcon 是预留字段，当前传空字符串，不传背景图文件。

文件实际编码、大小及图标样式按[图标规范](../assets-catalog.md#图标资源规范)检查；校验及请求期间保持文件可读。此方式不要求在 shortcuts_config.json 中预置同名快捷方式。

### 2. 构造参数并调用自定义资源校验重载

接口签名：

```typescript
checkPinShortcutPermitted(context: common.UIAbilityContext, shortcutId: string,
  want: Want, label: string, foregroundIcon: string,
  backgroundIcon: string): Promise<CheckShortcutResult>
```

Want 仅使用 bundleName、moduleName、abilityName、parameters 四个字段；parameters 的键值仅支持字符串，长度均≤1024。参数格式与 wants 标签一致，目标必须是实际 UIAbility。

在页面中增加以下异步方法：

```typescript
async checkCustomShortcut(): Promise<void> {
  if (this.requesting) {
    return;
  }
  this.tid = '';
  this.expiresAt = 0;
  if (deviceInfo.sdkApiVersion < 14 ||
    !canIUse('SystemCapability.AppGalleryService.Distribution.Recommendations')) {
    return;
  }
  try {
    const uiContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
    const shortcutId = 'custom_open_feature';
    const label = '打开功能';
    const foregroundIcon = uiContext.filesDir + '/shortcut.png';
    const backgroundIcon = '';
    const want: Want = {
      bundleName: 'com.example.application',
      moduleName: 'entry',
      abilityName: 'EntryAbility',
      parameters: {
        shortcutTarget: 'open_feature'
      }
    };
    const result = await productViewManager.checkPinShortcutPermitted(
      uiContext, shortcutId, want, label, foregroundIcon, backgroundIcon);
    if (result.code !== 0 || !result.tid || !result.expired || result.expired <= 0) {
      hilog.error(0x0000, 'DesktopShortcut', 'Shortcut check failed: %{public}d', result.code);
      return;
    }
    this.tid = result.tid;
    this.expiresAt = Date.now() + result.expired;
  } catch (error) {
    const err = error as BusinessError;
    hilog.error(0x0000, 'DesktopShortcut', 'Shortcut check error: %{public}d', err.code);
  }
}
```

### 3. 保存校验结果并提供加桌入口

与静态资源方式相同，保存成功结果的 tid 和有效期限；参数变化时服务会覆盖生成新的 tid，参数不变时可能返回历史 tid 及剩余有效时间。

在名称、图标文件与 Want 确定后预先调用 `checkCustomShortcut()`。当前内容切换时清除旧校验结果，再对新目标重新校验；异步结果返回时确认页面仍有效且业务目标未变化。不同入口的校验结果分别保存，不共用其他目标的 tid。

### 4. 用户点击后请求加桌

调用与静态资源方式相同的[请求加桌方法](#请求加桌与结果处理)，传入当前页面 UIAbilityContext 和自定义资源校验返回的 tid。请求接口无需重新传入名称、图标与 Want，这些内容已绑定到校验结果。

## 请求加桌与结果处理

两种资源方式均使用以下接口：

```typescript
requestNewPinShortcut(context: common.UIAbilityContext, tid: string): Promise<void>
```

在页面中合并该方法，点击时核验 tid 与有效期，防止重复提交，并处理同步异常和 Promise 拒绝：

```typescript
async requestShortcut(): Promise<void> {
  if (this.requesting) {
    return;
  }
  if (deviceInfo.sdkApiVersion < 14 ||
    !canIUse('SystemCapability.AppGalleryService.Distribution.Recommendations')) {
    return;
  }
  if (!this.tid || Date.now() >= this.expiresAt) {
    this.tid = '';
    this.expiresAt = 0;
    return;
  }
  const tid = this.tid;
  this.tid = '';
  this.expiresAt = 0;
  this.requesting = true;
  try {
    const uiContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
    await productViewManager.requestNewPinShortcut(uiContext, tid);
    hilog.info(0x0000, 'DesktopShortcut', 'Shortcut added');
  } catch (error) {
    const err = error as BusinessError;
    hilog.error(0x0000, 'DesktopShortcut', 'Add shortcut error: %{public}d', err.code);
  } finally {
    this.requesting = false;
  }
}
```

将以下点击处理合并到已确认的加桌入口；静态资源方式先完成 `checkStaticShortcut()`，自定义资源方式先完成 `checkCustomShortcut()`：

```typescript
Button('添加至桌面')
  .enabled(this.tid.length > 0 && !this.requesting)
  .onClick(() => {
    this.requestShortcut();
  })
```

成功加桌后原 tid 失效，再次请求需重新校验。上例在请求前消费本地 tid，失败或拒绝后也先重新校验，再等待用户点击，避免复用过期事务或自动重复弹框。目标、名称、图标或 Want 变化，以及页面退出时清除尚未使用的 tid 和期限；请求进行中保持当前目标不变。日志之外的业务提示沿用工程现有处理。

tid 过期时清除本地校验结果，重新预校验并等待用户再次点击；用户拒绝时保留原业务状态，不自动重试。具体错误码、含义及排查步骤见[故障排查](../troubleshooting.md)。

需要查询或删除已加桌快捷方式时，再按[管理能力](../management.md)核验 API24 与用户需求。

## 点击快捷方式与验证

两种方式均通过 Want 拉起实际 UIAbility。按[静态路线的参数接收与页面分发](static-shortcut.md#业务页面与参数分发)处理 onCreate/onNewWant，复用已有鉴权、导航及冷暖启动流程。

按[验证方案](../performance-validation.md)在真机检查系统确认、实际桌面图标、点击后的业务目标，以及拒绝、过期和失败回退。校验成功或弹框出现不代表已完成加桌。
