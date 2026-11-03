# 接入实现

## 工程发现

先确定文件/链接业务范围；需要 SDK 升级时按通用工作流确认。将以下方法合入目标页面或现有 VM，复用工程已有的窗口、业务数据与生命周期。

## 注册和清理

通过 `window.getLastWindow(context)` 获取页面所属窗口，再从 `getWindowProperties().id` 读取窗口 ID，注册和退订使用同一个回调。

在页面或 VM 文件中导入：

```typescript
import { common } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { deviceInfo } from '@kit.BasicServicesKit';
import { harmonyShare, systemShare } from '@kit.ShareKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
```

以下方法放入现有页面或 VM。`getGestureShareData()` 按下文文件或链接场景实现，从当前业务数据构造分享内容。

```typescript
private gestureCallback = (target: harmonyShare.SharableTarget): void => {
  try {
    const data = this.getGestureShareData();
    if (data) {
      target.share(data).catch(() => {
        hilog.error(0x0000, 'GesturesShare', 'share failed');
      });
    } else {
      target.reject(harmonyShare.SharableErrorCode.NO_CONTENT_ERROR).catch(() => {
        hilog.error(0x0000, 'GesturesShare', 'reject failed');
      });
    }
  } catch {
    hilog.error(0x0000, 'GesturesShare', 'share data or invocation failed');
  }
};

private startGestureShare(context: common.UIAbilityContext): void {
  if (!deviceInfo.apiAvailable('6.0.0') || !canIUse('SystemCapability.Collaboration.HarmonyShare')) {
    return;
  }
  window.getLastWindow(context).then((mainWindow) => {
    const mainWindowID: number = mainWindow.getWindowProperties().id;
    harmonyShare.on('gesturesShare', { windowId: mainWindowID }, this.gestureCallback);
  }).catch(() => {
    hilog.error(0x0000, 'GesturesShare', 'window query or registration failed');
  });
}

private stopGestureShare(context: common.UIAbilityContext): void {
  if (!deviceInfo.apiAvailable('6.0.0') || !canIUse('SystemCapability.Collaboration.HarmonyShare')) {
    return;
  }
  window.getLastWindow(context).then((mainWindow) => {
    const mainWindowID: number = mainWindow.getWindowProperties().id;
    harmonyShare.off('gesturesShare', { windowId: mainWindowID }, this.gestureCallback);
  }).catch(() => {
    hilog.error(0x0000, 'GesturesShare', 'window query or unregistration failed');
  });
}
```

在目标页面进入可见前台时注册监听，比如在 `aboutToAppear`, `onPageShow` 回调中注册，页面隐藏、离开 Tab、应用退后台或销毁时退订，比如在 `aboutToDisappear`, `onPageHide`；恢复前台时只为当前可分享页面重新注册。复用已有导航与前后台事件，避免同时在多个生命周期入口重复注册。`aboutToDisappear` 不覆盖应用退后台和路由缓存场景。

```typescript
// context 为当前页面所属 UIAbilityContext，复用工程已有上下文。
aboutToAppear() {
  this.startGestureShare(context);
}

// 页面隐藏、退后台或销毁。
aboutToDisappear() {
  this.stopGestureShare(context);
}
```

注册与退订使用同一页面所属上下文，确认两次获取的是同一目标窗口；多窗口工程按真实分享窗口核对。沿用已有可见状态判断，确保窗口查询返回时页面仍可分享。不带窗口的 API20 重载仅在工程已有明确作用域时使用；on/off 的重载与实际回调须配对。

## 数据构造与发出

收到 SharableTarget 后建议3秒内调用 `target.share(data)`。提前准备文件、封面和链接，回调中从当前业务数据构造 SharedData；不在回调中等待网络下载或视频转码。

文件场景导入：

```typescript
import { uniformTypeDescriptor } from '@kit.ArkData';
import { fileUri } from '@kit.CoreFileKit';
```

以下 `selectedFiles` 表示页面已有的选中文件集合，字段按工程现有类型映射；`path` 和 `thumbnailPath` 为已准备好的本地路径：

```typescript
private getGestureShareData(): systemShare.SharedData | undefined {
  let data: systemShare.SharedData | undefined = undefined;
  for (const file of this.selectedFiles) {
    const extension = file.name.substring(file.name.lastIndexOf('.'));
    const record: systemShare.SharedRecord = {
      utd: uniformTypeDescriptor.getUniformDataTypeByFilenameExtension(extension),
      uri: fileUri.getUriFromPath(file.path),
      thumbnailUri: fileUri.getUriFromPath(file.thumbnailPath),
      title: file.name,
      description: file.description
    };
    if (data) {
      data.addRecord(record);
    } else {
      data = new systemShare.SharedData(record);
    }
  }
  return data;
}
```

路径必须存在且可读；网络 URL 不冒充本地文件 URI，已是有效 URI 的数据不重复转换。UTD 按真实扩展名和业务类型生成，无匹配时按实际 SDK 文档处理。空选择返回 undefined，由事件回调以 NO_CONTENT_ERROR 拒绝。至少一条记录，最多500条且元数据总大小不超过200KB；原始缩略图字节字段 `thumbnail` 限32KB以下，不把文件体塞进元数据。文件与封面在传送结束前保持有效。

链接场景使用以下 `getGestureShareData()`。`currentContent` 表示页面已有的当前内容，`appLink` 为当前内容的 HTTPS 分享链接，`coverUri` 为已准备好的封面 URI；字段按实际业务类型映射：

```typescript
private getGestureShareData(): systemShare.SharedData | undefined {
  const content = this.currentContent;
  if (!content) {
    return undefined;
  }
  return new systemShare.SharedData({
    utd: uniformTypeDescriptor.UniformDataType.HYPERLINK,
    content: content.appLink,
    thumbnailUri: content.coverUri,
    title: content.title,
    description: content.description
  });
}
```

链接场景同样从 `@kit.ArkData` 导入 `uniformTypeDescriptor`。链接域名、路径和参数必须对应实际业务。如需接收端直达应用或元服务内内容，再按[可选 App Linking 配置](app-linking.md)接入。已有分享按钮继续使用原业务；隔空回调通过 `target.share` 发出数据。

同步异常和 share/reject Promise 拒绝均须处理，日志不输出敏感内容或令牌。分享失败保持原业务，不能写成“已发送”；已发起的传输不伪造取消 API。按[验证方案](performance-validation.md)完成静态、构建与双端验收，输出统一报告。

接入完成后，在交付回复中先展示[手机设置和真机操作步骤](compatibility.md#系统设置和信任)，明确华为分享、隔空传送开关的设置路径、双端信任确认与“一抓一放”验证。选择链接直达时，再按[开发者配置指导](app-linking.md#接入完成后向开发者展示)展示所选接收目标的配置步骤和官网链接，并提醒“App Linking 只能使用手动签名，不能使用自动签名”。区分已完成的工程接入、待开发者设置或配置项与待验证项。
