---
title: "闪控窗恢复主窗口与导航"
summary: "说明从闪控窗的用户点击恢复主窗口，传递业务参数，并在宿主 onNewWant 中导航到目标页面。"
createdAt: "2026-11-10"
updatedAt: "2026-11-10"
tags: ["HarmonyOS", "闪控窗", "floatView", "restoreMainWindow", "onNewWant"]
---

# 闪控窗恢复主窗口与导航

使用当前闪控窗的系统控制器 `viewController`，类型为 `floatView.FloatViewController`。窗处于 `STARTED` 且由窗内用户点击触发时，调用 `restoreMainWindow()`。主窗口处于 `PAUSED` 或多任务状态时，请求可能失败。保留当前业务状态，并以接口结果判断是否恢复成功。 [闪控窗 API 参考](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-floatview)

## 恢复主窗口并传递参数

只需返回主窗口时可省略参数。在闪控窗的点击回调中调用：

```typescript
import { BusinessError } from '@kit.BasicServicesKit';

viewController.restoreMainWindow().catch((error: BusinessError) => {
  console.error(`Restore main window failed: ${error.code}, ${error.message}`);
});
```

恢复主窗口只负责将主窗口带到前台，业务页面跳转需在原有 `EntryAbility.onNewWant` 和页面导航逻辑中处理。需要打开指定业务详情时，改用带参调用。`wantParameters` 类型为 `Record<string, Object>`，`itemId` 取自当前业务条目。

```typescript
// 在闪控窗的用户点击回调中，itemId 为当前业务数据的标识。
const wantParameters: Record<string, Object> = { itemId: itemId };
viewController.restoreMainWindow(wantParameters).catch((error: BusinessError) => {
  console.error(`Restore main window failed: ${error.code}, ${error.message}`);
});
```

## 宿主接收参数并处理导航

恢复主窗口只负责将主窗口带到前台，业务页面跳转需在原有 `EntryAbility.onNewWant` 和页面导航逻辑中处理。在宿主 `UIAbility` 中引入 `Want`，把以下分支合入现有 `onNewWant`，保留其他启动来源的处理。

```typescript
import { Want } from '@kit.AbilityKit';
```

```typescript
onNewWant(want: Want): void {
  const itemId = want.parameters?.itemId;
  if (typeof itemId === 'string' && itemId.length > 0) {
    // 通过事件监听或应用全局UI状态存储AppStorageV2等其他方式方式进行具体页面跳转
    this.context.eventHub.emit('openBusinessDetail', itemId);
  }
}
```

主页面可通过同一 `UIAbilityContext` 的 `eventHub` 监听该事件，校验目标数据存在且可访问后，用已有 Router 或 Navigation 打开详情。事件名和参数按项目约定配置。监听须在发送前就绪，页面退出时用原回调退订。页面尚未就绪时，由已有状态管理暂存导航请求。参数缺失或无效时沿用原入口行为。

恢复主窗口后是否关闭闪控窗由业务决定。业务明确结束展示时，再向当前控制器发出停止请求，并在 `STOPPED` 后完成清理。验收时分别核对主窗口恢复结果和目标页面导航结果。
